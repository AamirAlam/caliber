import Link from 'next/link';

interface MaintenanceModeProps {
  title?: string;
  detail?: string;
  showHomeLink?: boolean;
}

export function MaintenanceMode({
  title = 'Maintenance mode',
  detail = 'The Caliber API is temporarily unavailable or not configured. Live treasury controls are paused while backend setup is completed.',
  showHomeLink = true,
}: MaintenanceModeProps) {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-5xl items-center px-4 py-10 sm:px-6 lg:min-h-screen lg:px-8">
      <section className="w-full overflow-hidden rounded-2xl border border-slate-900/[0.07] bg-white shadow-card">
        <div className="grid gap-6 p-6 sm:grid-cols-[auto_1fr] sm:gap-8 sm:p-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-signal-amber">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M12 8v5M12 17h.01M10.3 4.7 2.8 17.5A2 2 0 0 0 4.5 20h15a2 2 0 0 0 1.7-2.5L13.7 4.7a2 2 0 0 0-3.4 0Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div className="min-w-0">
            <p className="eyebrow">Testnet dashboard</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tightish text-ink-900 sm:text-[1.9rem]">
              {title}
            </h1>
            <p className="mt-3 max-w-2xl text-[0.97rem] leading-relaxed text-slate-600">
              {detail}
            </p>
            <div className="mt-5 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
              <StatusItem label="API" value="Unavailable" />
              <StatusItem label="Signals" value="Paused" />
              <StatusItem label="Execution" value="Disabled" />
            </div>
            {showHomeLink && (
              <Link href="/" className="btn-ghost mt-6 w-full sm:w-auto">
                Back to site
              </Link>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function StatusItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-900/[0.06] bg-slate-50 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 font-medium text-slate-700">{value}</p>
    </div>
  );
}
