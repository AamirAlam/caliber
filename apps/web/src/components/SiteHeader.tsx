import Link from 'next/link';

const nav = [
  { href: '#how', label: 'How it works' },
  { href: '#architecture', label: 'Architecture' },
  { href: '#guardrails', label: 'Guardrails' },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-ink-950/80 backdrop-blur">
      <div className="container-helm flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <HelmMark />
          <span className="text-sm font-semibold tracking-wide text-slate-100">HELM</span>
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm text-slate-400 transition hover:text-slate-100"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <Link href="/dashboard" className="btn-primary">
          Open dashboard
        </Link>
      </div>
    </header>
  );
}

export function HelmMark() {
  // A ship's-wheel inspired mark — steering, control, calm.
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="#2dd4bf" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="3" stroke="#2dd4bf" strokeWidth="1.5" />
      <path
        d="M12 3v6M12 15v6M3 12h6M15 12h6"
        stroke="#5eead4"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
