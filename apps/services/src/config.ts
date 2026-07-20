export type RuntimeMode = 'development' | 'testnet' | 'production';

export interface CaliberConfig {
  env: RuntimeMode | string;
  casper: {
    rpcUrl: string;
    networkName: string;
    vaultContractHash: string;
    secretKeyPath: string;
    keyAlgo: string;
    paymentMotes: number;
  };
  ai: {
    provider: string;
    apiKey: string;
    model: string;
    reviewVotes: number;
  };
  api: {
    port: number;
    corsOrigin: string;
    adminToken: string;
  };
  loop: {
    intervalMs: number;
    dryRun: boolean;
  };
  signals: {
    feedUrl: string;
    timeoutMs: number;
    maxAgeMs: number;
  };
  policy: {
    json: string;
    path: string;
  };
  mcp: {
    casperUrl: string;
    required: boolean;
  };
  db:
    | { kind: 'memory' }
    | { kind: 'postgres'; url: string }
    | { kind: 'sqlite'; path: string };
}

/** Centralized environment access for the services app. */
export const config = loadConfig(process.env);

export function loadConfig(env: NodeJS.ProcessEnv): CaliberConfig {
  return {
    env: env.CALIBER_ENV ?? normalizeNodeEnv(env.NODE_ENV),
    casper: {
      rpcUrl: env.CASPER_NODE_RPC_URL ?? 'https://node.testnet.casper.network/rpc',
      networkName: env.CASPER_NETWORK_NAME ?? 'casper-test',
      vaultContractHash: env.CALIBER_VAULT_CONTRACT_HASH ?? '',
      secretKeyPath: env.CASPER_SECRET_KEY_PATH ?? '',
      /** Signing key algorithm: 'ed25519' (default) or 'secp256k1'. */
      keyAlgo: env.CALIBER_KEY_ALGO ?? 'ed25519',
      /** Payment (motes) for the record_rebalance contract call. */
      paymentMotes: numberEnv(env.CALIBER_PAYMENT_MOTES, 2_500_000_000),
    },
    ai: aiConfig(env),
    api: {
      // Prefer the platform-injected PORT (Railway/Render) so the service is reachable.
      port: numberEnv(env.PORT || env.CALIBER_API_PORT, 4000),
      corsOrigin: env.CALIBER_CORS_ORIGIN ?? 'http://localhost:3000',
      adminToken: env.CALIBER_ADMIN_TOKEN ?? '',
    },
    loop: {
      intervalMs: numberEnv(env.CALIBER_LOOP_INTERVAL_MS, 60000),
      dryRun: boolEnv(env.CALIBER_DRY_RUN, true),
    },
    signals: {
      feedUrl: env.CALIBER_SIGNAL_FEED_URL ?? env.RWA_FEED_URL ?? '',
      timeoutMs: numberEnv(env.CALIBER_SIGNAL_FEED_TIMEOUT_MS, 10000),
      maxAgeMs: numberEnv(env.CALIBER_SIGNAL_MAX_AGE_MS, 300000),
    },
    policy: {
      json: env.CALIBER_POLICY_JSON ?? '',
      path: env.CALIBER_POLICY_PATH ?? '',
    },
    mcp: {
      casperUrl: env.CALIBER_CASPER_MCP_URL ?? '',
      required: boolEnv(env.CALIBER_CASPER_MCP_REQUIRED, false),
    },
    db: dbConfig(env),
  };
}

/**
 * Persistence backend, selected by env:
 * - `CALIBER_DB=memory` → in-memory (tests/CI; no durability).
 * - `CALIBER_DATABASE_URL=postgres://…` → Postgres (production).
 * - otherwise → SQLite file at `CALIBER_SQLITE_PATH` (local dev, the default).
 */
function dbConfig(env: NodeJS.ProcessEnv): CaliberConfig['db'] {
  // Accept Railway's plugin default (`DATABASE_URL`) as a fallback.
  const url = env.CALIBER_DATABASE_URL || env.DATABASE_URL || '';
  if (env.CALIBER_DB === 'memory') return { kind: 'memory' as const };
  if (/^postgres(ql)?:\/\//.test(url)) return { kind: 'postgres' as const, url };
  return { kind: 'sqlite' as const, path: env.CALIBER_SQLITE_PATH ?? './data/caliber.dev.sqlite' };
}

/**
 * LLM provider config — model-agnostic. The provider selects the key env var and
 * a sensible default model; both are overridable via env.
 * - `anthropic` (default): key `ANTHROPIC_API_KEY`, model `claude-opus-4-8`.
 * - `openrouter`: key `OPENROUTER_API_KEY`, model `openai/gpt-4o-mini` — one key
 *   across many providers, with provider-level fallbacks for resilience.
 */
function aiConfig(env: NodeJS.ProcessEnv): CaliberConfig['ai'] {
  const provider = env.CALIBER_LLM_PROVIDER ?? 'anthropic';
  const defaults: Record<string, { model: string; keyEnv: string }> = {
    anthropic: { model: 'claude-opus-4-8', keyEnv: 'ANTHROPIC_API_KEY' },
    openrouter: { model: 'openai/gpt-4o-mini', keyEnv: 'OPENROUTER_API_KEY' },
  };
  const d = defaults[provider] ?? defaults.anthropic!;
  return {
    provider,
    apiKey: env[d.keyEnv] ?? '',
    // `||` (not `??`): an empty env value should fall back to the default model.
    model: env.CALIBER_DECISION_MODEL || d.model,
    /** Independent Risk-Officer reviews per rebalance; majority veto wins. */
    reviewVotes: numberEnv(env.CALIBER_REVIEW_VOTES, 3),
  };
}

function normalizeNodeEnv(nodeEnv: string | undefined): RuntimeMode {
  return nodeEnv === 'production' ? 'production' : 'development';
}

function numberEnv(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') return fallback;
  return Number(value);
}

function boolEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return value === 'true';
}

export function isProductionLike(c: CaliberConfig = config): boolean {
  return c.env === 'production' || c.env === 'testnet';
}

export function validateRuntimeConfig(c: CaliberConfig = config): void {
  const errors: string[] = [];

  const positive = (name: string, value: number) => {
    if (!Number.isFinite(value) || value <= 0) errors.push(`${name} must be a positive number`);
  };

  if (!['development', 'testnet', 'production'].includes(c.env)) {
    errors.push('CALIBER_ENV must be development, testnet, or production');
  }

  positive('PORT/CALIBER_API_PORT', c.api.port);
  positive('CALIBER_LOOP_INTERVAL_MS', c.loop.intervalMs);
  positive('CALIBER_PAYMENT_MOTES', c.casper.paymentMotes);
  positive('CALIBER_REVIEW_VOTES', c.ai.reviewVotes);
  positive('CALIBER_SIGNAL_FEED_TIMEOUT_MS', c.signals.timeoutMs);
  positive('CALIBER_SIGNAL_MAX_AGE_MS', c.signals.maxAgeMs);

  if (!['ed25519', 'secp256k1'].includes(c.casper.keyAlgo)) {
    errors.push('CALIBER_KEY_ALGO must be ed25519 or secp256k1');
  }

  if (!c.loop.dryRun) {
    if (!c.casper.vaultContractHash) errors.push('CALIBER_VAULT_CONTRACT_HASH is required when CALIBER_DRY_RUN=false');
    if (!c.casper.secretKeyPath) errors.push('CASPER_SECRET_KEY_PATH is required when CALIBER_DRY_RUN=false');
  }

  if (isProductionLike(c)) {
    if (!c.signals.feedUrl) errors.push('CALIBER_SIGNAL_FEED_URL is required in production/testnet');
    if (!c.policy.json && !c.policy.path) {
      errors.push('CALIBER_POLICY_JSON or CALIBER_POLICY_PATH is required in production/testnet');
    }
    if (c.db.kind !== 'postgres') errors.push('Postgres DATABASE_URL/CALIBER_DATABASE_URL is required in production/testnet');
    if (!c.api.adminToken) errors.push('CALIBER_ADMIN_TOKEN is required in production/testnet');
    if (c.loop.dryRun) errors.push('CALIBER_DRY_RUN=false is required in production/testnet');
    if (c.mcp.required && !c.mcp.casperUrl) {
      errors.push('CALIBER_CASPER_MCP_URL is required when CALIBER_CASPER_MCP_REQUIRED=true');
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid runtime config:\n- ${errors.join('\n- ')}`);
  }
}
