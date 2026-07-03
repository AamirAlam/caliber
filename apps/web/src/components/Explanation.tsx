const pillars = [
  {
    title: 'Built for RWAs',
    body: 'Redemption and liquidity risk are first-class signals, not afterthoughts.',
    icon: (
      <path
        d="M4 20V9l8-5 8 5v11M4 20h16M9 20v-6h6v6"
        stroke="#3657d5"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    title: 'Agentic reasoning',
    body: 'A Proposer designs the move; a Risk Officer signs off or vetoes.',
    icon: (
      <>
        <circle cx="12" cy="12" r="3.4" stroke="#3657d5" strokeWidth="1.8" />
        <path
          d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"
          stroke="#3657d5"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </>
    ),
  },
  {
    title: 'Deterministic guardrails',
    body: 'Allocation bands, liquidity floors, and risk ceilings gate every action.',
    icon: (
      <>
        <path
          d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"
          stroke="#3657d5"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path d="M9 12l2 2 4-4" stroke="#3657d5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
];

export function Explanation() {
  return (
    <section className="py-16 md:py-24">
      <div className="container-caliber grid gap-5 md:grid-cols-3">
        {pillars.map((p) => (
          <div key={p.title} className="panel p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                {p.icon}
              </svg>
            </div>
            <h3 className="mt-4 text-base font-semibold text-ink-900">{p.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{p.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
