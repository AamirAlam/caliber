import type { RebalanceRequest, RiskScore, SignalSnapshot, TreasuryPolicy } from '@helm/shared';

export interface PolicyViolation {
  constraint: string;
  detail: string;
}

/**
 * Deterministic risk scoring from a signal snapshot (per-factor, explainable).
 * TODO: implement scoring model.
 */
export function scoreRisk(_snapshot: SignalSnapshot): RiskScore {
  throw new Error('scoreRisk not implemented');
}

/**
 * Deterministic policy evaluation — the ONLY gate on execution. Returns the
 * set of violations for a proposed rebalance. Must never depend on AI output.
 * TODO: implement constraint checks (allocation bands, liquidity floor, risk ceiling).
 */
export function evaluatePolicy(
  _policy: TreasuryPolicy,
  _risk: RiskScore,
  _proposal?: RebalanceRequest,
): PolicyViolation[] {
  throw new Error('evaluatePolicy not implemented');
}
