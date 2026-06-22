import { InMemoryAuditStore } from './audit/index.js';
import { log } from './logger.js';
import { defaultDeps } from './orchestrator.js';
import { samplePolicy } from './samplePolicy.js';
import { Scheduler } from './scheduler/index.js';

/**
 * Entry point for the Helm off-chain agent. Boots an audit store, wires the
 * default dependencies, and starts the scheduler against the sample policy.
 */
function main(): void {
  const audit = new InMemoryAuditStore();
  const deps = defaultDeps(audit);
  const scheduler = new Scheduler(samplePolicy, deps);

  scheduler.start();

  process.on('SIGINT', () => {
    scheduler.stop();
    process.exit(0);
  });

  log.info('helm agent running', { policy: samplePolicy.id });
}

main();
