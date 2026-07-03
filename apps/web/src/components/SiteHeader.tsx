import Link from 'next/link';

const nav = [
  { href: '#how', label: 'How it works' },
  { href: '#architecture', label: 'Architecture' },
  { href: '#guardrails', label: 'Guardrails' },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-900/[0.06] bg-canvas/80 backdrop-blur-xl">
      <div className="container-caliber flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <CaliberMark />
          <span className="text-[0.95rem] font-semibold tracking-tightish text-ink-900">Caliber</span>
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-slate-500 transition hover:text-ink-900"
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

export function CaliberMark({ className = '' }: { className?: string }) {
  // A precision aperture: an open ring (reads as a "C" and a caliber bore/gauge)
  // with a center pupil — calibration and focus.
  return (
    <span
      className={`flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500 shadow-soft ${className}`}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M17.9 7.9 A7.2 7.2 0 1 1 17.9 16.1"
          stroke="white"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <circle cx="12" cy="12" r="2.4" fill="white" />
      </svg>
    </span>
  );
}
