<div align="center">

# Caliber

**Policy-driven AI treasury control plane for tokenized real-world assets, built on Casper.**

Agentic AI × DeFi × RWAs × Casper · Casper Agentic Buildathon 2026

</div>

Caliber pairs disciplined risk frameworks with agentic automation and full on-chain
transparency. It watches market and RWA signals, reasons about risk and liquidity
within a treasury's mandate, and executes **approved** rebalances on Casper — every
decision and transaction verifiable on-chain.

> Caliber is **not** a generic yield vault. It treats a treasury as a mandate with
> constraints — allocation bands, liquidity buffers, risk ceilings — and acts only
> within them. The AI reasons; deterministic policy decides what may execute.

---

## Live on Casper testnet

The prototype is deployed and producing real transactions on `casper-test`.

| | |
|---|---|
| **Network** | Casper testnet (`casper-test`) |
| **CaliberVault package hash** | [`5dd0bfde…12a8cbd2`](https://testnet.cspr.live/contract-package/5dd0bfde53bf885dc64b7009d4c02030aced4c8525ff7a1f3c0735d238142ce0) |
| **Contract hash** | [`bdac504f…0dbb4ff5`](https://testnet.cspr.live/contract/bdac504ff9f57316de41be341459cfea603589cd10e302db89e61b0b0dbb4ff5) |
| **Transaction-producing entry point** | `record_rebalance` |
| **On-chain rebalances recorded** | read live from the contract's `rebalance_count` |
| **Explorer** | [testnet.cspr.live](https://testnet.cspr.live/contract-package/5dd0bfde53bf885dc64b7009d4c02030aced4c8525ff7a1f3c0735d238142ce0) |

> Full package hash: `contract-package-5dd0bfde53bf885dc64b7009d4c02030aced4c8525ff7a1f3c0735d238142ce0`

Caliber interacts with Casper **both ways**: it *writes* approved rebalances via
`record_rebalance`, and *reads* live contract state (`paused`, `rebalance_count`)
straight from global state — no off-chain bookkeeping.

## What makes it different

- **A real multi-agent decision, not a narrator.** A **Proposer** agent designs the
  move (which asset to trim, sizing, rationale) and must pass the deterministic
  policy engine; an adversarial **Risk-Reviewer** agent then signs off or vetoes.
- **Deterministic guardrails are the only gate on execution.** Allocation bands,
  liquidity floors, risk ceilings, and single-rebalance caps are enforced in code —
  the LLM can never loosen them, only propose within them.
- **Human-in-the-loop + on-chain audit.** Nothing settles without approval, and every
  run's signals, decision, rationale, review, and deploy hash are recorded.
- **Model-agnostic.** The agent runs on the Vercel AI SDK; swap the LLM via config
  (Claude by default). With no API key it falls back to a deterministic decision, so
  the demo always runs.

## How it works

```
collect signals → score risk → PROPOSER agent designs a move
    → deterministic policy gate (the hard gate)
    → RISK-REVIEWER agent signs off / vetoes
    → await human approval
    → execute on Casper (record_rebalance)
    → record audit log + read on-chain state
```

Deterministic policy checks decide what may execute; the AI-authored rationale is
explanatory and never overrides the rules. See [`docs/architecture.md`](docs/architecture.md).

## Monorepo layout

| Path | What |
|---|---|
| `apps/web` | Next.js frontend — landing page + live dashboard (risk gauge, agent deliberation, paginated run history) |
| `apps/services` | Off-chain agent orchestrator — signals → risk → **proposer/reviewer agents** → policy gate → execution → audit, exposed over a Fastify API |
| `packages/contracts` | Casper treasury-vault contract (**Odra**) — the on-chain anchor |
| `packages/shared` | Zod schemas + TypeScript domain types (one source of truth) |
| `packages/config` | Shared ESLint + tsconfig |
| `docs` | Architecture, dev setup, contract deployment |
| `scripts` | Repo-level helpers |

**Stack:** pnpm workspaces + Turborepo · TypeScript · Next.js + Tailwind CSS ·
Vercel AI SDK (model-agnostic agents) · casper-js-sdk · Odra (Rust) ·
Kysely + SQLite (dev) / Postgres (prod) · ESLint + Prettier.

## Quick start

```bash
corepack enable
pnpm install
bash scripts/setup.sh          # seeds .env files

pnpm dev                       # web (:3000) + services API (:4000) together
```

Open **http://localhost:3000** for the landing page and **/dashboard** for the app.

Run pieces individually:

```bash
pnpm --filter @caliber/web dev            # frontend only
pnpm --filter @caliber/services dev       # agent API only
pnpm --filter @caliber/services run:once  # one agent loop, prints JSON
pnpm --filter @caliber/contracts test     # contract tests (cargo odra, 5/5)
```

### Configuration

Copy the env templates (done by `scripts/setup.sh`) and fill in as needed:

- `apps/services/.env` — `CASPER_NODE_RPC_URL`, `CALIBER_VAULT_CONTRACT_HASH`,
  `CASPER_SECRET_KEY_PATH` (+ `CALIBER_KEY_ALGO`), `CALIBER_SIGNAL_FEED_URL`,
  `CALIBER_ADMIN_TOKEN`, and `CALIBER_DRY_RUN=false` for real testnet execution.
- **AI (optional):** set `ANTHROPIC_API_KEY` to enable the live Proposer + Risk-Reviewer
  agents. Swap providers with `CALIBER_LLM_PROVIDER` / `CALIBER_DECISION_MODEL`. Without a
  key, the deterministic decision path runs.
- `apps/web/.env.local` — `NEXT_PUBLIC_SERVICES_URL`, `NEXT_PUBLIC_VAULT_CONTRACT_HASH`,
  `NEXT_PUBLIC_EXPLORER_BASE`.

### Vercel + Railway deployment

The safest production setup is:

- **Railway (`apps/services`)**
  - Deploy the Fastify service with the repo-root `railway.toml` or `apps/services/railway.toml`.
  - Set `CALIBER_DATABASE_URL` or Railway `DATABASE_URL` for Postgres.
  - Set `CALIBER_SIGNAL_FEED_URL` to a live JSON feed that returns `Signal[]` or `{ "signals": Signal[] }`.
  - Set `CALIBER_ADMIN_TOKEN`; Vercel uses it server-side for `POST /runs` and `POST /approve`.
  - Set `PORT` via Railway defaults; the service already binds `0.0.0.0:$PORT`.
  - Set `CALIBER_DRY_RUN=false` and mount a real funded PEM file because `CASPER_SECRET_KEY_PATH` is read from the filesystem.
  - If you still call Railway directly from a browser, set `CALIBER_CORS_ORIGIN` to your Vercel URL.
  - Quick reachability checks: `/health` should return `200 OK`; `/ready` should return `200 OK` only when dependencies are reachable.
- **Vercel (`apps/web`)**
  - Set the project root to `apps/web`.
  - Set `SERVICES_URL=https://<your-railway-service>.up.railway.app`.
  - Set the same `CALIBER_ADMIN_TOKEN` so the proxy can authenticate mutations server-to-server.
  - If `SERVICES_URL` is missing, the Next.js proxy falls back to `http://localhost:4000`, which makes production requests fail with `502`.
  - `NEXT_PUBLIC_SERVICES_URL` is optional now; the frontend uses a Next.js proxy at `/api/caliber`.

This avoids browser-to-Railway CORS entirely. Vercel calls Railway server-to-server, and the browser only talks to Vercel.

## Testnet flow

1. Dashboard shows the policy, live signals, a risk gauge, and the latest decision.
2. **Run agent cycle** → the service pulls the configured live signal feed.
3. The agents deliberate: the Proposer designs a compliant de-risking rebalance; the
   Risk-Reviewer approves it.
4. **Approve & settle on Casper** → a real `record_rebalance` deploy is submitted; the
   deploy hash links to the explorer and the on-chain rebalance count ticks up.

## Casper AI toolkit usage

Implemented now:

- **Odra** — `CaliberVault` is the deployed Casper testnet contract; it is
  owner-gated, records approved rebalances, and emits audit events.
- **casper-js-sdk** — builds, signs, submits `record_rebalance`, and reads live
  Casper state through RPC.
- **Casper MCP Server** — optional agent tool provider when
  `CALIBER_CASPER_MCP_URL` is set. Each recommendation trace records whether MCP
  was connected or whether the agent used direct RPC/SDK fallback.

Planned launch integrations:

- **CSPR.cloud** for hosted chain data and signal infrastructure.
- **x402** for paid, verifiable signal-feed requests between agents and data providers.
- **CSPR.click** for wallet-based human approvals once backend hardening is complete.

## Contract surface (`CaliberVault`)

`init` · `set_policy` · `set_paused` · **`record_rebalance`** (tx-producing) ·
`is_paused` · `rebalance_count` · `policy_version`. Owner-gated; emits
`RebalanceRecorded` / `PausedSet`. Deploy guide: [`docs/contract-deployment.md`](docs/contract-deployment.md).

## License

MIT
