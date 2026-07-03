import { tool } from 'ai';
import { z } from 'zod';
import type { RiskScore, SignalSnapshot, TreasuryPolicy } from '@caliber/shared';
import { evaluatePolicy } from '../policy/index.js';
import { buildRebalanceFromLegs, proposeRebalance } from '../decision/index.js';
import type { VaultState } from '../casper/reader.js';

export type { VaultState };

/** Shape of a proposed rebalance leg the agent can test / commit. */
export const legSchema = z.object({
  fromAssetId: z.string().describe('assetId to move value out of (must exist in policy)'),
  toAssetId: z.string().describe('assetId to move value into (must exist in policy)'),
  weight: z.number().min(0).max(1).describe('fraction of the treasury to move, 0..1'),
});

export interface AgentContext {
  runId: string;
  policy: TreasuryPolicy;
  snapshot: SignalSnapshot;
  risk: RiskScore;
  vaultState: VaultState;
}

/**
 * Build the agent's toolset for one turn. The guardrail tools (`score_risk`,
 * `evaluate_policy`) are deterministic — the model must call them rather than
 * reason about the numbers itself, and it cannot override their verdict.
 */
export function buildTools(ctx: AgentContext) {
  return {
    get_signals: tool({
      description: 'Get the latest treasury and market signal snapshot.',
      parameters: z.object({}),
      execute: async () => ctx.snapshot,
    }),
    get_policy: tool({
      description: 'Get the active treasury policy (allocations and constraints).',
      parameters: z.object({}),
      execute: async () => ctx.policy,
    }),
    get_vault_state: tool({
      description: 'Read on-chain vault state: paused flag and rebalance count.',
      parameters: z.object({}),
      execute: async () => ctx.vaultState,
    }),
    score_risk: tool({
      description: 'Deterministic risk score (0-100) with per-factor breakdown for the snapshot.',
      parameters: z.object({}),
      execute: async () => ctx.risk,
    }),
    evaluate_policy: tool({
      description:
        'Deterministic policy check — the ONLY source of compliance truth. Omit `legs` to check whether HOLDING is compliant; pass candidate `legs` to test a rebalance you are considering. Returns the list of violations (empty array = compliant). Call this before committing.',
      parameters: z.object({ legs: z.array(legSchema).optional() }),
      execute: async ({ legs }) => {
        if (!legs || legs.length === 0) {
          return { violations: evaluatePolicy(ctx.policy, ctx.risk, ctx.snapshot) };
        }
        const proposal = buildRebalanceFromLegs(ctx.policy, ctx.runId, legs);
        return { violations: evaluatePolicy(ctx.policy, ctx.risk, ctx.snapshot, proposal) };
      },
    }),
    suggest_rebalance: tool({
      description:
        'Get a deterministic reference de-risking rebalance (move from the most over-weight asset into the stablecoin buffer). Use it as a starting point — you may propose something different.',
      parameters: z.object({}),
      execute: async () => proposeRebalance(ctx.policy, ctx.snapshot, ctx.runId)?.legs ?? null,
    }),
  };
}
