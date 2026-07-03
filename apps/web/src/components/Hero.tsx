import Link from 'next/link';

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* soft blue gradient wash */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-brand-fade" />
      <div className="pointer-events-none absolute -top-32 left-1/2 h-72 w-[46rem] -translate-x-1/2 rounded-full bg-brand-300/30 blur-3xl" />

      <div className="container-caliber relative flex flex-col items-center pb-14 pt-20 text-center md:pt-24">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-900/[0.07] bg-white/70 px-3 py-1 text-xs font-medium text-slate-600 shadow-soft backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
          Live on Casper testnet
        </div>

        <h1 className="mt-7 max-w-3xl text-balance text-[2.6rem] font-semibold leading-[1.03] tracking-tighter2 text-ink-900 md:text-[4.25rem]">
          Autonomous treasury management, kept within its mandate.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
          An AI agent steers tokenized real-world assets — and every move clears deterministic
          guardrails before it settles on Casper.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/dashboard" className="btn-primary shadow-pop">
            Open the dashboard
          </Link>
          <a href="#how" className="btn-ghost">
            See how it works
          </a>
        </div>
      </div>
    </section>
  );
}
