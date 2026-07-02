import 'dotenv/config';
import { InMemoryAuditStore } from './audit/index.js';
import { buildServer } from './api/server.js';
import { config } from './config.js';
import { log } from './logger.js';
import { defaultDeps } from './orchestrator.js';
import { samplePolicy } from './samplePolicy.js';
import { Scheduler } from './scheduler/index.js';
import { AppState } from './state.js';

/**
 * Entry point for the Helm off-chain agent: boots app state, the audit store,
 * the scheduler (phase-1 loop), and the HTTP API the dashboard consumes.
 */
async function main(): Promise<void> {
  const state = new AppState(samplePolicy);
  const audit = new InMemoryAuditStore();
  const deps = defaultDeps(audit, state);
  const scheduler = new Scheduler(deps);

  const server = buildServer(deps, scheduler);
  await server.listen({ port: config.api.port, host: '0.0.0.0' });
  log.info('helm api listening', { port: config.api.port });

  scheduler.start();

  const shutdown = () => {
    scheduler.stop();
    void server.close().then(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

void main();
