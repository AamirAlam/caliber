#!/usr/bin/env bash
set -euo pipefail

# Deploy the Helm vault contract to Casper testnet.
# Prereqs: cargo-odra, casper-client, a funded testnet key.
# Usage: cp .env.example .env && edit values && pnpm --filter @helm/contracts deploy:testnet

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -f .env ]; then set -a; . ./.env; set +a; fi

: "${CASPER_NODE_RPC_URL:?set CASPER_NODE_RPC_URL}"
: "${CASPER_CHAIN_NAME:?set CASPER_CHAIN_NAME}"
: "${CASPER_SECRET_KEY_PATH:?set CASPER_SECRET_KEY_PATH}"

echo "==> Building contract wasm with cargo-odra"
cargo odra build

WASM_PATH="wasm/HelmVault.wasm"
echo "==> Expecting wasm at $WASM_PATH"

# TODO: submit the install deploy with casper-client put-deploy, passing
# session-arg owner and policy_ref. Capture the deploy hash and, after
# finalization, the resulting contract package hash.
echo "==> Deployment is a scaffold placeholder. Implement the casper-client call here."
