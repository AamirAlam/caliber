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
  private lastStartedAt?: string;
  private lastSucceededAt?: string;
  private lastFailedAt?: string;
  private lastError?: string;

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

  /** Run one loop now, used by the authenticated manual trigger. Returns the seq used. */
  async runNow(): Promise<number> {
    await this.tick();
    return this.seq;
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.lastStartedAt = new Date().toISOString();
    try {
      await runAgentLoop(this.deps, ++this.seq);
      this.lastSucceededAt = new Date().toISOString();
      this.lastError = undefined;
    } catch (err) {
      this.lastFailedAt = new Date().toISOString();
      this.lastError = String(err);
      log.error('agent loop failed', { seq: this.seq, err: String(err) });
    } finally {
      this.running = false;
    }
  }

  status() {
    return {
      running: this.running,
      seq: this.seq,
      intervalMs: this.intervalMs,
      lastStartedAt: this.lastStartedAt,
      lastSucceededAt: this.lastSucceededAt,
      lastFailedAt: this.lastFailedAt,
      lastError: this.lastError,
    };
  }
}
