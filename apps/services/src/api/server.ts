import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { readVaultStateCached } from '../casper/reader.js';
import { executeApproved, type OrchestratorDeps } from '../orchestrator.js';
import type { Scheduler } from '../scheduler/index.js';

/**
 * Thin HTTP API the dashboard consumes. Reads come from AppState / the audit
 * store; `/scenario/stress` toggles the simulated stress scenario and forces a
 * loop tick; `/approve` resumes a paused run and submits the on-chain deploy.
 */
/**
 * Resolve the CORS `origin` option from config:
 * - `*` (or `true`) → reflect any origin (public read-only demo API).
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

  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/policy', async () => state.activePolicy);

  app.get('/signals/latest', async (_req, reply) =>
    state.latestSnapshot ?? reply.code(404).send({ error: 'no snapshot yet' }),
  );
  app.get('/risk/latest', async (_req, reply) =>
    state.latestRisk ?? reply.code(404).send({ error: 'no risk yet' }),
  );
  app.get('/recommendation/latest', async (_req, reply) =>
    state.latestRecommendation ?? reply.code(404).send({ error: 'no recommendation yet' }),
  );
  app.get('/runs', async () => audit.listRuns());

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

  app.post<{ Body: { active?: boolean } }>('/scenario/stress', async (req) => {
    state.scenarioStress = req.body?.active ?? true;
    await scheduler.runNow();
    return {
      snapshot: state.latestSnapshot,
      risk: state.latestRisk,
      recommendation: state.latestRecommendation,
      pendingRunId: state.pendingRun?.runId ?? null,
    };
  });

  app.post<{ Body: { runId?: string; approver?: string } }>('/approve', async (req, reply) => {
    const { runId, approver } = req.body ?? {};
    if (!runId) return reply.code(400).send({ error: 'runId required' });
    if (!state.pendingRun || state.pendingRun.runId !== runId) {
      return reply.code(409).send({ error: 'no run awaiting approval with that id' });
    }
    try {
      const result = await executeApproved(deps, runId, approver ?? 'dashboard');
      return result;
    } catch (err) {
      return reply.code(502).send({ error: String(err) });
    }
  });

  return app;
}
