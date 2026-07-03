import { describe, expect, it } from 'vitest';
import { Kysely, SqliteDialect } from 'kysely';
import BetterSqlite3 from 'better-sqlite3';
import type { AgentRunLog, Recommendation } from '@caliber/shared';
import type { Database, DB } from '../db.js';
import { migrate } from '../db.js';
import { SqlAuditStore } from './sql.js';

async function memoryStore(): Promise<SqlAuditStore> {
  const db: DB = new Kysely<Database>({
    dialect: new SqliteDialect({ database: new BetterSqlite3(':memory:') }),
  });
  await migrate(db);
  return new SqlAuditStore(db);
}

const run = (id: string, at: string): AgentRunLog => ({
  id,
  policyId: 'pol',
  stage: 'done',
  status: 'completed',
  action: 'hold',
  riskScore: 20,
  startedAt: at,
});

describe('SqlAuditStore (SQLite)', () => {
  it('persists and reads back a run', async () => {
    const store = await memoryStore();
    await store.saveRun(run('run_1', '2026-07-03T01:00:00.000Z'));
    expect(await store.getRun('run_1')).toMatchObject({ id: 'run_1', action: 'hold' });
  });

  it('lists runs newest-first', async () => {
    const store = await memoryStore();
    await store.saveRun(run('run_1', '2026-07-03T01:00:00.000Z'));
    await store.saveRun(run('run_2', '2026-07-03T02:00:00.000Z'));
    expect((await store.listRuns()).map((r) => r.id)).toEqual(['run_2', 'run_1']);
  });

  it('upserts on conflict (latest write wins)', async () => {
    const store = await memoryStore();
    await store.saveRun(run('run_1', '2026-07-03T01:00:00.000Z'));
    await store.saveRun({ ...run('run_1', '2026-07-03T01:00:00.000Z'), status: 'rejected' });
    const runs = await store.listRuns();
    expect(runs).toHaveLength(1);
    expect(runs[0]?.status).toBe('rejected');
  });

  it('round-trips a recommendation with its trace', async () => {
    const store = await memoryStore();
    const rec: Recommendation = {
      id: 'rec_1',
      runId: 'run_1',
      action: 'rebalance',
      compliancePassed: true,
      violations: [],
      riskScore: 73,
      explanation: 'de-risk',
      confidence: 0.85,
      agentProposed: true,
      trace: [{ step: 0, kind: 'decision', label: 'REBALANCE', ok: true }],
      createdAt: '2026-07-03T01:00:00.000Z',
    };
    await store.saveRecommendation(rec);
    const back = await store.getRecommendation('rec_1');
    expect(back?.trace?.[0]?.label).toBe('REBALANCE');
  });
});
