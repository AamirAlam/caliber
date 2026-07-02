import type {
  AgentRunLog,
  Recommendation,
  RiskScore,
  SignalSnapshot,
  TransactionRecord,
  TreasuryPolicy,
} from '@helm/shared';

export interface RunDetail {
  run: AgentRunLog;
  recommendation: Recommendation | null;
  transaction: TransactionRecord | null;
}

const BASE = process.env.NEXT_PUBLIC_SERVICES_URL ?? 'http://localhost:4000';

async function get<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export interface VaultState {
  paused: boolean;
  rebalanceCount: number;
  contractHash: string;
}

export const api = {
  getPolicy: () => get<TreasuryPolicy>('/policy'),
  getLatestSignals: () => get<SignalSnapshot>('/signals/latest'),
  getLatestRisk: () => get<RiskScore>('/risk/latest'),
  getLatestRecommendation: () => get<Recommendation>('/recommendation/latest'),
  getRuns: () => get<AgentRunLog[]>('/runs'),
  getRun: (id: string) => get<RunDetail>(`/runs/${id}`),
  getVaultState: () => get<VaultState>('/vault/state'),
  runStress: (active = true) =>
    post<{
      snapshot: SignalSnapshot | null;
      risk: RiskScore | null;
      recommendation: Recommendation | null;
      pendingRunId: string | null;
    }>('/scenario/stress', { active }),
  approve: (runId: string, approver = 'dashboard') =>
    post<{ run: AgentRunLog; tx: TransactionRecord }>('/approve', { runId, approver }),
};
