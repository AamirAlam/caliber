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
| **CaliberVault contract (package)** | `contract-package-5dd0bfde53bf885dc64b7009d4c02030aced4c8525ff7a1f3c0735d238142ce0` |
| **Transaction-producing entry point** | `record_rebalance` |
| **On-chain rebalances recorded** | read live from the contract's `rebalance_count` |
| **Explorer** | [testnet.cspr.live](https://testnet.cspr.live) |

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
Vercel AI SDK (model-agnostic agents) · casper-js-sdk · Odra (Rust) · ESLint + Prettier.

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
  `CASPER_SECRET_KEY_PATH` (+ `CALIBER_KEY_ALGO`), and `CALIBER_DRY_RUN` (`true` keeps the
  agent off-chain-safe for local runs).
- **AI (optional):** set `ANTHROPIC_API_KEY` to enable the live Proposer + Risk-Reviewer
  agents. Swap providers with `CALIBER_LLM_PROVIDER` / `CALIBER_DECISION_MODEL`. Without a
  key, the deterministic decision path runs.
- `apps/web/.env.local` — `NEXT_PUBLIC_SERVICES_URL`, `NEXT_PUBLIC_VAULT_CONTRACT_HASH`,
  `NEXT_PUBLIC_EXPLORER_BASE`.

## Demo flow

1. Dashboard shows the policy, live signals, a risk gauge, and the latest decision.
2. **Run stress scenario** → liquidity drops, risk crosses the ceiling.
3. The agents deliberate: the Proposer designs a compliant de-risking rebalance; the
   Risk-Reviewer approves it.
4. **Approve & settle on Casper** → a real `record_rebalance` deploy is submitted; the
   deploy hash links to the explorer and the on-chain rebalance count ticks up.

## Casper AI toolkit usage

- **Odra** — the CaliberVault contract (deployed, tested, owner-gated, emits audit events).
- **casper-js-sdk** — builds/signs/submits `record_rebalance` and reads live contract state.
- **Casper MCP Server** — plugged into the agent's toolset when `CALIBER_CASPER_MCP_URL`
  is set (direct RPC is the fallback).

## Contract surface (`CaliberVault`)

`init` · `set_policy` · `set_paused` · **`record_rebalance`** (tx-producing) ·
`is_paused` · `rebalance_count` · `policy_version`. Owner-gated; emits
`RebalanceRecorded` / `PausedSet`. Deploy guide: [`docs/contract-deployment.md`](docs/contract-deployment.md).

## Hackathon submission checklist

- [x] Vault contract deployed to Casper testnet
- [x] Transaction-producing on-chain action (`record_rebalance`)
- [x] Public, open-source repo with this README
- [x] Original code and content only
- [ ] Demo video

## License

MIT
