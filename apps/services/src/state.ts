import type {
  RebalanceRequest,
  Recommendation,
  RiskScore,
  SignalSnapshot,
  TreasuryPolicy,
} from '@helm/shared';

/** A run paused at `await_approval`, holding the candidate move + an approval token. */
export interface PendingRun {
  runId: string;
  recommendation: Recommendation;
  rebalance: RebalanceRequest;
  /** Opaque token the executor requires before submitting on-chain. */
  approvalToken: string;
}

/**
 * In-process application state. The dashboard reads the `latest*` fields; the
 * scenario flag drives the simulated signal source. In-memory is acceptable —
 * the on-chain rebalance record is the durable audit anchor.
 */
export class AppState {
  activePolicy: TreasuryPolicy;
  scenarioStress = false;
  latestSnapshot?: SignalSnapshot;
  latestRisk?: RiskScore;
  latestRecommendation?: Recommendation;
  pendingRun?: PendingRun;

  constructor(policy: TreasuryPolicy) {
    this.activePolicy = policy;
  }
}
