import { demoPolicy, demoRecommendation, demoRuns, demoSignals } from '@/lib/mockData';

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="flex items-end justify-between">
        <div>
          <p className="eyebrow">Control plane</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">
            {demoPolicy.name}
          </h1>
        </div>
        <span className="rounded-full border border-helm-600/30 bg-helm-600/10 px-3 py-1 text-xs text-helm-300">
          {demoRecommendation.action.toUpperCase()}
        </span>
      </header>

      <p className="mt-6 rounded-lg border border-white/[0.06] bg-ink-900/40 p-4 text-sm text-slate-500">
        This dashboard is a static shell. Wire it to the off-chain services API
        (<code className="text-slate-400">NEXT_PUBLIC_SERVICES_URL</code>) to render live policy,
        signals, recommendations, and run history.
      </p>

      {/* Policy */}
      <Section id="policy" title="Policy">
        <div className="grid gap-3 sm:grid-cols-3">
          {demoPolicy.allocations.map((a) => (
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

      {/* Signals */}
      <Section id="signals" title="Live signals">
        <div className="grid gap-3 sm:grid-cols-3">
          {demoSignals.map((s) => (
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
      <Section id="recommendation" title="Latest recommendation">
        <div className="panel p-5">
          <p className="text-sm leading-relaxed text-slate-300">{demoRecommendation.explanation}</p>
          <p className="mt-3 font-mono text-xs text-slate-500">
            risk {demoRecommendation.riskScore}/100 · compliant{' '}
            {String(demoRecommendation.compliancePassed)}
          </p>
        </div>
      </Section>

      {/* Run history */}
      <Section id="runs" title="Run history">
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
              {demoRuns.map((r) => (
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

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-10 scroll-mt-20">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">{title}</h2>
      {children}
    </section>
  );
}
