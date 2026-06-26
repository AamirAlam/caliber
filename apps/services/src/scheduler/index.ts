import { config } from '../config.js';
import { log } from '../logger.js';
import { runAgentLoop, type OrchestratorDeps } from '../orchestrator.js';

/**
 * Drives phase 1 of the agent loop on a fixed interval. Runs are sequential to
 * keep audit ordering deterministic; overlapping ticks are skipped. Replace with
 * a durable queue (BullMQ, Temporal, cron) for production.
 */
export class Scheduler {
  private timer?: ReturnType<typeof setInterval>;
  private seq = 0;
  private running = false;

  constructor(
    private readonly deps: OrchestratorDeps,
    private readonly intervalMs: number = config.loop.intervalMs,
  ) {}

  start(): void {
    log.info('scheduler started', { intervalMs: this.intervalMs, dryRun: config.loop.dryRun });
    void this.tick();
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    log.info('scheduler stopped');
  }

  /** Run one loop now (used by the scenario trigger). Returns the seq used. */
  async runNow(): Promise<number> {
    await this.tick();
    return this.seq;
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await runAgentLoop(this.deps, ++this.seq);
    } catch (err) {
      log.error('agent loop failed', { seq: this.seq, err: String(err) });
    } finally {
      this.running = false;
    }
  }
}
