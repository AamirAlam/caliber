# Caliber — AI treasury control plane for tokenized RWAs, on Casper

Caliber runs a treasury the way a disciplined desk would: it watches the signals,
reasons about risk inside a fixed mandate, and only acts on moves that clear hard
guardrails. Every approved move settles on Casper, and the on-chain record is the
source of truth.

It's not a yield bot. A treasury here is a mandate with constraints — allocation
bands, a liquidity floor, a risk ceiling, a single-rebalance cap. The AI proposes
within those limits; deterministic code decides what's allowed to execute.

## How it works

One loop, per cycle:

```
collect signals → score risk → Proposer designs a move
  → deterministic policy gate (the hard gate)
  → Risk Officer reviews (approve / veto)
  → human approval
  → settle on Casper (record_rebalance)
  → persist the full run + read on-chain state back
```

Two agents actually deliberate. The **Proposer** designs the rebalance — which
asset to trim, how much — and tests it against the policy tools. The **Risk
Officer** is a separate, adversarial reviewer that signs off or vetoes. If it
vetoes (or the gate rejects the move), the concern goes back to the Proposer for
one revision, then re-review. It only halts if the second attempt still fails.
That's real self-correction, not an LLM narrating a rules engine.

The guardrails are the only thing that can authorize execution. The LLM can
propose and explain; it can never loosen a constraint. Nothing hits the chain
without human approval, and every run stores its full reasoning trace (proposer
turns, tools used, gate verdict, review verdict, revisions, final decision).

## What's actually on-chain

`CaliberVault` (Odra/Rust) is deployed and live on Casper testnet.
`record_rebalance` is the transaction-producing entry point — it anchors each
approved decision and emits an audit event. Caliber also *reads* live contract
state (`rebalance_count`, `paused`) straight from global state, so the dashboard's
numbers come from the chain, not off-chain bookkeeping.

- **Contract package:** `contract-package-5dd0bfde53bf885dc64b7009d4c02030aced4c8525ff7a1f3c0735d238142ce0`
- **Explorer:** https://testnet.cspr.live/contract-package/5dd0bfde53bf885dc64b7009d4c02030aced4c8525ff7a1f3c0735d238142ce0

## Stack

- **Contracts:** Odra (Rust), deployed via Odra livenet; owner-gated, emits `RebalanceRecorded` / `PausedSet`.
- **Agent:** Vercel AI SDK — model-agnostic (Claude by default, swap via env). Two-agent loop with a deterministic policy engine as the gate. Casper MCP server plugs in for on-chain reads; casper-js-sdk is the fallback + the signing/submit path.
- **API + web:** Fastify service exposing the loop; Next.js + Tailwind dashboard (risk gauge, live agent deliberation, decision memory, paginated run history with full reasoning traces).
- **Persistence:** SQLite for local dev, Postgres for production (Kysely, one code path). The durable record for rebalances is on-chain; the DB holds the richer off-chain history.
- **Monorepo:** pnpm + Turborepo, TypeScript throughout.

## Casper AI Toolkit Usage

Implemented in the submitted prototype:

- **Odra:** `CaliberVault` is the transaction-producing on-chain component. It
  records approved rebalances, enforces owner-only writes, supports pause/resume,
  and emits audit events on Casper testnet.
- **casper-js-sdk:** the execution layer constructs, signs, and submits
  `record_rebalance` deploys, then reads transaction and contract state back from
  Casper RPC.
- **Casper MCP Server:** when `CALIBER_CASPER_MCP_URL` is configured, MCP tools
  are injected into the Proposer agent. The recommendation trace records MCP as
  connected, disabled, or unavailable, so the demo can show whether the agent
  used Casper AI Toolkit tools or SDK/RPC fallback.

Launch roadmap integrations:

- **CSPR.cloud:** hosted chain-data and signal infrastructure for production
  deployments.
- **x402:** pay-per-request access to premium RWA and market signal feeds.
- **CSPR.click:** wallet-based human approval before settlement.

## Run it

```bash
pnpm install
bash scripts/setup.sh     # seeds .env files
pnpm dev                  # web :3000 + agent API :4000
```

Open `/dashboard`, hit **Run agent cycle** → the service pulls the configured
live signal feed → the two agents deliberate → **Approve** → a real
`record_rebalance` deploy lands on testnet, linked to the explorer. Set
`ANTHROPIC_API_KEY` for the live agents; without a key it falls back to the
deterministic decision path while still using live configured signals.
