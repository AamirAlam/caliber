/** Centralized environment access for the services app. */
export const config = {
  casper: {
    rpcUrl: process.env.CASPER_NODE_RPC_URL ?? 'https://node.testnet.casper.network/rpc',
    networkName: process.env.CASPER_NETWORK_NAME ?? 'casper-test',
    vaultContractHash: process.env.CALIBER_VAULT_CONTRACT_HASH ?? '',
    secretKeyPath: process.env.CASPER_SECRET_KEY_PATH ?? '',
    /** Signing key algorithm: 'ed25519' (default) or 'secp256k1'. */
    keyAlgo: process.env.CALIBER_KEY_ALGO ?? 'ed25519',
    /** Payment (motes) for the record_rebalance contract call. */
    paymentMotes: Number(process.env.CALIBER_PAYMENT_MOTES ?? '2500000000'),
  },
  ai: aiConfig(),
  api: {
    // Prefer the platform-injected PORT (Railway/Render) so the service is reachable.
    port: Number(process.env.PORT || process.env.CALIBER_API_PORT || '4000'),
    corsOrigin: process.env.CALIBER_CORS_ORIGIN ?? 'http://localhost:3000',
  },
  loop: {
    intervalMs: Number(process.env.CALIBER_LOOP_INTERVAL_MS ?? '60000'),
    dryRun: (process.env.CALIBER_DRY_RUN ?? 'true') === 'true',
  },
  db: dbConfig(),
} as const;

/**
 * Persistence backend, selected by env:
 * - `CALIBER_DB=memory` → in-memory (tests/CI; no durability).
 * - `CALIBER_DATABASE_URL=postgres://…` → Postgres (production).
 * - otherwise → SQLite file at `CALIBER_SQLITE_PATH` (local dev, the default).
 */
function dbConfig() {
  // Accept Railway's plugin default (`DATABASE_URL`) as a fallback.
  const url = process.env.CALIBER_DATABASE_URL || process.env.DATABASE_URL || '';
  if (process.env.CALIBER_DB === 'memory') return { kind: 'memory' as const };
  if (/^postgres(ql)?:\/\//.test(url)) return { kind: 'postgres' as const, url };
  return { kind: 'sqlite' as const, path: process.env.CALIBER_SQLITE_PATH ?? './data/caliber.dev.sqlite' };
}

/**
 * LLM provider config — model-agnostic. The provider selects the key env var and
 * a sensible default model; both are overridable via env.
 * - `anthropic` (default): key `ANTHROPIC_API_KEY`, model `claude-opus-4-8`.
 * - `openrouter`: key `OPENROUTER_API_KEY`, model `openai/gpt-4o-mini` — one key
 *   across many providers, with provider-level fallbacks for resilience.
 */
function aiConfig() {
  const provider = process.env.CALIBER_LLM_PROVIDER ?? 'anthropic';
  const defaults: Record<string, { model: string; keyEnv: string }> = {
    anthropic: { model: 'claude-opus-4-8', keyEnv: 'ANTHROPIC_API_KEY' },
    openrouter: { model: 'openai/gpt-4o-mini', keyEnv: 'OPENROUTER_API_KEY' },
  };
  const d = defaults[provider] ?? defaults.anthropic!;
  return {
    provider,
    apiKey: process.env[d.keyEnv] ?? '',
    // `||` (not `??`): an empty env value should fall back to the default model.
    model: process.env.CALIBER_DECISION_MODEL || d.model,
    /** Independent Risk-Officer reviews per rebalance; majority veto wins. */
    reviewVotes: Number(process.env.CALIBER_REVIEW_VOTES ?? '3'),
  };
}

export type CaliberConfig = typeof config;
