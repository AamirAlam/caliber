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

Odra 2.x needs a **nightly** Rust toolchain (pinned by `rust-toolchain.toml`)
plus the wasm target, and `cargo-odra`:

```bash
cargo install cargo-odra        # https://odra.dev
# nightly + wasm32 target are auto-selected via rust-toolchain.toml
```

## Develop

```bash
pnpm --filter @helm/contracts build   # cargo odra build  → wasm/HelmVault.wasm
pnpm --filter @helm/contracts test    # cargo odra test   (in-memory OdraVM)
```

Tests cover record-rebalance (count + event), the paused guard, and owner
access control. All five pass on the OdraVM with no network.

## Deploy to testnet (Odra Livenet)

1. Generate and fund a key:
   ```bash
   casper-client keygen ./keys
   # fund the public key at https://testnet.cspr.live/tools/faucet
   ```
2. `cp .env.example .env` and set the `ODRA_CASPER_LIVENET_*` values.
3. `pnpm --filter @helm/contracts deploy:testnet`
   — builds the wasm and runs `bin/helm_vault_on_livenet.rs` (`--features livenet`),
   which submits the install deploy and **prints the contract package hash**.
4. Copy that hash into `apps/services/.env` (`HELM_VAULT_CONTRACT_HASH`) and
   `apps/web/.env.local` (`NEXT_PUBLIC_VAULT_CONTRACT_HASH`), then set
   `HELM_DRY_RUN=false` to submit real rebalances.

> Alternative: the Casper MCP server and the `cspr-click` agent skill can also
> build, sign, and submit deploys via natural language.
