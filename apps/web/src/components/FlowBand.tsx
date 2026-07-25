const capabilities = [
  {
    title: 'Mandate first',
    body: 'Targets, risk ceiling, and liquidity buffers are encoded before the agent can recommend action.',
  },
  {
    title: 'Signals stay fresh',
    body: 'The Caliber-operated feed gives the backend agent current context for every workspace run.',
  },
  {
    title: 'Approval remains human',
    body: 'The agent can analyze continuously, but owner approval is required before Casper settlement.',
  },
];

export function FlowBand() {
  return (
    <section className="container-caliber mt-6 lg:mt-8">
      <div className="rounded-2xl border border-slate-900/[0.07] bg-white p-4 shadow-card dark:border-white/10 dark:bg-[#141b2b] sm:p-5">
        <div className="grid divide-y divide-slate-900/[0.06] dark:divide-white/10 md:grid-cols-3 md:divide-x md:divide-y-0">
          {capabilities.map((item) => (
            <div key={item.title} className="p-4 sm:p-5">
              <p className="text-sm font-semibold text-ink-900">{item.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
