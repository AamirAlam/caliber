import { describe, expect, it } from 'vitest';
import type { RebalanceRequest } from '@caliber/shared';
import { decisionContentHash } from './index.js';

const rebalance: RebalanceRequest = {
  id: 'reb_run1',
  policyId: 'pol_local',
  legs: [{ fromAssetId: 'tbill-rwa', toAssetId: 'usdc', amount: '144000', weight: 0.12 }],
  createdAt: '2026-07-25T00:00:00.000Z',
};

const ctx = { policyId: 'pol_local', snapshotId: 'snap_1', riskScore: 72 };

describe('decisionContentHash', () => {
  it('is deterministic for the same decision content', () => {
    expect(decisionContentHash(rebalance, ctx)).toBe(decisionContentHash(rebalance, ctx));
    expect(decisionContentHash(rebalance, ctx)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes when any decision input changes', () => {
    const base = decisionContentHash(rebalance, ctx);
    expect(decisionContentHash(rebalance, { ...ctx, riskScore: 71 })).not.toBe(base);
    expect(
      decisionContentHash(
        { ...rebalance, legs: [{ ...rebalance.legs[0]!, amount: '144001' }] },
        ctx,
      ),
    ).not.toBe(base);
  });
});
