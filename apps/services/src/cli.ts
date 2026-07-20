import 'dotenv/config';
import { InMemoryAuditStore } from './audit/index.js';
import { defaultDeps, executeApproved, runAgentLoop } from './orchestrator.js';
import { loadPolicy } from './policy/load.js';
import { AppState } from './state.js';

/**
 * Minimal CLI. `run-once` runs one configured signal-fed loop and, if a
 * rebalance is pending, approves it, printing the resulting recommendation,
 * transaction, and run history as JSON.
 */
async function main(): Promise<void> {
  const command = process.argv[2] ?? 'run-once';
  if (command !== 'run-once') {
    console.error(`Unknown command: ${command}`);
    process.exit(1);
  }

  const state = new AppState(loadPolicy());
  const audit = new InMemoryAuditStore();
  const deps = defaultDeps(audit, state);

  const run = await runAgentLoop(deps, 1);

  let approval;
  if (state.pendingRun) {
    approval = await executeApproved(deps, state.pendingRun.runId, 'demo@caliber');
  }

  console.log(
    JSON.stringify(
      {
        latestRecommendation: state.latestRecommendation,
        run,
        approval,
        runs: await audit.listRuns(),
      },
      null,
      2,
    ),
  );
}

void main();
