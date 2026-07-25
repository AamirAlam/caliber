import { describe, expect, it } from 'vitest';
import { loadConfig } from '../config.js';
import { samplePolicy } from '../samplePolicy.js';
import { loadPolicy } from './load.js';

describe('loadPolicy', () => {
  it('loads the checked-in testnet policy file by default in testnet mode', () => {
    const policy = loadPolicy(loadConfig({ CALIBER_ENV: 'testnet' }));
    expect(policy.id).toBe('pol_testnet');
  });

  it('loads and validates policy JSON from runtime config', () => {
    const policy = loadPolicy(loadConfig({ CALIBER_POLICY_JSON: JSON.stringify(samplePolicy) }));
    expect(policy.id).toBe(samplePolicy.id);
    expect(policy.allocations).toHaveLength(samplePolicy.allocations.length);
  });

  it('prefers a policy file over JSON so Railway JSON paste errors do not break testnet', () => {
    const policy = loadPolicy(loadConfig({ CALIBER_ENV: 'testnet', CALIBER_POLICY_JSON: '{' }));
    expect(policy.id).toBe('pol_testnet');
  });

  it('rejects invalid policy JSON', () => {
    const c = loadConfig({ CALIBER_POLICY_JSON: JSON.stringify({ id: 'missing-required-fields' }) });
    expect(() => loadPolicy(c)).toThrow(/Invalid treasury policy/);
  });

  it('keeps the sample policy as a local development fallback only', () => {
    const policy = loadPolicy(loadConfig({ CALIBER_ENV: 'development' }));
    expect(policy.id).toBe(samplePolicy.id);
  });

  it('requires a configured policy in deployed modes', () => {
    const c = loadConfig({ CALIBER_ENV: 'production' });
    expect(() => loadPolicy(c)).toThrow(/CALIBER_POLICY_JSON or CALIBER_POLICY_PATH/);
  });
});
