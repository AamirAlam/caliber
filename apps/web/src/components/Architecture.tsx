const layers = [
  {
    label: 'Signal layer',
    title: 'Self-managed feed',
    body: 'Caliber reads the deployed signal endpoint and tracks freshness before agent runs.',
  },
  {
    label: 'Reasoning layer',
    title: 'Policy agent',
    body: 'The backend evaluates risk, allocation drift, liquidity, and configured treasury limits.',
  },
  {
    label: 'Settlement layer',
    title: 'Casper execution',
    body: 'Approved actions are signed through the owner wallet and submitted through Casper tooling.',
  },
];

const stack = ['Odra contract', 'casper-js-sdk', 'Casper RPC', 'Wallet session', 'Policy engine', 'Audit trail'];

export function Architecture() {
  return (
    <section id="architecture" className="py-20 md:py-28">
      <div className="container-caliber">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div>
            <p className="eyebrow">Architecture</p>
            <h2 className="mt-3 max-w-xl text-3xl font-semibold tracking-tighter2 text-ink-900 md:text-[2.6rem] md:leading-[1.1]">
              Off-chain intelligence, on-chain accountability.
            </h2>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-slate-600">
              Caliber keeps the agent loop off-chain where analysis can iterate quickly, then moves
              only approved, policy-valid actions through Casper testnet settlement and audit.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-900/[0.07] bg-white p-5 shadow-card dark:border-white/10 dark:bg-[#141b2b]">
            <div className="grid gap-3">
              {layers.map((layer, index) => (
                <div key={layer.label} className="grid gap-4 rounded-xl bg-slate-50 p-4 dark:bg-white/[0.04] sm:grid-cols-[120px_1fr]">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-600">
                      {layer.label}
                    </p>
                    <p className="tnum mt-2 text-xs text-slate-400">{String(index + 1).padStart(2, '0')}</p>
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-ink-900">{layer.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{layer.body}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 border-t border-slate-900/[0.06] pt-5 dark:border-white/10">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Product stack
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {stack.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-slate-900/[0.07] bg-white px-3 py-1.5 font-mono text-[11px] text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
