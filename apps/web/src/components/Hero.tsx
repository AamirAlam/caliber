import Link from 'next/link';

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* soft blue gradient wash */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-brand-fade" />
      <div className="pointer-events-none absolute -top-32 left-1/2 h-72 w-[46rem] -translate-x-1/2 rounded-full bg-brand-300/30 blur-3xl" />

      <div className="container-helm relative pb-24 pt-20 md:pb-28 md:pt-24">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-900/[0.07] bg-white/70 px-3 py-1 text-xs font-medium text-slate-600 shadow-soft backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
          Casper Agentic Buildathon · live on testnet
        </div>

        <h1 className="mt-7 max-w-3xl text-[2.6rem] font-semibold leading-[1.05] tracking-tighter2 text-ink-900 md:text-[4.25rem]">
          Policy-driven treasury management for tokenized real-world assets.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
          Helm pairs disciplined risk frameworks with agentic automation and full onchain
          transparency. It watches market and RWA signals, reasons about risk within your mandate,
          and executes approved rebalances on Casper — every action verifiable onchain.
        </p>

        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Link href="/dashboard" className="btn-primary shadow-pop">
            Open the dashboard
          </Link>
          <a href="#how" className="btn-ghost">
            See how it works
          </a>
        </div>

        <dl className="mt-16 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ['Deterministic', 'policy guardrails'],
            ['Explainable', 'agent rationale'],
            ['Onchain', 'Casper execution'],
            ['Auditable', 'every decision'],
          ].map(([k, v]) => (
            <div key={k} className="panel px-5 py-4">
              <dt className="text-sm font-semibold text-ink-900">{k}</dt>
              <dd className="mt-0.5 text-xs text-slate-500">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
