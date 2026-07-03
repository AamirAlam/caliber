import { generateText, tool, type LanguageModelV1 } from 'ai';
import { z } from 'zod';
import type { AgentReview, RebalanceRequest, Recommendation, RiskScore, TreasuryPolicy } from '@caliber/shared';
import {
  buildRebalanceFromLegs,
  buildRecommendation,
  decideAction,
  fallbackExplanation,
  knownAssetIds,
  type Decision,
  type DecisionInput,
} from '../decision/index.js';
import { evaluatePolicy, type PolicyViolation } from '../policy/index.js';
import { log } from '../logger.js';
import { resolveModel } from './model.js';
import { getCasperMcpTools } from './mcp.js';
import { reviewProposal } from './reviewer.js';
import { buildTools, legSchema, type VaultState } from './tools.js';

const PROPOSER_SYSTEM = `You are Caliber, an autonomous treasury agent for tokenized real-world assets.
You decide what to do THIS cycle: hold, rebalance, or halt. Work the tools:
1. read the signals, policy, and current risk;
2. reason about whether the treasury is within its mandate;
3. if a move is warranted, design a de-risking rebalance — choose which assets to trim and the sizing yourself —
   and TEST it with evaluate_policy. Iterate until evaluate_policy returns zero violations, or conclude no compliant move exists.
Rules you cannot break: only use assetIds that appear in the policy; keep any single move within the policy's single-rebalance cap;
compliance is decided ONLY by evaluate_policy, never by you. When you have decided, call commit_decision exactly once with your
final action, legs (for a rebalance), and a concise 2-3 sentence rationale. Do not call commit_decision more than once.`;

const DEFAULT_VAULT_STATE: VaultState = { paused: false, rebalanceCount: 0, contractHash: '' };

/** Max proposer attempts: one initial proposal + one revision after feedback. */
const MAX_ATTEMPTS = 2;

export interface AgentResult {
  recommendation: Recommendation;
  toolTrace: string[];
}

const commitSchema = z.object({
  action: z.enum(['hold', 'rebalance', 'halt']),
  legs: z.array(legSchema).optional(),
  rationale: z.string(),
});
export type Commit = z.infer<typeof commitSchema>;

/** Produce a Proposer decision (real one calls the LLM); returns the commit + tool trace. */
export type ProposeFn = (feedback?: string) => Promise<{ commit: Commit | null; trace: string[] }>;
/** Adversarial review of a compliant rebalance (real one calls the LLM). */
export type ReviewFn = (args: {
  policy: TreasuryPolicy;
  risk: RiskScore;
  rebalance: RebalanceRequest;
  rationale: string;
}) => Promise<AgentReview>;

/**
 * Run one cycle's agentic decision. Wires the real LLM Proposer + Risk-Reviewer,
 * then delegates the multi-agent orchestration to `runDeliberation`. Falls back
 * to the fully deterministic decision when no LLM is configured or on error.
 */
export async function generateRecommendation(
  input: DecisionInput,
  vaultState: VaultState = DEFAULT_VAULT_STATE,
): Promise<AgentResult> {
  const model = resolveModel();

  if (!model) {
    const decision = decideAction(input);
    return {
      recommendation: buildRecommendation(input, decision, fallbackExplanation(input, decision)),
      toolTrace: ['fallback:no-llm'],
    };
  }

  const mcp = await getCasperMcpTools();
  try {
    const propose: ProposeFn = (feedback) => runProposer(model, input, vaultState, mcp.tools, feedback);
    const review: ReviewFn = (args) => reviewProposal(model, args);
    return await runDeliberation(input, propose, review);
  } catch (err) {
    log.warn('deliberation failed; using deterministic fallback', { err: String(err) });
    const decision = decideAction(input);
    return {
      recommendation: buildRecommendation(input, decision, fallbackExplanation(input, decision), {
        agentProposed: false,
      }),
      toolTrace: ['fallback:error'],
    };
  } finally {
    await mcp.close();
  }
}

/**
 * Bounded multi-agent deliberation with self-correction:
 *   1. Proposer designs an action + any rebalance.
 *   2. Deterministic policy gate re-validates it (the hard gate).
 *   3. Risk-Reviewer signs off or vetoes a compliant rebalance.
 *   4. On a gate rejection OR a veto, the reason is fed back to the Proposer for
 *      one revision (repeat). Only if the final attempt still fails does it halt.
 * Provider-agnostic and LLM-free-testable: the Proposer/Reviewer are injected.
 */
export async function runDeliberation(
  input: DecisionInput,
  propose: ProposeFn,
  review: ReviewFn,
): Promise<AgentResult> {
  const { policy, risk, snapshot } = input;
  const toolTrace: string[] = [];
  let lastReview: AgentReview | undefined;
  let feedback: string | undefined;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const isLast = attempt === MAX_ATTEMPTS - 1;
    const { commit, trace } = await propose(feedback);
    toolTrace.push(...trace);

    if (!commit) break; // nothing committed → deterministic fallback
    const rationale = commit.rationale?.trim() || 'Decision committed by the agent.';

    // Non-rebalance decisions are accepted directly (hold re-validated for compliance).
    if (commit.action !== 'rebalance') {
      const violations = commit.action === 'hold' ? evaluatePolicy(policy, risk, snapshot) : [];
      return result(input, { action: commit.action, compliancePassed: violations.length === 0, violations }, rationale, toolTrace, { review: lastReview });
    }

    // Rebalance → deterministic gate.
    const legs = commit.legs ?? [];
    const gateViolations = gateRebalance(input, legs);
    if (gateViolations.length > 0) {
      if (!isLast) {
        feedback = `Your proposed rebalance failed the policy gate: ${detail(gateViolations)}. Revise it to satisfy every constraint, or hold.`;
        toolTrace.push('gate_reject', 'revise');
        continue;
      }
      return halt(input, gateViolations, rationale, lastReview, toolTrace);
    }

    // Passed the gate → adversarial Risk-Reviewer.
    const rebalance = buildRebalanceFromLegs(policy, input.runId, legs);
    lastReview = await review({ policy, risk, rebalance, rationale });
    toolTrace.push('risk_review');

    if (lastReview.approved) {
      return result(input, { action: 'rebalance', compliancePassed: true, violations: [], rebalance }, rationale, toolTrace, {
        review: lastReview,
      });
    }

    // Vetoed → revise, or halt on the final attempt.
    if (!isLast) {
      feedback = `The risk officer vetoed your move (${lastReview.severity} severity): ${lastReview.concern}. Propose a safer, smaller move that addresses this, or hold.`;
      toolTrace.push('revise');
      continue;
    }
    return halt(input, [{ constraint: 'riskReviewVeto', detail: lastReview.concern }], rationale, lastReview, toolTrace);
  }

  const decision = decideAction(input);
  return {
    recommendation: buildRecommendation(input, decision, fallbackExplanation(input, decision), {
      agentProposed: false,
    }),
    toolTrace: [...toolTrace, 'fallback:no-commit'],
  };
}

/** One Proposer turn against the real LLM. */
async function runProposer(
  model: LanguageModelV1,
  input: DecisionInput,
  vaultState: VaultState,
  mcpTools: Record<string, unknown>,
  feedback?: string,
): Promise<{ commit: Commit | null; trace: string[] }> {
  const { policy, risk } = input;
  let committed: Commit | null = null;

  const tools = {
    ...buildTools({ ...input, vaultState }),
    commit_decision: tool({
      description:
        'Commit your final decision for this cycle. Call exactly once, after you have tested any rebalance with evaluate_policy.',
      parameters: commitSchema,
      execute: async (c) => {
        committed = c;
        return { recorded: true };
      },
    }),
  };
  Object.assign(tools, mcpTools);

  const revision = feedback ? `\n\nThis is a revision. Your previous proposal was rejected — ${feedback}` : '';
  const out = await generateText({
    model,
    system: PROPOSER_SYSTEM,
    tools,
    maxSteps: 10,
    prompt: `Decide this cycle for the "${policy.name}" treasury. Risk is ${risk.band} (${risk.score}/100). Investigate with the tools, design a compliant move if warranted, then commit_decision.${revision}`,
  });

  const trace = (out.steps ?? []).flatMap((s) => (s.toolCalls ?? []).map((c) => c.toolName));
  return { commit: committed, trace };
}

/** Deterministic gate for a proposed rebalance: unknown assets, empty legs, and policy. */
function gateRebalance(
  input: DecisionInput,
  legs: { fromAssetId: string; toAssetId: string; weight: number }[],
): PolicyViolation[] {
  const { policy, risk, snapshot, runId } = input;
  if (legs.length === 0) return [{ constraint: 'noLegs', detail: 'Rebalance had no legs.' }];
  const violations: PolicyViolation[] = [];
  const known = knownAssetIds(policy);
  for (const l of legs) {
    if (!known.has(l.fromAssetId) || !known.has(l.toAssetId)) {
      violations.push({ constraint: 'unknownAsset', detail: `Unknown asset ${l.fromAssetId}/${l.toAssetId}.` });
    }
  }
  violations.push(...evaluatePolicy(policy, risk, snapshot, buildRebalanceFromLegs(policy, runId, legs)));
  return violations;
}

const detail = (v: PolicyViolation[]) => v.map((x) => x.detail).join('; ');

function result(
  input: DecisionInput,
  decision: Decision,
  rationale: string,
  toolTrace: string[],
  extra: { review?: AgentReview },
): AgentResult {
  return {
    recommendation: buildRecommendation(input, decision, rationale, { agentProposed: true, review: extra.review }),
    toolTrace,
  };
}

function halt(
  input: DecisionInput,
  violations: PolicyViolation[],
  rationale: string,
  review: AgentReview | undefined,
  toolTrace: string[],
): AgentResult {
  return result(input, { action: 'halt', compliancePassed: false, violations }, rationale, toolTrace, { review });
}
