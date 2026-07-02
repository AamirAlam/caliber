import 'dotenv/config';
import { InMemoryAuditStore } from './audit/index.js';
import { defaultDeps, executeApproved, runAgentLoop } from './orchestrator.js';
import { samplePolicy } from './samplePolicy.js';
import { AppState } from './state.js';

/**
 * Minimal CLI for demos. `run-once` runs a calm loop then a stress loop and (if
 * a rebalance is pending) approves it, printing the resulting recommendation,
 * transaction, and run history as JSON. Great for the demo video / offline check.
 */
async function main(): Promise<void> {
  const command = process.argv[2] ?? 'run-once';
  if (command !== 'run-once') {
    // eslint-disable-next-line no-console
    console.error(`Unknown command: ${command}`);
    process.exit(1);
  }

  const state = new AppState(samplePolicy);
  const audit = new InMemoryAuditStore();
  const deps = defaultDeps(audit, state);

  // Calm cycle.
  await runAgentLoop(deps, 1);

  // Stress cycle → should produce a rebalance awaiting approval.
  state.scenarioStress = true;
  const stressRun = await runAgentLoop(deps, 2);

  let approval;
  if (state.pendingRun) {
    approval = await executeApproved(deps, state.pendingRun.runId, 'demo@helm');
  }

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        latestRecommendation: state.latestRecommendation,
        stressRun,
        approval,
        runs: await audit.listRuns(),
      },
      null,
      2,
    ),
  );
}

void main();
