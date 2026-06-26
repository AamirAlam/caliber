import type { Signal, SignalSnapshot, TreasuryPolicy, RebalanceRequest } from '@helm/shared';

/**
 * Notional total treasury value (USD). The demo derives current allocation
 * weights from the liquidity signal against this constant. A real deployment
 * would read live balances on-chain.
 */
export const TOTAL_TREASURY_USD = 1_200_000;

/** Read a signal value by key from a snapshot (undefined if absent). */
export function getSignal(snapshot: SignalSnapshot, key: string): number | undefined {
  return snapshot.signals.find((s: Signal) => s.key === key)?.value;
}

/** Current stablecoin/liquidity buffer as a fraction of the treasury. */
export function liquidityBufferPct(snapshot: SignalSnapshot): number {
  const liquidity = getSignal(snapshot, 'vault.liquidity.usd') ?? 0;
  return liquidity / TOTAL_TREASURY_USD;
}

export interface AllocationWeight {
  assetId: string;
  weight: number;
}

/**
 * Derive current allocation weights from a snapshot. The liquidity buffer drives
 * the stablecoin (usdc) weight; the remainder is split across the non-stable
 * assets in proportion to their policy targets. Deterministic and explainable.
 */
export function deriveAllocations(
  policy: TreasuryPolicy,
  snapshot: SignalSnapshot,
): AllocationWeight[] {
  const usdcWeight = Math.min(1, Math.max(0, liquidityBufferPct(snapshot)));
  const others = policy.allocations.filter((a) => a.assetClass !== 'stablecoin');
  const targetSum = others.reduce((acc, a) => acc + a.target, 0) || 1;
  const remaining = 1 - usdcWeight;

  return policy.allocations.map((a) => {
    if (a.assetClass === 'stablecoin') return { assetId: a.assetId, weight: usdcWeight };
    return { assetId: a.assetId, weight: remaining * (a.target / targetSum) };
  });
}

/** Apply a proposed rebalance's legs to a set of weights, returning new weights. */
export function projectAllocations(
  current: AllocationWeight[],
  proposal: RebalanceRequest,
): AllocationWeight[] {
  const next = current.map((w) => ({ ...w }));
  const byId = (id: string) => next.find((w) => w.assetId === id);
  for (const leg of proposal.legs) {
    const from = byId(leg.fromAssetId);
    const to = byId(leg.toAssetId);
    if (from) from.weight -= leg.weight;
    if (to) to.weight += leg.weight;
  }
  return next;
}
