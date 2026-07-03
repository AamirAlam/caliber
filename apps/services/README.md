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
| `audit/` | Append-only store of snapshots, recommendations, txs, runs |
| `scheduler/` | Runs the loop on an interval |
| `orchestrator.ts` | Wires the stages together into one run |

### Deterministic vs. AI

Policy compliance is computed in `policy/` and is the **only** thing that gates
execution. The `decision/` layer's natural-language `explanation` is descriptive
and never overrides a policy verdict. This separation is core to Caliber's
trust/guardrails story.

## Status

This is a **scaffold**. Every module exposes its types, interfaces, and function
signatures, but the bodies are `TODO` stubs (they throw `not implemented`). Fill
them in module by module — the structure and the boundaries between them are the
point.

## Local development

```bash
cp .env.example .env        # fill in Casper RPC / keys when going live
pnpm --filter @caliber/services dev        # entry point (boots the scheduler)
pnpm --filter @caliber/services run:once   # single loop entry (CLI scaffold)
```

## Going live on Casper testnet

1. Deploy the vault contract (see `packages/contracts`) and set
   `CALIBER_VAULT_CONTRACT_HASH`.
2. Provide a funded testnet key at `CASPER_SECRET_KEY_PATH`.
3. Implement the `TODO` in `execution/index.ts` using `casper-js-sdk` or the
   Casper MCP server to build, sign, and submit the `record_rebalance` deploy.
4. Set `CALIBER_DRY_RUN=false`.
