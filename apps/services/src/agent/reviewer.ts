import { generateObject } from 'ai';
import type { LanguageModelV1 } from 'ai';
import { AgentReviewSchema } from '@caliber/shared';
import type { AgentReview, RebalanceRequest, RiskScore, TreasuryPolicy } from '@caliber/shared';
import { log } from '../logger.js';

const REVIEWER_SYSTEM = `You are Caliber's Risk Officer — an adversarial reviewer, independent of the agent that proposed this move.
Your job is to catch bad rebalances before a human ever sees them. Approve only if the move is clearly justified by the risk
picture and consistent with a conservative treasury mandate. Veto (approved=false) if the move looks unjustified, oversized for
the risk, or could increase exposure. Be skeptical; when unsure, veto with a clear concern. You cannot approve anything the
deterministic policy engine has already rejected — you can only add caution, never remove it.`;

/**
 * Second agent: independently reviews a policy-compliant rebalance proposal.
 * A veto downgrades the action upstream. Fails open (approves with a note) on
 * error — the human approval gate and deterministic checks still stand.
 */
export async function reviewProposal(
  model: LanguageModelV1,
  input: { policy: TreasuryPolicy; risk: RiskScore; rebalance: RebalanceRequest; rationale: string },
): Promise<AgentReview> {
  try {
    const { object } = await generateObject({
      model,
      schema: AgentReviewSchema,
      system: REVIEWER_SYSTEM,
      prompt: `Review this proposed rebalance for a "${input.policy.name}" treasury.

Risk score: ${input.risk.score}/100 (${input.risk.band})
Risk factors: ${input.risk.factors.map((f) => `${f.label}=${f.contribution}`).join(', ')}
Proposed legs: ${input.rebalance.legs
        .map((l) => `${(l.weight * 100).toFixed(1)}% ${l.fromAssetId} → ${l.toAssetId}`)
        .join('; ')}
Proposer's rationale: ${input.rationale}

Return your verdict.`,
    });
    return object;
  } catch (err) {
    log.warn('risk reviewer unavailable; failing open', { err: String(err) });
    return { approved: true, concern: 'Risk reviewer unavailable; deferred to human approval.', severity: 'low' };
  }
}
