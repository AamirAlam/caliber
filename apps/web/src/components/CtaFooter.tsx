import Link from 'next/link';
import { HelmMark } from './SiteHeader';

export function CtaFooter() {
  return (
    <footer className="border-t border-white/[0.06]">
      <section className="container-helm py-20 md:py-28">
        <div className="panel relative overflow-hidden p-10 text-center md:p-16">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-96 -translate-x-1/2 rounded-full bg-helm-600/10 blur-3xl" />
          <h2 className="relative mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-slate-50 md:text-4xl">
            Put a policy at the helm of your RWA treasury.
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-slate-400">
            Explore the dashboard, then deploy the vault to Casper testnet and let the agent run its
            first loop.
          </p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/dashboard" className="btn-primary">
              Open the dashboard
            </Link>
            <a
              href="https://docs.casper.network"
              target="_blank"
              rel="noreferrer"
              className="btn-ghost"
            >
              Casper docs
            </a>
          </div>
        </div>
      </section>
      <div className="container-helm flex flex-col items-center justify-between gap-4 border-t border-white/[0.06] py-8 text-sm text-slate-500 md:flex-row">
        <div className="flex items-center gap-2">
          <HelmMark />
          <span>Helm — AI treasury control plane for RWAs</span>
        </div>
        <span className="font-mono text-xs">Built for the Casper Agentic Buildathon</span>
      </div>
    </footer>
  );
}
