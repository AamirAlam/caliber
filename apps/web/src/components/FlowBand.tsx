/**
 * The landing centerpiece: an animated schematic of Caliber's loop —
 * funds flow from the RWA treasury, through the AI agent and the deterministic
 * policy gate, and settle on Casper. Every stage is a consistent brand-blue
 * node with a white glyph; the agent keeps a pulsing glow as the focal point.
 * Pure SVG + SMIL; reduced-motion aware. Decorative, so it's aria-hidden.
 */
const NODES = [
  { cx: 130, label: 'RWA treasury', glyph: 'treasury' as const },
  { cx: 380, label: 'Caliber agent', glyph: 'agent' as const, pulse: true },
  { cx: 630, label: 'Policy gate', glyph: 'shield' as const },
  { cx: 880, label: 'Casper', glyph: 'hex' as const },
];

export function FlowBand() {
  // Six dots flowing left→right along the spine, staggered.
  const dots = [0, -1.5, -3, -4.5, -6, -7.5];
  return (
    <div className="container-caliber">
      <div className="relative overflow-hidden rounded-2xl border border-slate-900/[0.07] bg-white p-4 shadow-card sm:p-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-brand-fade" />
        <svg
          viewBox="0 0 1000 210"
          className="relative w-full"
          role="img"
          aria-label="Funds flow from the treasury through the Caliber agent and policy gate, settling on Casper."
        >
          {/* spine connecting the node centers */}
          <path id="spine" d="M130 96 H880" fill="none" stroke="rgba(54,87,213,0.20)" strokeWidth="2" />

          {/* flowing funds (behind the nodes) */}
          {dots.map((begin, i) => (
            <circle key={i} className="flow-dot" r="4" fill={i % 3 === 0 ? '#059669' : '#3657d5'}>
              <animateMotion dur="6s" begin={`${begin}s`} repeatCount="indefinite" keyPoints="0;1" keyTimes="0;1" calcMode="linear">
                <mpath href="#spine" />
              </animateMotion>
            </circle>
          ))}

          {NODES.map((n) => (
            <FlowNode key={n.label} {...n} />
          ))}
        </svg>

        <div className="mt-1 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-xs text-slate-500">
          <Legend color="#3657d5" label="Funds in motion" />
          <Legend color="#059669" label="Settled on-chain" />
          <span className="text-slate-400">Signals → reason → guardrails → settle</span>
        </div>
      </div>
    </div>
  );
}

function FlowNode({
  cx,
  label,
  glyph,
  pulse,
}: {
  cx: number;
  label: string;
  glyph: 'treasury' | 'agent' | 'shield' | 'hex';
  pulse?: boolean;
}) {
  return (
    <g transform={`translate(${cx} 96)`}>
      {pulse ? (
        <circle className="ai-pulse" r="45" fill="#3657d5" />
      ) : (
        <circle r="44" fill="#3657d5" opacity="0.14" />
      )}
      <circle r="33" fill="#3657d5" />
      <Glyph kind={glyph} />
      <text
        y="70"
        textAnchor="middle"
        className="fill-slate-600 dark:fill-slate-300"
        fontSize="14"
        fontWeight="600"
      >
        {label}
      </text>
    </g>
  );
}

/** White glyphs, centered at (0,0) inside the node circle. */
function Glyph({ kind }: { kind: 'treasury' | 'agent' | 'shield' | 'hex' }) {
  const line = {
    fill: 'none',
    stroke: 'white',
    strokeWidth: 2.2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (kind) {
    case 'treasury':
      return (
        <g {...line}>
          <path d="M-15 -4 L0 -13 L15 -4" />
          <path d="M-12 -4 V9 M-4 -4 V9 M4 -4 V9 M12 -4 V9" />
          <path d="M-16 12 H16" />
        </g>
      );
    case 'agent':
      return (
        <>
          <circle r="11" fill="none" stroke="white" strokeWidth={2.6} />
          <circle r="3.6" fill="white" />
        </>
      );
    case 'shield':
      return (
        <g {...line}>
          <path d="M0 -13 l12 4 v8 c0 6.5-5 10.5-12 13 c-7-2.5-12-6.5-12-13 v-8 z" />
          <path d="M-5 0 l4 4 6.5 -7.5" />
        </g>
      );
    case 'hex':
      return (
        <g {...line}>
          <path d="M0 -13 L11.3 -6.5 L11.3 6.5 L0 13 L-11.3 6.5 L-11.3 -6.5 Z" />
          <path d="M-4.5 0 l3.2 3.2 5.8 -6.8" />
        </g>
      );
  }
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
