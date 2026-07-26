import { describe, expect, it } from 'vitest';
import type { AgentReview, Signal } from '@caliber/shared';
import { aggregatePanel, reviewContext, type ReviewInput } from './reviewer.js';
import { samplePolicy } from '../samplePolicy.js';
import { buildRebalanceFromLegs } from '../decision/index.js';
import { collectSignals, type SignalSource } from '../signals/index.js';
import { scoreRisk } from '../policy/index.js';

const approve = (): AgentReview => ({ approved: true, concern: 'ok', severity: 'low' });
const veto = (severity: AgentReview['severity'] = 'high'): AgentReview => ({
  approved: false,
  concern: `veto (${severity})`,
  severity,
});

describe('aggregatePanel — majority veto', () => {
  it('approves when a majority approve', () => {
    expect(aggregatePanel([approve(), approve(), veto()]).approved).toBe(true);
  });

  it('vetoes when a majority veto, carrying the worst severity', () => {
    const v = aggregatePanel([veto('medium'), veto('high'), approve()]);
    expect(v.approved).toBe(false);
    expect(v.severity).toBe('high');
    expect(v.concern).toContain('2 of 3');
  });

  it('a single veto in three does not block', () => {
    expect(aggregatePanel([veto(), approve(), approve()]).approved).toBe(true);
  });

  it('single reviewer: one veto blocks', () => {
    expect(aggregatePanel([veto('low')]).approved).toBe(false);
  });
});

describe('reviewContext — grounded facts', () => {
  it('reports the buffer delta and the deterministic verdict', async () => {
    const snapshot = await collectSignals([fixtureSource()], 'snap');
    const input: ReviewInput = {
      policy: samplePolicy,
      risk: scoreRisk(snapshot),
      snapshot,
      rebalance: buildRebalanceFromLegs(samplePolicy, 'r', [
        { fromAssetId: 'tbill-rwa', toAssetId: 'usdc', weight: 0.12 },
      ], snapshot),
      rationale: 'de-risk',
    };
    const ctx = reviewContext(input);
    expect(ctx).toContain('Liquidity buffer:');
    expect(ctx).toContain('Projected allocations:');
    expect(ctx).toContain('PASSES all constraints');
  });
});

function fixtureSource(): SignalSource {
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
        mk('tbill.yield.3m', '3M T-Bill yield', 4.5, 'pct', 0.95),
        mk('vault.liquidity.usd', 'Vault stablecoin liquidity', 180_000, 'usd'),
        mk('rwa.redemption.queue', 'RWA redemption queue depth', 40, 'count', 0.8),
      ];
    },
  };
}
