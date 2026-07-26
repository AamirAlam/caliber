import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentRunLog, TreasuryWorkspace } from '@caliber/shared';
import type { OrchestratorDeps, RunAgentLoopOptions } from '../orchestrator.js';
import { Scheduler } from './index.js';

const runAgentLoop = vi.hoisted(() => vi.fn());

vi.mock('../orchestrator.js', () => ({
  runAgentLoop,
}));

const workspace = (id: string, agentStatus: TreasuryWorkspace['agentStatus'] = 'active'): TreasuryWorkspace => ({
  id,
  name: id,
  ownerAccount: 'owner-wallet',
  vaultContractHash: 'contract-package-test',
  network: 'casper-test',
  policy: {
    rwaTarget: 55,
    stableTarget: 35,
    nativeTarget: 10,
    maxRiskScore: 70,
  },
  signals: {
    mode: 'operator',
    feedUrl: '',
  },
  agentStatus,
  createdAt: '2026-07-20T00:00:00.000Z',
  updatedAt: '2026-07-20T00:00:00.000Z',
});

const run = (
  workspaceId: string,
  startedAt: string,
  status: AgentRunLog['status'] = 'completed',
): AgentRunLog => ({
  id: `run_${workspaceId}`,
  policyId: 'policy',
  workspaceId,
  stage: status === 'running' ? 'await_approval' : 'done',
  status,
  startedAt,
});

function deps(workspaces: TreasuryWorkspace[], runs: AgentRunLog[] = []): OrchestratorDeps {
  return {
    audit: {
      listWorkspaces: async () => workspaces,
      listRuns: async () => runs,
    },
    executor: {},
    sources: [],
    state: {},
  } as unknown as OrchestratorDeps;
}

describe('Scheduler', () => {
  beforeEach(() => {
    runAgentLoop.mockReset();
    runAgentLoop.mockResolvedValue({});
  });

  it('runs active persisted workspaces on scheduled ticks', async () => {
    const scheduler = new Scheduler(deps([workspace('workspace_a'), workspace('workspace_b', 'stopped')]));

    await scheduler.runNow();

    expect(runAgentLoop).toHaveBeenCalledTimes(1);
    expect(runAgentLoop.mock.calls.map((call) => call[2] as RunAgentLoopOptions)).toEqual([
      { workspaceId: 'workspace_a' },
    ]);
  });

  it('keeps explicit workspace runs scoped to that workspace', async () => {
    const scheduler = new Scheduler(deps([workspace('workspace_a'), workspace('workspace_b')]));

    await scheduler.runNow({ workspaceId: 'workspace_b' });

    expect(runAgentLoop).toHaveBeenCalledTimes(1);
    expect(runAgentLoop.mock.calls[0]?.[2]).toEqual({ workspaceId: 'workspace_b' });
  });

  it('falls back to the default policy when no workspace exists', async () => {
    const scheduler = new Scheduler(deps([]));

    await scheduler.runNow();

    expect(runAgentLoop).toHaveBeenCalledTimes(1);
    expect(runAgentLoop.mock.calls[0]?.[2]).toEqual({});
  });

  it('skips active workspaces that ran within the interval or are still running', async () => {
    const scheduler = new Scheduler(
      deps(
        [workspace('workspace_recent'), workspace('workspace_running'), workspace('workspace_due')],
        [
          run('workspace_recent', new Date().toISOString()),
          run('workspace_running', '2026-07-20T00:00:00.000Z', 'running'),
          run('workspace_due', '2026-07-20T00:00:00.000Z'),
        ],
      ),
    );

    await scheduler.runNow();

    expect(runAgentLoop).toHaveBeenCalledTimes(1);
    expect(runAgentLoop.mock.calls[0]?.[2]).toEqual({ workspaceId: 'workspace_due' });
  });
});
