/** Centralized environment access for the services app. */
export const config = {
  casper: {
    rpcUrl: process.env.CASPER_NODE_RPC_URL ?? 'https://node.testnet.casper.network/rpc',
    networkName: process.env.CASPER_NETWORK_NAME ?? 'casper-test',
    vaultContractHash: process.env.HELM_VAULT_CONTRACT_HASH ?? '',
    secretKeyPath: process.env.CASPER_SECRET_KEY_PATH ?? '',
  },
  ai: {
    apiKey: process.env.ANTHROPIC_API_KEY ?? '',
    model: process.env.HELM_DECISION_MODEL ?? 'claude-opus-4-8',
  },
  loop: {
    intervalMs: Number(process.env.HELM_LOOP_INTERVAL_MS ?? '60000'),
    dryRun: (process.env.HELM_DRY_RUN ?? 'true') === 'true',
  },
} as const;

export type HelmConfig = typeof config;
