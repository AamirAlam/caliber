import type { AgentRunLog, TreasuryPolicy } from '@helm/shared';
import type { AuditStore } from './audit/index.js';
import { CasperExecutor } from './execution/index.js';
import type { SignalSource } from './signals/index.js';

export interface OrchestratorDeps {
  audit: AuditStore;
  executor: CasperExecutor;
  sources: SignalSource[];
}

export function defaultDeps(audit: AuditStore): OrchestratorDeps {
  return { audit, executor: new CasperExecutor(), sources: [] };
}

/**
 * One agent loop:
 *   collect signals → score risk → evaluate policy → generate decision
 *      → (await human approval) → execute on Casper → record audit log
 * TODO: implement the loop using the signals / policy / decision / execution
 * modules, recording an append-only audit log at every stage.
 */
export async function runAgentLoop(
  _policy: TreasuryPolicy,
  _deps: OrchestratorDeps,
  _seq: number,
): Promise<AgentRunLog> {
  throw new Error('runAgentLoop not implemented');
}
