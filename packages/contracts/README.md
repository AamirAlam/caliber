# @helm/contracts — Casper treasury vault (Odra)

The on-chain anchor of Helm. The `HelmVault` contract stores the active policy
reference, records approved rebalances, supports pause/resume and owner-gated
access control, and emits audit events.

This is the **transaction-producing on-chain component** required for the
buildathon: the off-chain agent calls `record_rebalance` to anchor an approved
decision on Casper testnet.

## Contract surface

| Entry point | Purpose |
| --- | --- |
| `init(owner, policy_ref)` | One-time constructor |
| `set_policy(policy_ref)` | Update active policy (owner only); bumps version |
| `set_paused(paused)` | Pause/resume; emits `PausedSet` |
| `record_rebalance(rebalance_id)` | **Anchor an approved rebalance**; emits `RebalanceRecorded` |
| `is_paused()` / `rebalance_count()` | Read-only views |

Bodies are scaffolding with `TODO`s — the storage and event wiring is left to fill in.

## Toolchain

```bash
rustup target add wasm32-unknown-unknown
cargo install cargo-odra        # https://odra.dev
cargo install casper-client     # for deploys
```

## Develop

```bash
pnpm --filter @helm/contracts build   # cargo odra build  → wasm/HelmVault.wasm
pnpm --filter @helm/contracts test    # cargo odra test   (in-memory backend)
```

## Deploy to testnet

1. `cp .env.example .env` and fill in RPC, chain name, and a funded key
   (faucet: https://testnet.cspr.live/tools/faucet).
2. `pnpm --filter @helm/contracts deploy:testnet`
3. Record the resulting contract package hash into the web and services
   `.env` files (`HELM_VAULT_CONTRACT_HASH` / `NEXT_PUBLIC_VAULT_CONTRACT_HASH`).

> Tip: the Casper MCP server and the `cspr-click` agent skill can build, sign,
> and submit deploys via natural language — handy during the hackathon.
