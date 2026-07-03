import type { AgentRunLog } from '@caliber/shared';

/** A compact summary of one prior cycle — the agent's short-term memory unit. */
export interface DecisionMemoryEntry {
  runId: string;
  action?: 'hold' | 'rebalance' | 'halt';
  risk?: number;
  status: AgentRunLog['status'];
}

/**
 * Short-term working memory: the last N decisions, newest-first, excluding the
 * current run. This is a recency window (sort + take N), not retrieval — no
 * embeddings or similarity search needed for a small ordered time series.
 */
export function summarizeHistory(runs: AgentRunLog[], currentRunId: string, n = 5): DecisionMemoryEntry[] {
  return runs
    .filter((r) => r.id !== currentRunId && r.action !== undefined)
    .slice(0, n)
    .map((r) => ({ runId: r.id, action: r.action, risk: r.riskScore, status: r.status }));
}

/**
 * Render the memory as a compact context block for the Proposer's prompt.
 * Oldest→newest so the risk trend reads naturally. Empty string when no history.
 */
export function formatMemory(entries: DecisionMemoryEntry[]): string {
  if (entries.length === 0) return '';
  const ordered = [...entries].reverse();
  const trend = ordered.map((e) => e.risk ?? '?').join(' → ');
  const lines = ordered.map((e) => `- ${e.action ?? '—'} at risk ${e.risk ?? '?'} (${e.status})`);
  return `Recent cycles (oldest → newest), risk trend ${trend}:\n${lines.join('\n')}`;
}

/** Ordered risk scores (oldest→newest) for a UI trend line. */
export function riskTrend(runs: AgentRunLog[], n = 8): number[] {
  return runs
    .filter((r) => typeof r.riskScore === 'number')
    .slice(0, n)
    .map((r) => r.riskScore as number)
    .reverse();
}
