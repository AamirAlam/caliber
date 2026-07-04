import { describe, expect, it } from 'vitest';
import type { AgentReview } from '@caliber/shared';
import { runDeliberation, type Commit, type ProposeFn, type ReviewFn } from './runner.js';
import type { DecisionInput } from '../decision/index.js';
import { collectSignals, SimulatedSignalSource } from '../signals/index.js';
import { scoreRisk } from '../policy/index.js';
import { samplePolicy } from '../samplePolicy.js';
import { AppState } from '../state.js';

async function inputFor(stress: boolean): Promise<DecisionInput> {
  const state = new AppState(samplePolicy);
  state.scenarioStress = stress;
  const snapshot = await collectSignals([new SimulatedSignalSource(state)], 'snap_test');
  return { runId: 'r', policy: samplePolicy, risk: scoreRisk(snapshot), snapshot };
}
const stressInput = () => inputFor(true);
const calmInput = () => inputFor(false);

/** A proposer that returns a fixed sequence of commits, one per attempt. */
const proposeSeq =
  (commits: (Commit | null)[]): ProposeFn =>
  async () => ({ commit: commits.shift() ?? null, trace: ['commit_decision'] });

/** A reviewer that returns a fixed sequence of verdicts. */
const reviewSeq =
  (verdicts: AgentReview[]): ReviewFn =>
  async () =>
    verdicts.shift() ?? { approved: true, concern: '', severity: 'low' };

const goodLegs = [{ fromAssetId: 'tbill-rwa', toAssetId: 'usdc', weight: 0.12 }];
const rebalanceCommit = (): Commit => ({ action: 'rebalance', legs: goodLegs, rationale: 'de-risk' });

describe('runDeliberation — multi-agent self-correction', () => {
  it('approves a compliant rebalance the reviewer signs off on', async () => {
    const input = await stressInput();
    const res = await runDeliberation(
      input,
      proposeSeq([rebalanceCommit()]),
      reviewSeq([{ approved: true, concern: 'ok', severity: 'low' }]),
    );
    expect(res.recommendation.action).toBe('rebalance');
    expect(res.recommendation.agentProposed).toBe(true);
    expect(res.recommendation.review?.approved).toBe(true);
  });

  it('revises after a veto, then approves — genuine iteration', async () => {
    const input = await stressInput();
    const res = await runDeliberation(
      input,
      proposeSeq([rebalanceCommit(), rebalanceCommit()]),
      reviewSeq([
        { approved: false, concern: 'too aggressive', severity: 'high' },
        { approved: true, concern: 'safer now', severity: 'low' },
      ]),
    );
    expect(res.recommendation.action).toBe('rebalance');
    expect(res.recommendation.review?.approved).toBe(true);
    expect(res.toolTrace).toContain('revise');
    // The deliberation trace captures the full chain incl. the revision.
    const trace = res.recommendation.trace;
    expect(trace.some((s) => s.kind === 'revision')).toBe(true);
    expect(trace.filter((s) => s.kind === 'review')).toHaveLength(2);
    expect(trace.at(-1)?.kind).toBe('decision');
  });

  it('halts when the reviewer vetoes both attempts', async () => {
    const input = await stressInput();
    const res = await runDeliberation(
      input,
      proposeSeq([rebalanceCommit(), rebalanceCommit()]),
      reviewSeq([
        { approved: false, concern: 'unjustified', severity: 'high' },
        { approved: false, concern: 'still unjustified', severity: 'high' },
      ]),
    );
    expect(res.recommendation.action).toBe('halt');
    expect(res.recommendation.violations.some((v) => v.constraint === 'riskReviewVeto')).toBe(true);
  });

  it('feeds a gate rejection back before halting (revise on bad legs)', async () => {
    const input = await stressInput();
    const badCommit: Commit = {
      action: 'rebalance',
      legs: [{ fromAssetId: 'tbill-rwa', toAssetId: 'usdc', weight: 0.9 }], // over the cap
      rationale: 'oversized',
    };
    const res = await runDeliberation(input, proposeSeq([badCommit, rebalanceCommit()]), reviewSeq([
      { approved: true, concern: 'ok', severity: 'low' },
    ]));
    expect(res.toolTrace).toContain('gate_reject');
    expect(res.recommendation.action).toBe('rebalance'); // recovered on revision
  });

  it('falls back deterministically when the proposer never commits', async () => {
    const input = await stressInput();
    const res = await runDeliberation(input, proposeSeq([null]), reviewSeq([]));
    expect(res.recommendation.agentProposed).toBe(false);
    expect(res.toolTrace).toContain('fallback:no-commit');
  });

  it('will not hold through a breach — revises, then halts', async () => {
    const input = await stressInput(); // liquidity below floor → holding is non-compliant
    const hold: Commit = { action: 'hold', rationale: 'do nothing' };
    const res = await runDeliberation(input, proposeSeq([hold, hold]), reviewSeq([]));
    expect(res.recommendation.action).toBe('halt');
    expect(res.toolTrace).toContain('hold_reject');
  });

  it('accepts a compliant hold in calm conditions', async () => {
    const input = await calmInput();
    const hold: Commit = { action: 'hold', rationale: 'within mandate' };
    const res = await runDeliberation(input, proposeSeq([hold]), reviewSeq([]));
    expect(res.recommendation.action).toBe('hold');
    expect(res.recommendation.compliancePassed).toBe(true);
  });
});
