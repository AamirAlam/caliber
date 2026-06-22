import type { TreasuryPolicy } from '@helm/shared';

/** A realistic example policy used for local dev and the run-once CLI. */
export const samplePolicy: TreasuryPolicy = {
  id: 'pol_demo',
  name: 'Conservative RWA Treasury',
  version: 1,
  owner: 'account-hash-0000demo',
  allocations: [
    {
      assetId: 'tbill-rwa',
      label: 'Tokenized US T-Bills',
      assetClass: 'rwa',
      target: 0.6,
      min: 0.5,
      max: 0.7,
    },
    {
      assetId: 'usdc',
      label: 'USDC liquidity buffer',
      assetClass: 'stablecoin',
      target: 0.3,
      min: 0.2,
      max: 0.4,
    },
    {
      assetId: 'cspr',
      label: 'Native CSPR',
      assetClass: 'native',
      target: 0.1,
      min: 0.05,
      max: 0.15,
    },
  ],
  constraints: {
    maxSingleRebalancePct: 0.2,
    minLiquidityBufferPct: 0.2,
    maxRiskScore: 70,
    requireHumanApproval: true,
    allowedCounterparties: [],
  },
  paused: false,
  updatedAt: new Date().toISOString(),
};
