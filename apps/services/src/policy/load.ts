import { readFileSync } from 'node:fs';
import { TreasuryPolicySchema, type TreasuryPolicy } from '@caliber/shared';
import { ZodError } from 'zod';
import { config, isProductionLike, type CaliberConfig } from '../config.js';
import { samplePolicy } from '../samplePolicy.js';

export function loadPolicy(c: CaliberConfig = config): TreasuryPolicy {
  if (c.policy.json) return parsePolicy(c.policy.json, 'CALIBER_POLICY_JSON');
  if (c.policy.path) return parsePolicy(readFileSync(c.policy.path, 'utf8'), c.policy.path);
  if (isProductionLike(c)) {
    throw new Error('CALIBER_POLICY_JSON or CALIBER_POLICY_PATH is required in production/testnet');
  }
  return samplePolicy;
}

function parsePolicy(raw: string, source: string): TreasuryPolicy {
  try {
    return TreasuryPolicySchema.parse(JSON.parse(raw));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid treasury policy JSON from ${source}: ${error.message}`);
    }
    if (error instanceof ZodError) {
      throw new Error(`Invalid treasury policy from ${source}: ${error.message}`);
    }
    throw error;
  }
}
