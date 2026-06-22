import { z } from 'zod';

/**
 * A single observed metric from an external source (market data, RWA issuer
 * feed, on-chain reading). Signals are inputs to risk scoring and policy eval.
 */
export const SignalSchema = z.object({
  /** Stable key, e.g. "tbill.yield.3m" or "vault.liquidity.usd". */
  key: z.string().min(1),
  label: z.string().min(1),
  value: z.number(),
  unit: z.enum(['pct', 'usd', 'ratio', 'bps', 'count']),
  /** Where this reading came from. */
  source: z.string().min(1),
  /** Confidence in the reading, 0..1 (stale or estimated data scores lower). */
  confidence: z.number().min(0).max(1).default(1),
  observedAt: z.string().datetime(),
});

/** A coherent batch of signals captured at one point in time. */
export const SignalSnapshotSchema = z.object({
  id: z.string().min(1),
  capturedAt: z.string().datetime(),
  signals: z.array(SignalSchema),
});

/** A composite risk assessment derived deterministically from a snapshot. */
export const RiskScoreSchema = z.object({
  /** Overall score, 0 (calm) .. 100 (critical). */
  score: z.number().min(0).max(100),
  band: z.enum(['low', 'moderate', 'elevated', 'critical']),
  /** Per-factor contributions for explainability. */
  factors: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      contribution: z.number(),
    }),
  ),
  snapshotId: z.string().min(1),
  computedAt: z.string().datetime(),
});
