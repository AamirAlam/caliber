import type {
  AgentReview,
  RebalanceRequest,
  Recommendation,
  RiskScore,
  SignalSnapshot,
  TraceStep,
  TreasuryPolicy,
} from '@caliber/shared';
import { evaluatePolicy, type PolicyViolation } from '../policy/index.js';
import { deriveAllocations, liquidityBufferPct, TOTAL_TREASURY_USD } from '../portfolio.js';

export interface DecisionInput {
  runId: string;
  policy: TreasuryPolicy;
  risk: RiskScore;
  snapshot: SignalSnapshot;
}

/**
 * Build a candidate de-risking rebalance: move value from the most over-weight
 * non-stable asset into the stablecoin buffer, sized to restore the buffer just
 * above the floor and capped by the single-rebalance limit. Deterministic.
 */
export function proposeRebalance(
  policy: TreasuryPolicy,
  snapshot: SignalSnapshot,
  runId: string,
): RebalanceRequest | undefined {
  const stable = policy.allocations.find((a) => a.assetClass === 'stablecoin');
  const current = deriveAllocations(policy, snapshot);
  const overweight = current
    .filter((w) => policy.allocations.find((a) => a.assetId === w.assetId)?.assetClass !== 'stablecoin')
    .sort((a, b) => b.weight - a.weight)[0];
  if (!stable || !overweight) return undefined;

  const buffer = liquidityBufferPct(snapshot);
  const targetBuffer = policy.constraints.minLiquidityBufferPct + 0.07;
  const moveWeight = Math.min(
    policy.constraints.maxSingleRebalancePct,
    Math.max(0, Number((targetBuffer - buffer).toFixed(4))),
  );
  if (moveWeight <= 0) return undefined;

  return {
    id: `reb_${runId}`,
    policyId: policy.id,
    legs: [
      {
        fromAssetId: overweight.assetId,
        toAssetId: stable.assetId,
        amount: String(Math.round(moveWeight * TOTAL_TREASURY_USD)),
        weight: moveWeight,
      },
    ],
    createdAt: new Date().toISOString(),
  };
}

export interface Decision {
  action: Recommendation['action'];
  compliancePassed: boolean;
  violations: PolicyViolation[];
  rebalance?: RebalanceRequest;
}

/**
 * Deterministic action selection — the authoritative verdict. Hold if compliant;
 * otherwise propose a de-risking rebalance and recommend it if executing it is
 * compliant; if no compliant fix exists, halt. The AI never sets this.
 */
export function decideAction(input: DecisionInput): Decision {
  const { policy, risk, snapshot, runId } = input;
  const holdViolations = evaluatePolicy(policy, risk, snapshot);
  if (holdViolations.length === 0) {
    return { action: 'hold', compliancePassed: true, violations: [] };
  }

  const rebalance = proposeRebalance(policy, snapshot, runId);
  if (rebalance) {
    const proposalViolations = evaluatePolicy(policy, risk, snapshot, rebalance);
    if (proposalViolations.length === 0) {
      return { action: 'rebalance', compliancePassed: true, violations: [], rebalance };
    }
    return { action: 'halt', compliancePassed: false, violations: proposalViolations };
  }
  return { action: 'halt', compliancePassed: false, violations: holdViolations };
}

/** Deterministic fallback explanation used when no LLM is configured. */
export function fallbackExplanation(input: DecisionInput, decision: Decision): string {
  const { risk } = input;
  if (decision.action === 'hold') {
    return `Holding. Risk is ${risk.band} (${risk.score}/100) and all allocations sit within their target bands above the liquidity floor. No rebalance is warranted.`;
  }
  if (decision.action === 'rebalance' && decision.rebalance) {
    const leg = decision.rebalance.legs[0]!;
    return `Recommending a de-risking rebalance: move ${(leg.weight * 100).toFixed(
      1,
    )}% from ${leg.fromAssetId} into ${leg.toAssetId}. Risk is ${risk.band} (${risk.score}/100); the move restores the liquidity buffer above the policy floor and brings allocations back within band, and it stays within the single-rebalance cap.`;
  }
  return `Halting. Risk is ${risk.band} (${risk.score}/100) and no policy-compliant rebalance is available (${decision.violations
    .map((v) => v.constraint)
    .join(', ')}). Awaiting review.`;
}

/** Assemble the final Recommendation from the deterministic decision + an explanation. */
export function buildRecommendation(
  input: DecisionInput,
  decision: Decision,
  explanation: string,
  extra?: { agentProposed?: boolean; review?: AgentReview; trace?: TraceStep[] },
): Recommendation {
  return {
    id: `rec_${input.runId}`,
    runId: input.runId,
    action: decision.action,
    compliancePassed: decision.compliancePassed,
    violations: decision.violations,
    riskScore: input.risk.score,
    rebalance: decision.rebalance,
    explanation,
    confidence: decision.compliancePassed ? 0.85 : 0.95,
    agentProposed: extra?.agentProposed ?? false,
    review: extra?.review,
    trace: extra?.trace ?? [],
    createdAt: new Date().toISOString(),
  };
}

/** Asset ids the policy recognizes — used to reject an agent proposing unknown assets. */
export function knownAssetIds(policy: TreasuryPolicy): Set<string> {
  return new Set(policy.allocations.map((a) => a.assetId));
}

/**
 * Build a concrete RebalanceRequest from agent-proposed legs, converting each
 * weight into a USD/motes amount against the notional treasury size.
 */
export function buildRebalanceFromLegs(
  policy: TreasuryPolicy,
  runId: string,
  legs: { fromAssetId: string; toAssetId: string; weight: number }[],
): RebalanceRequest {
  return {
    id: `reb_${runId}`,
    policyId: policy.id,
    legs: legs.map((l) => ({
      fromAssetId: l.fromAssetId,
      toAssetId: l.toAssetId,
      weight: l.weight,
      amount: String(Math.round(l.weight * TOTAL_TREASURY_USD)),
    })),
    createdAt: new Date().toISOString(),
  };
}
