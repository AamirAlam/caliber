import { randomUUID } from 'node:crypto';
import cors from '@fastify/cors';
import {
  CreateTreasuryWorkspaceSchema,
  UpdateWorkspacePolicySchema,
  WalletApprovalSchema,
  type TreasuryWorkspace,
} from '@caliber/shared';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import casper from 'casper-js-sdk';
import { config } from '../config.js';
import { readVaultState, readVaultStateCached } from '../casper/reader.js';
import { executeApproved, type OrchestratorDeps } from '../orchestrator.js';
import type { Scheduler } from '../scheduler/index.js';
import { buildOperatorSignalFeed, HttpSignalSource, validateSignalSet } from '../signals/index.js';
import { walletApprovalMessage } from './walletMessages.js';

/**
 * Thin HTTP API the dashboard consumes. Reads come from AppState / the audit
 * store; `POST /runs` forces a loop tick from configured live sources;
 * `/approve` resumes a paused run and submits the on-chain deploy.
 */
/**
 * Resolve the CORS `origin` option from config:
 * - `*` (or `true`) → reflect any origin (public read-only API).
 * - comma-separated list → an allowlist of origins.
 * - otherwise → the single origin string.
 */
function corsOrigin(v: string): boolean | string | string[] {
  if (v === '*' || v === 'true') return true;
  if (v.includes(',')) return v.split(',').map((s) => s.trim());
  return v;
}

export function buildServer(deps: OrchestratorDeps, scheduler: Scheduler): FastifyInstance {
  const app = Fastify({ logger: false });
  void app.register(cors, { origin: corsOrigin(config.api.corsOrigin) });

  const { state, audit } = deps;

  app.get('/', async () => ({
    service: 'caliber-services',
    status: 'ok',
    routes: {
      health: '/health',
      ready: '/ready',
      status: '/status',
      metrics: '/metrics',
      policy: '/policy',
      signalFeed: '/signals/feed',
      workspaces: '/workspaces',
      runs: '/runs',
      vaultState: '/vault/state',
    },
  }));
  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/ready', async (_req, reply) => {
    const checks: Record<string, 'ok' | 'fail'> = {
      scheduler: 'ok',
      vault: 'ok',
      database: 'ok',
      signals: 'ok',
    };
    try {
      await readVaultState();
    } catch {
      checks.vault = 'fail';
    }
    try {
      await audit.listRuns();
    } catch {
      checks.database = 'fail';
    }
    try {
      await signalFeedReady();
    } catch {
      checks.signals = 'fail';
    }
    const ok = Object.values(checks).every((v) => v === 'ok');
    return reply.code(ok ? 200 : 503).send({ status: ok ? 'ready' : 'not_ready', checks, scheduler: scheduler.status() });
  });
  app.get('/metrics', async (_req, reply) => {
    const s = scheduler.status();
    const runs = await audit.listRuns();
    const latestRun = runs[0];
    const runCounts = summarizeRuns(runs);
    const latestSignalAge = state.latestSnapshot
      ? Math.max(0, Math.floor((Date.now() - Date.parse(state.latestSnapshot.capturedAt)) / 1000))
      : 0;
    const lines = [
      '# HELP caliber_scheduler_running Whether the scheduler is currently running a loop.',
      '# TYPE caliber_scheduler_running gauge',
      `caliber_scheduler_running ${s.running ? 1 : 0}`,
      '# HELP caliber_scheduler_seq Last scheduler sequence number in this process.',
      '# TYPE caliber_scheduler_seq counter',
      `caliber_scheduler_seq ${s.seq}`,
      '# HELP caliber_scheduler_last_success_unixtime Last successful loop completion time.',
      '# TYPE caliber_scheduler_last_success_unixtime gauge',
      `caliber_scheduler_last_success_unixtime ${s.lastSucceededAt ? Math.floor(Date.parse(s.lastSucceededAt) / 1000) : 0}`,
      '# HELP caliber_scheduler_last_failure_unixtime Last failed loop time.',
      '# TYPE caliber_scheduler_last_failure_unixtime gauge',
      `caliber_scheduler_last_failure_unixtime ${s.lastFailedAt ? Math.floor(Date.parse(s.lastFailedAt) / 1000) : 0}`,
      '# HELP caliber_runs_total Total agent runs by status and action.',
      '# TYPE caliber_runs_total counter',
      ...[...runCounts.entries()].map(([labels, count]) => `caliber_runs_total{${labels}} ${count}`),
      '# HELP caliber_latest_risk_score Latest deterministic treasury risk score.',
      '# TYPE caliber_latest_risk_score gauge',
      `caliber_latest_risk_score ${state.latestRisk?.score ?? 0}`,
      '# HELP caliber_pending_approval Whether an executable rebalance is awaiting approval.',
      '# TYPE caliber_pending_approval gauge',
      `caliber_pending_approval ${state.pendingRun ? 1 : 0}`,
      '# HELP caliber_latest_signal_age_seconds Age of the latest accepted signal snapshot.',
      '# TYPE caliber_latest_signal_age_seconds gauge',
      `caliber_latest_signal_age_seconds ${latestSignalAge}`,
      '# HELP caliber_latest_run_started_unixtime Latest run start time.',
      '# TYPE caliber_latest_run_started_unixtime gauge',
      `caliber_latest_run_started_unixtime ${latestRun ? Math.floor(Date.parse(latestRun.startedAt) / 1000) : 0}`,
    ];
    return reply.type('text/plain; version=0.0.4').send(`${lines.join('\n')}\n`);
  });
  app.get('/status', async () => {
    const runs = await audit.listRuns();
    const latestRun = runs[0];
    const latestTx = latestRun?.transactionId ? await audit.getTransaction(latestRun.transactionId) : undefined;
    const signalAgeSeconds = state.latestSnapshot
      ? Math.max(0, Math.floor((Date.now() - Date.parse(state.latestSnapshot.capturedAt)) / 1000))
      : null;

    return {
      status: 'ok',
      mode: config.env,
      dryRun: config.loop.dryRun,
      policy: {
        id: state.activePolicy.id,
        name: state.activePolicy.name,
        version: state.activePolicy.version,
        paused: state.activePolicy.paused,
      },
      scheduler: scheduler.status(),
      latestRun: latestRun
        ? {
            id: latestRun.id,
            status: latestRun.status,
            stage: latestRun.stage,
            action: latestRun.action ?? null,
            riskScore: latestRun.riskScore ?? null,
            deployHash: latestRun.deployHash ?? null,
            startedAt: latestRun.startedAt,
            endedAt: latestRun.endedAt ?? null,
          }
        : null,
      latestSignal: state.latestSnapshot
        ? {
            snapshotId: state.latestSnapshot.id,
            capturedAt: state.latestSnapshot.capturedAt,
            ageSeconds: signalAgeSeconds,
            signalCount: state.latestSnapshot.signals.length,
          }
        : null,
      latestRisk: state.latestRisk
        ? {
            score: state.latestRisk.score,
            band: state.latestRisk.band,
            computedAt: state.latestRisk.computedAt,
          }
        : null,
      pendingApproval: state.pendingRun
        ? {
            runId: state.pendingRun.runId,
            recommendationId: state.pendingRun.recommendation.id,
            riskScore: state.pendingRun.risk.score,
          }
        : null,
      latestTransaction: latestTx
        ? {
            id: latestTx.id,
            status: latestTx.status,
            deployHash: latestTx.deployHash ?? null,
            finalizedAt: latestTx.finalizedAt ?? null,
          }
        : null,
    };
  });
  app.get('/policy', async () => state.activePolicy);
  app.get('/signals/feed', async () => buildOperatorSignalFeed());
  app.get('/workspaces', async (req) => {
    const ownerAccount = ownerAccountFromQuery(req);
    const workspaces = await audit.listWorkspaces();
    return ownerAccount ? workspaces.filter((workspace) => ownsWorkspace(workspace, ownerAccount)) : workspaces;
  });

  app.get<{ Params: { id: string } }>('/workspaces/:id', async (req, reply) => {
    const workspace = await audit.getWorkspace(req.params.id);
    if (!workspace) return reply.code(404).send({ error: 'workspace not found' });
    return workspace;
  });

  app.post('/workspaces', async (req, reply) => {
    const parsed = CreateTreasuryWorkspaceSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.message });
    }
    const now = new Date().toISOString();
    const workspace: TreasuryWorkspace = {
      ...parsed.data,
      id: `workspace_${randomUUID().slice(0, 12)}`,
      agentStatus: 'stopped',
      agentStoppedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    await audit.saveWorkspace(workspace);
    return reply.code(201).send(workspace);
  });

  app.post<{ Params: { id: string }; Body: { status?: 'active' | 'stopped'; ownerAccount?: string } }>(
    '/workspaces/:id/agent',
    async (req, reply) => {
      const workspace = await audit.getWorkspace(req.params.id);
      if (!workspace) return reply.code(404).send({ error: 'workspace not found' });
      if (req.body?.ownerAccount && !ownsWorkspace(workspace, req.body.ownerAccount)) {
        return reply.code(403).send({ error: 'wallet does not own this workspace' });
      }
      const status = req.body?.status;
      if (status !== 'active' && status !== 'stopped') {
        return reply.code(400).send({ error: 'status must be active or stopped' });
      }
      const now = new Date().toISOString();
      const updated: TreasuryWorkspace = {
        ...workspace,
        agentStatus: status,
        agentStartedAt: status === 'active' ? now : workspace.agentStartedAt,
        agentStoppedAt: status === 'stopped' ? now : workspace.agentStoppedAt,
        updatedAt: now,
      };
      await audit.saveWorkspace(updated);
      return updated;
    },
  );

  app.post<{ Params: { id: string }; Body: { policy?: unknown; ownerAccount?: string } }>(
    '/workspaces/:id/policy',
    async (req, reply) => {
      const workspace = await audit.getWorkspace(req.params.id);
      if (!workspace) return reply.code(404).send({ error: 'workspace not found' });
      if (req.body?.ownerAccount && !ownsWorkspace(workspace, req.body.ownerAccount)) {
        return reply.code(403).send({ error: 'wallet does not own this workspace' });
      }
      const parsed = UpdateWorkspacePolicySchema.safeParse(req.body?.policy ?? {});
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.message });
      }
      const updated: TreasuryWorkspace = {
        ...workspace,
        policy: parsed.data,
        updatedAt: new Date().toISOString(),
      };
      await audit.saveWorkspace(updated);
      return updated;
    },
  );

  app.get('/signals/latest', async (_req, reply) =>
    state.latestSnapshot ?? reply.code(404).send({ error: 'no snapshot yet' }),
  );
  app.get('/risk/latest', async (_req, reply) =>
    state.latestRisk ?? reply.code(404).send({ error: 'no risk yet' }),
  );
  app.get('/recommendation/latest', async (_req, reply) =>
    state.latestRecommendation ?? reply.code(404).send({ error: 'no recommendation yet' }),
  );
  app.get('/runs', async (req) => {
    const workspaceId = workspaceIdFromQuery(req);
    const runs = await audit.listRuns();
    return workspaceId ? runs.filter((run) => run.workspaceId === workspaceId) : runs;
  });

  // Full detail for one run: the decision reasoning + money flow + transaction.
  app.get<{ Params: { id: string } }>('/runs/:id', async (req, reply) => {
    const run = await audit.getRun(req.params.id);
    if (!run) return reply.code(404).send({ error: 'run not found' });
    const recommendation = run.recommendationId
      ? await audit.getRecommendation(run.recommendationId)
      : undefined;
    const transaction = run.transactionId
      ? await audit.getTransaction(run.transactionId)
      : undefined;
    return { run, recommendation: recommendation ?? null, transaction: transaction ?? null };
  });

  app.get('/vault/state', async () => readVaultStateCached());

  app.post<{ Body: { workspaceId?: string; ownerAccount?: string } }>('/runs', async (req, reply) => {
    if (!authorize(req, reply)) return reply;
    const workspaceId = req.body?.workspaceId;
    if (!workspaceId) {
      return reply.code(400).send({ error: 'workspaceId required' });
    }
    const workspace = await audit.getWorkspace(workspaceId);
    if (!workspace) {
      return reply.code(404).send({ error: 'workspace not found' });
    }
    if (req.body?.ownerAccount && !ownsWorkspace(workspace, req.body.ownerAccount)) {
      return reply.code(403).send({ error: 'wallet does not own this workspace' });
    }
    await scheduler.runNow({ workspaceId });
    return {
      snapshot: state.latestSnapshot,
      risk: state.latestRisk,
      recommendation: state.latestRecommendation,
      pendingRunId: state.pendingRun?.runId ?? null,
      workspaceId: state.pendingRun?.workspaceId ?? workspaceId ?? null,
    };
  });

  app.post<{ Body: { runId?: string; approver?: string; workspaceId?: string; approval?: unknown } }>('/approve', async (req, reply) => {
    if (!authorize(req, reply)) return reply;
    const { runId, approver, workspaceId } = req.body ?? {};
    if (!runId) return reply.code(400).send({ error: 'runId required' });
    const approval = WalletApprovalSchema.safeParse(req.body?.approval);
    if (!approval.success) {
      return reply.code(400).send({ error: 'wallet approval required' });
    }
    const pending = state.pendingRun ?? (await audit.getPendingApproval(runId));
    if (!pending || pending.runId !== runId) {
      return reply.code(409).send({ error: 'no run awaiting approval with that id' });
    }
    if (workspaceId && pending.workspaceId && pending.workspaceId !== workspaceId) {
      return reply.code(409).send({ error: 'run is awaiting approval for a different workspace' });
    }
    const workspace = pending.workspaceId ? await audit.getWorkspace(pending.workspaceId) : undefined;
    if (workspace && !walletOwnsWorkspace(workspace, approval.data)) {
      return reply.code(403).send({ error: 'wallet does not own this workspace' });
    }
    if (
      pending.workspaceId &&
      approval.data.message !== walletApprovalMessage(runId, pending.workspaceId, approval.data.accountHash)
    ) {
      return reply.code(400).send({ error: 'wallet approval message mismatch' });
    }
    if (!verifyWalletSignature(approval.data.publicKey, approval.data.message, approval.data.signature)) {
      return reply.code(401).send({ error: 'wallet approval signature invalid' });
    }
    try {
      const result = await executeApproved(deps, runId, approver ?? approval.data.accountHash, workspaceId, approval.data);
      return result;
    } catch (err) {
      return reply.code(502).send({ error: String(err) });
    }
  });

  return app;
}

function walletOwnsWorkspace(
  workspace: TreasuryWorkspace,
  approval: { accountHash: string; publicKey: string },
): boolean {
  return ownsWorkspace(workspace, approval.accountHash) || ownsWorkspace(workspace, approval.publicKey);
}

function ownsWorkspace(workspace: TreasuryWorkspace, account: string): boolean {
  return workspace.ownerAccount === account;
}

function ownerAccountFromQuery(req: FastifyRequest): string | undefined {
  const query = req.query as { ownerAccount?: unknown };
  return typeof query.ownerAccount === 'string' && query.ownerAccount ? query.ownerAccount : undefined;
}

function verifyWalletSignature(publicKeyHex: string, message: string, signatureHex: string): boolean {
  try {
    const publicKey = casper.PublicKey.fromHex(publicKeyHex);
    const messageBytes = Buffer.from(message, 'utf8');
    const signatureBytes = Buffer.from(stripHexPrefix(signatureHex), 'hex');
    return publicKey.verifySignature(messageBytes, signatureBytes);
  } catch {
    return false;
  }
}

function stripHexPrefix(value: string): string {
  return value.startsWith('0x') ? value.slice(2) : value;
}

export async function signalFeedReady(): Promise<void> {
  if (config.signals.feedUrl) {
    validateSignalSet(await new HttpSignalSource().collect());
    return;
  }
  validateSignalSet(buildOperatorSignalFeed().signals);
}

function authorize(req: FastifyRequest, reply: FastifyReply): boolean {
  if (!config.api.adminToken) return true;
  const auth = req.headers.authorization ?? '';
  if (auth !== `Bearer ${config.api.adminToken}`) {
    reply.code(401).send({ error: 'unauthorized' });
    return false;
  }
  return true;
}

function workspaceIdFromQuery(req: FastifyRequest): string | undefined {
  const query = req.query as { workspaceId?: unknown };
  return typeof query.workspaceId === 'string' && query.workspaceId ? query.workspaceId : undefined;
}

function summarizeRuns(runs: Awaited<ReturnType<OrchestratorDeps['audit']['listRuns']>>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const run of runs) {
    const labels = `status="${metricLabel(run.status)}",action="${metricLabel(run.action ?? 'none')}"`;
    counts.set(labels, (counts.get(labels) ?? 0) + 1);
  }
  if (counts.size === 0) counts.set('status="none",action="none"', 0);
  return counts;
}

function metricLabel(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}
