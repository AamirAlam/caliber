import { config } from '../config.js';
import { log } from '../logger.js';
import { runAgentLoop, type OrchestratorDeps, type RunAgentLoopOptions } from '../orchestrator.js';

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
    private readonly workspaceRunIntervalMs: number = config.loop.workspaceRunIntervalMs,
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
  async runNow(options: RunAgentLoopOptions = {}): Promise<number> {
    await this.tick(options);
    return this.seq;
  }

  private async tick(options: RunAgentLoopOptions = {}): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.lastStartedAt = new Date().toISOString();
    try {
      if (options.workspaceId) {
        await this.runOne(options);
      } else {
        const workspaces = await this.deps.audit.listWorkspaces();
        const activeWorkspaces = workspaces.filter((workspace) => workspace.agentStatus === 'active');
        if (workspaces.length === 0) {
          await this.runOne();
        } else {
          const runs = await this.deps.audit.listRuns();
          for (const workspace of activeWorkspaces) {
            if (shouldRunWorkspace(workspace.id, runs, this.workspaceRunIntervalMs)) {
              await this.runOne({ workspaceId: workspace.id });
            }
          }
        }
      }
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

  private async runOne(options: RunAgentLoopOptions = {}): Promise<void> {
    try {
      await runAgentLoop(this.deps, ++this.seq, options);
      this.lastSucceededAt = new Date().toISOString();
      this.lastError = undefined;
    } catch (err) {
      this.lastFailedAt = new Date().toISOString();
      this.lastError = String(err);
      log.error('agent loop failed', { seq: this.seq, workspaceId: options.workspaceId, err: String(err) });
    }
  }
}

function shouldRunWorkspace(
  workspaceId: string,
  runs: Awaited<ReturnType<OrchestratorDeps['audit']['listRuns']>>,
  intervalMs: number,
  now = Date.now(),
): boolean {
  const latest = runs.find((run) => run.workspaceId === workspaceId);
  if (!latest) return true;
  if (latest.status === 'running') return false;
  const lastStarted = Date.parse(latest.startedAt);
  return !Number.isFinite(lastStarted) || now - lastStarted >= intervalMs;
}
