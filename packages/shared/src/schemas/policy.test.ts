import { describe, expect, it } from 'vitest';
import { TreasuryPolicySchema } from './policy.js';

describe('TreasuryPolicySchema', () => {
  it('parses a valid policy', () => {
    const parsed = TreasuryPolicySchema.parse({
      id: 'pol_live',
      name: 'Live Treasury',
      version: 1,
      owner: 'account-hash-owner',
      allocations: [
        { assetId: 'tbill-rwa', label: 'Tokenized T-Bills', assetClass: 'rwa', target: 0.6, min: 0.5, max: 0.7 },
        { assetId: 'usdc', label: 'USDC', assetClass: 'stablecoin', target: 0.3, min: 0.2, max: 0.4 },
      ],
      constraints: {
        maxSingleRebalancePct: 0.2,
        minLiquidityBufferPct: 0.2,
        maxRiskScore: 70,
        requireHumanApproval: true,
        allowedCounterparties: [],
      },
      paused: false,
      updatedAt: '2026-07-03T01:00:00.000Z',
    });

    expect(parsed.constraints.requireHumanApproval).toBe(true);
  });
});
