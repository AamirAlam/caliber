# @helm/shared

The shared domain model for Helm. Everything the frontend, off-chain services,
and tests agree on lives here as **Zod schemas** with TypeScript types inferred
from them — one definition, validated at runtime and typed at compile time.

## Domain model

| Concept | Schema | Notes |
| --- | --- | --- |
| Treasury policy | `TreasuryPolicySchema` | Allocations + deterministic constraints |
| Asset allocation | `AssetAllocationSchema` | Target/min/max weight bands per asset |
| Signal snapshot | `SignalSnapshotSchema` | A timestamped batch of observed signals |
| Risk score | `RiskScoreSchema` | Composite 0..100 with per-factor breakdown |
| Recommendation | `RecommendationSchema` | Action + compliance verdict + AI explanation |
| Rebalance request | `RebalanceRequestSchema` | Concrete legs handed to execution |
| Transaction record | `TransactionRecordSchema` | Casper deploy lifecycle + hash |
| Agent run log | `AgentRunLogSchema` | Append-only audit spine of one loop |

## Design notes

- **Deterministic vs. AI.** A recommendation's `compliancePassed`/`violations`
  are computed mechanically and gate execution. `explanation` is AI-authored and
  explanatory only — it never overrides a policy verdict.
- **Money as strings.** On-chain amounts use string motes to avoid float loss.

## Usage

```ts
import { TreasuryPolicySchema, type TreasuryPolicy } from '@helm/shared';

const policy: TreasuryPolicy = TreasuryPolicySchema.parse(raw);
```
