#!/usr/bin/env bash
set -euo pipefail

# One-shot bootstrap for new contributors.
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Installing JS dependencies (pnpm)"
pnpm install

echo "==> Seeding .env files (only if missing)"
copy_env() { [ -f "$2" ] || { cp "$1" "$2"; echo "    created $2"; }; }
copy_env apps/web/.env.example apps/web/.env.local
copy_env apps/services/.env.example apps/services/.env
copy_env packages/contracts/.env.example packages/contracts/.env

echo "==> Done. Next:"
echo "    pnpm dev                         # web + services"
echo "    pnpm --filter @caliber/contracts test"
