/** Centralized environment access for the services app. */
export const config = {
  casper: {
    rpcUrl: process.env.CASPER_NODE_RPC_URL ?? 'https://node.testnet.casper.network/rpc',
    networkName: process.env.CASPER_NETWORK_NAME ?? 'casper-test',
    vaultContractHash: process.env.HELM_VAULT_CONTRACT_HASH ?? '',
    secretKeyPath: process.env.CASPER_SECRET_KEY_PATH ?? '',
    /** Signing key algorithm: 'ed25519' (default) or 'secp256k1'. */
    keyAlgo: process.env.HELM_KEY_ALGO ?? 'ed25519',
    /** Payment (motes) for the record_rebalance contract call. */
    paymentMotes: Number(process.env.HELM_PAYMENT_MOTES ?? '2500000000'),
  },
  ai: {
    /** LLM provider — model-agnostic. Currently only 'anthropic' is wired. */
    provider: process.env.HELM_LLM_PROVIDER ?? 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY ?? '',
    model: process.env.HELM_DECISION_MODEL ?? 'claude-opus-4-8',
  },
  api: {
    port: Number(process.env.HELM_API_PORT ?? '4000'),
    corsOrigin: process.env.HELM_CORS_ORIGIN ?? 'http://localhost:3000',
  },
  loop: {
    intervalMs: Number(process.env.HELM_LOOP_INTERVAL_MS ?? '60000'),
    dryRun: (process.env.HELM_DRY_RUN ?? 'true') === 'true',
  },
} as const;

export type HelmConfig = typeof config;
