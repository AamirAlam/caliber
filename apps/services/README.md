# @caliber/services — off-chain agent

The brain of Caliber. A thin, well-organized off-chain orchestrator that runs the
agent loop and prepares Casper transactions. Heavy business logic is left as
clearly marked extension points — this package is about architecture and DX.

## The agent loop

```
collect signals → score risk → evaluate policy → generate decision
   → (await human approval) → execute on Casper → record audit log
```

Each stage is its own module:

| Module | Responsibility |
| --- | --- |
| `signals/` | Pluggable `SignalSource`s (market, RWA feeds, on-chain reads) |
| `policy/` | **Deterministic** risk scoring + policy constraint evaluation |
| `decision/` | Picks an action + produces the (AI-authored) explanation |
| `execution/` | `CasperExecutor` — builds & submits the rebalance deploy |
| `audit/` | Persistent store of snapshots, recommendations, txs, runs (SQLite dev / Postgres prod) |
| `scheduler/` | Runs the loop on an interval |
| `orchestrator.ts` | Wires the stages together into one run |

### Deterministic vs. AI

Policy compliance is computed in `policy/` and is the **only** thing that gates
execution. The `decision/` layer's natural-language `explanation` is descriptive
and never overrides a policy verdict. This separation is core to Caliber's
trust/guardrails story.

### Persistence

The audit trail is stored in a database via the `AuditStore` interface:

- **Local dev (default):** SQLite file at `CALIBER_SQLITE_PATH` (`./data/caliber.dev.sqlite`).
- **Production:** set `CALIBER_DATABASE_URL=postgres://…` and Postgres takes over — same code path (Kysely).
- **CI / ephemeral:** `CALIBER_DB=memory` uses the in-memory store (no durability).

Tables are created automatically on first connect. The **durable source of truth
for rebalances is on-chain** (`rebalance_count` + `RebalanceRecorded`); the database
persists the richer off-chain history (signals, reasoning traces, run logs).

## Local development

```bash
cp .env.example .env        # fill in Casper RPC, signer, DB, admin token, and signal feed
pnpm --filter @caliber/services dev        # entry point (boots the scheduler)
pnpm --filter @caliber/services run:once   # single configured loop entry
```

## Going live on Casper testnet

1. Deploy the vault contract (see `packages/contracts`) and set
   `CALIBER_VAULT_CONTRACT_HASH`.
2. Provide a funded testnet key at `CASPER_SECRET_KEY_PATH`.
3. Set `CALIBER_POLICY_PATH` or `CALIBER_POLICY_JSON` to the real treasury policy.
4. Set `CALIBER_SIGNAL_FEED_URL` to a live JSON feed that returns `Signal[]` or
   `{ "signals": Signal[] }`.
5. Set Postgres via `CALIBER_DATABASE_URL` / `DATABASE_URL`, set
   `CALIBER_ADMIN_TOKEN`, and set `CALIBER_DRY_RUN=false`.
