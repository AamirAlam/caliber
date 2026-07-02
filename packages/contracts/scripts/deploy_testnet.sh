#!/usr/bin/env bash
set -euo pipefail

# Deploy the HelmVault contract to Casper testnet via Odra's Livenet integration.
#
# Prereqs:
#   - Rust nightly (pinned by rust-toolchain.toml) + wasm32 target
#   - cargo-odra:  cargo install cargo-odra
#   - A funded testnet key. Generate + fund:
#       casper-client keygen ./keys
#       # fund the public key at https://testnet.cspr.live/tools/faucet
#   - cp .env.example .env  (and set ODRA_CASPER_LIVENET_* values)
#
# Usage:  pnpm --filter @helm/contracts deploy:testnet

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -f .env ]; then set -a; . ./.env; set +a; fi

: "${ODRA_CASPER_LIVENET_NODE_ADDRESS:?set ODRA_CASPER_LIVENET_NODE_ADDRESS}"
: "${ODRA_CASPER_LIVENET_CHAIN_NAME:?set ODRA_CASPER_LIVENET_CHAIN_NAME}"
: "${ODRA_CASPER_LIVENET_SECRET_KEY_PATH:?set ODRA_CASPER_LIVENET_SECRET_KEY_PATH}"

echo "==> Building contract wasm (cargo odra build)"
cargo odra build

echo "==> Deploying HelmVault to ${ODRA_CASPER_LIVENET_CHAIN_NAME}"
echo "    This submits a real, gas-paying install deploy and prints the package hash."
cargo run --bin helm_vault_on_livenet --features livenet

echo
echo "==> Done. Copy the printed package hash into:"
echo "      apps/services/.env    HELM_VAULT_CONTRACT_HASH"
echo "      apps/web/.env.local   NEXT_PUBLIC_VAULT_CONTRACT_HASH"
echo "    Then set HELM_DRY_RUN=false in apps/services/.env to submit real rebalances."
