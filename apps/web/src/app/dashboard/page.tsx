'use client';

import { useCallback, useEffect, useState } from 'react';
import { AGENT_ROLES } from '@caliber/shared';
import type { Recommendation, RiskScore, SignalSnapshot, TreasuryPolicy } from '@caliber/shared';
import { api, type VaultState } from '@/lib/api';
import { PageLoader } from '@/components/Spinner';
import { MaintenanceMode } from '@/components/MaintenanceMode';

const EXPLORER = process.env.NEXT_PUBLIC_EXPLORER_BASE ?? 'https://testnet.cspr.live';

const BANDS = {
  low: { label: 'Low', color: '#059669', tint: 'text-signal-emerald' },
  moderate: { label: 'Moderate', color: '#3657d5', tint: 'text-brand-600' },
  elevated: { label: 'Elevated', color: '#d97706', tint: 'text-signal-amber' },
  critical: { label: 'Critical', color: '#e11d48', tint: 'text-signal-rose' },
} as const;

export default function DashboardPage() {
  const [policy, setPolicy] = useState<TreasuryPolicy | null>(null);
  const [snapshot, setSnapshot] = useState<SignalSnapshot | null>(null);
  const [risk, setRisk] = useState<RiskScore | null>(null);
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [vault, setVault] = useState<VaultState | null>(null);
  const [pendingRunId, setPendingRunId] = useState<string | null>(null);
  const [deployHash, setDeployHash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(true);
  const [showReasoning, setShowReasoning] = useState(false);

  const refresh = useCallback(async () => {
    const [p, s, r, rc, v] = await Promise.all([
      api.getPolicy(),
      api.getLatestSignals(),
      api.getLatestRisk(),
      api.getLatestRecommendation(),
      api.getVaultState(),
    ]);
    if (p === null) {
      setLive(false);
      setError('The services API is unavailable or not configured.');
      setPolicy(null);
      setSnapshot(null);
      setRisk(null);
      setRec(null);
      setVault(null);
      setPendingRunId(null);
      return;
    }
    setLive(true);
    setError(null);
    setPolicy(p);
    if (s) setSnapshot(s);
    if (r) setRisk(r);
    if (rc) setRec(rc);
    if (v) setVault(v);
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 4000);
    return () => clearInterval(t);
  }, [refresh]);

  const onRunNow = async () => {
    setBusy(true);
    setError(null);
    setDeployHash(null);
    try {
      const res = await api.runNow();
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

  if (!policy) {
    if (error) {
      return (
        <MaintenanceMode
          detail={`${error} Live treasury controls are paused until the backend is configured and healthy.`}
        />
      );
    }
    return <PageLoader />;
  }

  const canApprove = live && rec?.action === 'rebalance';
  const headline =
    rec?.action === 'rebalance'
      ? 'Rebalance recommended'
      : rec?.action === 'halt'
        ? 'Halted — review required'
        : 'Holding — within policy';

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 pb-28 sm:px-6 sm:py-8 lg:px-8 lg:py-10 lg:pb-10">
      <header className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Treasury control plane</p>
          <h1 className="mt-1.5 text-[1.6rem] font-semibold tracking-tightish text-ink-900">
            {policy.name}
          </h1>
        </div>
        <span
          className={`pill ${live ? 'border-signal-emerald/30 bg-emerald-50 text-signal-emerald' : 'border-slate-200 bg-slate-50 text-slate-500'}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-signal-emerald' : 'bg-slate-400'}`} />
          {live ? 'Live · testnet' : 'Offline'}
        </span>
      </header>

      {/* ── Decision hero: the single focal element ── */}
      <section className="animate-in mt-6 overflow-hidden rounded-2xl border border-slate-900/[0.07] bg-white shadow-card">
        <div className="grid gap-6 p-6 sm:grid-cols-[auto_1fr] sm:gap-8 sm:p-8">
          <div className="flex items-center justify-center">
            <RiskGauge score={risk?.score ?? 0} band={risk?.band ?? 'low'} />
          </div>

          <div className="min-w-0">
            <p className={`text-sm font-semibold ${rec ? BANDS[risk?.band ?? 'low'].tint : 'text-slate-400'}`}>
              {rec ? `Agent recommendation · ${rec.action.toUpperCase()}` : 'Waiting for first run'}
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tightish text-ink-900 sm:text-[1.75rem]">
              {headline}
            </h2>
            <p className="mt-3 text-[0.97rem] leading-relaxed text-slate-600">
              {rec?.explanation ?? 'Run the loop to generate a recommendation.'}
            </p>

            <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:items-center">
              {canApprove ? (
                <button
                  onClick={onApprove}
                  disabled={busy}
                  className="btn-primary w-full bg-signal-emerald shadow-pop hover:bg-emerald-700 disabled:opacity-40 sm:w-auto"
                >
                  {busy ? 'Submitting…' : 'Approve & settle on Casper →'}
                </button>
              ) : (
                <button
                  onClick={onRunNow}
                  disabled={busy || !live}
                  className="btn-primary w-full shadow-pop disabled:opacity-40 sm:w-auto"
                >
                  {busy ? 'Running…' : 'Run agent cycle'}
                </button>
              )}
            </div>

            {error && (
              <p className="mt-3 rounded-lg border border-signal-rose/20 bg-rose-50 px-3 py-2 text-sm text-signal-rose">
                {error}
              </p>
            )}
            {deployHash && (
              <p className="mt-3 rounded-lg border border-signal-emerald/20 bg-emerald-50 px-3 py-2 text-sm text-slate-700">
                Settled on-chain:{' '}
                <a
                  href={`${EXPLORER}/transaction/${deployHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono font-medium text-brand-600 underline-offset-4 hover:underline"
                >
                  {deployHash.slice(0, 10)}…{deployHash.slice(-6)}
                </a>
              </p>
            )}
            {!live && (
              <p className="mt-3 text-xs text-slate-500">
                Configure and start the services API to stream live treasury signals.
              </p>
            )}
          </div>
        </div>

        {rec && (
          <div className="border-t border-slate-900/[0.06] px-6 py-4 sm:px-8">
            <button onClick={() => setShowReasoning((v) => !v)} className="disclosure-btn">
              {showReasoning ? 'Hide reasoning' : 'Show reasoning'}
              <Chevron open={showReasoning} />
            </button>
            {showReasoning && (
              <div className="disclosure-panel mt-4 grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Risk factors
                  </p>
                  <div className="space-y-2.5">
                    {(risk?.factors ?? []).map((f) => (
                      <div key={f.key}>
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>{f.label}</span>
                          <span className="tnum">{f.contribution}</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-brand-500"
                            style={{ width: `${Math.min(100, f.contribution)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Policy check
                  </p>
                  <dl className="space-y-1.5 text-sm">
                    <Row k="Compliance" v={rec.compliancePassed ? 'Passing' : 'Blocked'} good={rec.compliancePassed} />
                    <Row k="Confidence" v={`${(rec.confidence * 100).toFixed(0)}%`} />
                    <Row k="On-chain rebalances" v={String(vault?.rebalanceCount ?? '—')} />
                  </dl>
                  {rec.violations.length > 0 && (
                    <ul className="mt-3 space-y-1 text-xs text-signal-amber">
                      {rec.violations.map((v, i) => (
                        <li key={i}>• {v.detail}</li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Multi-agent deliberation */}
                <div className="sm:col-span-2">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Agent deliberation
                  </p>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <DeliberationStep
                      role={AGENT_ROLES.proposer.name}
                      ok
                      note={
                        rec.agentProposed
                          ? 'Designed the move and tested it against policy.'
                          : 'Deterministic engine (no LLM key configured).'
                      }
                    />
                    <DeliberationStep
                      role={AGENT_ROLES.reviewer.name}
                      ok={rec.review ? rec.review.approved : true}
                      note={
                        rec.review
                          ? `${rec.review.approved ? 'Approved' : 'Vetoed'} · ${rec.review.severity} — ${rec.review.concern}`
                          : rec.action === 'rebalance'
                            ? 'Signed off on the rebalance.'
                            : 'No rebalance to review.'
                      }
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Signals */}
      <section id="signals" className="mt-8 scroll-mt-20">
        <SectionTitle>Live signals</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-3">
          {(snapshot?.signals ?? []).map((s) => (
            <div key={s.key} className="panel p-5">
              <p className="text-sm text-slate-500">{s.label}</p>
              <p className="mt-1.5 tnum text-2xl font-semibold text-ink-900">
                {s.value.toLocaleString()}
                <span className="ml-1.5 text-xs font-normal text-slate-400">{s.unit}</span>
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Policy */}
      <section id="policy" className="mt-8 scroll-mt-20">
        <SectionTitle>Policy allocations</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-3">
          {policy.allocations.map((a) => (
            <div key={a.assetId} className="panel p-5">
              <p className="text-sm font-semibold text-ink-900">{a.label}</p>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-brand-500" style={{ width: `${a.target * 100}%` }} />
              </div>
              <p className="mt-2 font-mono text-xs text-slate-500">
                target {(a.target * 100).toFixed(0)}% · band {(a.min * 100).toFixed(0)}–{(a.max * 100).toFixed(0)}%
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function RiskGauge({ score, band }: { score: number; band: RiskScore['band'] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const r = 52;
  const c = 2 * Math.PI * r;
  const shown = mounted ? score : 0;
  const offset = c * (1 - shown / 100);
  const { color, label } = BANDS[band];
  return (
    <div className="relative h-[132px] w-[132px]">
      <svg width="132" height="132" viewBox="0 0 132 132" className="-rotate-90">
        <circle className="gauge-track" cx="66" cy="66" r={r} fill="none" stroke="#eef1f6" strokeWidth="10" />
        <circle
          className="gauge-value"
          cx="66"
          cy="66"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tnum text-[2.4rem] font-semibold leading-none text-ink-900">{score}</span>
        <span
          className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em]"
          style={{ color }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{children}</h2>;
}

function DeliberationStep({ role, ok, note }: { role: string; ok: boolean; note: string }) {
  return (
    <div className="flex gap-2.5 rounded-lg border border-slate-900/[0.06] bg-white p-3">
      <span
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${ok ? 'bg-signal-emerald' : 'bg-signal-rose'}`}
      >
        {ok ? '✓' : '!'}
      </span>
      <div>
        <p className="text-xs font-semibold text-ink-900">{role}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{note}</p>
      </div>
    </div>
  );
}

function Row({ k, v, good }: { k: string; v: string; good?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-400">{k}</dt>
      <dd
        className={`text-right ${
          good === undefined ? 'text-slate-700' : good ? 'text-signal-emerald' : 'text-signal-amber'
        }`}
      >
        {v}
      </dd>
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`}
    >
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
