import { z } from 'zod';

/**
 * A target allocation band for a single tokenized asset within a treasury.
 * `target` is the desired weight (0..1); `min`/`max` define the tolerated drift
 * band before the policy considers the allocation out of compliance.
 */
export const AssetAllocationSchema = z.object({
  /** Stable identifier for the asset, e.g. a Casper contract package hash or ticker. */
  assetId: z.string().min(1),
  /** Human-readable label, e.g. "Tokenized US T-Bills". */
  label: z.string().min(1),
  /** Asset class used for diversification and risk rules. */
  assetClass: z.enum(['rwa', 'stablecoin', 'native', 'lp', 'other']),
  /** Desired portfolio weight, 0..1. */
  target: z.number().min(0).max(1),
  /** Lower bound of the tolerated weight band, 0..1. */
  min: z.number().min(0).max(1),
  /** Upper bound of the tolerated weight band, 0..1. */
  max: z.number().min(0).max(1),
});

/**
 * Deterministic guardrails the agent must respect. These are enforced
 * mechanically and are independent of any AI-generated reasoning.
 */
export const PolicyConstraintsSchema = z.object({
  /** Max fraction of the treasury that may move in a single rebalance, 0..1. */
  maxSingleRebalancePct: z.number().min(0).max(1),
  /** Minimum liquidity buffer to retain in stablecoins, 0..1. */
  minLiquidityBufferPct: z.number().min(0).max(1),
  /** Max acceptable risk score (0..100) before action is blocked. */
  maxRiskScore: z.number().min(0).max(100),
  /** Whether a human approval is required before on-chain execution. */
  requireHumanApproval: z.boolean().default(true),
  /** Allowlisted Casper recipient/contract hashes for outbound transfers. */
  allowedCounterparties: z.array(z.string()).default([]),
});

export const TreasuryPolicySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.number().int().nonnegative(),
  /** Casper account or contract that owns this policy (access control). */
  owner: z.string().min(1),
  allocations: z.array(AssetAllocationSchema).min(1),
  constraints: PolicyConstraintsSchema,
  /** Paused policies must not produce executable recommendations. */
  paused: z.boolean().default(false),
  updatedAt: z.string().datetime(),
});
