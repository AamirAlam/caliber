import { z } from 'zod';

/** A proposed move of value between two assets in the treasury. */
export const RebalanceLegSchema = z.object({
  fromAssetId: z.string().min(1),
  toAssetId: z.string().min(1),
  /** Amount expressed in the smallest motes/unit as a string to avoid float loss. */
  amount: z.string().min(1),
  /** Fraction of total treasury this leg represents, 0..1 (for display). */
  weight: z.number().min(0).max(1),
});

/**
 * The full intent to rebalance. This is what gets handed to the execution
 * layer to be turned into one or more Casper deploys.
 */
export const RebalanceRequestSchema = z.object({
  id: z.string().min(1),
  policyId: z.string().min(1),
  legs: z.array(RebalanceLegSchema).min(1),
  createdAt: z.string().datetime(),
});

/**
 * Verdict from the adversarial Risk-Reviewer agent. It independently reviews a
 * compliant proposal; a veto downgrades the action. Advisory to the human, but
 * it never *loosens* the deterministic gate — it can only tighten.
 */
export const AgentReviewSchema = z.object({
  approved: z.boolean(),
  concern: z.string(),
  severity: z.enum(['low', 'medium', 'high']),
});

/**
 * The agent's output for one run. Deterministic policy checks live in
 * `compliancePassed`/`violations`; the AI-authored prose lives in
 * `explanation` and never gates execution on its own.
 */
export const RecommendationSchema = z.object({
  id: z.string().min(1),
  runId: z.string().min(1),
  action: z.enum(['hold', 'rebalance', 'halt']),
  /** Deterministic verdict: did the proposal satisfy all policy constraints? */
  compliancePassed: z.boolean(),
  /** Machine-readable policy violations (empty when compliant). */
  violations: z.array(
    z.object({
      constraint: z.string(),
      detail: z.string(),
    }),
  ),
  riskScore: z.number().min(0).max(100),
  /** Optional concrete rebalance when action === "rebalance". */
  rebalance: RebalanceRequestSchema.optional(),
  /** AI-generated, human-facing rationale. Explanatory only. */
  explanation: z.string(),
  confidence: z.number().min(0).max(1),
  /** True when an LLM proposed the move (vs the deterministic fallback). */
  agentProposed: z.boolean().default(false),
  /** Verdict from the adversarial Risk-Reviewer agent, when one ran. */
  review: AgentReviewSchema.optional(),
  createdAt: z.string().datetime(),
});
