import { describe, expect, it } from 'vitest';
import type { AgentRunLog } from '@caliber/shared';
import { formatMemory, riskTrend, summarizeHistory } from './memory.js';

const run = (id: string, action: AgentRunLog['action'], risk: number): AgentRunLog => ({
  id,
  policyId: 'pol',
  stage: 'done',
  status: 'completed',
  action,
  riskScore: risk,
  startedAt: `2026-07-03T0${id.slice(-1)}:00:00.000Z`,
});

// newest-first, as listRuns() returns them
const runs: AgentRunLog[] = [
  run('run_4', 'rebalance', 73),
  run('run_3', 'hold', 58),
  run('run_2', 'hold', 41),
  run('run_1', 'hold', 20),
];

describe('decision memory', () => {
  it('summarizes recent history excluding the current run', () => {
    const entries = summarizeHistory(runs, 'run_4', 5);
    expect(entries.map((e) => e.runId)).toEqual(['run_3', 'run_2', 'run_1']);
    expect(entries[0]).toMatchObject({ action: 'hold', risk: 58, status: 'completed' });
  });

  it('caps to N', () => {
    expect(summarizeHistory(runs, 'none', 2)).toHaveLength(2);
  });

  it('formats a readable oldest→newest trend', () => {
    const block = formatMemory(summarizeHistory(runs, 'run_4', 5));
    expect(block).toContain('risk trend 20 → 41 → 58');
    expect(block).toContain('- hold at risk 41 (completed)');
  });

  it('returns empty string with no history', () => {
    expect(formatMemory([])).toBe('');
  });

  it('riskTrend is oldest→newest numbers', () => {
    expect(riskTrend(runs)).toEqual([20, 41, 58, 73]);
  });
});
