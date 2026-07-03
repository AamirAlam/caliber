/**
 * Canonical names for Caliber's agent roles — the single source of truth used
 * across the agent prompts, the deliberation trace, and the UI so the
 * multi-agent design reads consistently everywhere.
 */
export const AGENT_ROLES = {
  /** Designs the move: which assets to trim and how much. */
  proposer: { name: 'Proposer', title: 'Allocation Strategist' },
  /** Adversarial reviewer: signs off on or vetoes a compliant proposal. */
  reviewer: { name: 'Risk Officer', title: 'Adversarial Reviewer' },
} as const;

export type AgentRoleKey = keyof typeof AGENT_ROLES;
