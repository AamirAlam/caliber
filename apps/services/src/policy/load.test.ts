import { describe, expect, it } from 'vitest';
import { loadConfig } from '../config.js';
import { samplePolicy } from '../samplePolicy.js';
import { loadPolicy } from './load.js';

describe('loadPolicy', () => {
  it('loads the checked-in testnet policy file by default in testnet mode', () => {
    const policy = loadPolicy(loadConfig({ CALIBER_ENV: 'testnet' }));
    expect(policy.id).toBe('pol_testnet');
  });

  it('keeps the sample policy as a local development fallback only', () => {
    const policy = loadPolicy(loadConfig({ CALIBER_ENV: 'development' }));
    expect(policy.id).toBe(samplePolicy.id);
  });

  it('loads the checked-in policy file in production mode too', () => {
    const c = loadConfig({ CALIBER_ENV: 'production' });
    expect(loadPolicy(c).id).toBe('pol_testnet');
  });
});
