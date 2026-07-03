import type { RebalanceRequest, RiskScore, SignalSnapshot, TreasuryPolicy } from '@caliber/shared';
import {
  deriveAllocations,
  getSignal,
  liquidityBufferPct,
  projectAllocations,
} from '../portfolio.js';

export interface PolicyViolation {
  constraint: string;
  detail: string;
}

const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));

/** Map a 0..100 score to a band. Single source of truth for risk banding. */
function riskBand(score: number): RiskScore['band'] {
  if (score < 25) return 'low';
  if (score < 50) return 'moderate';
  if (score < 75) return 'elevated';
  return 'critical';
}

/**
 * Deterministic, explainable risk scoring from a signal snapshot (0..100).
 * Each factor records its contribution so the UI and audit log can show how the
 * score was reached. Pure signals → risk; independent of any policy or AI.
 */
export function scoreRisk(snapshot: SignalSnapshot): RiskScore {
  const buffer = liquidityBufferPct(snapshot);
  const queue = getSignal(snapshot, 'rwa.redemption.queue') ?? 0;
  const yield3m = getSignal(snapshot, 'tbill.yield.3m') ?? 5;

  const factors = [
    {
      key: 'vault.liquidity.usd',
      label: 'Liquidity buffer',
      contribution: clamp((0.3 - buffer) / 0.3) * 55,
    },
    {
      key: 'rwa.redemption.queue',
      label: 'Redemption pressure',
      contribution: clamp(queue / 40) * 40,
    },
    {
      key: 'tbill.yield.3m',
      label: 'Rate environment',
      contribution: clamp((5.5 - yield3m) / 2) * 10,
    },
  ];

  const score = Math.round(Math.min(100, factors.reduce((acc, f) => acc + f.contribution, 0)));
  return {
    score,
    band: riskBand(score),
    factors: factors.map((f) => ({ ...f, contribution: Math.round(f.contribution) })),
    snapshotId: snapshot.id,
    computedAt: new Date().toISOString(),
  };
}

/**
 * Deterministic policy evaluation — the ONLY gate on execution. Never depends
 * on AI output.
 *
 * - Without a `proposal`: evaluates whether HOLDING (the current state) is
 *   compliant — flags risk over the ceiling, liquidity below the floor, and any
 *   allocation outside its band.
 * - With a `proposal`: evaluates whether EXECUTING that rebalance is compliant —
 *   checks the move respects the single-rebalance cap, counterparty allowlist,
 *   and that the projected post-rebalance allocations sit within bands and above
 *   the liquidity floor. A de-risking rebalance is allowed even when current risk
 *   is high (the risk ceiling gates inaction, not de-risking).
 */
export function evaluatePolicy(
  policy: TreasuryPolicy,
  risk: RiskScore,
  snapshot: SignalSnapshot,
  proposal?: RebalanceRequest,
): PolicyViolation[] {
  const violations: PolicyViolation[] = [];
  const { constraints } = policy;

  if (policy.paused) {
    violations.push({ constraint: 'paused', detail: 'Policy is paused; no action permitted.' });
    return violations;
  }

  const current = deriveAllocations(policy, snapshot);

  if (!proposal) {
    // Evaluate HOLD.
    if (risk.score > constraints.maxRiskScore) {
      violations.push({
        constraint: 'maxRiskScore',
        detail: `Risk ${risk.score} exceeds ceiling ${constraints.maxRiskScore}.`,
      });
    }
    if (liquidityBufferPct(snapshot) < constraints.minLiquidityBufferPct) {
      violations.push({
        constraint: 'minLiquidityBufferPct',
        detail: `Liquidity buffer ${(liquidityBufferPct(snapshot) * 100).toFixed(1)}% below floor ${(
          constraints.minLiquidityBufferPct * 100
        ).toFixed(0)}%.`,
      });
    }
    pushBandViolations(policy, current, violations);
    return violations;
  }

  // Evaluate the proposed REBALANCE.
  const moved = proposal.legs.reduce((acc, l) => acc + l.weight, 0);
  if (moved > constraints.maxSingleRebalancePct) {
    violations.push({
      constraint: 'maxSingleRebalancePct',
      detail: `Rebalance moves ${(moved * 100).toFixed(1)}% > cap ${(
        constraints.maxSingleRebalancePct * 100
      ).toFixed(0)}%.`,
    });
  }
  if (constraints.allowedCounterparties.length > 0) {
    for (const leg of proposal.legs) {
      if (!constraints.allowedCounterparties.includes(leg.toAssetId)) {
        violations.push({
          constraint: 'allowedCounterparties',
          detail: `Counterparty ${leg.toAssetId} not allowlisted.`,
        });
      }
    }
  }
  const projected = projectAllocations(current, proposal);
  const projectedBuffer =
    projected.find((w) =>
      policy.allocations.find((a) => a.assetId === w.assetId && a.assetClass === 'stablecoin'),
    )?.weight ?? 0;
  if (projectedBuffer < constraints.minLiquidityBufferPct) {
    violations.push({
      constraint: 'minLiquidityBufferPct',
      detail: `Projected buffer ${(projectedBuffer * 100).toFixed(1)}% still below floor.`,
    });
  }
  pushBandViolations(policy, projected, violations);
  return violations;
}

function pushBandViolations(
  policy: TreasuryPolicy,
  weights: { assetId: string; weight: number }[],
  violations: PolicyViolation[],
): void {
  for (const alloc of policy.allocations) {
    const w = weights.find((x) => x.assetId === alloc.assetId)?.weight ?? 0;
    if (w < alloc.min - 1e-6 || w > alloc.max + 1e-6) {
      violations.push({
        constraint: 'allocationBand',
        detail: `${alloc.label} at ${(w * 100).toFixed(1)}% outside band ${(alloc.min * 100).toFixed(
          0,
        )}–${(alloc.max * 100).toFixed(0)}%.`,
      });
    }
  }
}
