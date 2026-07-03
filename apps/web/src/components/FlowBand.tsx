/**
 * The landing centerpiece: an animated schematic of Caliber's loop —
 * funds flow from the RWA treasury, through the AI agent and the deterministic
 * policy gate, and settle on Casper. Pure SVG + SMIL; the agent glow is CSS
 * (reduced-motion aware). Decorative, so it's aria-hidden.
 */
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
          {/* spine */}
          <path id="spine" d="M175 100 H772" fill="none" stroke="rgba(54,87,213,0.18)" strokeWidth="2" />

          {/* flowing funds */}
          {dots.map((begin, i) => (
            <circle key={i} className="flow-dot" r="4" fill={i % 3 === 0 ? '#059669' : '#3657d5'}>
              <animateMotion dur="6s" begin={`${begin}s`} repeatCount="indefinite" keyPoints="0;1" keyTimes="0;1" calcMode="linear">
                <mpath href="#spine" />
              </animateMotion>
            </circle>
          ))}

          {/* ── Assets: RWA treasury ── */}
          <g>
            <rect x="40" y="60" width="135" height="80" rx="14" fill="white" stroke="rgba(15,23,42,0.10)" />
            <rect x="58" y="80" width="60" height="7" rx="3.5" fill="#3657d5" />
            <rect x="58" y="96" width="90" height="7" rx="3.5" fill="#a8bcff" />
            <rect x="58" y="112" width="40" height="7" rx="3.5" fill="#c7d2fe" />
            <text x="107" y="166" textAnchor="middle" className="fill-slate-500" fontSize="13" fontWeight="600">
              RWA treasury
            </text>
          </g>

          {/* ── Caliber agent (AI) ── */}
          <g>
            <circle className="ai-pulse" cx="400" cy="100" r="46" fill="#3657d5" />
            <circle cx="400" cy="100" r="34" fill="#3657d5" />
            <path d="M411 90 A11 11 0 1 1 411 110" fill="none" stroke="white" strokeWidth="3.2" strokeLinecap="round" />
            <circle cx="400" cy="100" r="3.6" fill="white" />
            <text x="400" y="166" textAnchor="middle" className="fill-ink-900" fontSize="13" fontWeight="700">
              Caliber agent
            </text>
          </g>

          {/* ── Policy / security gate ── */}
          <g>
            <rect x="558" y="72" width="56" height="56" rx="14" fill="white" stroke="rgba(15,23,42,0.10)" />
            <path
              d="M586 84 l14 5 v9 c0 8-6 13-14 16 c-8-3-14-8-14-16 v-9 z"
              fill="none"
              stroke="#059669"
              strokeWidth="2.4"
              strokeLinejoin="round"
            />
            <path d="M581 100 l4 4 7-8" fill="none" stroke="#059669" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            <text x="586" y="166" textAnchor="middle" className="fill-slate-500" fontSize="13" fontWeight="600">
              Policy gate
            </text>
          </g>

          {/* ── Casper (onchain settlement) ── */}
          <g>
            <path
              d="M772 62 l60 0 30 38 -30 38 -60 0 -30 -38 z"
              fill="white"
              stroke="rgba(15,23,42,0.10)"
            />
            <path d="M792 100 l9 9 18 -20" fill="none" stroke="#3657d5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <text x="802" y="166" textAnchor="middle" className="fill-ink-900" fontSize="13" fontWeight="700">
              Casper
            </text>
          </g>
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

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
