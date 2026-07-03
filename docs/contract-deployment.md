# Contract deployment (Casper testnet)

## Current deployed instance

`CaliberVault` is live on `casper-test`:

| | |
|---|---|
| Package hash | `contract-package-5dd0bfde53bf885dc64b7009d4c02030aced4c8525ff7a1f3c0735d238142ce0` |
| Contract hash | `contract-bdac504ff9f57316de41be341459cfea603589cd10e302db89e61b0b0dbb4ff5` |
| Package on explorer | https://testnet.cspr.live/contract-package/5dd0bfde53bf885dc64b7009d4c02030aced4c8525ff7a1f3c0735d238142ce0 |
| Contract on explorer | https://testnet.cspr.live/contract/bdac504ff9f57316de41be341459cfea603589cd10e302db89e61b0b0dbb4ff5 |

The steps below redeploy your own instance.

## 1. Get a funded key

Generate a key and fund it from the testnet faucet:

```bash
casper-client keygen ./packages/contracts/keys
# Fund the public key at https://testnet.cspr.live/tools/faucet
```

> Never commit keys. `keys/` and `*.pem` are git-ignored.

## 2. Configure

```bash
cd packages/contracts
cp .env.example .env
# set CASPER_NODE_RPC_URL, CASPER_CHAIN_NAME, CASPER_SECRET_KEY_PATH,
# VAULT_OWNER_ACCOUNT_HASH, VAULT_POLICY_REF
```

## 3. Build & deploy

```bash
pnpm --filter @caliber/contracts build          # → wasm/CaliberVault.wasm
pnpm --filter @caliber/contracts deploy:testnet # scaffold script — implement the put-deploy
```

## 4. Wire the hash back into the apps

After finalization, copy the contract package hash into:

- `apps/services/.env` → `CALIBER_VAULT_CONTRACT_HASH`
- `apps/web/.env.local` → `NEXT_PUBLIC_VAULT_CONTRACT_HASH`

## Alternatives

- **Casper MCP server** — submit deploys and read state via natural language.
- **`cspr-click` agent skill** — wallet, signing, and Odra deployment.
