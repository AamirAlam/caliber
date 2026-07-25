import type {
  AgentRunLog,
  Recommendation,
  SignalSnapshot,
  TreasuryWorkspace,
  TransactionRecord,
} from '@caliber/shared';
import type { DB } from '../db.js';
import type { AuditStore, PendingApproval } from './index.js';

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
  async savePendingApproval(pending: PendingApproval): Promise<void> {
    const data = JSON.stringify(pending);
    await this.db
      .insertInto('pending_approvals')
      .values({ run_id: pending.runId, created_at: pending.createdAt, data })
      .onConflict((oc) => oc.column('run_id').doUpdateSet({ created_at: pending.createdAt, data }))
      .execute();
  }
  async deletePendingApproval(runId: string): Promise<void> {
    await this.db.deleteFrom('pending_approvals').where('run_id', '=', runId).execute();
  }
  async saveWorkspace(workspace: TreasuryWorkspace): Promise<void> {
    const data = JSON.stringify(workspace);
    await this.db
      .insertInto('workspaces')
      .values({ id: workspace.id, created_at: workspace.createdAt, data })
      .onConflict((oc) => oc.column('id').doUpdateSet({ created_at: workspace.createdAt, data }))
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
  async listWorkspaces(): Promise<TreasuryWorkspace[]> {
    const rows = await this.db
      .selectFrom('workspaces')
      .select('data')
      .orderBy('created_at', 'desc')
      .execute();
    return rows.map((r) => JSON.parse(r.data) as TreasuryWorkspace);
  }
  async getRun(id: string): Promise<AgentRunLog | undefined> {
    return this.getById('runs', id);
  }
  async getWorkspace(id: string): Promise<TreasuryWorkspace | undefined> {
    return this.getById('workspaces', id);
  }
  async getSnapshot(id: string): Promise<SignalSnapshot | undefined> {
    return this.getById('snapshots', id);
  }
  async getRecommendation(id: string): Promise<Recommendation | undefined> {
    return this.getById('recommendations', id);
  }
  async getTransaction(id: string): Promise<TransactionRecord | undefined> {
    return this.getById('transactions', id);
  }
  async getPendingApproval(runId: string): Promise<PendingApproval | undefined> {
    const row = await this.db
      .selectFrom('pending_approvals')
      .select('data')
      .where('run_id', '=', runId)
      .executeTakeFirst();
    return row ? (JSON.parse(row.data) as PendingApproval) : undefined;
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
    table: 'runs' | 'snapshots' | 'recommendations' | 'transactions' | 'workspaces',
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
