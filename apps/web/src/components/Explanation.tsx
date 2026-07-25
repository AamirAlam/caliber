const pillars = [
  {
    title: 'Workspace scoped',
    body: 'Policy, owner wallet, vault, signal source, and run history stay bound to the treasury workspace.',
  },
  {
    title: 'Agent operated',
    body: 'Backend runs turn fresh signals into workspace-specific decisions and rationale.',
  },
  {
    title: 'Wallet enforced',
    body: 'Execution remains behind the treasury owner wallet, even when monitoring runs continuously.',
  },
];

export function Explanation() {
  return (
    <section className="py-16 md:py-24">
      <div className="container-caliber">
        <div className="grid overflow-hidden rounded-2xl border border-slate-900/[0.07] bg-white shadow-card dark:border-white/10 dark:bg-[#141b2b] lg:grid-cols-[0.92fr_1.08fr]">
          <div className="bg-ink-900 p-8 text-white md:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-300">
              Product thesis
            </p>
            <h2 className="mt-4 max-w-xl text-3xl font-semibold tracking-tighter2 md:text-[2.65rem] md:leading-[1.08]">
              Treasury automation should start with policy, not a trade.
            </h2>
            <p className="mt-5 max-w-lg text-sm leading-relaxed text-slate-300">
              Caliber separates observation from execution. The agent can watch the treasury and
              explain decisions, while deterministic guardrails and wallet approval decide whether
              anything reaches Casper.
            </p>
          </div>

          <div className="grid divide-y divide-slate-900/[0.06] dark:divide-white/10">
            {pillars.map((pillar) => (
              <div key={pillar.title} className="grid gap-4 p-6 sm:grid-cols-[140px_1fr] sm:p-8">
                <div className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-brand-500" />
                  <p className="text-sm font-semibold text-ink-900">{pillar.title}</p>
                </div>
                <p className="text-sm leading-relaxed text-slate-600">{pillar.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
