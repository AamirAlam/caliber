import { randomUUID } from 'node:crypto';
import type { AgentRunLog, TreasuryPolicy, TreasuryWorkspace, TransactionRecord, WalletApproval } from '@caliber/shared';
import { generateRecommendation } from './agent/runner.js';
import { readVaultStateCached } from './casper/reader.js';
import { formatMemory, summarizeHistory } from './memory.js';
import type { AuditStore } from './audit/index.js';
import { evaluatePolicy } from './policy/index.js';
import { CasperExecutor } from './execution/index.js';
import { log } from './logger.js';
import { scoreRisk } from './policy/index.js';
import { buildSignalSources, collectSignals, type SignalSource } from './signals/index.js';
import type { AppState } from './state.js';

export interface RebalanceExecutor {
  submit(request: Parameters<CasperExecutor['submit']>[0]): Promise<TransactionRecord>;
  waitForFinalization(hash: string): Promise<'pending' | 'finalized' | 'failed'>;
}

export interface OrchestratorDeps {
  audit: AuditStore;
  executor: RebalanceExecutor;
  sources: SignalSource[];
  state: AppState;
}

export interface RunAgentLoopOptions {
  workspaceId?: string;
}

export function defaultDeps(audit: AuditStore, state: AppState): OrchestratorDeps {
  return {
    audit,
    executor: new CasperExecutor(),
    sources: buildSignalSources(),
    state,
  };
}

/**
 * Phase 1 of the agent loop: collect → score → evaluate → decide. If the agent
 * recommends a rebalance and the policy requires human approval, the run pauses
 * at `await_approval` (with a candidate stashed on AppState) and returns; phase 2
 * happens in `executeApproved`. Hold/halt runs complete immediately.
 */
export async function runAgentLoop(
  deps: OrchestratorDeps,
  _seq: number,
  options: RunAgentLoopOptions = {},
): Promise<AgentRunLog> {
  const { audit, state } = deps;
  const policy = await resolveRunPolicy(audit, state.activePolicy, options.workspaceId);
  const runId = `run_${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}_${randomUUID().slice(0, 8)}`;
  const run: AgentRunLog = {
    id: runId,
    policyId: policy.id,
    workspaceId: options.workspaceId,
    stage: 'collect_signals',
    status: 'running',
    startedAt: new Date().toISOString(),
  };
  await audit.saveRun(run);

  try {
    const snapshot = await collectSignals(deps.sources, `snap_${runId}`);
    await audit.saveSnapshot(snapshot);
    state.latestSnapshot = snapshot;

    const risk = scoreRisk(snapshot);
    state.latestRisk = risk;
    run.stage = 'evaluate_policy';
    run.snapshotId = snapshot.id;
    run.riskScore = risk.score;

    const vaultState = await readVaultStateCached();
    // Short-term memory: last N prior decisions, so the agent reasons with history.
    const memory = formatMemory(summarizeHistory(await audit.listRuns(), runId));
    const { recommendation, toolTrace } = await generateRecommendation(
      { runId, policy, risk, snapshot },
      vaultState,
      memory,
    );
    await audit.saveRecommendation(recommendation);
    state.latestRecommendation = recommendation;
    run.stage = 'generate_decision';
    run.action = recommendation.action;
    run.recommendationId = recommendation.id;
    run.notes = `tools=[${toolTrace.join(', ')}]`;

    log.info('decision', {
      runId,
      action: recommendation.action,
      risk: risk.score,
      compliant: recommendation.compliancePassed,
    });

    if (recommendation.action === 'rebalance' && recommendation.rebalance) {
      state.pendingRun = {
        runId,
        workspaceId: options.workspaceId,
        policy,
        recommendation,
        rebalance: recommendation.rebalance,
        approvalToken: `tok_${runId}`,
        snapshot,
        risk,
      };
      await audit.savePendingApproval({ ...state.pendingRun, createdAt: new Date().toISOString() });
      if (policy.constraints.requireHumanApproval) {
        run.stage = 'await_approval';
        run.status = 'running';
        await audit.saveRun(run);
        log.info('awaiting human approval', { runId });
        return run;
      }
      // Auto-approve path.
      const { run: done } = await executeApproved(deps, runId, 'auto', options.workspaceId);
      return done;
    }

    run.stage = 'done';
    run.status = 'completed';
    run.endedAt = new Date().toISOString();
    await audit.saveRun(run);
    return run;
  } catch (err) {
    run.status = 'failed';
    run.endedAt = new Date().toISOString();
    run.notes = String(err);
    await audit.saveRun(run);
    throw err;
  }
}

/**
 * Phase 2: execute a rebalance that was paused awaiting approval. Re-checks
 * policy compliance server-side before submitting the deploy on-chain.
 */
export async function executeApproved(
  deps: OrchestratorDeps,
  runId: string,
  approver: string,
  workspaceId?: string,
  approval?: WalletApproval,
): Promise<{ run: AgentRunLog; tx: TransactionRecord }> {
  const { audit, state } = deps;
  const pending = state.pendingRun ?? (await audit.getPendingApproval(runId));
  if (!pending || pending.runId !== runId) {
    throw new Error(`No run awaiting approval with id ${runId}`);
  }
  if (workspaceId && pending.workspaceId && pending.workspaceId !== workspaceId) {
    throw new Error(`Run ${runId} is not awaiting approval for workspace ${workspaceId}`);
  }

  const run = (await audit.getRun(runId)) ?? {
    id: runId,
    policyId: pending.policy?.id ?? state.activePolicy.id,
    workspaceId: pending.workspaceId ?? workspaceId,
    stage: 'await_approval' as const,
    status: 'running' as const,
    startedAt: new Date().toISOString(),
  };

  // Server-side re-check: the deterministic gate, not the AI, authorizes execution.
  const violations = evaluatePolicy(
    pending.policy ?? state.activePolicy,
    pending.risk,
    pending.snapshot,
    pending.rebalance,
  );
  if (violations.length > 0) {
    run.stage = 'await_approval';
    run.status = 'rejected';
    run.endedAt = new Date().toISOString();
    run.notes = `rejected on re-check: ${violations.map((v) => v.constraint).join(', ')}`;
    await audit.saveRun(run);
    await audit.deletePendingApproval(runId);
    state.pendingRun = undefined;
    throw new Error(`Compliance re-check failed: ${violations.map((v) => v.detail).join('; ')}`);
  }

  run.stage = 'execute';
  await audit.saveRun(run);

  const tx = await deps.executor.submit(pending.rebalance);
  await audit.saveTransaction(tx);

  run.stage = 'done';
  run.status = tx.status === 'failed' ? 'failed' : 'completed';
  run.transactionId = tx.id;
  run.deployHash = tx.deployHash;
  run.approvedBy = approver;
  run.approvalSignature = approval?.signature;
  run.notes = tx.status === 'failed' ? tx.error : run.notes;
  run.endedAt = new Date().toISOString();
  await audit.saveRun(run);

  await audit.deletePendingApproval(runId);
  state.pendingRun = undefined;

  // Fire-and-forget finalization poll: updates the tx record once the deploy
  // finalizes on-chain. The dashboard's polling reflects the change.
  if (tx.status === 'submitted' && tx.deployHash) {
    void finalizeInBackground(deps, tx);
  }

  return { run, tx };
}

async function resolveRunPolicy(
  audit: AuditStore,
  defaultPolicy: TreasuryPolicy,
  workspaceId?: string,
): Promise<TreasuryPolicy> {
  if (!workspaceId) return defaultPolicy;
  const workspace = await audit.getWorkspace(workspaceId);
  if (!workspace) throw new Error(`Workspace ${workspaceId} not found`);
  return policyFromWorkspace(workspace, defaultPolicy);
}

function policyFromWorkspace(workspace: TreasuryWorkspace, base: TreasuryPolicy): TreasuryPolicy {
  const pct = {
    rwa: workspace.policy.rwaTarget / 100,
    stablecoin: workspace.policy.stableTarget / 100,
    native: workspace.policy.nativeTarget / 100,
  };
  const band = 0.1;
  return {
    ...base,
    id: `policy_${workspace.id}`,
    name: workspace.name,
    owner: workspace.ownerAccount || base.owner,
    updatedAt: workspace.updatedAt,
    allocations: base.allocations.map((allocation) => {
      const target = pct[allocation.assetClass as keyof typeof pct] ?? allocation.target;
      return {
        ...allocation,
        target,
        min: Math.max(0, target - band),
        max: Math.min(1, target + band),
      };
    }),
    constraints: {
      ...base.constraints,
      minLiquidityBufferPct: pct.stablecoin,
      maxRiskScore: workspace.policy.maxRiskScore,
    },
  };
}

async function finalizeInBackground(deps: OrchestratorDeps, tx: TransactionRecord): Promise<void> {
  try {
    let status: 'pending' | 'finalized' | 'failed' = 'pending';
    for (let attempt = 0; attempt < 12 && status === 'pending'; attempt++) {
      if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 5000));
      status = await deps.executor.waitForFinalization(tx.deployHash!);
    }
    if (status === 'pending') {
      log.warn('transaction finalization still pending', { id: tx.id });
      return;
    }
    await deps.audit.saveTransaction({
      ...tx,
      status,
      finalizedAt: new Date().toISOString(),
    });
    log.info('transaction finalized', { id: tx.id, status });
  } catch (err) {
    log.warn('finalization poll failed', { id: tx.id, err: String(err) });
  }
}
