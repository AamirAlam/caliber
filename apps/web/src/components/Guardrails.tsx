const guardrails = [
  'No default rebalance action',
  'Risk ceiling enforced before approval',
  'Owner wallet required for settlement',
  'Run rationale and deploy hash retained',
];

export function Guardrails() {
  return (
    <section id="guardrails" className="py-20 md:py-28">
      <div className="container-caliber">
        <div className="overflow-hidden rounded-2xl bg-ink-900 shadow-card">
          <div className="grid lg:grid-cols-[1fr_1.05fr]">
            <div className="p-8 text-white md:p-10">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-300">
                Trust model
              </p>
              <h2 className="mt-4 max-w-xl text-3xl font-semibold tracking-tighter2 md:text-[2.6rem] md:leading-[1.1]">
                Automation that cannot bypass the mandate.
              </h2>
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-slate-300">
                Caliber is designed for treasury operators who need agentic monitoring without
                surrendering execution control. A recommendation is only useful after policy,
                freshness, and ownership checks line up.
              </p>
            </div>

            <div className="grid divide-y divide-white/10 border-t border-white/10 lg:border-l lg:border-t-0">
              {guardrails.map((item) => (
                <div key={item} className="flex items-center gap-4 px-6 py-5 md:px-8">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-signal-emerald/15 text-signal-emerald">
                    <span className="h-2 w-2 rounded-full bg-signal-emerald" />
                  </span>
                  <p className="text-sm font-semibold text-white">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
