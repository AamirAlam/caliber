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
  ai: {
    /** LLM provider — model-agnostic. Currently only 'anthropic' is wired. */
    provider: process.env.CALIBER_LLM_PROVIDER ?? 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY ?? '',
    model: process.env.CALIBER_DECISION_MODEL ?? 'claude-opus-4-8',
    /** Independent Risk-Officer reviews per rebalance; majority veto wins. */
    reviewVotes: Number(process.env.CALIBER_REVIEW_VOTES ?? '3'),
  },
  api: {
    port: Number(process.env.CALIBER_API_PORT ?? '4000'),
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
  const url = process.env.CALIBER_DATABASE_URL ?? '';
  if (process.env.CALIBER_DB === 'memory') return { kind: 'memory' as const };
  if (/^postgres(ql)?:\/\//.test(url)) return { kind: 'postgres' as const, url };
  return { kind: 'sqlite' as const, path: process.env.CALIBER_SQLITE_PATH ?? './data/caliber.dev.sqlite' };
}

export type CaliberConfig = typeof config;
