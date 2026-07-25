import { readFileSync } from 'node:fs';
import { TreasuryPolicySchema, type TreasuryPolicy } from '@caliber/shared';
import { ZodError } from 'zod';
import { config, isProductionLike, type CaliberConfig } from '../config.js';
import { samplePolicy } from '../samplePolicy.js';

const DEPLOYED_POLICY_PATH = './config/testnet-policy.json';

export function loadPolicy(c: CaliberConfig = config): TreasuryPolicy {
  if (isProductionLike(c)) {
    return parsePolicy(readFileSync(DEPLOYED_POLICY_PATH, 'utf8'), DEPLOYED_POLICY_PATH);
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
