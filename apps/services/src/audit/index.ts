import type {
  AgentRunLog,
  Recommendation,
  SignalSnapshot,
  TransactionRecord,
} from '@helm/shared';

/**
 * Append-only audit store. The audit trail is what makes Helm's decisions
 * explainable and reviewable. Back this with Postgres/SQLite or an object store.
 */
export interface AuditStore {
  saveSnapshot(snapshot: SignalSnapshot): Promise<void>;
  saveRecommendation(rec: Recommendation): Promise<void>;
  saveTransaction(tx: TransactionRecord): Promise<void>;
  saveRun(run: AgentRunLog): Promise<void>;
  listRuns(): Promise<AgentRunLog[]>;
}

/** Scaffold in-memory implementation. TODO: persist to a real store. */
export class InMemoryAuditStore implements AuditStore {
  async saveSnapshot(_snapshot: SignalSnapshot): Promise<void> {
    // TODO
  }
  async saveRecommendation(_rec: Recommendation): Promise<void> {
    // TODO
  }
  async saveTransaction(_tx: TransactionRecord): Promise<void> {
    // TODO
  }
  async saveRun(_run: AgentRunLog): Promise<void> {
    // TODO
  }
  async listRuns(): Promise<AgentRunLog[]> {
    // TODO
    return [];
  }
}
