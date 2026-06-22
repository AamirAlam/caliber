# Developer setup

## Prerequisites

- Node.js ≥ 20 and [pnpm](https://pnpm.io) ≥ 9
- Rust + `wasm32-unknown-unknown` target (for contracts)
- `cargo-odra` and `casper-client` (for building/deploying contracts)

```bash
corepack enable
rustup target add wasm32-unknown-unknown
cargo install cargo-odra casper-client
```

## Bootstrap

```bash
git clone <repo> && cd helm
pnpm install
cp apps/web/.env.example apps/web/.env.local
cp apps/services/.env.example apps/services/.env
cp packages/contracts/.env.example packages/contracts/.env
```

## Everyday commands (run from the repo root)

| Command | What it does |
| --- | --- |
| `pnpm dev` | Run web + services in watch mode (Turborepo) |
| `pnpm build` | Build all packages |
| `pnpm lint` | Lint all packages |
| `pnpm test` | Run tests |
| `pnpm format` | Prettier write |
| `pnpm contracts:build` | `cargo odra build` |
| `pnpm contracts:test` | `cargo odra test` |

## Run pieces individually

```bash
pnpm --filter @helm/web dev          # frontend on :3000
pnpm --filter @helm/services dev     # agent loop
pnpm --filter @helm/services run:once # single loop, prints JSON
pnpm --filter @helm/contracts test   # contract tests
```
