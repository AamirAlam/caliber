type Item =
  | { kind: 'label'; text: string }
  | { kind: 'step'; n: string; title: string; desc: string; tools: string[] };

const items: Item[] = [
  { kind: 'label', text: 'Off-chain — Caliber agent' },
  { kind: 'step', n: '01', title: 'Ingest signals', desc: 'Live market and RWA data is pulled in continuously.', tools: ['CSPR.cloud', 'x402'] },
  { kind: 'step', n: '02', title: 'Reason & score risk', desc: 'The agent assesses liquidity and risk against the mandate.', tools: ['Caliber agent'] },
  { kind: 'step', n: '03', title: 'Check policy guardrails', desc: 'Deterministic rules approve, hold, or halt the action.', tools: ['Caliber agent'] },
  { kind: 'label', text: 'On-chain — Casper' },
  { kind: 'step', n: '04', title: 'Sign the approved action', desc: 'The rebalance is signed before anything is submitted.', tools: ['CSPR.click', 'casper-eip-712'] },
  { kind: 'step', n: '05', title: 'Submit to Casper', desc: 'The deploy is broadcast and executed on the network.', tools: ['Casper MCP'] },
  { kind: 'step', n: '06', title: 'Record & audit', desc: 'CaliberVault stores the rebalance and emits an audit event.', tools: ['Odra · CaliberVault'] },
];

const toolkit = [
  { label: 'Odra', desc: 'Smart contract framework — the CaliberVault contract.' },
  { label: 'Casper MCP Server', desc: 'Query state and submit deploys via MCP.' },
  { label: 'CSPR.click', desc: 'Wallet management and transaction signing.' },
  { label: 'CSPR.cloud', desc: 'REST / Streaming / Node data middleware.' },
  { label: 'x402 Facilitator', desc: 'Pay-per-request access to data feeds.' },
  { label: 'casper-eip-712', desc: 'Typed-data signing for gasless approvals.' },
];

export function Architecture() {
  return (
    <section id="architecture" className="py-20 md:py-28">
      <div className="container-caliber">
        <p className="eyebrow">Architecture</p>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tighter2 text-ink-900 md:text-[2.6rem] md:leading-[1.1]">
          Designed on Casper, powered by the agentic toolkit.
        </h2>
        <p className="mt-4 max-w-2xl text-slate-600">
          An off-chain reasoning loop that settles every approved decision on Casper — composing the
          native{' '}
          <a
            href="https://www.casper.network/ai#toolkit"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-brand-600 underline-offset-4 hover:underline"
          >
            Casper agentic toolkit
          </a>{' '}
          at each step.
        </p>

        <div className="mt-12 max-w-2xl">
          {items.map((item, i) =>
            item.kind === 'label' ? (
              <LabelRow key={`l${i}`} text={item.text} delay={i * 0.32} />
            ) : (
              <StepRow key={item.n} item={item} delay={i * 0.32} />
            ),
          )}
        </div>

        <h3 className="mt-16 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          Toolkit
        </h3>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {toolkit.map((t) => (
            <div key={t.label} className="panel p-5">
              <span className="font-mono text-xs font-semibold text-brand-600">{t.label}</span>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{t.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Rail({ delay }: { delay: number }) {
  return (
    <span className="flow-track">
      <span className="flow-pulse" style={{ animationDelay: `${delay}s` }} />
    </span>
  );
}

function LabelRow({ text, delay }: { text: string; delay: number }) {
  return (
    <div className="flex gap-5">
      <div className="relative w-4 shrink-0">
        <Rail delay={delay} />
        <span className="absolute left-1/2 top-1 z-10 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-brand-400 bg-white" />
      </div>
      <div className="pb-4 pt-0.5">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          {text}
        </span>
      </div>
    </div>
  );
}

function StepRow({
  item,
  delay,
}: {
  item: Extract<Item, { kind: 'step' }>;
  delay: number;
}) {
  return (
    <div className="flex gap-5">
      <div className="relative w-4 shrink-0">
        <Rail delay={delay} />
        <span className="flow-node absolute left-1/2 top-4 z-10 flex h-4 w-4 -translate-x-1/2 items-center justify-center rounded-full border-2 border-brand-500 bg-white">
          <span className="h-1 w-1 rounded-full bg-brand-500" />
        </span>
      </div>
      <div className="mb-3 flex-1 panel p-4">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold text-brand-600">{item.n}</span>
          <h4 className="text-sm font-semibold text-ink-900">{item.title}</h4>
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{item.desc}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {item.tools.map((t) => (
            <span
              key={t}
              className="rounded-md border border-slate-900/[0.07] bg-slate-50 px-2 py-0.5 font-mono text-[11px] text-slate-600"
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
