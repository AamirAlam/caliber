# Caliber Submission Guide

Caliber is a policy-driven AI treasury control plane for tokenized real-world
assets on Casper. It lets a treasury owner create a workspace, define guardrails,
run an agent analysis against live signals, and approve only the actions that pass
deterministic policy checks.

The product is intentionally not a yield bot. It behaves like an operating desk:
policy comes first, agents monitor autonomously on a schedule, and no on-chain
action is shown until the agents have produced a decision for that specific
workspace.

## Quick Links

| Item | Link / value |
|---|---|
| GitHub repository | <ADD REPO URL> |
| Demo video | <ADD VIDEO URL> |
| Casper network | `casper-test` |
| Contract package | `contract-package-5dd0bfde53bf885dc64b7009d4c02030aced4c8525ff7a1f3c0735d238142ce0` |
| Package explorer | https://testnet.cspr.live/contract-package/5dd0bfde53bf885dc64b7009d4c02030aced4c8525ff7a1f3c0735d238142ce0 |
| Contract hash | `contract-bdac504ff9f57316de41be341459cfea603589cd10e302db89e61b0b0dbb4ff5` |
| Contract explorer | https://testnet.cspr.live/contract/bdac504ff9f57316de41be341459cfea603589cd10e302db89e61b0b0dbb4ff5 |
| Self-managed feed | https://caliber-production-d4ee.up.railway.app/signals/feed |

## Product Walkthrough

Start at `/onboarding`.

1. Create a treasury workspace.
2. Connect the deployed `CaliberVault` package hash.
3. Choose a policy preset or customize allocation/risk guardrails.
4. Signals come from the self-managed Caliber feed, augmented with live on-chain
   data: the treasury account's real Casper balance valued at the live CSPR/USD
   market price.
5. Connect the treasury owner wallet to create the dashboard session.
6. Activate the workspace and open the dashboard.

The dashboard starts in an idle state for a new workspace. It shows funds under
management (live on-chain figure when configured, labeled notional otherwise),
policy guardrails (editable in place by the owner), feed health, vault activity,
and run history. Owners with multiple treasuries switch between them from the
sidebar. The action pane stays empty until the agents are started and the first
scheduled analysis completes — a next-run ETA is shown while monitoring.

After an analysis run, the dashboard shows the latest workspace-specific
decision: hold, rebalance, or halt. If the agents recommend a policy-compliant
rebalance, the treasury owner can approve and settle it on Casper.

## Decision Flow

One analysis cycle:

```text
collect signals
  -> score risk
  -> Proposer agent designs an action
  -> deterministic policy gate checks hard constraints
  -> Risk-Reviewer agent approves or vetoes
  -> decision is recorded
  -> optional owner approval
  -> record_rebalance deploy on Casper
```

The Proposer can reason and explain, but it cannot authorize execution. The
deterministic policy engine is the hard gate. It enforces allocation bands,
liquidity floor, risk ceiling, approved assets, and the single-rebalance cap.

The Risk-Reviewer is an adversarial panel (3 independent votes, majority veto,
fails closed on error). If the reviewers or gate reject the first proposal, the
concern goes back to the Proposer for one revision before the cycle settles on a
final decision.

## Wallet Behavior

Wallet sign-in uses a server-issued challenge that the Casper Wallet signs and
the server verifies, proving key ownership before a session is minted (with a
public-key fallback for read/monitor access).

On-chain settlement always requires a real wallet signature: approving a
rebalance signs a structured message that the backend verifies (signature +
workspace ownership) before submitting the Casper deploy.

## What Is On-Chain

`CaliberVault` is the on-chain audit anchor. The transaction-producing entry
point is:

```text
record_rebalance
```

When a rebalance is approved, the services backend builds and submits a real
Casper deploy. The recorded id is `<rebalance_id>:<blake2b content hash>` — a
verifiable digest of the full decision (legs, amounts, policy id, signal
snapshot id, risk score) anchored on-chain, so the audit stamp can be checked
against the off-chain record. The contract increments `rebalance_count` and
emits an audit event. The dashboard reads live contract state (`paused`,
`rebalance_count`) back from Casper RPC, and the signal layer reads the treasury
account's CSPR balance for live funds-under-management.

## What Is Off-Chain

The services backend runs the agent loop and API:

- collects signal snapshots from the self-managed feed plus live on-chain
  signals (treasury balance × live CSPR/USD price)
- scores treasury risk
- runs proposer/reviewer deliberation (default model `claude-haiku-4-5`;
  deterministic fallback with no API key)
- applies deterministic policy checks, including the counterparty allowlist
  (never open — defaults to the policy's own assets)
- persists workspace-scoped run history
- prepares approval-gated Casper execution on a scheduled monitoring interval

The web app provides onboarding, wallet-session access, dashboard monitoring,
feed status/freshness, action approval, and run-history views.

## Self-Managed Feed

The submitted product uses a backend-managed feed:

```text
https://caliber-production-d4ee.up.railway.app/signals/feed
```

The feed returns `Signal[]` or `{ "signals": Signal[] }` with observations such
as treasury liquidity, RWA redemption queue, and short-term Treasury yield. The
dashboard checks the feed directly through a server-side status route and shows
freshness before an agent run exists.

## Casper AI Toolkit Usage

- **Odra:** `CaliberVault` is implemented as an Odra contract and deployed on
  Casper testnet.
- **casper-js-sdk:** the services execution layer signs/submits
  `record_rebalance` deploys and reads Casper RPC state.
- **Casper MCP Server:** optional tool provider through `CALIBER_CASPER_MCP_URL`.
  Caliber also exposes a built-in `casper_get_vault_state` tool backed by Casper
  RPC so the agent can inspect live vault state.

Roadmap integrations:

- **CSPR.cloud:** hosted chain-data and signal infrastructure.
- **x402:** paid/verifiable premium signal feeds.
- **CSPR.click:** wallet-based approval and account access surface.

## Run Locally

```bash
pnpm install
bash scripts/setup.sh
pnpm dev
```

Open `/onboarding` to create a workspace and `/dashboard` to monitor it, edit
policy, start agents, and inspect run history with full reasoning traces. Full
setup, configuration, and test instructions are in the repository README.

## Repository Map

| Path | Purpose |
|---|---|
| `apps/web` | Next.js onboarding, dashboard, wallet session, run history |
| `apps/services` | Fastify API, agent loop, policy engine, execution, audit |
| `packages/contracts` | Odra `CaliberVault` contract |
| `packages/shared` | Shared Zod schemas and TypeScript domain types |
| `docs` | Architecture and deployment documentation |
