import type {
  AgentRunLog,
  RebalanceRequest,
  Recommendation,
  RiskScore,
  SignalSnapshot,
  TreasuryWorkspace,
  TransactionRecord,
} from '@caliber/shared';
import { config, isProductionLike } from '../config.js';
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
  savePendingApproval(pending: PendingApproval): Promise<void>;
  deletePendingApproval(runId: string): Promise<void>;
  saveWorkspace(workspace: TreasuryWorkspace): Promise<void>;
  listRuns(): Promise<AgentRunLog[]>;
  listWorkspaces(): Promise<TreasuryWorkspace[]>;
  getRun(id: string): Promise<AgentRunLog | undefined>;
  getSnapshot(id: string): Promise<SignalSnapshot | undefined>;
  getRecommendation(id: string): Promise<Recommendation | undefined>;
  getTransaction(id: string): Promise<TransactionRecord | undefined>;
  getPendingApproval(runId: string): Promise<PendingApproval | undefined>;
  getWorkspace(id: string): Promise<TreasuryWorkspace | undefined>;
}

export interface PendingApproval {
  runId: string;
  recommendation: Recommendation;
  rebalance: RebalanceRequest;
  approvalToken: string;
  snapshot: SignalSnapshot;
  risk: RiskScore;
  createdAt: string;
}

/** In-memory implementation. Keyed by id; `listRuns` returns newest-first. */
export class InMemoryAuditStore implements AuditStore {
  private snapshots = new Map<string, SignalSnapshot>();
  private recommendations = new Map<string, Recommendation>();
  private transactions = new Map<string, TransactionRecord>();
  private runs = new Map<string, AgentRunLog>();
  private pending = new Map<string, PendingApproval>();
  private workspaces = new Map<string, TreasuryWorkspace>();

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
  async savePendingApproval(pending: PendingApproval): Promise<void> {
    this.pending.set(pending.runId, { ...pending });
  }
  async deletePendingApproval(runId: string): Promise<void> {
    this.pending.delete(runId);
  }
  async saveWorkspace(workspace: TreasuryWorkspace): Promise<void> {
    this.workspaces.set(workspace.id, { ...workspace });
  }
  async listRuns(): Promise<AgentRunLog[]> {
    return [...this.runs.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }
  async listWorkspaces(): Promise<TreasuryWorkspace[]> {
    return [...this.workspaces.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async getRun(id: string): Promise<AgentRunLog | undefined> {
    return this.runs.get(id);
  }
  async getSnapshot(id: string): Promise<SignalSnapshot | undefined> {
    return this.snapshots.get(id);
  }
  async getRecommendation(id: string): Promise<Recommendation | undefined> {
    return this.recommendations.get(id);
  }
  async getTransaction(id: string): Promise<TransactionRecord | undefined> {
    return this.transactions.get(id);
  }
  async getPendingApproval(runId: string): Promise<PendingApproval | undefined> {
    return this.pending.get(runId);
  }
  async getWorkspace(id: string): Promise<TreasuryWorkspace | undefined> {
    return this.workspaces.get(id);
  }
}

/**
 * Build the configured audit store: SQL-backed (SQLite/Postgres) when a database
 * is configured, otherwise in-memory. Runs migrations on first connect.
 */
export async function createAuditStore(): Promise<AuditStore> {
  if (config.db.kind === 'memory') {
    log.info('audit store: in-memory (no database configured)');
    return new InMemoryAuditStore();
  }
  // A database problem must never take the API down — degrade to in-memory
  // (loudly) rather than crashing on boot with a 502.
  try {
    const db = await createKysely();
    if (!db) return new InMemoryAuditStore();
    await migrate(db);
    const target = config.db.kind === 'postgres' ? 'postgres' : config.db.path;
    log.info('audit store: sql', { backend: config.db.kind, target });
    return new SqlAuditStore(db);
  } catch (err) {
    if (isProductionLike()) throw err;
    log.error('audit store: database unavailable — falling back to in-memory (data will NOT persist)', {
      backend: config.db.kind,
      err: String(err),
    });
    return new InMemoryAuditStore();
  }
}
