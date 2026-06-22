# Helm

**Policy-driven AI treasury control plane for tokenized real-world assets, built on Casper.**

Helm pairs disciplined risk frameworks with agentic automation and full onchain
transparency. It watches market and RWA signals, reasons about risk and
liquidity within a treasury's mandate, and executes approved rebalances on
Casper — every action verifiable onchain.

> Helm is **not** a generic yield vault. It treats a treasury as a mandate with
> constraints — allocation bands, liquidity buffers, risk ceilings — and acts
> only within them.

Built for the **Casper Agentic Buildathon** — agentic AI × DeFi × RWAs × Casper.

## Monorepo layout

| Path | What |
| --- | --- |
| `apps/web` | Next.js frontend — landing page + dashboard shell |
| `apps/services` | Off-chain agent orchestrator (signals → policy → decision → execution → audit) |
| `packages/contracts` | Casper treasury-vault contract (Odra) — the on-chain anchor |
| `packages/shared` | Zod schemas + TypeScript domain types (one source of truth) |
| `packages/config` | Shared ESLint + tsconfig |
| `docs` | Architecture, dev setup, contract deployment |
| `scripts` | Repo-level helpers |

Tooling: **pnpm** workspaces + **Turborepo**, **TypeScript** throughout,
**Tailwind CSS**, **Odra** for contracts, **ESLint** + **Prettier**.

## Quick start

```bash
corepack enable
pnpm install
bash scripts/setup.sh    # seeds .env files

pnpm dev                 # run web (:3000) + services together
```

Run pieces individually:

```bash
pnpm --filter @helm/web dev            # frontend
pnpm --filter @helm/services run:once  # one agent loop, prints JSON
pnpm --filter @helm/contracts test     # contract tests (cargo odra)
```

## Root scripts

| Script | Purpose |
| --- | --- |
| `pnpm dev` | Dev mode across apps |
| `pnpm build` | Build all packages |
| `pnpm lint` | Lint |
| `pnpm test` | Test |
| `pnpm typecheck` | Typecheck |
| `pnpm format` | Prettier write |
| `pnpm contracts:build` / `contracts:test` | Odra build / test |

## How it works

```
collect signals → score risk → evaluate policy → generate decision
   → (await human approval) → execute on Casper → record audit log
```

Deterministic policy checks are the **only** gate on execution; the AI-authored
rationale is explanatory and never overrides the rules. See
[`docs/architecture.md`](docs/architecture.md).

## Casper testnet

The `HelmVault` contract's `record_rebalance` entry point is the
transaction-producing on-chain component. To deploy, see
[`docs/contract-deployment.md`](docs/contract-deployment.md). The
[Casper AI toolkit](https://www.casper.network/ai) (Odra, CSPR.cloud, the
`cspr-click` skill, and the Casper MCP server) streamlines wallet, signing, and
deployment during the hackathon.

## Hackathon submission checklist

- [ ] Vault contract deployed to Casper testnet
- [ ] At least one transaction-producing on-chain action (`record_rebalance`)
- [ ] Public, open-source repo with this README
- [ ] Demo video
- [ ] Original code and content only

## License

MIT
