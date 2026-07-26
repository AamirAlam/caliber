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

Caliber is deployed and producing real transactions on `casper-test`.

| | |
|---|---|
| **Network** | Casper testnet (`casper-test`) |
| **CaliberVault package hash** | [`5dd0bfde…12a8cbd2`](https://testnet.cspr.live/contract-package/5dd0bfde53bf885dc64b7009d4c02030aced4c8525ff7a1f3c0735d238142ce0) |
| **Contract hash** | [`bdac504f…0dbb4ff5`](https://testnet.cspr.live/contract/bdac504ff9f57316de41be341459cfea603589cd10e302db89e61b0b0dbb4ff5) |
| **Transaction-producing entry point** | `record_rebalance` |
| **On-chain rebalances recorded** | read live from the contract's `rebalance_count` |
| **Self-managed signal feed** | [`/signals/feed`](https://caliber-production-d4ee.up.railway.app/signals/feed) |
| **Explorer** | [testnet.cspr.live](https://testnet.cspr.live/contract-package/5dd0bfde53bf885dc64b7009d4c02030aced4c8525ff7a1f3c0735d238142ce0) |

> Full package hash: `contract-package-5dd0bfde53bf885dc64b7009d4c02030aced4c8525ff7a1f3c0735d238142ce0`

Caliber interacts with Casper **both ways**: it *writes* approved rebalances via
`record_rebalance`, and *reads* live contract state (`paused`, `rebalance_count`)
straight from global state — no off-chain bookkeeping.

## What makes it different

- **A real multi-agent decision, not a narrator.** A **Proposer** agent designs the
  move (which asset to trim, sizing, rationale) and must pass the deterministic
  policy engine; an adversarial **Risk-Reviewer** panel (3 votes, majority veto,
  fails closed) then signs off or vetoes.
- **Deterministic guardrails are the only gate on execution.** Allocation bands,
  liquidity floors, risk ceilings, counterparty allowlists, and single-rebalance
  caps are enforced in code — the LLM can never loosen them, only propose within them.
- **Live on-chain treasury data.** Funds under management are derived from the
  treasury account's real Casper balance valued at the live CSPR/USD market price,
  flowing into the same signal snapshot the policy engine evaluates.
- **Verifiable decisions.** Every executed rebalance anchors a blake2b content hash
  of the full decision (legs, amounts, policy, signals, risk score) on-chain inside
  the recorded rebalance id — the audit stamp can be checked against the off-chain record.
- **Workspace-scoped control.** A treasury owner creates a workspace, connects a
  wallet (signed sign-in challenge when the extension supports it), edits policy
  guardrails from the dashboard, and starts agents that monitor on a schedule.
- **Human-in-the-loop + on-chain audit.** Nothing settles without a wallet-signed
  approval, and every run's signals, decision, rationale, review, and deploy hash
  are recorded.
- **Model-agnostic.** The agent runs on the Vercel AI SDK; swap the LLM via config
  (Claude Haiku 4.5 by default for cost-efficient deliberation). With no API key it
  falls back to a deterministic decision, so local and testnet operations still run
  end-to-end.

## How it works

```
collect signals (feed + live on-chain balance × CSPR price)
    → score risk → PROPOSER agent designs a move
    → deterministic policy gate (the hard gate)
    → RISK-REVIEWER panel signs off / vetoes (majority, fails closed)
    → await human approval (wallet signature, verified server-side)
    → execute on Casper (record_rebalance, decision content hash anchored)
    → record audit log + read on-chain state
```

Deterministic policy checks decide what may execute; the AI-authored rationale is
explanatory and never overrides the rules. See [`docs/architecture.md`](docs/architecture.md).

## Monorepo layout

| Path | What |
|---|---|
| `apps/web` | Next.js frontend — onboarding, wallet-session access, workspace dashboard, feed status, and paginated run history |
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
  `CASPER_SECRET_KEY_PATH` (+ `CALIBER_KEY_ALGO`), `CALIBER_ADMIN_TOKEN`, and
  `CALIBER_DRY_RUN=false` for real testnet execution.
- **Live treasury signals (optional):** set `CALIBER_TREASURY_ACCOUNT` (public key
  hex) to derive funds under management from the account's real on-chain CSPR
  balance valued at the live market price (`CALIBER_PRICE_API_URL` overrides the
  price endpoint). Without it, a labeled notional is used.
- **AI (optional):** set `ANTHROPIC_API_KEY` to enable the live Proposer + Risk-Reviewer
  agents (default model: `claude-haiku-4-5`). Swap providers with
  `CALIBER_LLM_PROVIDER` / `CALIBER_DECISION_MODEL`. Without a key, the
  deterministic decision path runs.
- `apps/web/.env.local` — `SERVICES_URL`, `CALIBER_ADMIN_TOKEN`,
  `WALLET_SESSION_SECRET`, `NEXT_PUBLIC_VAULT_CONTRACT_HASH`,
  `NEXT_PUBLIC_EXPLORER_BASE`.

### Vercel + Railway deployment

The safest production setup is:

- **Railway (`apps/services`)**
  - Deploy the Fastify service with the repo-root `railway.toml` or `apps/services/railway.toml`.
  - Set `CALIBER_DATABASE_URL` or Railway `DATABASE_URL` for Postgres.
  - Review `apps/services/config/testnet-policy.json`; deployed modes load this policy directly.
  - Leave `CALIBER_SIGNAL_FEED_URL` empty to use the self-managed testnet feed at `/signals/feed`. The current deployed feed is `https://caliber-production-d4ee.up.railway.app/signals/feed`.
  - Set `CALIBER_ADMIN_TOKEN`; Vercel uses it server-side for `POST /runs` and `POST /approve`.
  - Set `PORT` via Railway defaults; the service already binds `0.0.0.0:$PORT`.
  - Set `CALIBER_DRY_RUN=false` and mount a real funded PEM file because `CASPER_SECRET_KEY_PATH` is read from the filesystem.
  - If you still call Railway directly from a browser, set `CALIBER_CORS_ORIGIN` to your Vercel URL.
  - Quick reachability checks: `/health` should return `200 OK`; `/ready` should return `200 OK` only when dependencies are reachable.
- **Vercel (`apps/web`)**
  - Set the project root to `apps/web`.
  - Set `SERVICES_URL=https://<your-railway-service>.up.railway.app`.
  - Set the same `CALIBER_ADMIN_TOKEN` so the proxy can authenticate mutations server-to-server.
  - Set `WALLET_SESSION_SECRET`; treasury owners connect a wallet session before run controls are available. Approval signing is still required for on-chain rebalance settlement.
  - If `SERVICES_URL` is missing, the Next.js proxy falls back to `http://localhost:4000`, which makes production requests fail with `502`.
  - `NEXT_PUBLIC_SERVICES_URL` is optional now; the frontend uses a Next.js proxy at `/api/caliber`.

This avoids browser-to-Railway CORS entirely. Vercel calls Railway server-to-server, and the browser only talks to Vercel.

## Product flow

1. Create a treasury workspace with a vault package hash, policy preset/custom guardrails, and the self-managed feed.
2. Connect the treasury owner wallet — a signed sign-in challenge proves key ownership when the extension supports it (with a paste-key fallback for read access).
3. Open the dashboard to review funds under management (live on-chain balance when configured), current policy, feed status/freshness, and run history. Owners can edit allocation and risk guardrails in place, and switch between multiple treasuries from the sidebar.
4. **Start agents** → the backend monitors the workspace autonomously on its interval; each run collects live signals, scores risk, runs the proposer/reviewer deliberation against the workspace policy, and records a full decision trace. The dashboard shows the next-run ETA.
5. If the agents recommend a policy-compliant rebalance, the action pane asks the owner to approve (wallet signature, verified server-side) and settle on Casper. No action is shown before an agent decision exists.

## Casper AI toolkit usage

Implemented now:

- **Odra** — `CaliberVault` is the deployed Casper testnet contract; it is
  owner-gated, records approved rebalances, and emits audit events.
- **casper-js-sdk** — builds, signs, submits `record_rebalance`, and reads live
  Casper state through RPC.
- **Casper MCP Server** — optional agent tool provider when
  `CALIBER_CASPER_MCP_URL` is set. Caliber also injects a built-in
  `casper_get_vault_state` tool into the agent so every LLM cycle can inspect
  live Casper vault state. Set `CALIBER_CASPER_MCP_REQUIRED=true` for an operator run
  that must fail unless the external Casper MCP server is connected. Each
  recommendation trace records MCP status.

Planned launch integrations:

- **CSPR.cloud** for hosted chain data and signal infrastructure.
- **x402** for paid, verifiable signal-feed requests between agents and data providers.
- **CSPR.click** as a launch wallet surface for human approvals and account-based treasury access.

## Contract surface (`CaliberVault`)

`init` · `set_policy` · `set_paused` · **`record_rebalance`** (tx-producing) ·
`is_paused` · `rebalance_count` · `policy_version`. Owner-gated; emits
`RebalanceRecorded` / `PausedSet`. Approved rebalances are recorded as
`<rebalance_id>:<blake2b decision hash>`, anchoring a verifiable digest of the
decision (legs, amounts, policy, signal snapshot, risk score) on-chain.
Deploy guide: [`docs/contract-deployment.md`](docs/contract-deployment.md).

## Roadmap: from testnet to pilots

Caliber's decision architecture is production-shaped today; the path to real
treasury pilots is sequenced and already underway:

1. **Done during the buildathon** — live on-chain FUM signals, challenge-signed
   wallet sessions, in-dashboard policy governance, enforced counterparty
   allowlists, and on-chain decision content hashes.
2. **Next** — x402-paid premium signal feeds (agents pay per request),
   CSPR.cloud-hosted chain data, and CSPR.click as the wallet approval surface.
3. **Pilot readiness** — per-vault token custody and real settlement legs
   (today the contract anchors decisions; settlement is the next milestone),
   durable run scheduling, and mainnet deployment with a partner DAO treasury.

## License

MIT
