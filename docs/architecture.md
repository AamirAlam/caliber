# Architecture

Caliber is a policy-driven AI treasury control plane for tokenized real-world
assets (RWAs), built on Casper. It separates **deterministic guardrails** from
**agentic reasoning** so autonomy stays safe near a treasury.

## Monorepo layout

```
apps/
  web/         Next.js frontend — landing page + dashboard shell
  services/    Off-chain agent orchestrator (signals → … → execution → audit)
packages/
  contracts/   Casper treasury-vault contract (Odra)
  shared/      Zod schemas + TypeScript domain types (single source of truth)
  config/      Shared ESLint + tsconfig
docs/          Architecture, dev setup, contract deployment
scripts/       Repo-level helpers
```

## The agent loop

```
collect signals → score risk → evaluate policy → generate decision
   → (await human approval) → execute on Casper → record audit log
```

- **Signals** — pluggable sources (market data, RWA feeds, on-chain reads).
- **Policy** — deterministic risk scoring + constraint checks. The *only* gate
  on execution.
- **Decision** — chooses hold / rebalance / halt and produces an AI-authored
  explanation that is descriptive only.
- **Execution** — `CasperExecutor` builds and submits the `record_rebalance`
  deploy to Casper testnet.
- **Audit** — append-only log of every snapshot, decision, and transaction hash.

## On-chain anchor

`packages/contracts` exposes the `CaliberVault` contract. Its `record_rebalance`
entry point is the transaction-producing component: approved decisions are
anchored on Casper, emitting `RebalanceRecorded` audit events.

## Data model

All packages share one model defined as Zod schemas in `@caliber/shared`:
treasury policy, asset allocation, signal snapshot, risk score, recommendation,
rebalance request, transaction record, agent run log.
