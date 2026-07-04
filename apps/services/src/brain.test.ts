import { describe, expect, it } from 'vitest';
import { collectSignals, SimulatedSignalSource } from './signals/index.js';
import { evaluatePolicy, scoreRisk } from './policy/index.js';
import { buildRebalanceFromLegs, decideAction } from './decision/index.js';
import { samplePolicy } from './samplePolicy.js';
import { AppState } from './state.js';

async function snapshotFor(stress: boolean) {
  const state = new AppState(samplePolicy);
  state.scenarioStress = stress;
  return collectSignals([new SimulatedSignalSource(state)], 'snap_test');
}

describe('signals + risk', () => {
  it('is deterministic for a given scenario flag and tick', async () => {
    const a = await snapshotFor(true);
    const b = await snapshotFor(true);
    expect(a.signals).toEqual(b.signals);
  });

  it('scores calm low and stress high', async () => {
    const calm = scoreRisk(await snapshotFor(false));
    const stress = scoreRisk(await snapshotFor(true));
    expect(calm.score).toBeLessThan(samplePolicy.constraints.maxRiskScore);
    expect(stress.score).toBeGreaterThan(samplePolicy.constraints.maxRiskScore);
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
