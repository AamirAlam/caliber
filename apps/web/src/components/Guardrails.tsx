const rails = [
  { title: 'Deterministic policy, not vibes', body: 'Bands, floors, and ceilings enforced in code. The AI explains; it never overrides.' },
  { title: 'Human-in-the-loop', body: 'Approval required before any deploy. Nothing moves on-chain silently.' },
  { title: 'Pause & access control', body: 'Owner-gated entry points and pause/resume, enforced at the contract layer.' },
  { title: 'Verifiable audit trail', body: 'Every run records its rationale and Casper deploy hash — on-chain and off.' },
];

export function Guardrails() {
  return (
    <section id="guardrails" className="py-20 md:py-28">
      <div className="container-caliber">
        <p className="eyebrow">Trust &amp; guardrails</p>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tighter2 text-ink-900 md:text-[2.6rem] md:leading-[1.1]">
          Autonomy you can actually let near a treasury.
        </h2>
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {rails.map((r) => (
            <div key={r.title} className="panel flex gap-4 p-6">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z"
                    stroke="#3657d5"
                    strokeWidth="1.7"
                    strokeLinejoin="round"
                  />
                  <path d="M9 12l2 2 4-4" stroke="#3657d5" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-ink-900">{r.title}</h3>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-slate-600">{r.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
