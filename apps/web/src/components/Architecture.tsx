type Item =
  | { kind: 'label'; text: string; tone: 'slate' | 'helm' }
  | {
      kind: 'step';
      n: string;
      title: string;
      desc: string;
      tools: string[];
      tone: 'slate' | 'helm';
    };

const items: Item[] = [
  { kind: 'label', text: 'Off-chain — Helm agent', tone: 'slate' },
  {
    kind: 'step',
    n: '01',
    title: 'Ingest signals',
    desc: 'Live market and RWA data is pulled in continuously.',
    tools: ['CSPR.cloud', 'x402'],
    tone: 'slate',
  },
  {
    kind: 'step',
    n: '02',
    title: 'Reason & score risk',
    desc: 'The agent assesses liquidity and risk against the mandate.',
    tools: ['Helm agent'],
    tone: 'slate',
  },
  {
    kind: 'step',
    n: '03',
    title: 'Check policy guardrails',
    desc: 'Deterministic rules approve, hold, or halt the action.',
    tools: ['Helm agent'],
    tone: 'slate',
  },
  { kind: 'label', text: 'On-chain — Casper', tone: 'helm' },
  {
    kind: 'step',
    n: '04',
    title: 'Sign the approved action',
    desc: 'The rebalance is signed before anything is submitted.',
    tools: ['CSPR.click', 'casper-eip-712'],
    tone: 'helm',
  },
  {
    kind: 'step',
    n: '05',
    title: 'Submit to Casper',
    desc: 'The deploy is broadcast and executed on the network.',
    tools: ['Casper MCP'],
    tone: 'helm',
  },
  {
    kind: 'step',
    n: '06',
    title: 'Record & audit',
    desc: 'HelmVault stores the rebalance and emits an audit event.',
    tools: ['Odra · HelmVault'],
    tone: 'helm',
  },
];

const toolkit = [
  { label: 'Odra', desc: 'Smart contract framework — the HelmVault contract.' },
  { label: 'Casper MCP Server', desc: 'Query state and submit deploys via MCP.' },
  { label: 'CSPR.click', desc: 'Wallet management and transaction signing.' },
  { label: 'CSPR.cloud', desc: 'REST / Streaming / Node data middleware.' },
  { label: 'x402 Facilitator', desc: 'Pay-per-request access to data feeds.' },
  { label: 'casper-eip-712', desc: 'Typed-data signing for gasless approvals.' },
];

export function Architecture() {
  return (
    <section id="architecture" className="border-t border-white/[0.06] py-20 md:py-28">
      <div className="container-helm">
        <p className="eyebrow">Architecture</p>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-slate-50 md:text-4xl">
          Designed on Casper, powered by the agentic toolkit.
        </h2>
        <p className="mt-4 max-w-2xl text-slate-400">
          An off-chain reasoning loop that settles every approved decision on Casper — composing the
          native{' '}
          <a
            href="https://www.casper.network/ai#toolkit"
            target="_blank"
            rel="noreferrer"
            className="text-helm-400 underline-offset-4 hover:underline"
          >
            Casper agentic toolkit
          </a>{' '}
          at each step.
        </p>

        <div className="mt-12 max-w-2xl">
          {items.map((item, i) =>
            item.kind === 'label' ? (
              <LabelRow key={`l${i}`} item={item} delay={i * 0.32} />
            ) : (
              <StepRow key={item.n} item={item} delay={i * 0.32} />
            ),
          )}
        </div>

        <h3 className="mt-16 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
          Toolkit
        </h3>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {toolkit.map((t) => (
            <div key={t.label} className="panel p-5">
              <span className="font-mono text-xs text-helm-400">{t.label}</span>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{t.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Vertical rail column shared by every row; carries the animated pulse. */
function Rail({ delay }: { delay: number }) {
  return (
    <span className="flow-track">
      <span className="flow-pulse" style={{ animationDelay: `${delay}s` }} />
    </span>
  );
}

function LabelRow({
  item,
  delay,
}: {
  item: Extract<Item, { kind: 'label' }>;
  delay: number;
}) {
  return (
    <div className="flex gap-5">
      <div className="relative w-4 shrink-0">
        <Rail delay={delay} />
        <span
          className={`absolute left-1/2 top-1 z-10 h-3 w-3 -translate-x-1/2 rounded-full border-2 ${
            item.tone === 'helm' ? 'border-helm-400 bg-ink-950' : 'border-slate-500 bg-ink-950'
          }`}
        />
      </div>
      <div className="pb-4 pt-0.5">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          {item.text}
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
  const accent = item.tone === 'helm';
  return (
    <div className="flex gap-5">
      <div className="relative w-4 shrink-0">
        <Rail delay={delay} />
        <span
          className={`flow-node absolute left-1/2 top-4 z-10 flex h-4 w-4 -translate-x-1/2 items-center justify-center rounded-full border-2 bg-ink-950 ${
            accent ? 'border-helm-500' : 'border-slate-500'
          }`}
        >
          <span className={`h-1 w-1 rounded-full ${accent ? 'bg-helm-400' : 'bg-slate-400'}`} />
        </span>
      </div>
      <div
        className={`mb-3 flex-1 rounded-xl border bg-ink-900/60 p-4 ${
          accent ? 'border-helm-600/25' : 'border-white/[0.06]'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-helm-400">{item.n}</span>
          <h4 className="text-sm font-semibold text-slate-100">{item.title}</h4>
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{item.desc}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {item.tools.map((t) => (
            <span
              key={t}
              className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 font-mono text-[11px] text-slate-300"
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
