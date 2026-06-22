const rails = [
  {
    title: 'Deterministic policy, not vibes',
    body: 'Allocation bands, liquidity floors, and risk ceilings are enforced in code. The AI explains decisions; it never overrides the rules.',
  },
  {
    title: 'Human-in-the-loop',
    body: 'Policies can require explicit approval before any deploy is submitted. Nothing moves on-chain silently.',
  },
  {
    title: 'Pause & access control',
    body: 'The on-chain vault supports pause/resume and owner-gated entry points, so control is enforced at the contract layer too.',
  },
  {
    title: 'Verifiable audit trail',
    body: 'Each run records its signals, rationale, and the resulting Casper deploy hash — reviewable on-chain and off.',
  },
];

export function Guardrails() {
  return (
    <section id="guardrails" className="border-t border-white/[0.06] py-20 md:py-28">
      <div className="container-helm">
        <p className="eyebrow">Trust &amp; guardrails</p>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-slate-50 md:text-4xl">
          Autonomy you can actually let near a treasury.
        </h2>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {rails.map((r) => (
            <div key={r.title} className="panel flex gap-4 p-6">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-helm-600/30 bg-helm-600/10">
                <span className="h-2 w-2 rounded-full bg-helm-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-100">{r.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{r.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
