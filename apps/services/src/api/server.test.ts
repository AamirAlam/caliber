import { describe, expect, it } from 'vitest';
import type { AgentRunLog, TransactionRecord } from '@caliber/shared';
import { InMemoryAuditStore } from '../audit/index.js';
import { samplePolicy } from '../samplePolicy.js';
import type { Scheduler } from '../scheduler/index.js';
import { AppState } from '../state.js';
import { buildServer } from './server.js';

function scheduler(): Scheduler {
  return {
    status: () => ({
      running: false,
      seq: 7,
      intervalMs: 60000,
      lastStartedAt: '2026-07-20T00:00:00.000Z',
      lastSucceededAt: '2026-07-20T00:01:00.000Z',
      lastFailedAt: undefined,
      lastError: undefined,
    }),
    runNow: async () => 7,
  } as Scheduler;
}

async function testServer() {
  const audit = new InMemoryAuditStore();
  const state = new AppState(samplePolicy);
  const app = buildServer(
    {
      audit,
      state,
      sources: [],
      executor: {
        submit: async () => {
          throw new Error('not used');
        },
        waitForFinalization: async () => 'pending',
      },
    },
    scheduler(),
  );
  return { app, audit, state };
}

describe('service observability API', () => {
  it('returns an operational status snapshot', async () => {
    const { app, audit, state } = await testServer();
    const run: AgentRunLog = {
      id: 'run_1',
      policyId: samplePolicy.id,
      stage: 'done',
      status: 'completed',
      action: 'hold',
      riskScore: 12,
      startedAt: '2026-07-20T00:00:00.000Z',
      endedAt: '2026-07-20T00:01:00.000Z',
    };
    state.latestRisk = {
      score: 12,
      band: 'low',
      factors: [],
      snapshotId: 'snap_1',
      computedAt: '2026-07-20T00:00:30.000Z',
    };
    await audit.saveRun(run);

    const res = await app.inject({ method: 'GET', url: '/status' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      status: 'ok',
      policy: { id: samplePolicy.id },
      scheduler: { seq: 7 },
      latestRun: { id: 'run_1', status: 'completed', action: 'hold' },
      latestRisk: { score: 12, band: 'low' },
    });
  });

  it('exports metrics for runs, risk, pending approval, and deploy timing', async () => {
    const { app, audit, state } = await testServer();
    const tx: TransactionRecord = {
      id: 'tx_1',
      deployHash: 'deploy-hash',
      status: 'finalized',
      entryPoint: 'record_rebalance',
      network: 'casper-testnet',
      submittedAt: '2026-07-20T00:00:00.000Z',
      finalizedAt: '2026-07-20T00:02:00.000Z',
    };
    await audit.saveTransaction(tx);
    await audit.saveRun({
      id: 'run_2',
      policyId: samplePolicy.id,
      stage: 'done',
      status: 'completed',
      action: 'rebalance',
      riskScore: 72,
      transactionId: tx.id,
      deployHash: tx.deployHash,
      startedAt: '2026-07-20T00:00:00.000Z',
      endedAt: '2026-07-20T00:02:00.000Z',
    });
    state.latestRisk = {
      score: 72,
      band: 'critical',
      factors: [],
      snapshotId: 'snap_2',
      computedAt: '2026-07-20T00:00:30.000Z',
    };

    const res = await app.inject({ method: 'GET', url: '/metrics' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('caliber_runs_total{status="completed",action="rebalance"} 1');
    expect(res.body).toContain('caliber_latest_risk_score 72');
    expect(res.body).toContain('caliber_pending_approval 0');
    expect(res.body).toContain('caliber_latest_run_started_unixtime 1784505600');
  });
});
