import type {
  AgentRunLog,
  Recommendation,
  SignalSnapshot,
  TransactionRecord,
} from '@caliber/shared';
import type { DB } from '../db.js';
import type { AuditStore } from './index.js';

/**
 * SQL-backed audit store over Kysely — works identically against SQLite (dev)
 * and Postgres (production). Records are upserted by id; `listRuns` orders by
 * the stored `started_at` column, newest-first.
 */
export class SqlAuditStore implements AuditStore {
  constructor(private readonly db: DB) {}

  async saveSnapshot(snapshot: SignalSnapshot): Promise<void> {
    await this.upsert('snapshots', snapshot.id, snapshot);
  }
  async saveRecommendation(rec: Recommendation): Promise<void> {
    await this.upsert('recommendations', rec.id, rec);
  }
  async saveTransaction(tx: TransactionRecord): Promise<void> {
    await this.upsert('transactions', tx.id, tx);
  }
  async saveRun(run: AgentRunLog): Promise<void> {
    const data = JSON.stringify(run);
    await this.db
      .insertInto('runs')
      .values({ id: run.id, started_at: run.startedAt, data })
      .onConflict((oc) => oc.column('id').doUpdateSet({ started_at: run.startedAt, data }))
      .execute();
  }

  async listRuns(): Promise<AgentRunLog[]> {
    const rows = await this.db
      .selectFrom('runs')
      .select('data')
      .orderBy('started_at', 'desc')
      .execute();
    return rows.map((r) => JSON.parse(r.data) as AgentRunLog);
  }
  async getRun(id: string): Promise<AgentRunLog | undefined> {
    return this.getById('runs', id);
  }
  async getRecommendation(id: string): Promise<Recommendation | undefined> {
    return this.getById('recommendations', id);
  }
  async getTransaction(id: string): Promise<TransactionRecord | undefined> {
    return this.getById('transactions', id);
  }

  private async upsert(
    table: 'snapshots' | 'recommendations' | 'transactions',
    id: string,
    value: unknown,
  ): Promise<void> {
    const data = JSON.stringify(value);
    await this.db
      .insertInto(table)
      .values({ id, data })
      .onConflict((oc) => oc.column('id').doUpdateSet({ data }))
      .execute();
  }

  private async getById<T>(
    table: 'runs' | 'recommendations' | 'transactions',
    id: string,
  ): Promise<T | undefined> {
    const row = await this.db
      .selectFrom(table)
      .select('data')
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? (JSON.parse(row.data) as T) : undefined;
  }
}
