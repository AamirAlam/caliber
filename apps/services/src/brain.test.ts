import { describe, expect, it } from 'vitest';
import type { Signal } from '@caliber/shared';
import { collectSignals, validateSignalSet, type SignalSource } from './signals/index.js';
import { evaluatePolicy, scoreRisk } from './policy/index.js';
import { buildRebalanceFromLegs, decideAction } from './decision/index.js';
import { samplePolicy } from './samplePolicy.js';

async function snapshotFor(stress: boolean) {
  return collectSignals([fixtureSource(stress)], 'snap_test');
}

function fixtureSource(stress: boolean): SignalSource {
  const mk = (key: string, label: string, value: number, unit: Signal['unit'], confidence = 1): Signal => ({
    key,
    label,
    value,
    unit,
    source: 'test-fixture',
    confidence,
    observedAt: new Date().toISOString(),
  });
  return {
    name: 'test-fixture',
    async collect() {
      return [
        mk('tbill.yield.3m', '3M T-Bill yield', stress ? 4.5 : 5.1, 'pct', 0.95),
        mk('vault.liquidity.usd', 'Vault stablecoin liquidity', stress ? 180_000 : 420_000, 'usd'),
        mk('rwa.redemption.queue', 'RWA redemption queue depth', stress ? 40 : 3, 'count', 0.8),
      ];
    },
  };
}

describe('signals + risk', () => {
  it('collects all required live signal keys', async () => {
    const snapshot = await snapshotFor(true);
    expect(snapshot.signals.map((s) => s.key).sort()).toEqual([
      'rwa.redemption.queue',
      'tbill.yield.3m',
      'vault.liquidity.usd',
    ]);
  });

  it('scores calm low and stress high', async () => {
    const calm = scoreRisk(await snapshotFor(false));
    const stress = scoreRisk(await snapshotFor(true));
    expect(calm.score).toBeLessThan(samplePolicy.constraints.maxRiskScore);
    expect(stress.score).toBeGreaterThan(samplePolicy.constraints.maxRiskScore);
  });

  it('rejects incomplete signal sets', async () => {
    await expect(
      collectSignals(
        [
          {
            name: 'incomplete',
            async collect() {
              return [
                {
                  key: 'vault.liquidity.usd',
                  label: 'Vault stablecoin liquidity',
                  value: 180_000,
                  unit: 'usd',
                  source: 'incomplete',
                  confidence: 1,
                  observedAt: new Date().toISOString(),
                },
              ];
            },
          },
        ],
        'snap_incomplete',
      ),
    ).rejects.toThrow(/missing required keys/);
  });

  it('rejects stale signal observations', () => {
    const observedAt = '2026-07-03T01:00:00.000Z';
    const signals: Signal[] = [
      { key: 'tbill.yield.3m', label: '3M T-Bill yield', value: 4.5, unit: 'pct', source: 'test', confidence: 1, observedAt },
      { key: 'vault.liquidity.usd', label: 'Vault stablecoin liquidity', value: 180_000, unit: 'usd', source: 'test', confidence: 1, observedAt },
      { key: 'rwa.redemption.queue', label: 'RWA redemption queue depth', value: 40, unit: 'count', source: 'test', confidence: 1, observedAt },
    ];
    expect(() => validateSignalSet(signals, Date.parse('2026-07-03T01:10:01.000Z'), 300000)).toThrow(/stale/);
  });
});

describe('policy + decision', () => {
  it('holds and is compliant in calm conditions', async () => {
    const snapshot = await snapshotFor(false);
    const risk = scoreRisk(snapshot);
    const decision = decideAction({ runId: 'r', policy: samplePolicy, risk, snapshot });
    expect(decision.action).toBe('hold');
    expect(decision.compliancePassed).toBe(true);
  });

  it('flags hold violations under stress', async () => {
    const snapshot = await snapshotFor(true);
    const risk = scoreRisk(snapshot);
    const violations = evaluatePolicy(samplePolicy, risk, snapshot);
    expect(violations.some((v) => v.constraint === 'minLiquidityBufferPct')).toBe(true);
  });

  it('recommends a compliant de-risking rebalance under stress', async () => {
    const snapshot = await snapshotFor(true);
    const risk = scoreRisk(snapshot);
    const decision = decideAction({ runId: 'r', policy: samplePolicy, risk, snapshot });
    expect(decision.action).toBe('rebalance');
    expect(decision.compliancePassed).toBe(true);
    expect(decision.rebalance?.legs[0]?.weight).toBeLessThanOrEqual(
      samplePolicy.constraints.maxSingleRebalancePct,
    );
  });
});

describe('deterministic gate on agent-proposed legs', () => {
  it('accepts a sensible de-risking move under stress', async () => {
    const snapshot = await snapshotFor(true);
    const risk = scoreRisk(snapshot);
    const proposal = buildRebalanceFromLegs(samplePolicy, 'r', [
      { fromAssetId: 'tbill-rwa', toAssetId: 'usdc', weight: 0.12 },
    ]);
    expect(proposal.legs[0]?.amount).toBe(String(Math.round(0.12 * 1_200_000)));
    expect(evaluatePolicy(samplePolicy, risk, snapshot, proposal)).toHaveLength(0);
  });

  it('rejects an oversized move that breaches the single-rebalance cap', async () => {
    const snapshot = await snapshotFor(true);
    const risk = scoreRisk(snapshot);
    const proposal = buildRebalanceFromLegs(samplePolicy, 'r', [
      { fromAssetId: 'tbill-rwa', toAssetId: 'usdc', weight: 0.5 },
    ]);
    const violations = evaluatePolicy(samplePolicy, risk, snapshot, proposal);
    expect(violations.some((v) => v.constraint === 'maxSingleRebalancePct')).toBe(true);
  });

  it('rejects a compliant-but-pointless move that does not raise the buffer', async () => {
    const snapshot = await snapshotFor(true);
    const risk = scoreRisk(snapshot);
    // tbill-rwa → cspr: within cap, but doesn't add to the stablecoin buffer.
    const proposal = buildRebalanceFromLegs(samplePolicy, 'r', [
      { fromAssetId: 'tbill-rwa', toAssetId: 'cspr', weight: 0.05 },
    ]);
    const violations = evaluatePolicy(samplePolicy, risk, snapshot, proposal);
    expect(violations.some((v) => v.constraint === 'noImprovement')).toBe(true);
  });
});
