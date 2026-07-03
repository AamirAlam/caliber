import type {
  AgentRunLog,
  Recommendation,
  SignalSnapshot,
  TransactionRecord,
} from '@caliber/shared';
import { config } from '../config.js';
import { createKysely, migrate } from '../db.js';
import { log } from '../logger.js';
import { SqlAuditStore } from './sql.js';

/**
 * Append-only audit store. The audit trail is what makes Caliber's decisions
 * explainable and reviewable. Backed by SQLite (dev) or Postgres (production);
 * falls back to in-memory when no database is configured.
 */
export interface AuditStore {
  saveSnapshot(snapshot: SignalSnapshot): Promise<void>;
  saveRecommendation(rec: Recommendation): Promise<void>;
  saveTransaction(tx: TransactionRecord): Promise<void>;
  saveRun(run: AgentRunLog): Promise<void>;
  listRuns(): Promise<AgentRunLog[]>;
  getRun(id: string): Promise<AgentRunLog | undefined>;
  getRecommendation(id: string): Promise<Recommendation | undefined>;
  getTransaction(id: string): Promise<TransactionRecord | undefined>;
}

/** In-memory implementation. Keyed by id; `listRuns` returns newest-first. */
export class InMemoryAuditStore implements AuditStore {
  private snapshots = new Map<string, SignalSnapshot>();
  private recommendations = new Map<string, Recommendation>();
  private transactions = new Map<string, TransactionRecord>();
  private runs = new Map<string, AgentRunLog>();

  async saveSnapshot(snapshot: SignalSnapshot): Promise<void> {
    this.snapshots.set(snapshot.id, snapshot);
  }
  async saveRecommendation(rec: Recommendation): Promise<void> {
    this.recommendations.set(rec.id, rec);
  }
  async saveTransaction(tx: TransactionRecord): Promise<void> {
    this.transactions.set(tx.id, tx);
  }
  async saveRun(run: AgentRunLog): Promise<void> {
    this.runs.set(run.id, { ...run });
  }
  async listRuns(): Promise<AgentRunLog[]> {
    return [...this.runs.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }
  async getRun(id: string): Promise<AgentRunLog | undefined> {
    return this.runs.get(id);
  }
  async getRecommendation(id: string): Promise<Recommendation | undefined> {
    return this.recommendations.get(id);
  }
  async getTransaction(id: string): Promise<TransactionRecord | undefined> {
    return this.transactions.get(id);
  }
}

/**
 * Build the configured audit store: SQL-backed (SQLite/Postgres) when a database
 * is configured, otherwise in-memory. Runs migrations on first connect.
 */
export async function createAuditStore(): Promise<AuditStore> {
  const db = await createKysely();
  if (!db) {
    log.info('audit store: in-memory (no database configured)');
    return new InMemoryAuditStore();
  }
  await migrate(db);
  const target = config.db.kind === 'postgres' ? 'postgres' : config.db.path;
  log.info('audit store: sql', { backend: config.db.kind, target });
  return new SqlAuditStore(db);
}
