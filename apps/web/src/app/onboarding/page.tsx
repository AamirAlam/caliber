'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { CaliberMark } from '@/components/SiteHeader';
import { api, type FeedStatus } from '@/lib/api';
import { feedFreshness, managedSignalFeedUrl } from '@/lib/signalFeed';
import { activateWorkspace } from '@/lib/workspaces';
import {
  authenticateWallet,
  connectWalletProvider,
  disconnectWallet,
  loadWalletSession,
  subscribeWalletPublicKey,
} from '@/lib/walletClient';
import type { WalletSession } from '@/lib/walletAuth';

const steps = [
  'Workspace',
  'Vault',
  'Policy',
  'Signals',
  'Activate',
] as const;

type SourceMode = 'operator' | 'external';
type PolicyPresetId = 'balanced' | 'income' | 'defensive' | 'custom';

const policyPresets: Array<{
  id: PolicyPresetId;
  label: string;
  description: string;
  rwaTarget: number;
  stableTarget: number;
  nativeTarget: number;
  riskLimit: number;
}> = [
  {
    id: 'balanced',
    label: 'Balanced yield',
    description: 'Keeps RWA exposure active while preserving a meaningful stablecoin buffer.',
    rwaTarget: 60,
    stableTarget: 30,
    nativeTarget: 10,
    riskLimit: 70,
  },
  {
    id: 'income',
    label: 'Income focused',
    description: 'Prioritizes tokenized RWA allocation with tighter reserve capacity.',
    rwaTarget: 70,
    stableTarget: 20,
    nativeTarget: 10,
    riskLimit: 65,
  },
  {
    id: 'defensive',
    label: 'Liquidity first',
    description: 'Keeps a larger stablecoin buffer and lowers the maximum accepted risk score.',
    rwaTarget: 45,
    stableTarget: 45,
    nativeTarget: 10,
    riskLimit: 55,
  },
  {
    id: 'custom',
    label: 'Custom policy',
    description: 'Set treasury allocation and risk limits manually.',
    rwaTarget: 60,
    stableTarget: 30,
    nativeTarget: 10,
    riskLimit: 70,
  },
];

function shortAddress(value: string): string {
  return value.length > 18 ? `${value.slice(0, 10)}...${value.slice(-8)}` : value;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [workspace, setWorkspace] = useState('RWA Income Treasury');
  const [wallet, setWallet] = useState<WalletSession | null>(null);
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [manualAddress, setManualAddress] = useState('');
  const [walletPermissionConfirmed, setWalletPermissionConfirmed] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [vault, setVault] = useState('5dd0bfde53bf885dc64b7009d4c02030aced4c8525ff7a1f3c0735d238142ce0');
  const [stableTarget, setStableTarget] = useState(30);
  const [rwaTarget, setRwaTarget] = useState(60);
  const [nativeTarget, setNativeTarget] = useState(10);
  const [riskLimit, setRiskLimit] = useState(70);
  const [policyPreset, setPolicyPreset] = useState<PolicyPresetId>('balanced');
  const sourceMode: SourceMode = 'operator';
  const [feedStatus, setFeedStatus] = useState<FeedStatus | null>(null);
  const [activating, setActivating] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);

  const selectedPolicyPresetLabel =
    policyPresets.find((preset) => preset.id === policyPreset)?.label ?? 'Balanced yield';
  const totalAllocation = stableTarget + rwaTarget + nativeTarget;
  const workspaceReady = workspace.trim().length > 2;
  const vaultReady = vault.trim().length > 12;
  const allocationReady = totalAllocation === 100;
  const signalReady = sourceMode === 'operator';
  const managedFeedUrl = managedSignalFeedUrl();
  const managedFeedFreshness = feedFreshness(feedStatus?.capturedAt ?? undefined);
  const ready = Boolean(wallet) && workspaceReady && vaultReady && allocationReady && signalReady;
  const summary = useMemo(
    () => [
      { label: 'Workspace', value: workspace || 'Unnamed treasury' },
      { label: 'Owner wallet', value: wallet ? shortAddress(wallet.accountHash) : connectedAddress ? shortAddress(connectedAddress) : 'Not connected' },
      { label: 'Policy mode', value: selectedPolicyPresetLabel },
      { label: 'Vault', value: vault ? `${vault.slice(0, 10)}...${vault.slice(-8)}` : 'Not connected' },
      { label: 'Policy', value: `${rwaTarget}% RWA / ${stableTarget}% stable / ${nativeTarget}% native` },
      { label: 'Risk ceiling', value: `${riskLimit}/100` },
      { label: 'Signal source', value: sourceMode === 'operator' ? 'Self managed feed' : 'External feed coming soon' },
      { label: 'Feed URL', value: sourceMode === 'operator' ? managedFeedUrl : 'Coming soon' },
      { label: 'Agent status', value: 'Stopped until started from dashboard' },
    ],
    [connectedAddress, managedFeedUrl, nativeTarget, riskLimit, rwaTarget, selectedPolicyPresetLabel, sourceMode, stableTarget, vault, wallet, workspace],
  );

  const onActivateWorkspace = async () => {
    if (!ready) return;
    setActivating(true);
    setActivationError(null);
    const payload = {
      name: workspace.trim(),
      ownerAccount: wallet!.accountHash,
      vaultContractHash: vault.trim(),
      network: 'casper-test',
      policy: {
        rwaTarget,
        stableTarget,
        nativeTarget,
        maxRiskScore: riskLimit,
      },
      signals: {
        mode: sourceMode,
        feedUrl: sourceMode === 'operator' ? managedFeedUrl : '',
      },
    } as const;

    try {
      const created = await api.createWorkspace(payload);
      activateWorkspace(created);
      router.push(`/dashboard?workspace=${encodeURIComponent(created.id)}`);
    } catch (error) {
      setActivationError(`Workspace could not be created: ${String(error)}`);
    } finally {
      setActivating(false);
    }
  };

  useEffect(() => {
    const unsubscribe = subscribeWalletPublicKey((publicKey) => {
      setConnectedAddress(publicKey);
      setWalletPermissionConfirmed(true);
      setWalletError(null);
    });
    void loadWalletSession()
      .then((session) => {
        setWallet(session);
        setConnectedAddress(session?.accountHash ?? null);
        setWalletPermissionConfirmed(Boolean(session));
      })
      .catch(() => setWallet(null));
    return unsubscribe;
  }, []);

  useEffect(() => {
    void api.getFeedStatus().then(setFeedStatus);
    const interval = setInterval(() => {
      void api.getFeedStatus().then(setFeedStatus);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const onConnectWallet = async () => {
    setWalletError(null);
    try {
      const publicKey = connectedAddress ?? manualAddress.trim();
      if (publicKey) {
        setConnectedAddress(publicKey);
        setWallet(await authenticateWallet(publicKey));
        return;
      }
      const connectedPublicKey = await connectWalletProvider();
      setWalletPermissionConfirmed(true);
      if (!connectedPublicKey) {
        setWalletError('Wallet is connected, but the extension did not expose an active public key. Unlock the wallet and try again, or paste the wallet public key to continue.');
        return;
      }
      setConnectedAddress(connectedPublicKey);
      setWallet(await authenticateWallet(connectedPublicKey));
    } catch (error) {
      setWalletPermissionConfirmed(true);
      setWalletError(String(error));
    }
  };

  const onDisconnectWallet = async () => {
    await disconnectWallet();
    setWallet(null);
    setConnectedAddress(null);
    setManualAddress('');
    setWalletPermissionConfirmed(false);
  };

  const onSelectPolicyPreset = (presetId: PolicyPresetId) => {
    const preset = policyPresets.find((item) => item.id === presetId);
    if (!preset) return;
    setPolicyPreset(preset.id);
    if (preset.id === 'custom') return;
    setRwaTarget(preset.rwaTarget);
    setStableTarget(preset.stableTarget);
    setNativeTarget(preset.nativeTarget);
    setRiskLimit(preset.riskLimit);
  };

  const setCustomRwaTarget = (value: number) => {
    setPolicyPreset('custom');
    setRwaTarget(value);
  };

  const setCustomStableTarget = (value: number) => {
    setPolicyPreset('custom');
    setStableTarget(value);
  };

  const setCustomNativeTarget = (value: number) => {
    setPolicyPreset('custom');
    setNativeTarget(value);
  };

  const setCustomRiskLimit = (value: number) => {
    setPolicyPreset('custom');
    setRiskLimit(value);
  };

  const walletHasPublicKeyInput = Boolean(connectedAddress || manualAddress.trim());

  return (
    <main className="min-h-screen bg-canvas">
      <header className="border-b border-slate-900/[0.06] bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <CaliberMark />
            <span className="text-sm font-semibold text-ink-900">Caliber</span>
          </Link>
          <div className="flex items-center gap-3">
            {(wallet || connectedAddress) && (
              <span className="pill border-signal-emerald/30 bg-emerald-50 font-mono text-signal-emerald">
                {shortAddress(wallet?.accountHash ?? connectedAddress!)}
              </span>
            )}
            <Link href="/dashboard" className="btn-ghost">
              Open dashboard
            </Link>
          </div>
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
                description="This becomes the operating room for one treasury, its policy, signal sources, and approval workflow. You will connect the owner wallet before activation."
              >
                <Field label="Workspace name">
                  <input className="input" value={workspace} onChange={(e) => setWorkspace(e.target.value)} />
                </Field>
              </SetupBlock>
            )}

            {step === 1 && (
              <SetupBlock
                title="Connect or deploy a vault"
                description="Connect a CaliberVault on Casper testnet. Agent runs and approvals will be scoped to this vault and workspace policy."
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
                description="Choose a treasury policy profile, or customize the deterministic limits that decide what can be approved or executed."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  {policyPresets.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => onSelectPolicyPreset(preset.id)}
                      className={`rounded-xl border p-4 text-left transition ${
                        policyPreset === preset.id
                          ? 'border-brand-500 bg-brand-50 text-ink-900'
                          : 'border-slate-900/[0.07] bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <span className="block text-sm font-semibold">{preset.label}</span>
                      <span className="mt-1 block text-xs leading-relaxed text-slate-500">{preset.description}</span>
                      <span className="mt-3 block font-mono text-xs text-slate-500">
                        {preset.rwaTarget}% RWA / {preset.stableTarget}% stable / {preset.nativeTarget}% CSPR / risk {preset.riskLimit}
                      </span>
                    </button>
                  ))}
                </div>
                <Allocation label="RWA target" value={rwaTarget} setValue={setCustomRwaTarget} />
                <Allocation label="Stablecoin buffer" value={stableTarget} setValue={setCustomStableTarget} />
                <Allocation label="Native CSPR" value={nativeTarget} setValue={setCustomNativeTarget} />
                <Allocation label="Max risk score" value={riskLimit} setValue={setCustomRiskLimit} max={100} />
                <p className={`text-sm ${totalAllocation === 100 ? 'text-signal-emerald' : 'text-signal-rose'}`}>
                  Allocation total: {totalAllocation}%
                </p>
              </SetupBlock>
            )}

            {step === 3 && (
              <SetupBlock
                title="Choose signal sources"
                description="This treasury uses the self managed feed running on the Caliber backend, augmented with live on-chain balance and CSPR price signals when configured."
              >
                {sourceMode === 'operator' && (
                  <div className="rounded-xl border border-slate-900/[0.07] bg-slate-50 p-4">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${managedFeedFreshness.active ? 'bg-signal-emerald' : 'bg-slate-300'}`} />
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {managedFeedFreshness.status}
                      </p>
                    </div>
                    <a
                      href={managedFeedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block break-all font-mono text-sm font-medium text-brand-600 hover:text-brand-700"
                    >
                      {managedFeedUrl}
                    </a>
                    <p className="mt-2 text-xs text-slate-500">{managedFeedFreshness.label}</p>
                  </div>
                )}
              </SetupBlock>
            )}

            {step === 4 && (
              <SetupBlock
                title="Review and create"
                description="Connect the owner wallet, then create the operating workspace on the services backend. Agents start stopped by default and can be started from the dashboard."
              >
                <div className="grid gap-3">
                  {summary.map((item) => (
                    <div key={item.label} className="flex justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3 text-sm">
                      <span className="text-slate-500">{item.label}</span>
                      <span className="text-right font-medium text-ink-900">{item.value}</span>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl border border-slate-900/[0.07] bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Treasury owner wallet
                      </p>
                      <p className="mt-1 break-all font-mono text-sm text-ink-900">
                        {wallet?.accountHash ??
                          connectedAddress ??
                          (walletPermissionConfirmed ? 'Wallet connected - public key required' : 'No wallet connected')}
                      </p>
                      {(wallet || connectedAddress || walletPermissionConfirmed) && (
                        <p className={`mt-1 text-xs ${wallet || connectedAddress ? 'text-signal-emerald' : 'text-signal-amber'}`}>
                          {wallet
                            ? 'Authenticated and ready to own this treasury workspace.'
                            : connectedAddress
                              ? 'Wallet address detected. Continue to create the treasury session.'
                              : 'Wallet permission is confirmed. Paste the wallet public key below to continue.'}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={wallet ? onDisconnectWallet : onConnectWallet}
                      disabled={!wallet && walletPermissionConfirmed && !walletHasPublicKeyInput}
                      className="btn-ghost w-full disabled:opacity-40 sm:w-auto"
                    >
                      {wallet
                        ? 'Disconnect wallet'
                        : connectedAddress
                          ? 'Authenticate wallet'
                          : walletPermissionConfirmed
                            ? 'Use pasted public key'
                            : 'Connect wallet'}
                    </button>
                  </div>
                  {walletPermissionConfirmed && !connectedAddress && !wallet && (
                    <input
                      className="input mt-3 font-mono text-xs"
                      value={manualAddress}
                      onChange={(event) => setManualAddress(event.target.value)}
                      placeholder="Public key, e.g. 01..."
                    />
                  )}
                  {walletError && <p className="mt-2 text-sm text-signal-rose">{walletError}</p>}
                </div>
                <button
                  onClick={onActivateWorkspace}
                  disabled={!ready || activating}
                  className="btn-primary mt-6 w-full disabled:opacity-40"
                >
                  {activating ? 'Creating...' : 'Create workspace'}
                </button>
                {!ready && <ActivationChecklist
                  walletReady={Boolean(wallet)}
                  workspaceReady={workspaceReady}
                  vaultReady={vaultReady}
                  allocationReady={allocationReady}
                  signalReady={signalReady}
                />}
                {activationError && <p className="mt-2 text-sm text-signal-amber">{activationError}</p>}
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
            Agent runs and approvals are locked to the connected treasury owner wallet.
          </div>
        </aside>
      </div>
    </main>
  );
}

function ActivationChecklist({
  walletReady,
  workspaceReady,
  vaultReady,
  allocationReady,
  signalReady,
}: {
  walletReady: boolean;
  workspaceReady: boolean;
  vaultReady: boolean;
  allocationReady: boolean;
  signalReady: boolean;
}) {
  const items = [
    { label: 'Authenticate treasury owner wallet', ok: walletReady },
    { label: 'Name the workspace', ok: workspaceReady },
    { label: 'Connect a vault package hash', ok: vaultReady },
    { label: 'Set allocations to 100%', ok: allocationReady },
    { label: 'Use the self managed signal feed', ok: signalReady },
  ];
  return (
    <div className="mt-4 grid gap-2 rounded-xl border border-slate-900/[0.07] bg-slate-50 p-3 text-sm">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${item.ok ? 'bg-signal-emerald' : 'bg-slate-300'}`} />
          <span className={item.ok ? 'text-slate-500' : 'text-slate-700'}>{item.label}</span>
        </div>
      ))}
    </div>
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

