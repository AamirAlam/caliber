'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AgentRunLog } from '@caliber/shared';
import { api, type RunDetail } from '@/lib/api';
import { demoRuns } from '@/lib/mockData';

const PAGE_SIZE = 8;
const EXPLORER = process.env.NEXT_PUBLIC_EXPLORER_BASE ?? 'https://testnet.cspr.live';

const short = (h: string) => `${h.slice(0, 8)}…${h.slice(-6)}`;
const prettyAsset = (id: string) =>
  id.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function RunsPage() {
  const [runs, setRuns] = useState<AgentRunLog[]>([]);
  const [live, setLive] = useState(true);
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RunDetail | null>(null);

  const refresh = useCallback(async () => {
    const rn = await api.getRuns();
    if (rn === null) {
      setLive(false);
      setRuns(demoRuns);
      return;
    }
    setLive(true);
    setRuns(rn);
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 5000);
    return () => clearInterval(t);
  }, [refresh]);

  const toggle = async (id: string) => {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    setDetail(null);
    if (live) setDetail(await api.getRun(id));
  };

  const totalPages = Math.max(1, Math.ceil(runs.length / PAGE_SIZE));
  const current = Math.min(page, totalPages - 1);
  const rows = runs.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
  const start = runs.length === 0 ? 0 : current * PAGE_SIZE + 1;
  const end = Math.min(runs.length, current * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 pb-28 sm:px-6 sm:py-8 lg:px-8 lg:py-10 lg:pb-10">
      <header className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Audit trail</p>
          <h1 className="mt-1.5 text-[1.6rem] font-semibold tracking-tightish text-ink-900">
            Run history
          </h1>
        </div>
        <span className="pill border-slate-200 bg-white text-slate-500">
          {runs.length} run{runs.length === 1 ? '' : 's'}
        </span>
      </header>

      <RiskTrend runs={runs} />

      <div className="mt-6 panel overflow-x-auto">
        <table className="w-full text-left text-sm sm:min-w-[680px]">
          <thead className="border-b border-slate-900/[0.06] bg-slate-50/60 text-[11px] uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3 font-semibold sm:px-5">Decision</th>
              <th className="px-4 py-3 font-semibold sm:px-5">Run</th>
              <th className="hidden px-4 py-3 font-semibold sm:table-cell sm:px-5">Status</th>
              <th className="px-4 py-3 text-right font-semibold sm:px-5 sm:text-left">Risk</th>
              <th className="hidden px-4 py-3 font-semibold sm:table-cell sm:px-5">Transaction</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-slate-400">
                  No runs yet. Trigger one from the overview.
                </td>
              </tr>
            )}
            {rows.map((r, i) => {
              const isLatest = current === 0 && i === 0;
              const open = openId === r.id;
              return (
                <RowGroup key={r.id}>
                  <tr className="border-t border-slate-900/[0.05] transition hover:bg-slate-50/60">
                    <td className="px-4 py-3 sm:px-5">
                      <button
                        onClick={() => toggle(r.id)}
                        className="flex items-center gap-1.5 rounded-lg"
                        aria-expanded={open}
                      >
                        <Chevron open={open} />
                        <ActionBadge action={r.action} />
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 sm:px-5">
                      <span className="font-mono text-xs text-slate-600">{r.id}</span>
                      {isLatest && live && (
                        <span className="ml-2 rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-600">
                          latest
                        </span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell sm:px-5">
                      <StatusPill status={r.status} />
                    </td>
                    <td className="px-4 py-3 tnum text-right text-slate-600 sm:px-5 sm:text-left">
                      {r.riskScore ?? '—'}
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell sm:px-5">
                      {r.deployHash ? (
                        <a
                          href={`${EXPLORER}/transaction/${r.deployHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-xs text-brand-600 underline-offset-4 hover:underline"
                        >
                          {short(r.deployHash)}
                        </a>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                  {open && (
                    <tr className="border-t border-slate-900/[0.05] bg-slate-50/40">
                      <td colSpan={5} className="px-4 py-5 sm:px-5">
                        <RunDetailView runId={r.id} run={r} detail={detail} live={live} />
                      </td>
                    </tr>
                  )}
                </RowGroup>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
        <span className="tnum">
          {start}–{end} of {runs.length}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={current === 0}
            className="rounded-lg border border-slate-900/10 bg-white px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="tnum px-1 text-slate-400">
            {current + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={current >= totalPages - 1}
            className="rounded-lg border border-slate-900/10 bg-white px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function RowGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/** Short-term memory, visualized: the risk scores the agent reasons over. */
function RiskTrend({ runs }: { runs: AgentRunLog[] }) {
  const series = runs
    .filter((r) => typeof r.riskScore === 'number')
    .slice(0, 12)
    .map((r) => r.riskScore as number)
    .reverse();
  if (series.length < 2) return null;

  const w = 180;
  const h = 40;
  const pts = series
    .map((v, i) => {
      const x = (i / (series.length - 1)) * w;
      const y = h - (Math.min(100, Math.max(0, v)) / 100) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const latest = series[series.length - 1]!;
  const color = latest >= 75 ? '#e11d48' : latest >= 50 ? '#d97706' : latest >= 25 ? '#3657d5' : '#059669';

  return (
    <div className="mt-5 flex items-center gap-4 panel p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Agent memory</p>
        <p className="mt-1 text-sm text-slate-600">
          Risk trend the agent reasons over — {series.slice(-3).join(' → ')}
        </p>
      </div>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="ml-auto shrink-0" aria-hidden>
        <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {series.map((v, i) => {
          const x = (i / (series.length - 1)) * w;
          const y = h - (Math.min(100, Math.max(0, v)) / 100) * h;
          return <circle key={i} cx={x} cy={y} r={i === series.length - 1 ? 2.6 : 1.4} fill={color} />;
        })}
      </svg>
    </div>
  );
}

function RunDetailView({
  runId,
  run,
  detail,
  live,
}: {
  runId: string;
  run: AgentRunLog;
  detail: RunDetail | null;
  live: boolean;
}) {
  const rec = detail?.recommendation;
  const legs = rec?.rebalance?.legs ?? [];
  const loading = live && (!detail || detail.run.id !== runId);

  return (
    <div className="disclosure-panel grid gap-6 sm:grid-cols-2">
      {/* Agent reasoning */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Agent reasoning
          </p>
          {rec?.agentProposed && (
            <span className="rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-600">
              AI-proposed
            </span>
          )}
        </div>
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : (
          <p className="text-sm leading-relaxed text-slate-600">
            {rec?.explanation ?? run.notes ?? 'No reasoning recorded.'}
          </p>
        )}
        {rec?.review && (
          <p
            className={`mt-3 text-xs ${rec.review.approved ? 'text-signal-emerald' : 'text-signal-rose'}`}
          >
            Risk reviewer: {rec.review.approved ? 'approved' : 'vetoed'} ({rec.review.severity}) —{' '}
            {rec.review.concern}
          </p>
        )}
        {rec && rec.violations.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-signal-amber">
            {rec.violations.map((v, i) => (
              <li key={i}>• {v.detail}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Money flow */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Money flow
        </p>
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : legs.length === 0 ? (
          <p className="text-sm text-slate-500">
            No funds moved — decision was <span className="font-medium">{run.action ?? 'hold'}</span>.
          </p>
        ) : (
          <div className="space-y-2">
            {legs.map((leg, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-lg border border-slate-900/[0.06] bg-white p-2.5"
              >
                <Chip>{prettyAsset(leg.fromAssetId)}</Chip>
                <span className="text-slate-400">→</span>
                <Chip accent>{prettyAsset(leg.toAssetId)}</Chip>
                <span className="ml-auto text-right">
                  <span className="tnum block text-sm font-semibold text-ink-900">
                    ${Number(leg.amount).toLocaleString()}
                  </span>
                  <span className="tnum text-xs text-slate-400">
                    {(leg.weight * 100).toFixed(1)}% of treasury
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
        {detail?.transaction?.deployHash && (
          <a
            href={`${EXPLORER}/transaction/${detail.transaction.deployHash}`}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 font-mono text-xs text-brand-600 underline-offset-4 hover:underline"
          >
            View on-chain: {short(detail.transaction.deployHash)}
          </a>
        )}
      </div>
    </div>
  );
}

function Chip({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span
      className={`rounded-md px-2 py-1 text-xs font-medium ${accent ? 'bg-brand-50 text-brand-600' : 'bg-slate-100 text-slate-600'}`}
    >
      {children}
    </span>
  );
}

function ActionBadge({ action }: { action?: 'hold' | 'rebalance' | 'halt' }) {
  if (!action) return <span className="text-slate-300">—</span>;
  const map = {
    hold: 'border-brand-200 bg-brand-50 text-brand-600',
    rebalance: 'border-signal-amber/30 bg-amber-50 text-signal-amber',
    halt: 'border-signal-rose/30 bg-rose-50 text-signal-rose',
  } as const;
  return <span className={`pill ${map[action]}`}>{action.toUpperCase()}</span>;
}

function StatusPill({ status }: { status: AgentRunLog['status'] }) {
  const map: Record<AgentRunLog['status'], string> = {
    completed: 'border-signal-emerald/30 bg-emerald-50 text-signal-emerald',
    running: 'border-brand-200 bg-brand-50 text-brand-600',
    rejected: 'border-signal-rose/30 bg-rose-50 text-signal-rose',
    failed: 'border-signal-rose/30 bg-rose-50 text-signal-rose',
  };
  return <span className={`pill ${map[status]}`}>{status}</span>;
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
