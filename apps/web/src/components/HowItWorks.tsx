const steps = [
  {
    n: '01',
    title: 'Collect signals',
    body: 'Market rates, RWA issuer feeds, on-chain liquidity, and redemption queues are gathered into a timestamped snapshot.',
  },
  {
    n: '02',
    title: 'Score risk',
    body: 'A deterministic model turns the snapshot into a 0–100 risk score with a per-factor breakdown — fully explainable.',
  },
  {
    n: '03',
    title: 'Evaluate policy',
    body: 'The proposed move is checked against allocation bands, liquidity buffers, and risk ceilings. Violations block action.',
  },
  {
    n: '04',
    title: 'Decide & explain',
    body: 'Helm chooses hold, rebalance, or halt, and writes a plain-language rationale alongside the machine verdict.',
  },
  {
    n: '05',
    title: 'Approve & execute',
    body: 'Compliant rebalances are submitted to Casper as on-chain deploys — optionally behind a human approval gate.',
  },
  {
    n: '06',
    title: 'Audit',
    body: 'Every signal, decision, rationale, and transaction hash is recorded as an append-only run log.',
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="border-t border-white/[0.06] py-20 md:py-28">
      <div className="container-helm">
        <p className="eyebrow">How it works</p>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-slate-50 md:text-4xl">
          One closed loop, from signal to settled transaction.
        </h2>
        <ol className="mt-12 grid gap-px overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.04] md:grid-cols-2 lg:grid-cols-3">
          {steps.map((s) => (
            <li key={s.n} className="bg-ink-900/80 p-6">
              <span className="font-mono text-xs text-helm-400">{s.n}</span>
              <h3 className="mt-2 text-base font-semibold text-slate-100">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
