import { describe, expect, it } from 'vitest';
import { CreateTreasuryWorkspaceSchema, TreasuryWorkspaceSchema } from './workspace.js';

const base = {
  name: 'RWA Income Treasury',
  ownerAccount: 'account-hash-test',
  vaultContractHash: 'hash-test',
  network: 'casper-test',
  policy: {
    rwaTarget: 60,
    stableTarget: 30,
    nativeTarget: 10,
    maxRiskScore: 70,
  },
  signals: {
    mode: 'operator',
    feedUrl: '',
  },
} as const;

describe('TreasuryWorkspaceSchema', () => {
  it('accepts a workspace creation payload', () => {
    expect(CreateTreasuryWorkspaceSchema.parse(base).name).toBe('RWA Income Treasury');
  });

  it('accepts a persisted workspace record', () => {
    const parsed = TreasuryWorkspaceSchema.parse({
      ...base,
      id: 'workspace_1',
      createdAt: '2026-07-25T00:00:00.000Z',
      updatedAt: '2026-07-25T00:00:00.000Z',
    });
    expect(parsed.id).toBe('workspace_1');
  });

  it('rejects workspace allocations that do not total 100%', () => {
    expect(() =>
      CreateTreasuryWorkspaceSchema.parse({
        ...base,
        policy: {
          ...base.policy,
          nativeTarget: 15,
        },
      }),
    ).toThrow(/allocations must total 100%/);
  });

  it('requires a feed URL for external signal sources', () => {
    expect(() =>
      CreateTreasuryWorkspaceSchema.parse({
        ...base,
        signals: {
          mode: 'external',
          feedUrl: '',
        },
      }),
    ).toThrow(/external signal mode requires feedUrl/);
  });
});
