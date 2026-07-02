'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HelmMark } from '@/components/SiteHeader';
import { ThemeToggle } from '@/components/ThemeToggle';

const nav = [
  { href: '/dashboard', label: 'Home', icon: 'grid' },
  { href: '/dashboard/runs', label: 'Runs', icon: 'list' },
] as const;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);

  return (
    <div className="app-surface flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto border-r border-slate-900/[0.06] bg-white/60 backdrop-blur lg:flex">
        <Link
          href="/"
          className="flex h-16 items-center gap-2.5 border-b border-slate-900/[0.06] px-6"
        >
          <HelmMark />
          <span className="text-[0.95rem] font-semibold tracking-tightish text-ink-900">Helm</span>
        </Link>
        <nav className="flex flex-col gap-0.5 p-3">
          {nav.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.label}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-ink-900'
                }`}
              >
                <NavIcon name={item.icon} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto p-3">
          <div className="border-t border-slate-900/[0.06] pb-2 pt-2">
            <ThemeToggle variant="nav" />
          </div>
          <div className="mt-1 rounded-xl border border-slate-900/[0.07] bg-slate-50 p-3.5 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
              <span className="h-1.5 w-1.5 rounded-full bg-signal-emerald" />
              casper-testnet
            </span>
            <p className="mt-1.5 leading-relaxed">
              HelmVault deployed. Approvals submit real on-chain deploys.
            </p>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-900/[0.06] bg-canvas/85 px-4 backdrop-blur-xl lg:hidden">
          <Link href="/" className="flex items-center gap-2.5">
            <HelmMark />
            <span className="text-[0.95rem] font-semibold tracking-tightish text-ink-900">Helm</span>
          </Link>
          <ThemeToggle />
        </header>

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-900/[0.06] bg-white/90 backdrop-blur-xl lg:hidden">
        {nav.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition ${
                active ? 'text-brand-600' : 'text-slate-500 active:bg-slate-50'
              }`}
            >
              <NavIcon name={item.icon} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function NavIcon({ name }: { name: 'grid' | 'list' }) {
  const p = {
    grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
    list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  } as const;
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d={p[name]}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
