'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  AgentRunLog,
  Recommendation,
  RiskScore,
  SignalSnapshot,
  TreasuryPolicy,
} from '@helm/shared';
import { api, type VaultState } from '@/lib/api';
import { demoPolicy, demoRecommendation, demoRuns, demoSignals } from '@/lib/mockData';

const EXPLORER = process.env.NEXT_PUBLIC_EXPLORER_BASE ?? 'https://testnet.cspr.live';

export default function DashboardPage() {
  const [policy, setPolicy] = useState<TreasuryPolicy | null>(null);
  const [snapshot, setSnapshot] = useState<SignalSnapshot | null>(null);
  const [risk, setRisk] = useState<RiskScore | null>(null);
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [runs, setRuns] = useState<AgentRunLog[]>([]);
  const [vault, setVault] = useState<VaultState | null>(null);
  const [pendingRunId, setPendingRunId] = useState<string | null>(null);
  const [deployHash, setDeployHash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(true);

  const refresh = useCallback(async () => {
    const [p, s, r, rc, rn, v] = await Promise.all([
      api.getPolicy(),
      api.getLatestSignals(),
      api.getLatestRisk(),
      api.getLatestRecommendation(),
      api.getRuns(),
      api.getVaultState(),
    ]);
    if (p === null) {
      // Services API unreachable — fall back to static demo data so the shell renders.
      setLive(false);
      setPolicy(demoPolicy);
      setSnapshot({ id: 'demo', capturedAt: '', signals: demoSignals });
      setRec(demoRecommendation);
      setRuns(demoRuns);
      return;
    }
    setLive(true);
    setPolicy(p);
    if (s) setSnapshot(s);
    if (r) setRisk(r);
    if (rc) setRec(rc);
    if (rn) setRuns(rn);
    if (v) setVault(v);
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 4000);
    return () => clearInterval(t);
  }, [refresh]);

  const onStress = async (active: boolean) => {
    setBusy(true);
    setError(null);
    setDeployHash(null);
    try {
      const res = await api.runStress(active);
      setPendingRunId(res.pendingRunId);
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const onApprove = async () => {
    const runId = pendingRunId ?? (rec?.action === 'rebalance' ? rec.runId : null);
    if (!runId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.approve(runId);
      setDeployHash(res.tx.deployHash ?? null);
      setPendingRunId(null);
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const canApprove = live && rec?.action === 'rebalance';

  if (!policy) {
    return <div className="mx-auto max-w-5xl px-6 py-10 text-slate-400">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Control plane</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">{policy.name}</h1>
        </div>
        <div className="flex items-center gap-3">
          {rec && (
            <span
              className={`rounded-full border px-3 py-1 text-xs ${
                rec.action === 'rebalance'
                  ? 'border-signal-amber/40 bg-signal-amber/10 text-signal-amber'
                  : rec.action === 'halt'
                    ? 'border-signal-rose/40 bg-signal-rose/10 text-signal-rose'
                    : 'border-helm-600/30 bg-helm-600/10 text-helm-300'
              }`}
            >
              {rec.action.toUpperCase()}
            </span>
          )}
          <span className="font-mono text-xs text-slate-500">
            {live ? 'live' : 'demo (api offline)'}
          </span>
        </div>
      </header>

      {/* Controls */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button onClick={() => onStress(true)} disabled={busy || !live} className="btn-primary disabled:opacity-40">
          Run stress scenario
        </button>
        <button onClick={() => onStress(false)} disabled={busy || !live} className="btn-ghost disabled:opacity-40">
          Reset to calm
        </button>
        {canApprove && (
          <button onClick={onApprove} disabled={busy} className="btn-primary disabled:opacity-40">
            Approve rebalance
          </button>
        )}
        {!live && (
          <span className="text-xs text-slate-500">
            Start the services API (<code>pnpm --filter @helm/services dev</code>) to go live.
          </span>
        )}
      </div>
      {error && <p className="mt-3 text-sm text-signal-rose">{error}</p>}
      {deployHash && (
        <p className="mt-3 text-sm text-helm-300">
          Submitted deploy:{' '}
          <a
            href={`${EXPLORER}/deploy/${deployHash}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono underline underline-offset-4"
          >
            {deployHash}
          </a>
        </p>
      )}

      {/* Policy */}
      <Section title="Policy">
        <div className="grid gap-3 sm:grid-cols-3">
          {policy.allocations.map((a) => (
            <div key={a.assetId} className="panel p-4">
              <p className="text-sm font-medium text-slate-200">{a.label}</p>
              <p className="mt-1 font-mono text-xs text-slate-500">
                target {(a.target * 100).toFixed(0)}% · band {(a.min * 100).toFixed(0)}–
                {(a.max * 100).toFixed(0)}%
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* Risk + vault */}
      <Section title="Risk & on-chain state">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="panel p-4">
            <p className="text-sm text-slate-400">Risk score</p>
            <p className="mt-1 font-mono text-2xl text-slate-100">
              {risk ? risk.score : '—'}
              <span className="ml-2 text-xs text-slate-500">{risk?.band}</span>
            </p>
          </div>
          <div className="panel p-4">
            <p className="text-sm text-slate-400">On-chain rebalances</p>
            <p className="mt-1 font-mono text-2xl text-slate-100">{vault?.rebalanceCount ?? '—'}</p>
          </div>
          <div className="panel p-4">
            <p className="text-sm text-slate-400">Vault</p>
            <p className="mt-1 font-mono text-xs text-slate-500 break-all">
              {vault?.contractHash || 'not deployed'}
            </p>
          </div>
        </div>
      </Section>

      {/* Signals */}
      <Section title="Live signals">
        <div className="grid gap-3 sm:grid-cols-3">
          {(snapshot?.signals ?? []).map((s) => (
            <div key={s.key} className="panel p-4">
              <p className="text-sm text-slate-400">{s.label}</p>
              <p className="mt-1 font-mono text-lg text-slate-100">
                {s.value.toLocaleString()} <span className="text-xs text-slate-500">{s.unit}</span>
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* Recommendation */}
      {rec && (
        <Section title="Latest recommendation">
          <div className="panel p-5">
            <p className="text-sm leading-relaxed text-slate-300">{rec.explanation}</p>
            <p className="mt-3 font-mono text-xs text-slate-500">
              risk {rec.riskScore}/100 · compliant {String(rec.compliancePassed)}
              {rec.violations.length > 0 && ` · violations: ${rec.violations.map((v) => v.constraint).join(', ')}`}
            </p>
          </div>
        </Section>
      )}

      {/* Run history */}
      <Section title="Run history">
        <div className="overflow-hidden rounded-xl border border-white/[0.06]">
          <table className="w-full text-left text-sm">
            <thead className="bg-ink-900/60 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Run</th>
                <th className="px-4 py-3 font-medium">Stage</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Risk</th>
                <th className="px-4 py-3 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-t border-white/[0.06]">
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{r.id}</td>
                  <td className="px-4 py-3 text-slate-400">{r.stage}</td>
                  <td className="px-4 py-3 text-slate-300">{r.status}</td>
                  <td className="px-4 py-3 font-mono text-slate-400">{r.riskScore ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{r.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">{title}</h2>
      {children}
    </section>
  );
}
