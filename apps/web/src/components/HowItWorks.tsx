const lifecycle = [
  {
    phase: 'Mandate',
    title: 'Define treasury policy',
    body: 'Set allocation targets, risk ceiling, liquidity buffer, owner wallet, and signal mode.',
  },
  {
    phase: 'Observe',
    title: 'Run live analysis',
    body: 'The backend agent reads fresh signals, scores risk, and evaluates the workspace policy.',
  },
  {
    phase: 'Decide',
    title: 'Review the recommendation',
    body: 'The dashboard shows the latest decision, rationale, trace, and whether an action exists.',
  },
  {
    phase: 'Settle',
    title: 'Approve with wallet',
    body: 'If policy allows a rebalance, the owner wallet approves before a Casper deploy is submitted.',
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="py-20 md:py-28">
      <div className="container-caliber">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow">Workflow</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tighter2 text-ink-900 md:text-[2.6rem] md:leading-[1.1]">
              From mandate to settlement, with policy in the middle.
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-slate-600">
            Caliber does not ask users to rebalance by default. It waits for a real agent run and a
            policy-valid decision.
          </p>
        </div>

        <div className="mt-12 overflow-hidden rounded-2xl border border-slate-900/[0.07] bg-white shadow-card dark:border-white/10 dark:bg-[#141b2b]">
          <div className="grid lg:grid-cols-4">
            {lifecycle.map((item, index) => (
              <article
                key={item.phase}
                className="relative border-b border-slate-900/[0.06] p-6 last:border-b-0 dark:border-white/10 lg:border-b-0 lg:border-r lg:last:border-r-0"
              >
                <div className="mb-8 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">
                    {item.phase}
                  </span>
                  <span className="tnum text-xs text-slate-400">{String(index + 1).padStart(2, '0')}</span>
                </div>
                <h3 className="text-lg font-semibold text-ink-900">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
