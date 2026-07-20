import { generateText, tool, type LanguageModelV1 } from 'ai';
import { z } from 'zod';
import {
  AGENT_ROLES,
  type AgentReview,
  type RebalanceRequest,
  type Recommendation,
  type RiskScore,
  type SignalSnapshot,
  type TraceStep,
  type TreasuryPolicy,
} from '@caliber/shared';
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
import { reviewPanel } from './reviewer.js';
import { buildTools, legSchema, type VaultState } from './tools.js';

const PROPOSER_SYSTEM = `You are the ${AGENT_ROLES.proposer.name}, the ${AGENT_ROLES.proposer.title.toLowerCase()} on Caliber's
treasury team for tokenized real-world assets. You work alongside the ${AGENT_ROLES.reviewer.name}, who independently
reviews any move you propose. You decide what to do THIS cycle: hold, rebalance, or halt. Work the tools:
1. read the signals, policy, and current risk;
2. reason about whether the treasury is within its mandate;
3. if a move is warranted, DESIGN the rebalance yourself — you own the design. Choose which over-weight asset(s) to trim,
   size each leg, and split across one or two legs if that is cleaner. suggest_rebalance is only a reference baseline;
   you may size differently, pick a different asset, or improve on it. A de-risking move must add to the stablecoin buffer.
   TEST every candidate with evaluate_policy and iterate until it returns zero violations, or conclude no compliant move exists.
Rules you cannot break: use only assetIds from the policy; keep the total moved within the single-rebalance cap; a rebalance must
actually raise the liquidity buffer (evaluate_policy enforces this); compliance is decided ONLY by evaluate_policy, never by you.
When decided, call commit_decision exactly once with your final action, legs (for a rebalance), and a concise 2-3 sentence
rationale. Do not call commit_decision more than once.`;

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
/** Adversarial review of a compliant rebalance (real one calls a panel of LLMs). */
export type ReviewFn = (args: {
  policy: TreasuryPolicy;
  risk: RiskScore;
  snapshot: SignalSnapshot;
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
  memory = '',
): Promise<AgentResult> {
  const model = resolveModel();

  if (!model) {
    const decision = decideAction(input);
    const trace: TraceStep[] = [
      { step: 0, kind: 'fallback', label: 'Deterministic engine', detail: 'No LLM configured; rule-based decision' },
      { step: 1, kind: 'decision', label: decision.action.toUpperCase(), ok: decision.compliancePassed },
    ];
    return {
      recommendation: buildRecommendation(input, decision, fallbackExplanation(input, decision), { trace }),
      toolTrace: ['fallback:no-llm'],
    };
  }

  const mcp = await getCasperMcpTools();
  try {
    const propose: ProposeFn = (feedback) => runProposer(model, input, vaultState, mcp.tools, feedback, memory);
    const review: ReviewFn = (args) => reviewPanel(model, args);
    const result = await runDeliberation(input, propose, review);
    const trace = result.recommendation.trace;
    trace.unshift({
      step: -1,
      kind: 'tools',
      label: 'Casper AI Toolkit',
      detail:
        mcp.status === 'connected'
          ? `Casper MCP connected (${mcp.toolNames.length} tools): ${mcp.toolNames.join(', ')}`
          : mcp.status === 'disabled'
            ? 'Casper MCP disabled; using direct Casper RPC and casper-js-sdk fallback.'
            : 'Casper MCP unavailable; using direct Casper RPC and casper-js-sdk fallback.',
      ok: mcp.status === 'connected' ? true : undefined,
    });
    result.recommendation.trace = trace.map((s, step) => ({ ...s, step }));
    result.toolTrace.push(`casper_mcp:${mcp.status}`);

    // Baseline oracle: compare the agent's decision to the deterministic engine.
    // The agent stays authoritative (gated); we only record divergence for audit.
    const baseline = decideAction(input);
    if (baseline.action !== result.recommendation.action) {
      log.info('agent diverged from deterministic baseline', {
        agent: result.recommendation.action,
        baseline: baseline.action,
      });
      result.toolTrace.push(`baseline:diverge(${baseline.action})`);
    } else {
      result.toolTrace.push('baseline:agree');
    }
    return result;
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
  const steps: TraceStep[] = [];
  const add = (s: Omit<TraceStep, 'step'>) => steps.push({ step: steps.length, ...s });
  let lastReview: AgentReview | undefined;
  let feedback: string | undefined;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const isLast = attempt === MAX_ATTEMPTS - 1;
    const turn = attempt + 1;
    const { commit, trace } = await propose(feedback);
    toolTrace.push(...trace);

    if (trace.length) {
      const used = [...new Set(trace.filter((t) => t !== 'commit_decision'))];
      if (used.length) add({ kind: 'tools', label: `Investigated (attempt ${turn})`, detail: used.join(', ') });
    }
    if (!commit) break; // nothing committed → deterministic fallback
    const rationale = commit.rationale?.trim() || 'Decision committed by the agent.';
    add({ kind: 'proposal', label: `${AGENT_ROLES.proposer.name} · attempt ${turn}`, detail: `Proposed ${commit.action}`, ok: true });

    // HOLD is only valid when holding is actually compliant. If the treasury is
    // in breach, the agent may not hold through it — revise, then halt.
    if (commit.action === 'hold') {
      const violations = evaluatePolicy(policy, risk, snapshot);
      if (violations.length > 0) {
        if (!isLast) {
          feedback = `Holding is not compliant: ${detail(violations)}. You must rebalance to fix it or halt — you cannot hold through a breach.`;
          toolTrace.push('hold_reject', 'revise');
          add({ kind: 'revision', label: 'Sent back for revision', detail: 'Holding would breach policy' });
          continue;
        }
        add({ kind: 'decision', label: 'HALT', detail: 'Cannot hold through a breach; no compliant move found', ok: false });
        return halt(input, violations, rationale, lastReview, toolTrace, steps);
      }
      add({ kind: 'decision', label: 'HOLD', ok: true });
      return result(input, { action: 'hold', compliancePassed: true, violations: [] }, rationale, toolTrace, { review: lastReview, trace: steps });
    }

    // HALT — agent explicitly declines to act; surface any policy context.
    if (commit.action === 'halt') {
      const violations = evaluatePolicy(policy, risk, snapshot);
      add({ kind: 'decision', label: 'HALT', ok: violations.length === 0 });
      return halt(input, violations, rationale, lastReview, toolTrace, steps);
    }

    // Rebalance → deterministic gate.
    const legs = commit.legs ?? [];
    const gateViolations = gateRebalance(input, legs);
    add({
      kind: 'gate',
      label: 'Policy gate',
      ok: gateViolations.length === 0,
      detail: gateViolations.length === 0 ? 'Passed all constraints' : detail(gateViolations),
    });
    if (gateViolations.length > 0) {
      if (!isLast) {
        feedback = `Your proposed rebalance failed the policy gate: ${detail(gateViolations)}. Revise it to satisfy every constraint, or hold.`;
        toolTrace.push('gate_reject', 'revise');
        add({ kind: 'revision', label: 'Sent back for revision', detail: 'Gate rejected the proposal' });
        continue;
      }
      add({ kind: 'decision', label: 'HALT', detail: 'No compliant move after revision', ok: false });
      return halt(input, gateViolations, rationale, lastReview, toolTrace, steps);
    }

    // Passed the gate → adversarial Risk-Reviewer panel.
    const rebalance = buildRebalanceFromLegs(policy, input.runId, legs);
    lastReview = await review({ policy, risk, snapshot, rebalance, rationale });
    toolTrace.push('risk_review');
    add({
      kind: 'review',
      label: AGENT_ROLES.reviewer.name,
      ok: lastReview.approved,
      detail: `${lastReview.approved ? 'Approved' : `Vetoed (${lastReview.severity})`} — ${lastReview.concern}`,
    });

    if (lastReview.approved) {
      add({ kind: 'decision', label: 'REBALANCE', detail: 'Approved & ready for human sign-off', ok: true });
      return result(input, { action: 'rebalance', compliancePassed: true, violations: [], rebalance }, rationale, toolTrace, {
        review: lastReview,
        trace: steps,
      });
    }

    // Vetoed → revise, or halt on the final attempt.
    if (!isLast) {
      feedback = `The risk officer vetoed your move (${lastReview.severity} severity): ${lastReview.concern}. Propose a safer, smaller move that addresses this, or hold.`;
      toolTrace.push('revise');
      add({ kind: 'revision', label: 'Sent back for revision', detail: `${AGENT_ROLES.reviewer.name} vetoed` });
      continue;
    }
    add({ kind: 'decision', label: 'HALT', detail: 'Reviewer vetoed both attempts', ok: false });
    return halt(input, [{ constraint: 'riskReviewVeto', detail: lastReview.concern }], rationale, lastReview, toolTrace, steps);
  }

  const decision = decideAction(input);
  add({ kind: 'fallback', label: 'Deterministic engine', detail: 'Agent unavailable; used rule-based decision' });
  return {
    recommendation: buildRecommendation(input, decision, fallbackExplanation(input, decision), {
      agentProposed: false,
      trace: steps,
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
  memory = '',
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

  const history = memory ? `${memory}\n\n` : '';
  const revision = feedback ? `\n\nThis is a revision. Your previous proposal was rejected — ${feedback}` : '';
  const out = await generateText({
    model,
    system: PROPOSER_SYSTEM,
    tools,
    maxSteps: 10,
    prompt: `${history}Decide this cycle for the "${policy.name}" treasury. Risk is ${risk.band} (${risk.score}/100). Investigate with the tools, design a compliant move if warranted, then commit_decision.${revision}`,
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
  extra: { review?: AgentReview; trace: TraceStep[] },
): AgentResult {
  return {
    recommendation: buildRecommendation(input, decision, rationale, {
      agentProposed: true,
      review: extra.review,
      trace: extra.trace,
    }),
    toolTrace,
  };
}

function halt(
  input: DecisionInput,
  violations: PolicyViolation[],
  rationale: string,
  review: AgentReview | undefined,
  toolTrace: string[],
  trace: TraceStep[],
): AgentResult {
  return result(input, { action: 'halt', compliancePassed: false, violations }, rationale, toolTrace, { review, trace });
}
