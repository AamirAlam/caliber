import { generateObject } from 'ai';
import type { LanguageModelV1 } from 'ai';
import { AGENT_ROLES, AgentReviewSchema } from '@caliber/shared';
import type {
  AgentReview,
  RebalanceRequest,
  RiskScore,
  SignalSnapshot,
  TreasuryPolicy,
} from '@caliber/shared';
import { evaluatePolicy } from '../policy/index.js';
import { deriveAllocations, liquidityBufferPct, projectAllocations } from '../portfolio.js';
import { config } from '../config.js';
import { log } from '../logger.js';

const REVIEWER_SYSTEM = `You are the ${AGENT_ROLES.reviewer.name} on Caliber's treasury team — an adversarial reviewer,
independent of the ${AGENT_ROLES.proposer.name} that designed this move. You are given the verified numbers below
(projected allocations, the buffer before/after, and the deterministic policy verdict) — reason from those, not from vibes.
Approve only if the move is clearly justified by the risk picture and is a proportionate, conservative response.
Veto (approved=false) if the move is oversized for the risk, barely moves the buffer, pushes an allocation toward a band edge,
or otherwise looks unjustified. Be skeptical; when genuinely unsure, veto with a specific concern grounded in the numbers.
You cannot approve anything the deterministic policy engine has already rejected — you can only add caution, never remove it.`;

export interface ReviewInput {
  policy: TreasuryPolicy;
  risk: RiskScore;
  snapshot: SignalSnapshot;
  rebalance: RebalanceRequest;
  rationale: string;
}

/**
 * Ground the reviewer with verified computations (projected allocations, the
 * buffer delta, and the deterministic verdict) so its judgment is evidence-based
 * rather than opinion. This is the verification, precomputed and handed over.
 */
export function reviewContext(input: ReviewInput): string {
  const { policy, risk, snapshot, rebalance } = input;
  const c = policy.constraints;
  const label = (id: string) => policy.allocations.find((a) => a.assetId === id)?.label ?? id;
  const current = deriveAllocations(policy, snapshot);
  const projected = projectAllocations(current, rebalance);
  const curBuf = liquidityBufferPct(snapshot);
  const stableId = policy.allocations.find((a) => a.assetClass === 'stablecoin')?.assetId;
  const projBuf = projected.find((w) => w.assetId === stableId)?.weight ?? 0;
  const verdict = evaluatePolicy(policy, risk, snapshot, rebalance);

  return [
    `Mandate: risk ceiling ${c.maxRiskScore}/100, liquidity floor ${(c.minLiquidityBufferPct * 100).toFixed(0)}%, single-rebalance cap ${(c.maxSingleRebalancePct * 100).toFixed(0)}%.`,
    `Liquidity buffer: ${(curBuf * 100).toFixed(1)}% now → ${(projBuf * 100).toFixed(1)}% after the move.`,
    `Projected allocations: ${projected.map((w) => `${label(w.assetId)} ${(w.weight * 100).toFixed(1)}%`).join(', ')}.`,
    `Deterministic policy check on this exact move: ${verdict.length === 0 ? 'PASSES all constraints' : `FAILS — ${verdict.map((v) => v.detail).join('; ')}`}.`,
  ].join('\n');
}

/**
 * One independent review of a policy-compliant rebalance. Fails **closed** — on
 * error it vetoes (halt for human review) rather than waving the move through.
 * The deterministic gate and human approval still stand regardless.
 */
export async function reviewProposal(
  model: LanguageModelV1,
  input: ReviewInput,
): Promise<AgentReview> {
  try {
    const { object } = await generateObject({
      model,
      schema: AgentReviewSchema,
      system: REVIEWER_SYSTEM,
      prompt: `Review this proposed rebalance for the "${input.policy.name}" treasury.

Risk score: ${input.risk.score}/100 (${input.risk.band})
Risk factors: ${input.risk.factors.map((f) => `${f.label}=${f.contribution}`).join(', ')}
Proposed legs: ${input.rebalance.legs
        .map((l) => `${(l.weight * 100).toFixed(1)}% ${l.fromAssetId} → ${l.toAssetId}`)
        .join('; ')}
Proposer's rationale: ${input.rationale}

Verified numbers:
${reviewContext(input)}

Return your verdict.`,
    });
    return object;
  } catch (err) {
    log.warn('risk officer unavailable; failing closed (veto)', { err: String(err) });
    return {
      approved: false,
      concern: 'Risk Officer unavailable — halting for human review.',
      severity: 'medium',
    };
  }
}

/** Aggregate a panel of independent reviews into one verdict: majority veto wins. */
export function aggregatePanel(reviews: AgentReview[]): AgentReview {
  const vetoes = reviews.filter((r) => !r.approved);
  const approved = vetoes.length < Math.ceil(reviews.length / 2);
  if (approved) {
    return { approved: true, concern: `${reviews.length}/${reviews.length} approved.`, severity: 'low' };
  }
  const order = { low: 0, medium: 1, high: 2 } as const;
  const worst = vetoes.reduce((a, b) => (order[b.severity] > order[a.severity] ? b : a));
  return {
    approved: false,
    concern: `${vetoes.length} of ${reviews.length} vetoed — ${worst.concern}`,
    severity: worst.severity,
  };
}

/** Run N independent reviews in parallel and return the aggregated verdict. */
export async function reviewPanel(
  model: LanguageModelV1,
  input: ReviewInput,
  votes = config.ai.reviewVotes,
): Promise<AgentReview> {
  const n = Math.max(1, votes);
  const reviews = await Promise.all(Array.from({ length: n }, () => reviewProposal(model, input)));
  return aggregatePanel(reviews);
}
