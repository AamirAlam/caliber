import Link from 'next/link';
import { HelmMark } from './SiteHeader';

export function CtaFooter() {
  return (
    <footer>
      <section className="container-helm py-20 md:py-28">
        <div className="relative overflow-hidden rounded-2xl bg-ink-900 p-10 text-center shadow-card md:p-16">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-brand-500/30 blur-3xl" />
          <h2 className="relative mx-auto max-w-2xl text-3xl font-semibold tracking-tighter2 text-white md:text-4xl">
            Put a policy at the helm of your RWA treasury.
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-slate-300">
            Explore the dashboard, run a stress scenario, and watch an approved rebalance settle on
            Casper testnet.
          </p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-ink-900 transition hover:bg-slate-100"
            >
              Open the dashboard
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
      <div className="container-helm flex flex-col items-center justify-between gap-4 border-t border-slate-900/[0.06] py-8 text-sm text-slate-500 md:flex-row">
        <div className="flex items-center gap-2.5">
          <HelmMark />
          <span>Helm — AI treasury control plane for RWAs</span>
        </div>
        <span className="font-mono text-xs">Built for the Casper Agentic Buildathon</span>
      </div>
    </footer>
  );
}
