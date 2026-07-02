import { tool } from 'ai';
import { z } from 'zod';
import type { RiskScore, SignalSnapshot, TreasuryPolicy } from '@helm/shared';
import { evaluatePolicy } from '../policy/index.js';
import { proposeRebalance } from '../decision/index.js';

export interface VaultState {
  paused: boolean;
  rebalanceCount: number;
  contractHash: string;
}

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
        'Deterministic policy check. target="hold" evaluates the current state; target="rebalance" evaluates the candidate de-risking rebalance. Returns the list of violations (empty = compliant).',
      parameters: z.object({ target: z.enum(['hold', 'rebalance']) }),
      execute: async ({ target }) => {
        if (target === 'hold') {
          return { violations: evaluatePolicy(ctx.policy, ctx.risk, ctx.snapshot) };
        }
        const proposal = proposeRebalance(ctx.policy, ctx.snapshot, ctx.runId);
        if (!proposal) return { violations: [{ constraint: 'noProposal', detail: 'No rebalance available.' }] };
        return { violations: evaluatePolicy(ctx.policy, ctx.risk, ctx.snapshot, proposal) };
      },
    }),
    propose_rebalance: tool({
      description: 'Build a candidate de-risking rebalance (move from over-weight asset into the buffer).',
      parameters: z.object({}),
      execute: async () => proposeRebalance(ctx.policy, ctx.snapshot, ctx.runId) ?? null,
    }),
  };
}
