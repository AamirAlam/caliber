import Link from 'next/link';
import { HelmMark } from '@/components/SiteHeader';

const nav = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard#policy', label: 'Policy' },
  { href: '/dashboard#signals', label: 'Signals' },
  { href: '/dashboard#runs', label: 'Run history' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-white/[0.06] bg-ink-900/40 lg:flex">
        <Link href="/" className="flex h-16 items-center gap-2.5 border-b border-white/[0.06] px-6">
          <HelmMark />
          <span className="text-sm font-semibold tracking-wide text-slate-100">HELM</span>
        </Link>
        <nav className="flex flex-col gap-1 p-4">
          {nav.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm text-slate-400 transition hover:bg-white/[0.04] hover:text-slate-100"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="mt-auto p-4">
          <div className="rounded-lg border border-white/[0.06] bg-ink-800/40 p-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-helm-400" />
              casper-testnet
            </span>
            <p className="mt-1.5">Dry-run mode · no live key</p>
          </div>
        </div>
      </aside>
      <div className="flex-1">{children}</div>
    </div>
  );
}
