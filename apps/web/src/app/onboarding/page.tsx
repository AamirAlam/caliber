'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CaliberMark } from '@/components/SiteHeader';

const steps = [
  'Workspace',
  'Vault',
  'Policy',
  'Signals',
  'Activate',
] as const;

type SourceMode = 'operator' | 'external';

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [workspace, setWorkspace] = useState('RWA Income Treasury');
  const [owner, setOwner] = useState('');
  const [vault, setVault] = useState('5dd0bfde53bf885dc64b7009d4c02030aced4c8525ff7a1f3c0735d238142ce0');
  const [stableTarget, setStableTarget] = useState(30);
  const [rwaTarget, setRwaTarget] = useState(60);
  const [nativeTarget, setNativeTarget] = useState(10);
  const [riskLimit, setRiskLimit] = useState(70);
  const [sourceMode, setSourceMode] = useState<SourceMode>('operator');
  const [feedUrl, setFeedUrl] = useState('');

  const totalAllocation = stableTarget + rwaTarget + nativeTarget;
  const ready = workspace.trim().length > 2 && vault.trim().length > 12 && totalAllocation === 100;
  const summary = useMemo(
    () => [
      { label: 'Workspace', value: workspace || 'Unnamed treasury' },
      { label: 'Vault', value: vault ? `${vault.slice(0, 10)}...${vault.slice(-8)}` : 'Not connected' },
      { label: 'Policy', value: `${rwaTarget}% RWA / ${stableTarget}% stable / ${nativeTarget}% native` },
      { label: 'Risk ceiling', value: `${riskLimit}/100` },
      { label: 'Signal source', value: sourceMode === 'operator' ? 'Built-in testnet feed' : feedUrl || 'External feed pending' },
    ],
    [feedUrl, nativeTarget, riskLimit, rwaTarget, sourceMode, stableTarget, vault, workspace],
  );

  return (
    <main className="min-h-screen bg-canvas">
      <header className="border-b border-slate-900/[0.06] bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <CaliberMark />
            <span className="text-sm font-semibold text-ink-900">Caliber</span>
          </Link>
          <Link href="/dashboard" className="btn-ghost">
            View testnet workspace
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[240px_1fr_320px]">
        <aside className="panel h-fit p-3">
          {steps.map((s, i) => (
            <button
              key={s}
              onClick={() => setStep(i)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                i === step ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                i === step ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-500'
              }`}>
                {i + 1}
              </span>
              {s}
            </button>
          ))}
        </aside>

        <section className="panel min-h-[560px] p-6 sm:p-8">
          <p className="eyebrow">Treasury onboarding</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tightish text-ink-900">
            {steps[step]}
          </h1>

          <div className="mt-8">
            {step === 0 && (
              <SetupBlock
                title="Create a treasury workspace"
                description="This becomes the operating room for one treasury, its policy, signal sources, and approval workflow."
              >
                <Field label="Workspace name">
                  <input className="input" value={workspace} onChange={(e) => setWorkspace(e.target.value)} />
                </Field>
                <Field label="Treasury owner account">
                  <input
                    className="input"
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                    placeholder="account-hash-..."
                  />
                </Field>
              </SetupBlock>
            )}

            {step === 1 && (
              <SetupBlock
                title="Connect or deploy a vault"
                description="For final-round testnet we connect the deployed CaliberVault. A full product would let teams deploy a new vault from here."
              >
                <Field label="CaliberVault package hash">
                  <input className="input font-mono text-xs" value={vault} onChange={(e) => setVault(e.target.value)} />
                </Field>
                <div className="rounded-xl border border-slate-900/[0.07] bg-slate-50 p-4 text-sm text-slate-600">
                  Network: <span className="font-medium text-ink-900">Casper testnet</span>
                </div>
              </SetupBlock>
            )}

            {step === 2 && (
              <SetupBlock
                title="Set the policy guardrails"
                description="The agent may reason, but these deterministic limits decide what can be approved or executed."
              >
                <Allocation label="RWA target" value={rwaTarget} setValue={setRwaTarget} />
                <Allocation label="Stablecoin buffer" value={stableTarget} setValue={setStableTarget} />
                <Allocation label="Native CSPR" value={nativeTarget} setValue={setNativeTarget} />
                <Allocation label="Max risk score" value={riskLimit} setValue={setRiskLimit} max={100} />
                <p className={`text-sm ${totalAllocation === 100 ? 'text-signal-emerald' : 'text-signal-rose'}`}>
                  Allocation total: {totalAllocation}%
                </p>
              </SetupBlock>
            )}

            {step === 3 && (
              <SetupBlock
                title="Choose signal sources"
                description="Start with the built-in testnet signal feed, or point Caliber at an external feed when the treasury is ready."
              >
                <Segmented
                  value={sourceMode}
                  onChange={setSourceMode}
                  options={[
                    { value: 'operator', label: 'Built-in testnet feed' },
                    { value: 'external', label: 'External feed URL' },
                  ]}
                />
                {sourceMode === 'external' && (
                  <Field label="Signal feed URL">
                    <input
                      className="input"
                      value={feedUrl}
                      onChange={(e) => setFeedUrl(e.target.value)}
                      placeholder="https://..."
                    />
                  </Field>
                )}
              </SetupBlock>
            )}

            {step === 4 && (
              <SetupBlock
                title="Review and activate"
                description="This step turns setup into an operating workspace. Today it opens the live testnet workspace; next we persist this per user."
              >
                <div className="grid gap-3">
                  {summary.map((item) => (
                    <div key={item.label} className="flex justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3 text-sm">
                      <span className="text-slate-500">{item.label}</span>
                      <span className="text-right font-medium text-ink-900">{item.value}</span>
                    </div>
                  ))}
                </div>
                <Link
                  href="/dashboard"
                  className={`btn-primary mt-6 w-full ${ready ? '' : 'pointer-events-none opacity-40'}`}
                >
                  Activate testnet workspace
                </Link>
              </SetupBlock>
            )}
          </div>

          <div className="mt-10 flex items-center justify-between border-t border-slate-900/[0.06] pt-5">
            <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="btn-ghost disabled:opacity-40">
              Back
            </button>
            <button onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))} disabled={step === steps.length - 1} className="btn-primary disabled:opacity-40">
              Continue
            </button>
          </div>
        </section>

        <aside className="panel h-fit p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Workspace preview</p>
          <h2 className="mt-2 text-lg font-semibold text-ink-900">{workspace || 'Treasury workspace'}</h2>
          <div className="mt-5 grid gap-3">
            {summary.map((item) => (
              <div key={item.label}>
                <p className="text-xs text-slate-400">{item.label}</p>
                <p className="mt-0.5 break-words text-sm font-medium text-slate-700">{item.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-slate-600">
            Operator actions remain locked until a treasury operator signs in from the dashboard.
          </div>
        </aside>
      </div>
    </main>
  );
}

function SetupBlock({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-ink-900">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">{description}</p>
      <div className="mt-6 grid gap-5">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function Allocation({
  label,
  value,
  setValue,
  max = 100,
}: {
  label: string;
  value: number;
  setValue: (value: number) => void;
  max?: number;
}) {
  return (
    <label className="grid gap-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="tnum text-slate-500">{value}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={max}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        className="w-full accent-brand-500"
      />
    </label>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <div className="grid gap-2 rounded-xl bg-slate-100 p-1 sm:grid-cols-2">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
            option.value === value ? 'bg-white text-ink-900 shadow-soft' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
