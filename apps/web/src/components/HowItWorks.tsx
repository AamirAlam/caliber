const steps = [
  { n: '01', title: 'Collect signals', body: 'Market, RWA, and on-chain liquidity into one snapshot.' },
  { n: '02', title: 'Score risk', body: 'A 0–100 score with an explainable per-factor breakdown.' },
  { n: '03', title: 'Evaluate policy', body: 'Bands, buffers, and risk ceilings — violations block action.' },
  { n: '04', title: 'Decide & explain', body: 'Hold, rebalance, or halt, with a plain-language rationale.' },
  { n: '05', title: 'Approve & execute', body: 'Compliant moves settle on Casper behind a human gate.' },
  { n: '06', title: 'Audit', body: 'Every decision and deploy hash, append-only.' },
];

export function HowItWorks() {
  return (
    <section id="how" className="py-20 md:py-28">
      <div className="container-caliber">
        <p className="eyebrow">How it works</p>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tighter2 text-ink-900 md:text-[2.6rem] md:leading-[1.1]">
          One closed loop, from signal to settled transaction.
        </h2>
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="panel p-6">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 font-mono text-xs font-semibold text-brand-600">
                {s.n}
              </span>
              <h3 className="mt-4 text-base font-semibold text-ink-900">{s.title}</h3>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-slate-600">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
