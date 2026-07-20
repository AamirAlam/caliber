import type {
  RebalanceRequest,
  Recommendation,
  RiskScore,
  SignalSnapshot,
  TreasuryPolicy,
} from '@caliber/shared';

/** A run paused at `await_approval`, holding the candidate move + an approval token. */
export interface PendingRun {
  runId: string;
  recommendation: Recommendation;
  rebalance: RebalanceRequest;
  /** Opaque token the executor requires before submitting on-chain. */
  approvalToken: string;
  snapshot: SignalSnapshot;
  risk: RiskScore;
}

/**
 * In-process application state. The dashboard reads the `latest*` fields; the
 * database and on-chain rebalance record are the durable audit anchors.
 */
export class AppState {
  activePolicy: TreasuryPolicy;
  latestSnapshot?: SignalSnapshot;
  latestRisk?: RiskScore;
  latestRecommendation?: Recommendation;
  pendingRun?: PendingRun;

  constructor(policy: TreasuryPolicy) {
    this.activePolicy = policy;
  }
}
