import Link from 'next/link';

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grid-faint [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-helm-600/10 blur-3xl" />
      <div className="container-helm relative pb-24 pt-20 md:pb-32 md:pt-28">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full bg-helm-400" />
          Scalable onchain treasury management · built on Casper
        </div>
        <h1 className="mt-6 max-w-3xl text-balance text-4xl font-semibold leading-[1.1] tracking-tight text-slate-50 md:text-6xl">
          Policy-driven treasury management for tokenized real-world assets.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-400">
          Helm pairs disciplined risk frameworks with agentic automation and full onchain
          transparency. It watches market and RWA signals, reasons about risk and liquidity within
          your mandate, and executes approved rebalances on Casper — every action verifiable
          onchain.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Link href="/dashboard" className="btn-primary">
            Open the dashboard
          </Link>
          <a href="#how" className="btn-ghost">
            See how it works
          </a>
        </div>
        <dl className="mt-16 grid max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.04] sm:grid-cols-4">
          {[
            ['Deterministic', 'policy guardrails'],
            ['Explainable', 'AI rationale'],
            ['On-chain', 'Casper execution'],
            ['Auditable', 'every decision'],
          ].map(([k, v]) => (
            <div key={k} className="bg-ink-900/80 px-5 py-4">
              <dt className="text-sm font-semibold text-slate-100">{k}</dt>
              <dd className="mt-0.5 text-xs text-slate-500">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
