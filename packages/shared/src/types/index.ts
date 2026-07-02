import type { z } from 'zod';
import type {
  AssetAllocationSchema,
  PolicyConstraintsSchema,
  TreasuryPolicySchema,
  SignalSchema,
  SignalSnapshotSchema,
  RiskScoreSchema,
  RebalanceLegSchema,
  RebalanceRequestSchema,
  RecommendationSchema,
  AgentReviewSchema,
  TransactionRecordSchema,
  AgentRunStageSchema,
  AgentRunLogSchema,
} from '../schemas/index.js';

export type AssetAllocation = z.infer<typeof AssetAllocationSchema>;
export type PolicyConstraints = z.infer<typeof PolicyConstraintsSchema>;
export type TreasuryPolicy = z.infer<typeof TreasuryPolicySchema>;

export type Signal = z.infer<typeof SignalSchema>;
export type SignalSnapshot = z.infer<typeof SignalSnapshotSchema>;
export type RiskScore = z.infer<typeof RiskScoreSchema>;

export type RebalanceLeg = z.infer<typeof RebalanceLegSchema>;
export type RebalanceRequest = z.infer<typeof RebalanceRequestSchema>;
export type Recommendation = z.infer<typeof RecommendationSchema>;
export type AgentReview = z.infer<typeof AgentReviewSchema>;

export type TransactionRecord = z.infer<typeof TransactionRecordSchema>;
export type AgentRunStage = z.infer<typeof AgentRunStageSchema>;
export type AgentRunLog = z.infer<typeof AgentRunLogSchema>;
