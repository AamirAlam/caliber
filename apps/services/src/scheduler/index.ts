import type { TreasuryPolicy } from '@helm/shared';
import { config } from '../config.js';
import type { OrchestratorDeps } from '../orchestrator.js';

/**
 * Drives the agent loop on a fixed interval. Replace with a durable queue
 * (BullMQ, Temporal, cron) for production.
 * TODO: call runAgentLoop(policy, deps, seq) on each tick.
 */
export class Scheduler {
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly _policy: TreasuryPolicy,
    private readonly _deps: OrchestratorDeps,
    private readonly intervalMs: number = config.loop.intervalMs,
  ) {}

  start(): void {
    // TODO: invoke the agent loop on a schedule.
    this.timer = setInterval(() => {
      // TODO: void this.tick();
    }, this.intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
