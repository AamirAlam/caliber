import Link from 'next/link';

const tokens = [
  { symbol: 'RWA', label: 'Yield assets', color: 'bg-brand-500' },
  { symbol: 'USD', label: 'Stable buffer', color: 'bg-signal-emerald' },
  { symbol: 'CSPR', label: 'Network asset', color: 'bg-signal-amber' },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-slate-900/[0.06] bg-[#f5f7fb] dark:bg-[#0b0f1a]">
      <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(54,87,213,0.11),transparent_34%),linear-gradient(300deg,rgba(5,150,105,0.10),transparent_36%)]" />
      <div className="container-caliber relative grid min-h-[calc(100vh-4rem)] items-center gap-12 py-16 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-900/[0.08] bg-white/80 px-3 py-1 text-xs font-medium text-slate-600 shadow-soft backdrop-blur dark:border-white/10 dark:bg-white/10 dark:text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-signal-emerald" />
            Casper testnet treasury operations
          </div>

          <h1 className="mt-7 max-w-3xl text-balance text-[2.85rem] font-semibold leading-[1] tracking-tighter2 text-ink-900 md:text-[4.7rem]">
            Caliber Treasury Agent
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
            A DeFi control plane for tokenized RWA treasuries. Define the mandate, let the agent
            monitor live signals, and keep on-chain execution behind owner-wallet approval.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/onboarding" className="btn-primary shadow-pop">
              Create treasury
            </Link>
            <a href="#how" className="btn-ghost">
              See workflow
            </a>
          </div>

          <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <Proof label="Policy" value="Allocation guardrails" />
            <Proof label="Agent" value="Workspace-specific runs" />
            <Proof label="Chain" value="Casper settlement" />
          </div>
        </div>

        <ProtocolVisual />
      </div>
    </section>
  );
}

function Proof({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 font-semibold text-ink-900">{value}</p>
    </div>
  );
}

function ProtocolVisual() {
  return (
    <div className="mx-auto w-full max-w-[660px] rounded-[1.5rem] border border-slate-900/[0.08] bg-white/80 p-4 shadow-card backdrop-blur dark:border-white/10 dark:bg-white/[0.05] sm:p-5">
      <div className="grid gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Treasury mandate</p>
            <p className="mt-1 text-lg font-semibold text-ink-900">Tokenized RWA reserve</p>
          </div>
          <div className="w-fit rounded-full border border-signal-emerald/25 bg-emerald-50 px-3 py-1 text-xs font-semibold text-signal-emerald dark:bg-emerald-500/10">
            Signal feed fresh
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {tokens.map((token) => (
            <div key={token.symbol} className="rounded-2xl border border-slate-900/[0.07] bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
              <span className={`flex h-10 w-10 items-center justify-center rounded-full ${token.color} text-[11px] font-bold text-white`}>
                {token.symbol}
              </span>
              <p className="mt-3 truncate text-sm font-semibold text-ink-900">{token.label}</p>
              <p className="mt-1 text-xs text-slate-500">Policy input</p>
            </div>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
          <div className="rounded-2xl border border-brand-200 bg-brand-50 p-5 dark:border-brand-400/25 dark:bg-brand-500/15">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">Agent policy</p>
            <p className="mt-3 text-2xl font-semibold text-ink-900">Risk scored</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Fresh signals are evaluated against allocation and liquidity guardrails.
            </p>
          </div>

          <div className="hidden items-center justify-center sm:flex">
            <span className="h-px w-10 bg-slate-200 dark:bg-white/15" />
          </div>

          <div className="rounded-2xl border border-slate-900/[0.08] bg-ink-900 p-5 text-white shadow-sm dark:border-white/10">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-300">Execution gate</p>
            <p className="mt-3 text-2xl font-semibold">Owner approval</p>
            <div className="mt-4 rounded-xl border border-white/10 bg-white/10 p-3">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>Casper deploy</span>
                <span>Locked</span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-2/3 rounded-full bg-signal-emerald" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
