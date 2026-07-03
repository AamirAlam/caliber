const points = [
  {
    title: 'Not a yield bot',
    body: 'Caliber does not chase APY blindly. It treats a treasury as a mandate with constraints — allocation bands, liquidity buffers, and risk ceilings — and acts only within them.',
  },
  {
    title: 'Built for RWAs',
    body: 'Tokenized T-bills, credit, and money-market positions carry redemption and liquidity risk that pure-DeFi tools ignore. Caliber models those signals as first-class inputs.',
  },
  {
    title: 'Agentic, with a seatbelt',
    body: 'An autonomous loop proposes moves; deterministic policy checks gate them; a human can require approval before anything touches the chain.',
  },
];

export function Explanation() {
  return (
    <section className="py-20 md:py-28">
      <div className="container-caliber">
        <p className="eyebrow">What Caliber is</p>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tighter2 text-ink-900 md:text-[2.6rem] md:leading-[1.1]">
          A control plane for treasuries that hold real-world assets.
        </h2>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {points.map((p) => (
            <div key={p.title} className="panel p-7">
              <h3 className="text-lg font-semibold text-ink-900">{p.title}</h3>
              <p className="mt-3 text-[0.95rem] leading-relaxed text-slate-600">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
