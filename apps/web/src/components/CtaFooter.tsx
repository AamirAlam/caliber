import Link from 'next/link';
import { CaliberMark } from './SiteHeader';

export function CtaFooter() {
  return (
    <footer>
      <section className="container-caliber py-20 md:py-28">
        <div className="relative overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#0a0f1e_0%,#151b2e_58%,#273c99_100%)] p-10 text-center shadow-card md:p-16">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:44px_44px] opacity-20" />
          <h2 className="relative mx-auto max-w-2xl text-3xl font-semibold tracking-tighter2 text-white md:text-4xl">
            Create a policy-controlled treasury workspace.
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-slate-300">
            Define guardrails, connect the owner wallet when activation is needed, and let the
            backend agent monitor your Casper testnet treasury.
          </p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/onboarding"
              className="inline-flex items-center justify-center rounded-xl bg-[#ffffff] px-5 py-2.5 text-sm font-semibold text-[#0a0f1e] transition hover:bg-[#f1f5f9]"
            >
              Create a treasury
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-xl border border-white/20 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Open dashboard
            </Link>
            <a
              href="https://docs.casper.network"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-xl border border-white/20 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Casper docs
            </a>
          </div>
        </div>
      </section>
      <div className="container-caliber flex flex-col items-center justify-between gap-4 border-t border-slate-900/[0.06] py-8 text-sm text-slate-500 md:flex-row">
        <div className="flex items-center gap-2.5">
          <CaliberMark />
          <span>Caliber — AI treasury control plane for RWAs</span>
        </div>
        <span className="font-mono text-xs">Casper testnet treasury operations</span>
      </div>
    </footer>
  );
}
