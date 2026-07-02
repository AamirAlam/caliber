import type { AgentRunLog, TransactionRecord } from '@helm/shared';
import { generateRecommendation } from './agent/runner.js';
import type { AuditStore } from './audit/index.js';
import { evaluatePolicy } from './policy/index.js';
import { CasperExecutor } from './execution/index.js';
import { log } from './logger.js';
import { scoreRisk } from './policy/index.js';
import { collectSignals, SimulatedSignalSource, type SignalSource } from './signals/index.js';
import { AppState } from './state.js';

export interface OrchestratorDeps {
  audit: AuditStore;
  executor: CasperExecutor;
  sources: SignalSource[];
  state: AppState;
}

export function defaultDeps(audit: AuditStore, state: AppState): OrchestratorDeps {
  return {
    audit,
    executor: new CasperExecutor(),
    sources: [new SimulatedSignalSource(state)],
    state,
  };
}

/**
 * Phase 1 of the agent loop: collect → score → evaluate → decide. If the agent
 * recommends a rebalance and the policy requires human approval, the run pauses
 * at `await_approval` (with a candidate stashed on AppState) and returns; phase 2
 * happens in `executeApproved`. Hold/halt runs complete immediately.
 */
export async function runAgentLoop(deps: OrchestratorDeps, seq: number): Promise<AgentRunLog> {
  const { audit, state } = deps;
  const policy = state.activePolicy;
  const runId = `run_${seq}`;
  const run: AgentRunLog = {
    id: runId,
    policyId: policy.id,
    stage: 'collect_signals',
    status: 'running',
    startedAt: new Date().toISOString(),
  };
  await audit.saveRun(run);

  const snapshot = await collectSignals(deps.sources, `snap_${seq}`);
  await audit.saveSnapshot(snapshot);
  state.latestSnapshot = snapshot;

  const risk = scoreRisk(snapshot);
  state.latestRisk = risk;
  run.stage = 'evaluate_policy';
  run.snapshotId = snapshot.id;
  run.riskScore = risk.score;

  const { recommendation, toolTrace } = await generateRecommendation({
    runId,
    policy,
    risk,
    snapshot,
  });
  await audit.saveRecommendation(recommendation);
  state.latestRecommendation = recommendation;
  run.stage = 'generate_decision';
  run.recommendationId = recommendation.id;
  run.notes = `action=${recommendation.action}; tools=[${toolTrace.join(', ')}]`;

  log.info('decision', {
    runId,
    action: recommendation.action,
    risk: risk.score,
    compliant: recommendation.compliancePassed,
  });

  if (recommendation.action === 'rebalance' && recommendation.rebalance) {
    state.pendingRun = {
      runId,
      recommendation,
      rebalance: recommendation.rebalance,
      approvalToken: `tok_${runId}`,
    };
    if (policy.constraints.requireHumanApproval) {
      run.stage = 'await_approval';
      run.status = 'running';
      await audit.saveRun(run);
      log.info('awaiting human approval', { runId });
      return run;
    }
    // Auto-approve path.
    const { run: done } = await executeApproved(deps, runId, 'auto');
    return done;
  }

  run.stage = 'done';
  run.status = 'completed';
  run.endedAt = new Date().toISOString();
  await audit.saveRun(run);
  return run;
}

/**
 * Phase 2: execute a rebalance that was paused awaiting approval. Re-checks
 * policy compliance server-side before submitting the deploy on-chain.
 */
export async function executeApproved(
  deps: OrchestratorDeps,
  runId: string,
  approver: string,
): Promise<{ run: AgentRunLog; tx: TransactionRecord }> {
  const { audit, state } = deps;
  const pending = state.pendingRun;
  if (!pending || pending.runId !== runId) {
    throw new Error(`No run awaiting approval with id ${runId}`);
  }

  const run = (await audit.getRun(runId)) ?? {
    id: runId,
    policyId: state.activePolicy.id,
    stage: 'await_approval' as const,
    status: 'running' as const,
    startedAt: new Date().toISOString(),
  };

  // Server-side re-check: the deterministic gate, not the AI, authorizes execution.
  if (state.latestRisk && state.latestSnapshot) {
    const violations = evaluatePolicy(
      state.activePolicy,
      state.latestRisk,
      state.latestSnapshot,
      pending.rebalance,
    );
    if (violations.length > 0) {
      run.stage = 'await_approval';
      run.status = 'rejected';
      run.endedAt = new Date().toISOString();
      run.notes = `rejected on re-check: ${violations.map((v) => v.constraint).join(', ')}`;
      await audit.saveRun(run);
      state.pendingRun = undefined;
      throw new Error(`Compliance re-check failed: ${violations.map((v) => v.detail).join('; ')}`);
    }
  }

  run.stage = 'execute';
  await audit.saveRun(run);

  const tx = await deps.executor.submit(pending.rebalance);
  await audit.saveTransaction(tx);

  run.stage = 'done';
  run.status = 'completed';
  run.transactionId = tx.id;
  run.approvedBy = approver;
  run.endedAt = new Date().toISOString();
  await audit.saveRun(run);

  state.pendingRun = undefined;
  return { run, tx };
}
