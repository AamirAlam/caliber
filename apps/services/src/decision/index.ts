import type { Recommendation, RebalanceRequest, RiskScore, TreasuryPolicy } from '@helm/shared';

export interface DecisionInput {
  runId: string;
  policy: TreasuryPolicy;
  risk: RiskScore;
  /** A candidate rebalance the decision layer may choose to recommend. */
  proposal?: RebalanceRequest;
}

/**
 * Produce the run's recommendation. Deterministic policy compliance comes
 * first; the AI-authored `explanation` is descriptive only and never overrides
 * the policy verdict.
 * TODO: wire deterministic compliance + (optional) LLM explanation.
 */
export async function generateRecommendation(_input: DecisionInput): Promise<Recommendation> {
  throw new Error('generateRecommendation not implemented');
}
