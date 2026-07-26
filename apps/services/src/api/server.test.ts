import { describe, expect, it } from 'vitest';
import type { AgentRunLog, TransactionRecord } from '@caliber/shared';
import { InMemoryAuditStore } from '../audit/index.js';
import { samplePolicy } from '../samplePolicy.js';
import type { Scheduler } from '../scheduler/index.js';
import { AppState } from '../state.js';
import { buildServer } from './server.js';

function scheduler(seenOptions: Array<{ workspaceId?: string }> = []): Scheduler {
  return {
    status: () => ({
      running: false,
      seq: 7,
      intervalMs: 60000,
      lastStartedAt: '2026-07-20T00:00:00.000Z',
      lastSucceededAt: '2026-07-20T00:01:00.000Z',
      lastFailedAt: undefined,
      lastError: undefined,
    }),
    runNow: async (options?: { workspaceId?: string }) => {
      seenOptions.push(options ?? {});
      return 7;
    },
  } as Scheduler;
}

async function testServer() {
  const audit = new InMemoryAuditStore();
  const state = new AppState(samplePolicy);
  const seenSchedulerOptions: Array<{ workspaceId?: string }> = [];
  const app = buildServer(
    {
      audit,
      state,
      sources: [],
      executor: {
        submit: async () => {
          throw new Error('not used');
        },
        waitForFinalization: async () => 'pending',
      },
    },
    scheduler(seenSchedulerOptions),
  );
  return { app, audit, state, seenSchedulerOptions };
}

describe('service observability API', () => {
  it('returns an operational status snapshot', async () => {
    const { app, audit, state } = await testServer();
    const run: AgentRunLog = {
      id: 'run_1',
      policyId: samplePolicy.id,
      stage: 'done',
      status: 'completed',
      action: 'hold',
      riskScore: 12,
      startedAt: '2026-07-20T00:00:00.000Z',
      endedAt: '2026-07-20T00:01:00.000Z',
    };
    state.latestRisk = {
      score: 12,
      band: 'low',
      factors: [],
      snapshotId: 'snap_1',
      computedAt: '2026-07-20T00:00:30.000Z',
    };
    await audit.saveRun(run);

    const res = await app.inject({ method: 'GET', url: '/status' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      status: 'ok',
      policy: { id: samplePolicy.id },
      scheduler: { seq: 7 },
      latestRun: { id: 'run_1', status: 'completed', action: 'hold' },
      latestRisk: { score: 12, band: 'low' },
    });
  });

  it('serves the built-in signal feed', async () => {
    const { app } = await testServer();
    const res = await app.inject({ method: 'GET', url: '/signals/feed' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      signals: [
        { key: 'tbill.yield.3m' },
        { key: 'vault.liquidity.usd' },
        { key: 'rwa.redemption.queue' },
      ],
    });
  });

  it('creates and reads treasury workspaces', async () => {
    const { app } = await testServer();
    const payload = {
      name: 'RWA Income Treasury',
      ownerAccount: 'account-hash-test',
      vaultContractHash: 'contract-package-test',
      network: 'casper-test',
      policy: {
        rwaTarget: 60,
        stableTarget: 30,
        nativeTarget: 10,
        maxRiskScore: 70,
      },
      signals: {
        mode: 'operator',
        feedUrl: '',
      },
    };

    const created = await app.inject({
      method: 'POST',
      url: '/workspaces',
      payload,
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      name: payload.name,
      id: expect.stringMatching(/^workspace_/),
      ownerAccount: payload.ownerAccount,
      agentStatus: 'stopped',
    });

    const workspaceId = created.json().id as string;
    const detail = await app.inject({ method: 'GET', url: `/workspaces/${workspaceId}` });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({ id: workspaceId, policy: { maxRiskScore: 70 } });

    const list = await app.inject({ method: 'GET', url: '/workspaces' });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toHaveLength(1);
  });

  it('filters workspaces by owner account', async () => {
    const { app, audit } = await testServer();
    const base = {
      name: 'Treasury',
      vaultContractHash: 'contract-package-test',
      network: 'casper-test' as const,
      policy: {
        rwaTarget: 60,
        stableTarget: 30,
        nativeTarget: 10,
        maxRiskScore: 70,
      },
      signals: {
        mode: 'operator' as const,
        feedUrl: '',
      },
      agentStatus: 'stopped' as const,
      createdAt: '2026-07-20T00:00:00.000Z',
      updatedAt: '2026-07-20T00:00:00.000Z',
    };
    await audit.saveWorkspace({ ...base, id: 'workspace_owner', ownerAccount: 'owner-wallet' });
    await audit.saveWorkspace({ ...base, id: 'workspace_other', ownerAccount: 'other-wallet' });

    const res = await app.inject({ method: 'GET', url: '/workspaces?ownerAccount=owner-wallet' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject([{ id: 'workspace_owner', ownerAccount: 'owner-wallet' }]);
  });

  it('starts and stops workspace agents for the owner wallet', async () => {
    const { app, audit } = await testServer();
    await audit.saveWorkspace({
      id: 'workspace_1',
      name: 'RWA Income Treasury',
      ownerAccount: 'owner-wallet',
      vaultContractHash: 'contract-package-test',
      network: 'casper-test',
      policy: {
        rwaTarget: 60,
        stableTarget: 30,
        nativeTarget: 10,
        maxRiskScore: 70,
      },
      signals: {
        mode: 'operator',
        feedUrl: '',
      },
      agentStatus: 'stopped',
      createdAt: '2026-07-20T00:00:00.000Z',
      updatedAt: '2026-07-20T00:00:00.000Z',
    });

    const started = await app.inject({
      method: 'POST',
      url: '/workspaces/workspace_1/agent',
      payload: { status: 'active', ownerAccount: 'owner-wallet' },
    });
    expect(started.statusCode).toBe(200);
    expect(started.json()).toMatchObject({ id: 'workspace_1', agentStatus: 'active' });

    const stopped = await app.inject({
      method: 'POST',
      url: '/workspaces/workspace_1/agent',
      payload: { status: 'stopped', ownerAccount: 'owner-wallet' },
    });
    expect(stopped.statusCode).toBe(200);
    expect(stopped.json()).toMatchObject({ id: 'workspace_1', agentStatus: 'stopped' });
  });

  it('updates workspace policy for the owner wallet and rejects others', async () => {
    const { app, audit } = await testServer();
    await audit.saveWorkspace({
      id: 'workspace_1',
      name: 'RWA Income Treasury',
      ownerAccount: 'owner-wallet',
      vaultContractHash: 'contract-package-test',
      network: 'casper-test',
      policy: { rwaTarget: 60, stableTarget: 30, nativeTarget: 10, maxRiskScore: 70 },
      signals: { mode: 'operator', feedUrl: '' },
      agentStatus: 'stopped',
      createdAt: '2026-07-20T00:00:00.000Z',
      updatedAt: '2026-07-20T00:00:00.000Z',
    });

    const updated = await app.inject({
      method: 'POST',
      url: '/workspaces/workspace_1/policy',
      payload: {
        ownerAccount: 'owner-wallet',
        policy: { rwaTarget: 50, stableTarget: 40, nativeTarget: 10, maxRiskScore: 60 },
      },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({ id: 'workspace_1', policy: { rwaTarget: 50, maxRiskScore: 60 } });

    const forbidden = await app.inject({
      method: 'POST',
      url: '/workspaces/workspace_1/policy',
      payload: {
        ownerAccount: 'other-wallet',
        policy: { rwaTarget: 50, stableTarget: 40, nativeTarget: 10, maxRiskScore: 60 },
      },
    });
    expect(forbidden.statusCode).toBe(403);

    const invalid = await app.inject({
      method: 'POST',
      url: '/workspaces/workspace_1/policy',
      payload: {
        ownerAccount: 'owner-wallet',
        policy: { rwaTarget: 90, stableTarget: 40, nativeTarget: 10, maxRiskScore: 60 },
      },
    });
    expect(invalid.statusCode).toBe(400);
  });

  it('rejects invalid workspace payloads', async () => {
    const { app } = await testServer();
    const res = await app.inject({
      method: 'POST',
      url: '/workspaces',
      payload: { name: '' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('filters runs by workspace id', async () => {
    const { app, audit } = await testServer();
    await audit.saveRun({
      id: 'run_a',
      policyId: samplePolicy.id,
      workspaceId: 'workspace_a',
      stage: 'done',
      status: 'completed',
      action: 'hold',
      startedAt: '2026-07-20T00:00:00.000Z',
    });
    await audit.saveRun({
      id: 'run_b',
      policyId: samplePolicy.id,
      workspaceId: 'workspace_b',
      stage: 'done',
      status: 'completed',
      action: 'hold',
      startedAt: '2026-07-20T00:01:00.000Z',
    });

    const res = await app.inject({ method: 'GET', url: '/runs?workspaceId=workspace_a' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject([{ id: 'run_a', workspaceId: 'workspace_a' }]);
  });

  it('passes workspace id into manual run triggers', async () => {
    const { app, audit, seenSchedulerOptions } = await testServer();
    await audit.saveWorkspace({
      id: 'workspace_1',
      name: 'RWA Income Treasury',
      ownerAccount: 'account-hash-test',
      vaultContractHash: 'contract-package-test',
      network: 'casper-test',
      policy: {
        rwaTarget: 60,
        stableTarget: 30,
        nativeTarget: 10,
        maxRiskScore: 70,
      },
      signals: {
        mode: 'operator',
        feedUrl: '',
      },
      createdAt: '2026-07-20T00:00:00.000Z',
      updatedAt: '2026-07-20T00:00:00.000Z',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/runs',
      payload: { workspaceId: 'workspace_1' },
    });
    expect(res.statusCode).toBe(200);
    expect(seenSchedulerOptions).toEqual([{ workspaceId: 'workspace_1' }]);
  });

  it('rejects manual run triggers for unknown workspaces', async () => {
    const { app, seenSchedulerOptions } = await testServer();
    const res = await app.inject({
      method: 'POST',
      url: '/runs',
      payload: { workspaceId: 'workspace_missing' },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: 'workspace not found' });
    expect(seenSchedulerOptions).toEqual([]);
  });

  it('requires workspace id for manual run triggers', async () => {
    const { app, seenSchedulerOptions } = await testServer();
    const res = await app.inject({
      method: 'POST',
      url: '/runs',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'workspaceId required' });
    expect(seenSchedulerOptions).toEqual([]);
  });

  it('requires wallet approval metadata before approving a run', async () => {
    const { app } = await testServer();
    const res = await app.inject({
      method: 'POST',
      url: '/approve',
      payload: { runId: 'run_missing' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'wallet approval required' });
  });

  it('rejects approvals from wallets that do not own the workspace', async () => {
    const { app, audit, state } = await testServer();
    const now = '2026-07-20T00:00:00.000Z';
    await audit.saveWorkspace({
      id: 'workspace_1',
      name: 'RWA Income Treasury',
      ownerAccount: 'owner-wallet',
      vaultContractHash: 'contract-package-test',
      network: 'casper-test',
      policy: {
        rwaTarget: 60,
        stableTarget: 30,
        nativeTarget: 10,
        maxRiskScore: 70,
      },
      signals: {
        mode: 'operator',
        feedUrl: '',
      },
      createdAt: now,
      updatedAt: now,
    });
    state.pendingRun = {
      runId: 'run_approval',
      workspaceId: 'workspace_1',
      policy: samplePolicy,
      recommendation: {
        id: 'rec_approval',
        runId: 'run_approval',
        action: 'rebalance',
        compliancePassed: true,
        violations: [],
        riskScore: 12,
        explanation: 'rebalance',
        confidence: 0.8,
        agentProposed: false,
        trace: [],
        createdAt: now,
      },
      rebalance: {
        id: 'rebalance_approval',
        policyId: samplePolicy.id,
        legs: [{ fromAssetId: 'tbill-rwa', toAssetId: 'usdc', amount: '100', weight: 0.01 }],
        createdAt: now,
      },
      approvalToken: 'tok_run_approval',
      snapshot: {
        id: 'snap_approval',
        capturedAt: now,
        signals: [],
      },
      risk: {
        score: 12,
        band: 'low',
        factors: [],
        snapshotId: 'snap_approval',
        computedAt: now,
      },
    };

    const res = await app.inject({
      method: 'POST',
      url: '/approve',
      payload: {
        runId: 'run_approval',
        workspaceId: 'workspace_1',
        approval: {
          accountHash: 'other-wallet',
          publicKey: 'other-wallet',
          signature: 'sig',
          message: 'approval',
          signedAt: now,
        },
      },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ error: 'wallet does not own this workspace' });
  });

  it('exports metrics for runs, risk, pending approval, and deploy timing', async () => {
    const { app, audit, state } = await testServer();
    const tx: TransactionRecord = {
      id: 'tx_1',
      deployHash: 'deploy-hash',
      status: 'finalized',
      entryPoint: 'record_rebalance',
      network: 'casper-testnet',
      submittedAt: '2026-07-20T00:00:00.000Z',
      finalizedAt: '2026-07-20T00:02:00.000Z',
    };
    await audit.saveTransaction(tx);
    await audit.saveRun({
      id: 'run_2',
      policyId: samplePolicy.id,
      stage: 'done',
      status: 'completed',
      action: 'rebalance',
      riskScore: 72,
      transactionId: tx.id,
      deployHash: tx.deployHash,
      startedAt: '2026-07-20T00:00:00.000Z',
      endedAt: '2026-07-20T00:02:00.000Z',
    });
    state.latestRisk = {
      score: 72,
      band: 'critical',
      factors: [],
      snapshotId: 'snap_2',
      computedAt: '2026-07-20T00:00:30.000Z',
    };

    const res = await app.inject({ method: 'GET', url: '/metrics' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('caliber_runs_total{status="completed",action="rebalance"} 1');
    expect(res.body).toContain('caliber_latest_risk_score 72');
    expect(res.body).toContain('caliber_pending_approval 0');
    expect(res.body).toContain('caliber_latest_run_started_unixtime 1784505600');
  });
});
