import { describe, expect, it } from 'vitest';
import { isProductionLike, loadConfig, validateRuntimeConfig } from './config.js';

const baseEnv = {
  CALIBER_ENV: 'testnet',
  CALIBER_SIGNAL_FEED_URL: 'https://signals.example.com/feed',
  CALIBER_DATABASE_URL: 'postgres://user:pass@localhost:5432/caliber',
  CALIBER_ADMIN_TOKEN: 'admin-token',
  CALIBER_DRY_RUN: 'false',
  CALIBER_VAULT_CONTRACT_HASH: 'contract-package-test',
  CASPER_SECRET_KEY_PATH: './keys/agent_secret_key.pem',
  CALIBER_POLICY_JSON: JSON.stringify({
    id: 'pol_testnet',
    name: 'Testnet Treasury',
    version: 1,
    owner: 'account-hash-test',
    allocations: [
      {
        assetId: 'tbill-rwa',
        label: 'Tokenized US T-Bills',
        assetClass: 'rwa',
        target: 0.6,
        min: 0.5,
        max: 0.7,
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
    updatedAt: '2026-07-20T00:00:00.000Z',
  }),
} satisfies NodeJS.ProcessEnv;

describe('runtime config modes', () => {
  it('allows local development with sqlite and dry-run defaults', () => {
    const c = loadConfig({ CALIBER_ENV: 'development' });
    expect(c.env).toBe('development');
    expect(c.db.kind).toBe('sqlite');
    expect(c.loop.dryRun).toBe(true);
    expect(() => validateRuntimeConfig(c)).not.toThrow();
  });

  it('identifies testnet and production as production-like modes', () => {
    expect(isProductionLike(loadConfig({ CALIBER_ENV: 'testnet' }))).toBe(true);
    expect(isProductionLike(loadConfig({ CALIBER_ENV: 'production' }))).toBe(true);
    expect(isProductionLike(loadConfig({ CALIBER_ENV: 'development' }))).toBe(false);
  });

  it('accepts complete testnet config for real execution', () => {
    const c = loadConfig(baseEnv);
    expect(c.db.kind).toBe('postgres');
    expect(c.loop.dryRun).toBe(false);
    expect(() => validateRuntimeConfig(c)).not.toThrow();
  });

  it('rejects deployed modes without production prerequisites', () => {
    const c = loadConfig({ CALIBER_ENV: 'production' });
    expect(() => validateRuntimeConfig(c)).toThrow(/CALIBER_SIGNAL_FEED_URL/);
    expect(() => validateRuntimeConfig(c)).toThrow(/CALIBER_POLICY_JSON or CALIBER_POLICY_PATH/);
    expect(() => validateRuntimeConfig(c)).toThrow(/Postgres/);
    expect(() => validateRuntimeConfig(c)).toThrow(/CALIBER_ADMIN_TOKEN/);
    expect(() => validateRuntimeConfig(c)).toThrow(/CALIBER_DRY_RUN=false/);
  });

  it('rejects invalid modes and numeric values', () => {
    const c = loadConfig({
      ...baseEnv,
      CALIBER_ENV: 'staging',
      CALIBER_LOOP_INTERVAL_MS: 'abc',
      CALIBER_KEY_ALGO: 'rsa',
    });
    expect(() => validateRuntimeConfig(c)).toThrow(/CALIBER_ENV/);
    expect(() => validateRuntimeConfig(c)).toThrow(/CALIBER_LOOP_INTERVAL_MS/);
    expect(() => validateRuntimeConfig(c)).toThrow(/CALIBER_KEY_ALGO/);
  });

  it('requires a Casper MCP URL when external MCP is required in deployed modes', () => {
    const c = loadConfig({
      ...baseEnv,
      CALIBER_CASPER_MCP_REQUIRED: 'true',
    });
    expect(() => validateRuntimeConfig(c)).toThrow(/CALIBER_CASPER_MCP_URL/);
  });
});
