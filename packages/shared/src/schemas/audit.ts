import { z } from 'zod';

/** Record of a Casper deploy produced by the execution layer. */
export const TransactionRecordSchema = z.object({
  id: z.string().min(1),
  /** Casper deploy hash once submitted. */
  deployHash: z.string().optional(),
  status: z.enum(['prepared', 'submitted', 'finalized', 'failed']),
  /** Contract entry point invoked, e.g. "record_rebalance". */
  entryPoint: z.string().min(1),
  /** The rebalance request this tx fulfils, if any. */
  rebalanceRequestId: z.string().optional(),
  network: z.enum(['casper-testnet', 'casper-mainnet']).default('casper-testnet'),
  error: z.string().optional(),
  submittedAt: z.string().datetime().optional(),
  finalizedAt: z.string().datetime().optional(),
});

/** Lifecycle stages of a single agent loop. */
export const AgentRunStageSchema = z.enum([
  'collect_signals',
  'score_risk',
  'evaluate_policy',
  'generate_decision',
  'await_approval',
  'execute',
  'done',
]);

/**
 * A complete, append-only audit record of one agent loop: what it saw,
 * what it decided, why, and what it did on-chain. This is the spine of
 * Helm's explainability story.
 */
export const AgentRunLogSchema = z.object({
  id: z.string().min(1),
  policyId: z.string().min(1),
  stage: AgentRunStageSchema,
  status: z.enum(['running', 'completed', 'failed', 'rejected']),
  snapshotId: z.string().optional(),
  riskScore: z.number().min(0).max(100).optional(),
  recommendationId: z.string().optional(),
  transactionId: z.string().optional(),
  /** Who approved execution, if a human did. */
  approvedBy: z.string().optional(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().optional(),
  notes: z.string().optional(),
});
