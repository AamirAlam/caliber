import { InMemoryAuditStore } from './audit/index.js';
import { defaultDeps } from './orchestrator.js';
import { runAgentLoop } from './orchestrator.js';
import { samplePolicy } from './samplePolicy.js';

/**
 * Minimal CLI for demos. `run-once` executes a single agent loop and prints the
 * resulting recommendation + run log as JSON — handy for the demo video.
 */
async function main(): Promise<void> {
  const command = process.argv[2] ?? 'run-once';

  if (command === 'run-once') {
    const audit = new InMemoryAuditStore();
    const deps = defaultDeps(audit);
    const run = await runAgentLoop(samplePolicy, deps, 1);
    const runs = await audit.listRuns();
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ run, runs }, null, 2));
    return;
  }

  // eslint-disable-next-line no-console
  console.error(`Unknown command: ${command}`);
  process.exit(1);
}

void main();
