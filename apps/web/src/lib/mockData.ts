import type {
  AgentRunLog,
  Recommendation,
  RiskScore,
  Signal,
  TreasuryPolicy,
} from '@caliber/shared';

/**
 * Static demo data for the dashboard shell. Replace with live calls to the
 * services API (NEXT_PUBLIC_SERVICES_URL) once it exposes HTTP endpoints.
 */

export const demoPolicy: TreasuryPolicy = {
  id: 'pol_demo',
  name: 'Conservative RWA Treasury',
  version: 1,
  owner: 'account-hash-0000demo',
  allocations: [
    { assetId: 'tbill-rwa', label: 'Tokenized US T-Bills', assetClass: 'rwa', target: 0.6, min: 0.5, max: 0.7 },
    { assetId: 'usdc', label: 'USDC liquidity buffer', assetClass: 'stablecoin', target: 0.3, min: 0.2, max: 0.4 },
    { assetId: 'cspr', label: 'Native CSPR', assetClass: 'native', target: 0.1, min: 0.05, max: 0.15 },
  ],
  constraints: {
    maxSingleRebalancePct: 0.2,
    minLiquidityBufferPct: 0.2,
    maxRiskScore: 70,
    requireHumanApproval: true,
    allowedCounterparties: [],
  },
  paused: false,
  updatedAt: '2026-06-23T09:00:00.000Z',
};

export const demoSignals: Signal[] = [
  { key: 'tbill.yield.3m', label: '3M T-Bill yield', value: 5.1, unit: 'pct', source: 'mock-market', confidence: 0.95, observedAt: '2026-06-23T09:00:00.000Z' },
  { key: 'vault.liquidity.usd', label: 'Vault stablecoin liquidity', value: 420000, unit: 'usd', source: 'mock-market', confidence: 1, observedAt: '2026-06-23T09:00:00.000Z' },
  { key: 'rwa.redemption.queue', label: 'RWA redemption queue depth', value: 3, unit: 'count', source: 'mock-market', confidence: 0.8, observedAt: '2026-06-23T09:00:00.000Z' },
];

export const demoRisk: RiskScore = {
  score: 29,
  band: 'moderate',
  factors: [
    { key: 'vault.liquidity.usd', label: 'Liquidity buffer', contribution: 20 },
    { key: 'rwa.redemption.queue', label: 'Redemption pressure', contribution: 9 },
  ],
  snapshotId: 'snap_42',
  computedAt: '2026-06-23T09:00:01.000Z',
};

export const demoRecommendation: Recommendation = {
  id: 'rec_run_42',
  runId: 'run_42',
  action: 'hold',
  compliancePassed: true,
  violations: [],
  riskScore: 29,
  explanation:
    'Holding. Risk is moderate (29/100) and allocations are within target bands. The liquidity buffer is comfortably above the 20% floor, so no rebalance is warranted this cycle.',
  confidence: 0.8,
  agentProposed: true,
  createdAt: '2026-06-23T09:00:02.000Z',
};

export const demoRuns: AgentRunLog[] = [
  { id: 'run_42', policyId: 'pol_demo', stage: 'done', status: 'completed', action: 'hold', snapshotId: 'snap_42', riskScore: 29, recommendationId: 'rec_run_42', startedAt: '2026-06-23T09:00:00.000Z', endedAt: '2026-06-23T09:00:02.000Z', notes: 'Hold — within bands.' },
  { id: 'run_41', policyId: 'pol_demo', stage: 'done', status: 'completed', action: 'rebalance', snapshotId: 'snap_41', riskScore: 44, recommendationId: 'rec_run_41', transactionId: 'tx_reb_41', startedAt: '2026-06-23T08:00:00.000Z', endedAt: '2026-06-23T08:00:05.000Z', notes: 'Rebalanced 12% into liquidity buffer.' },
  { id: 'run_40', policyId: 'pol_demo', stage: 'await_approval', status: 'rejected', action: 'halt', snapshotId: 'snap_40', riskScore: 73, recommendationId: 'rec_run_40', startedAt: '2026-06-23T07:00:00.000Z', endedAt: '2026-06-23T07:05:00.000Z', notes: 'Risk over ceiling; halted pending review.' },
];
