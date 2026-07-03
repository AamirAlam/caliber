import { generateText, tool } from 'ai';
import { z } from 'zod';
import type { Recommendation } from '@caliber/shared';
import {
  buildRebalanceFromLegs,
  buildRecommendation,
  decideAction,
  fallbackExplanation,
  knownAssetIds,
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

export interface AgentResult {
  recommendation: Recommendation;
  toolTrace: string[];
}

const commitSchema = z.object({
  action: z.enum(['hold', 'rebalance', 'halt']),
  legs: z.array(legSchema).optional(),
  rationale: z.string(),
});
type Commit = z.infer<typeof commitSchema>;

/**
 * Run the agentic decision for one cycle:
 *   1. Proposer agent decides an action + designs any rebalance (tool-use loop).
 *   2. The deterministic policy engine re-validates the proposal — the hard gate.
 *      A non-compliant or malformed proposal is downgraded to `halt`.
 *   3. For a compliant rebalance, the adversarial Risk-Reviewer agent must sign
 *      off; a veto downgrades to `halt`.
 * Falls back to the fully deterministic decision when no LLM is configured.
 */
export async function generateRecommendation(
  input: DecisionInput,
  vaultState: VaultState = DEFAULT_VAULT_STATE,
): Promise<AgentResult> {
  const model = resolveModel();

  // Offline / no-key path: deterministic decision + templated explanation.
  if (!model) {
    const decision = decideAction(input);
    return {
      recommendation: buildRecommendation(input, decision, fallbackExplanation(input, decision)),
      toolTrace: ['fallback:no-llm'],
    };
  }

  const { policy, risk, snapshot, runId } = input;
  let committed: Commit | null = null;
  const toolTrace: string[] = [];

  // Optionally connect the Casper MCP Server for richer on-chain reads.
  const mcp = await getCasperMcpTools();

  try {
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
    // Merge MCP tools (if any) at runtime without widening the typed toolset.
    Object.assign(tools, mcp.tools);

    const result = await generateText({
      model,
      system: PROPOSER_SYSTEM,
      tools,
      maxSteps: 10,
      prompt: `Decide this cycle for the "${policy.name}" treasury. Risk is ${risk.band} (${risk.score}/100). Investigate with the tools, design a compliant move if warranted, then commit_decision.`,
    });
    toolTrace.push(...(result.steps ?? []).flatMap((s) => (s.toolCalls ?? []).map((c) => c.toolName)));
  } catch (err) {
    log.warn('proposer agent failed; using deterministic fallback', { err: String(err) });
  } finally {
    await mcp.close();
  }

  // If the agent never committed, fall back to the deterministic engine.
  if (!committed) {
    const decision = decideAction(input);
    return {
      recommendation: buildRecommendation(input, decision, fallbackExplanation(input, decision), {
        agentProposed: false,
      }),
      toolTrace: [...toolTrace, 'fallback:no-commit'],
    };
  }

  const commit: Commit = committed;
  const rationale = commit.rationale?.trim() || 'Decision committed by the agent.';

  // ── Deterministic gate: re-validate whatever the agent proposed. ──
  let action = commit.action;
  let rebalance;
  let violations: PolicyViolation[] = [];

  if (action === 'rebalance') {
    const legs = commit.legs ?? [];
    const known = knownAssetIds(policy);
    const unknown = legs.filter((l) => !known.has(l.fromAssetId) || !known.has(l.toAssetId));
    rebalance = buildRebalanceFromLegs(policy, runId, legs);
    violations = evaluatePolicy(policy, risk, snapshot, rebalance);
    if (legs.length === 0) violations.push({ constraint: 'noLegs', detail: 'Rebalance had no legs.' });
    for (const u of unknown) {
      violations.push({ constraint: 'unknownAsset', detail: `Unknown asset ${u.fromAssetId}/${u.toAssetId}.` });
    }
    if (violations.length > 0) {
      // The gate wins over the agent.
      action = 'halt';
      rebalance = undefined;
    }
  } else if (action === 'hold') {
    violations = evaluatePolicy(policy, risk, snapshot);
  }

  let compliancePassed = violations.length === 0;
  let review;

  // ── Adversarial review of a compliant rebalance. ──
  if (action === 'rebalance' && rebalance) {
    review = await reviewProposal(model, { policy, risk, rebalance, rationale });
    toolTrace.push('risk_review');
    if (!review.approved) {
      action = 'halt';
      rebalance = undefined;
      compliancePassed = false;
      violations = [
        ...violations,
        { constraint: 'riskReviewVeto', detail: review.concern },
      ];
    }
  }

  const recommendation = buildRecommendation(
    input,
    { action, compliancePassed, violations, rebalance },
    rationale,
    { agentProposed: true, review },
  );
  return { recommendation, toolTrace };
}
