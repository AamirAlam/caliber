'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AGENT_ROLES } from '@caliber/shared';
import type { AgentRunLog, Recommendation, RiskScore, SignalSnapshot, TraceStep, TreasuryPolicy } from '@caliber/shared';
import { api, type FeedStatus, type RunDetail, type VaultState } from '@/lib/api';
import { PageLoader, Spinner } from '@/components/Spinner';
import { MaintenanceMode } from '@/components/MaintenanceMode';
import { feedFreshness, managedSignalFeedUrl } from '@/lib/signalFeed';
import { activateWorkspace, getWorkspace, saveWorkspaces, type TreasuryWorkspace } from '@/lib/workspaces';
import {
  authenticateWallet,
  connectWalletProvider,
  disconnectWallet,
  hasWalletProvider,
  loadWalletSession,
  signApproval,
  subscribeWalletPublicKey,
} from '@/lib/walletClient';
import type { WalletSession } from '@/lib/walletAuth';

const EXPLORER = process.env.NEXT_PUBLIC_EXPLORER_BASE ?? 'https://testnet.cspr.live';
/** Fallback FUM (USD) shown when the feed carries no live `treasury.total.usd` signal. */
const NOTIONAL_FUNDS_UNDER_MANAGEMENT_USD = 1_200_000;
/** Mirrors the backend's CALIBER_WORKSPACE_RUN_INTERVAL_MS default. */
const WORKSPACE_RUN_INTERVAL_MS = 10 * 60 * 1000;
const HISTORY_PAGE_SIZE = 6;

/** Mirrors the backend's riskBand thresholds so the gauge color matches the shown score. */
function riskBand(score: number): RiskScore['band'] {
  if (score < 25) return 'low';
  if (score < 50) return 'moderate';
  if (score < 75) return 'elevated';
  return 'critical';
}

const BANDS = {
  low: { label: 'Low', color: '#059669', tint: 'text-signal-emerald' },
  moderate: { label: 'Moderate', color: '#3657d5', tint: 'text-brand-600' },
  elevated: { label: 'Elevated', color: '#d97706', tint: 'text-signal-amber' },
  critical: { label: 'Critical', color: '#e11d48', tint: 'text-signal-rose' },
} as const;

export default function DashboardPage() {
  // useSearchParams requires a Suspense boundary during prerender.
  return (
    <Suspense fallback={<PageLoader />}>
      <DashboardPageInner />
    </Suspense>
  );
}

function DashboardPageInner() {
  const searchParams = useSearchParams();
  const workspaceParam = searchParams.get('workspace');
  const [policy, setPolicy] = useState<TreasuryPolicy | null>(null);
  const [workspace, setWorkspace] = useState<TreasuryWorkspace | null>(null);
  const [workspaceResolved, setWorkspaceResolved] = useState(false);
  const [snapshot, setSnapshot] = useState<SignalSnapshot | null>(null);
  const [risk, setRisk] = useState<RiskScore | null>(null);
  const [vault, setVault] = useState<VaultState | null>(null);
  const [feedStatus, setFeedStatus] = useState<FeedStatus | null>(null);
  const [workspaceRuns, setWorkspaceRuns] = useState<AgentRunLog[]>([]);
  const [workspaceRecommendation, setWorkspaceRecommendation] = useState<Recommendation | null>(null);
  const [deployHash, setDeployHash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(true);
  const [showReasoning, setShowReasoning] = useState(false);
  const [wallet, setWallet] = useState<WalletSession | null>(null);
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [manualAddress, setManualAddress] = useState('');
  const [walletPermissionConfirmed, setWalletPermissionConfirmed] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [agentStatusBusy, setAgentStatusBusy] = useState(false);
  const [policyDraft, setPolicyDraft] = useState<{
    rwaTarget: number;
    stableTarget: number;
    nativeTarget: number;
    maxRiskScore: number;
  } | null>(null);
  const [policyBusy, setPolicyBusy] = useState(false);
  const [policyError, setPolicyError] = useState<string | null>(null);
  const [showRunHistory, setShowRunHistory] = useState(false);
  const [historyOpenId, setHistoryOpenId] = useState<string | null>(null);
  const [historyDetail, setHistoryDetail] = useState<RunDetail | null>(null);

  const refresh = useCallback(async () => {
    const [p, s, r, v] = await Promise.all([
      api.getPolicy(),
      api.getLatestSignals(),
      api.getLatestRisk(),
      api.getVaultState(),
    ]);
    if (p === null) {
      setLive(false);
      setError('The services API is unavailable or not configured.');
      setPolicy(null);
      setSnapshot(null);
      setRisk(null);
      setVault(null);
      return;
    }
    setLive(true);
    setError(null);
    setPolicy(p);
    if (s) setSnapshot(s);
    if (r) setRisk(r);
    if (v) setVault(v);
  }, []);

  useEffect(() => {
    if (!workspace?.id) return;
    let cancelled = false;
    const refreshWorkspaceActivity = async () => {
      const runs = (await api.getRuns(workspace.id)) ?? [];
      if (cancelled) return;
      setWorkspaceRuns(runs);
      const latest = runs[0];
      if (!latest) {
        setWorkspaceRecommendation(null);
        return;
      }
      const detail = await api.getRun(latest.id);
      if (!cancelled) setWorkspaceRecommendation(detail?.recommendation ?? null);
    };
    void refreshWorkspaceActivity();
    const interval = setInterval(() => void refreshWorkspaceActivity(), 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [workspace?.id]);

  useEffect(() => {
    const unsubscribeWallet = subscribeWalletPublicKey((publicKey) => {
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
    void refresh();
    void api.getFeedStatus().then(setFeedStatus);
    const t = setInterval(() => void refresh(), 4000);
    const feedStatusInterval = setInterval(() => {
      void api.getFeedStatus().then(setFeedStatus);
    }, 15000);
    return () => {
      unsubscribeWallet();
      clearInterval(t);
      clearInterval(feedStatusInterval);
    };
  }, [refresh]);

  // Re-resolve whenever the ?workspace= param changes (treasury switcher uses
  // client-side navigation, so the page never remounts).
  useEffect(() => {
    let cancelled = false;
    const localWorkspace = getWorkspace(workspaceParam);
    setWorkspace(localWorkspace);
    setWorkspaceResolved(Boolean(localWorkspace) || !workspaceParam);
    // Clear per-treasury state so the previous treasury's data never bleeds over.
    setWorkspaceRuns([]);
    setWorkspaceRecommendation(null);
    setDeployHash(null);
    setHistoryOpenId(null);
    setHistoryDetail(null);
    setPolicyDraft(null);
    setPolicyError(null);
    setError(null);
    if (workspaceParam && !localWorkspace) {
      void api.getWorkspace(workspaceParam).then((remoteWorkspace) => {
        if (cancelled) return;
        if (remoteWorkspace) {
          activateWorkspace(remoteWorkspace);
          setWorkspace(remoteWorkspace);
        }
        setWorkspaceResolved(true);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [workspaceParam]);

  const ownerAccount = wallet?.accountHash ?? connectedAddress;

  useEffect(() => {
    if (!ownerAccount) return;
    void api.getWorkspaces(ownerAccount).then((remoteWorkspaces) => {
      if (!remoteWorkspaces) return;
      saveWorkspaces(remoteWorkspaces);
      const currentWorkspaceIsOwned = workspace?.ownerAccount === ownerAccount;
      const nextWorkspace = currentWorkspaceIsOwned && workspace?.id
        ? remoteWorkspaces.find((item) => item.id === workspace.id) ?? null
        : remoteWorkspaces[0] ?? null;
      if (nextWorkspace) {
        activateWorkspace(nextWorkspace);
        setWorkspace(nextWorkspace);
      } else {
        setWorkspace(null);
      }
      setWorkspaceResolved(true);
    });
  }, [ownerAccount, workspace?.id, workspace?.ownerAccount]);

  const onConnectWallet = async () => {
    setWalletError(null);
    try {
      const publicKey = connectedAddress ?? manualAddress.trim();
      if (publicKey) {
        setConnectedAddress(publicKey);
        setWallet(await authenticateWallet(publicKey, { trySign: publicKey === connectedAddress }));
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

  const onUseManualAddress = async () => {
    const publicKey = manualAddress.trim();
    if (!publicKey) return;
    setWalletError(null);
    try {
      setConnectedAddress(publicKey);
      setWallet(await authenticateWallet(publicKey, { trySign: false }));
    } catch (error) {
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

  const onSetAgentStatus = async (status: 'active' | 'stopped') => {
    if (!workspace || !ownerAccount) return;
    setAgentStatusBusy(true);
    setError(null);
    try {
      const updated = await api.setWorkspaceAgentStatus(workspace.id, status, ownerAccount);
      activateWorkspace(updated);
      setWorkspace(updated);
    } catch (e) {
      setError(String(e));
    } finally {
      setAgentStatusBusy(false);
    }
  };

  const onApprove = async () => {
    const runId = workspaceRecommendation?.action === 'rebalance' ? workspaceRecommendation.runId : null;
    if (!runId || !workspace || !wallet) return;
    setBusy(true);
    setError(null);
    try {
      const approval = await signApproval(runId, workspace.id, wallet);
      const res = await api.approve(runId, workspace.id, approval);
      setDeployHash(res.tx.deployHash ?? null);
      const [, runsRes] = await Promise.all([refresh(), api.getRuns(workspace.id)]);
      const runs = runsRes ?? [];
      setWorkspaceRuns(runs);
      const latest = runs[0];
      const detail = latest ? await api.getRun(latest.id) : null;
      setWorkspaceRecommendation(detail?.recommendation ?? null);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const onSavePolicy = async () => {
    if (!workspace || !policyDraft || !ownerAccount) return;
    setPolicyBusy(true);
    setPolicyError(null);
    try {
      const updated = await api.updateWorkspacePolicy(workspace.id, policyDraft, ownerAccount);
      activateWorkspace(updated);
      setWorkspace(updated);
      setPolicyDraft(null);
    } catch (e) {
      setPolicyError(String(e));
    } finally {
      setPolicyBusy(false);
    }
  };

  const onToggleRunHistory = async (runId: string) => {
    if (historyOpenId === runId) {
      setHistoryOpenId(null);
      return;
    }
    setHistoryOpenId(runId);
    setHistoryDetail(null);
    if (live) setHistoryDetail(await api.getRun(runId));
  };

  if (!policy) {
    if (error) {
      return (
        <MaintenanceMode
          detail={`${error} Live treasury controls are paused until the backend is configured and healthy.`}
        />
      );
    }
    return <PageLoader />;
  }

  if (!workspaceResolved) return <PageLoader />;
  if (!ownerAccount) {
    return (
      <TreasuryAccessEmptyState
        walletError={walletError}
        onConnectWallet={onConnectWallet}
        hasWalletProvider={hasWalletProvider()}
        manualAddress={manualAddress}
        onManualAddressChange={setManualAddress}
        onUseManualAddress={onUseManualAddress}
      />
    );
  }
  if (!workspace) {
    return (
      <TreasuryWorkspaceEmptyState ownerAccount={ownerAccount} onDisconnectWallet={onDisconnectWallet} />
    );
  }

  const walletOwnsWorkspace = workspace.ownerAccount === ownerAccount;
  const agentActive = workspace.agentStatus === 'active';
  const lastRunAt = workspaceRuns[0] ? Date.parse(workspaceRuns[0].startedAt) : null;
  const nextRunInMin = lastRunAt
    ? Math.max(0, Math.ceil((lastRunAt + WORKSPACE_RUN_INTERVAL_MS - Date.now()) / 60_000))
    : null;
  const latestWorkspaceRun = workspaceRuns[0] ?? null;
  const currentDecision = workspaceRecommendation;
  const hasWorkspaceAnalysis = Boolean(latestWorkspaceRun);
  const canApprove = live && Boolean(walletOwnsWorkspace) && currentDecision?.action === 'rebalance';
  const headline =
    currentDecision?.action === 'rebalance'
      ? 'Rebalance recommended'
      : currentDecision?.action === 'halt'
        ? 'Halted — review required'
        : 'Holding — within policy';

  const workspaceTitle = workspace.name;
  const workspacePolicy = `${workspace.policy.rwaTarget}% RWA / ${workspace.policy.stableTarget}% stable / ${workspace.policy.nativeTarget}% CSPR`;
  const walletHasPublicKeyInput = Boolean(connectedAddress || manualAddress.trim());
  const workspaceSignalFeedUrl =
    workspace.signals.mode === 'operator' ? managedSignalFeedUrl() : workspace.signals.feedUrl || 'External feed';
  const signalFreshness = feedFreshness(feedStatus?.capturedAt ?? snapshot?.capturedAt);
  const liveTreasuryUsd = snapshot?.signals?.find((s) => s.key === 'treasury.total.usd')?.value;
  const latestRunStarted = latestWorkspaceRun ? new Date(latestWorkspaceRun.startedAt).toLocaleString() : null;
  const walletStatusLabel = wallet
    ? walletOwnsWorkspace
      ? 'Owner wallet connected'
      : 'Wallet connected'
    : walletPermissionConfirmed
      ? 'Wallet permission confirmed'
      : 'Read-only';
  const walletStatusDetail = wallet
    ? walletOwnsWorkspace
      ? 'Review agent decisions and approve on-chain actions for this treasury.'
      : 'Connected wallet does not own this treasury.'
    : connectedAddress
      ? 'Wallet address detected. Create the dashboard session.'
      : walletPermissionConfirmed
        ? 'Paste the public key to continue.'
        : 'Connect the owner wallet to operate this workspace.';
  const operatingState = [
    { label: 'Workspace', value: 'Active', active: true },
    { label: 'Policy', value: `${workspace.policy.maxRiskScore}/100 risk`, active: true },
    { label: 'Feed', value: signalFreshness.status, active: signalFreshness.active },
    { label: 'Agent', value: agentActive ? 'Monitoring policy' : 'Stopped', active: agentActive },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 pb-28 sm:px-6 sm:py-8 lg:px-8 lg:py-10 lg:pb-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="eyebrow">Treasury control plane</p>
          <h1 className="mt-1.5 text-[1.8rem] font-semibold tracking-tightish text-ink-900">
            {workspaceTitle}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Policy-governed treasury monitoring on Casper testnet.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span
            className={`pill ${live ? 'border-signal-emerald/30 bg-emerald-50 text-signal-emerald' : 'border-slate-200 bg-slate-50 text-slate-500'}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-signal-emerald' : 'bg-slate-400'}`} />
            {live ? 'Live · testnet' : 'Offline'}
          </span>
          <span className="pill border-slate-200 bg-white text-slate-500">{walletStatusLabel}</span>
        </div>
      </header>

      <section className="mt-5 rounded-xl border border-slate-900/[0.07] bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink-900">{walletStatusLabel}</p>
            <p className="mt-0.5 text-sm text-slate-500">{walletStatusDetail}</p>
            {connectedAddress && (
              <p className="mt-1 break-all font-mono text-xs text-slate-500">
                {connectedAddress}
              </p>
            )}
            {walletPermissionConfirmed && !connectedAddress && !wallet && (
              <input
                className="input mt-3 font-mono text-xs"
                value={manualAddress}
                onChange={(event) => setManualAddress(event.target.value)}
                placeholder="Public key, e.g. 01..."
              />
            )}
          </div>
          {wallet ? (
            <button onClick={onDisconnectWallet} className="btn-ghost w-full sm:w-auto">
              Disconnect wallet
            </button>
          ) : (
            <button
              onClick={onConnectWallet}
              disabled={walletPermissionConfirmed && !walletHasPublicKeyInput}
              className="btn-ghost w-full disabled:opacity-40 sm:w-auto"
            >
              {connectedAddress
                ? 'Authenticate wallet'
                : walletPermissionConfirmed
                  ? 'Use pasted public key'
                  : 'Connect wallet'}
            </button>
          )}
        </div>
        {walletError && <p className="mt-2 text-sm text-signal-rose">{walletError}</p>}
        {!hasWalletProvider() && (
          <p className="mt-2 text-xs text-slate-500">
            Install or unlock a Casper wallet extension to operate this treasury.
          </p>
        )}
      </section>

      <section className="mt-5 rounded-2xl border border-slate-900/[0.07] bg-white px-4 py-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-4">
          {operatingState.map((item, index) => (
            <div key={item.label} className="relative min-w-0 rounded-xl bg-slate-50 px-3 py-3">
              {index < operatingState.length - 1 && (
                <span className="absolute right-[-0.55rem] top-1/2 z-10 hidden h-px w-4 bg-slate-200 sm:block" />
              )}
              <div className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                    item.active ? 'bg-signal-emerald shadow-[0_0_0_4px_rgba(5,150,105,0.12)]' : 'bg-slate-300'
                  }`}
                />
                <p className="truncate text-sm font-semibold text-ink-900">{item.label}</p>
              </div>
              <p className="mt-1 truncate pl-4 text-xs text-slate-500">{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardStat
          label="Funds under management"
          value={formatUsd(liveTreasuryUsd ?? NOTIONAL_FUNDS_UNDER_MANAGEMENT_USD)}
          detail={liveTreasuryUsd !== undefined ? 'On-chain balance × live CSPR price' : 'Policy notional (demo)'}
        />
        <DashboardStat label="Policy mix" value={workspacePolicy} detail={`Risk ceiling ${workspace.policy.maxRiskScore}/100`} />
        <DashboardStat
          label="Feed"
          value={workspace.signals.mode === 'operator' ? 'Self managed' : 'External'}
          status={{
            label: signalFreshness.status,
            tone: signalFreshness.active ? 'active' : 'inactive',
          }}
          detail={signalFreshness.label}
        />
        <DashboardStat label="Vault activity" value={`${vault?.rebalanceCount ?? 0} rebalances`} detail="Read from Casper" />
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-5">
          <section className="panel overflow-hidden">
            <div className="border-b border-slate-900/[0.06] bg-slate-50/60 px-5 py-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-ink-900">Agent analysis</p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`pill ${hasWorkspaceAnalysis ? 'border-brand-200 bg-brand-50 text-brand-600' : 'border-slate-200 bg-white text-slate-500'}`}>
                    {hasWorkspaceAnalysis ? 'Analyzed' : 'Not analyzed'}
                  </span>
                  <button
                    onClick={() => setShowRunHistory((value) => !value)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-brand-200 hover:text-brand-600"
                    aria-expanded={showRunHistory}
                  >
                    {showRunHistory ? 'Hide run history' : 'Run history'}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="p-5 sm:pr-0">
                <h2 className="text-xl font-semibold text-ink-900">
                  {hasWorkspaceAnalysis ? headline : 'Waiting for first analysis'}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
                  {currentDecision
                    ? currentDecision.explanation
                    : agentActive
                      ? 'Caliber will show the latest agent decision here after the backend completes an analysis run for this workspace.'
                      : 'Agent monitoring is stopped. Start agents when you want the backend to monitor this workspace every 10 minutes.'}
                </p>
              </div>
              <div className="px-5 pb-5 sm:p-5 sm:pl-0">
                {currentDecision ? (
                  <RiskGauge score={currentDecision.riskScore} band={riskBand(currentDecision.riskScore)} />
                ) : (
                  <EmptyRunMark />
                )}
              </div>
            </div>

            <div className="grid gap-3 px-5 pb-5 sm:grid-cols-3">
              <PolicyMetric label="Run status" value={latestWorkspaceRun?.status ?? 'Not run'} />
              <PolicyMetric label="Decision" value={currentDecision?.action ?? 'None'} />
              <PolicyMetric label="Last run" value={latestRunStarted ?? 'Pending'} />
            </div>

            {currentDecision && (
              <div className="border-t border-slate-900/[0.06] px-5 py-4">
                <button onClick={() => setShowReasoning((v) => !v)} className="disclosure-btn">
                  {showReasoning ? 'Hide analysis trace' : 'View analysis trace'}
                  <Chevron open={showReasoning} />
                </button>
                {showReasoning && (
                  <div className="disclosure-panel mt-4 grid gap-5 sm:grid-cols-2">
                    <div>
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Risk factors
                      </p>
                      <div className="space-y-2.5">
                        {(risk?.factors ?? []).map((f) => (
                          <div key={f.key}>
                            <div className="flex justify-between text-xs text-slate-500">
                              <span>{f.label}</span>
                              <span className="tnum">{f.contribution}</span>
                            </div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-brand-500"
                                style={{ width: `${Math.min(100, f.contribution)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Agent review
                      </p>
                      <div className="grid gap-2.5">
                        <DeliberationStep
                          role={AGENT_ROLES.proposer.name}
                          ok
                          note={
                            currentDecision.agentProposed
                              ? 'Designed the move and tested it against policy.'
                              : 'Deterministic engine produced the decision.'
                          }
                        />
                        <DeliberationStep
                          role={AGENT_ROLES.reviewer.name}
                          ok={currentDecision.review ? currentDecision.review.approved : true}
                          note={
                            currentDecision.review
                              ? `${currentDecision.review.approved ? 'Approved' : 'Vetoed'} · ${currentDecision.review.severity} — ${currentDecision.review.concern}`
                              : currentDecision.action === 'rebalance'
                                ? 'Signed off on the rebalance.'
                                : 'No rebalance to review.'
                          }
                        />
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Decision trace
                      </p>
                      {currentDecision.trace.length > 0 ? (
                        <TraceTimeline trace={currentDecision.trace} />
                      ) : (
                        <p className="text-sm text-slate-500">No trace entries recorded for this run.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="panel p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="eyebrow">Policy</p>
                <h2 className="mt-2 text-lg font-semibold text-ink-900">Allocation guardrails</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  The agent can recommend actions, but execution is constrained by these policy limits.
                </p>
                <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                  <div className="min-w-0 rounded-lg bg-slate-50 px-3 py-2">
                    <p className="font-semibold uppercase tracking-wide text-slate-400">Vault</p>
                    <p className="mt-1 truncate font-mono">{workspace.vaultAddress}</p>
                  </div>
                  <div className="min-w-0 rounded-lg bg-slate-50 px-3 py-2">
                    <p className="font-semibold uppercase tracking-wide text-slate-400">Owner</p>
                    <p className="mt-1 truncate font-mono">{workspace.ownerAccount}</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="rounded-lg bg-slate-50 px-3 py-2 text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Single move cap</p>
                  <p className="tnum mt-0.5 text-lg font-semibold text-ink-900">
                    {(policy.constraints.maxSingleRebalancePct * 100).toFixed(0)}%
                  </p>
                </div>
                {walletOwnsWorkspace && !policyDraft && (
                  <button
                    onClick={() => setPolicyDraft({ ...workspace.policy })}
                    className="btn-ghost text-sm"
                  >
                    Edit guardrails
                  </button>
                )}
              </div>
            </div>
            {policyDraft ? (
              <div className="mt-5 grid gap-3">
                {(
                  [
                    ['RWA target', 'rwaTarget'],
                    ['Stable buffer', 'stableTarget'],
                    ['Native CSPR', 'nativeTarget'],
                    ['Risk ceiling', 'maxRiskScore'],
                  ] as const
                ).map(([label, key]) => (
                  <label key={key} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                    <span className="font-medium text-ink-900">{label}</span>
                    <span className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={policyDraft[key]}
                        onChange={(e) => setPolicyDraft({ ...policyDraft, [key]: Number(e.target.value) })}
                        className="w-20 rounded-lg border border-slate-900/[0.1] bg-white px-2 py-1 text-right tnum"
                      />
                      <span className="text-xs text-slate-500">{key === 'maxRiskScore' ? '/100' : '%'}</span>
                    </span>
                  </label>
                ))}
                {(() => {
                  const total = policyDraft.rwaTarget + policyDraft.stableTarget + policyDraft.nativeTarget;
                  const valid = total === 100;
                  return (
                    <>
                      <p className={`text-xs font-medium ${valid ? 'text-signal-emerald' : 'text-signal-rose'}`}>
                        Allocations total {total}%{valid ? '' : ' — must equal 100%'}
                      </p>
                      {policyError && (
                        <p className="rounded-lg border border-signal-rose/20 bg-rose-50 px-3 py-2 text-sm text-signal-rose">
                          {policyError}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => void onSavePolicy()}
                          disabled={!valid || policyBusy}
                          className="btn-primary flex-1 disabled:opacity-40"
                        >
                          {policyBusy ? 'Saving…' : 'Save guardrails'}
                        </button>
                        <button
                          onClick={() => {
                            setPolicyDraft(null);
                            setPolicyError(null);
                          }}
                          disabled={policyBusy}
                          className="btn-ghost flex-1 disabled:opacity-40"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="mt-5 grid gap-3">
                <AllocationGuardrail label="RWA target" value={workspace.policy.rwaTarget} />
                <AllocationGuardrail label="Stable buffer" value={workspace.policy.stableTarget} />
                <AllocationGuardrail label="Native CSPR" value={workspace.policy.nativeTarget} />
              </div>
            )}
          </section>
        </div>

        <aside className="grid h-fit gap-5">
          <section className={`rounded-2xl border p-5 shadow-card ${
            canApprove ? 'border-signal-emerald/25 bg-emerald-50' : 'border-slate-900/[0.07] bg-white'
          }`}>
            <p className="eyebrow">Action</p>
            <h2 className="mt-2 text-lg font-semibold text-ink-900">
              {currentDecision ? headline : 'No action pending'}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {!agentActive
                ? 'Agents are stopped for this workspace. Start monitoring when this treasury should be evaluated in the background.'
                : currentDecision
                ? currentDecision.action === 'rebalance'
                  ? 'Review the recommendation and approve only when you are ready to submit on-chain.'
                  : 'No on-chain approval is required for the latest decision.'
                : 'No recommendation will appear here until an agent analysis has completed.'}
            </p>
            {!agentActive ? (
              <button
                onClick={() => void onSetAgentStatus('active')}
                disabled={agentStatusBusy}
                className="btn-primary mt-5 w-full shadow-pop disabled:opacity-40"
              >
                {agentStatusBusy ? 'Starting...' : 'Start agents'}
              </button>
            ) : canApprove ? (
              <button
                onClick={onApprove}
                disabled={busy}
                className="btn-primary mt-5 w-full bg-signal-emerald shadow-pop hover:bg-emerald-700 disabled:opacity-40"
              >
                {busy ? 'Submitting…' : 'Approve & settle on Casper'}
              </button>
            ) : !walletOwnsWorkspace && currentDecision?.action === 'rebalance' ? (
              <button
                onClick={onConnectWallet}
                disabled={walletPermissionConfirmed && !walletHasPublicKeyInput}
                className="btn-primary mt-5 w-full shadow-pop disabled:opacity-40"
              >
                {walletPermissionConfirmed ? 'Use pasted public key' : 'Connect wallet'}
              </button>
            ) : (
              <div className="mt-5 rounded-xl border border-slate-900/[0.07] bg-slate-50 px-3 py-3">
                <p className="text-sm font-semibold text-ink-900">
                  {currentDecision ? 'No wallet action required' : 'Monitoring in background'}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  {currentDecision
                    ? 'The latest decision does not require an on-chain approval.'
                    : nextRunInMin !== null
                      ? `Next scheduled analysis in about ${nextRunInMin} min.`
                      : 'The first analysis will run shortly.'}
                </p>
              </div>
            )}
            {agentActive && !canApprove && (
              <button
                onClick={() => void onSetAgentStatus('stopped')}
                disabled={agentStatusBusy}
                className="btn-ghost mt-3 w-full disabled:opacity-40"
              >
                {agentStatusBusy ? 'Stopping...' : 'Stop agents'}
              </button>
            )}
            {!walletOwnsWorkspace && currentDecision?.action === 'rebalance' && (
              <p className="mt-3 text-xs text-slate-500">
                Rebalance approval requires the treasury owner wallet.
              </p>
            )}
            {error && (
              <p className="mt-4 rounded-lg border border-signal-rose/20 bg-rose-50 px-3 py-2 text-sm text-signal-rose">
                {error}
              </p>
            )}
            {deployHash && (
              <p className="mt-4 rounded-lg border border-signal-emerald/20 bg-emerald-50 px-3 py-2 text-sm text-slate-700">
                Settled:{' '}
                <a
                  href={`${EXPLORER}/transaction/${deployHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono font-medium text-brand-600 underline-offset-4 hover:underline"
                >
                  {deployHash.slice(0, 10)}…{deployHash.slice(-6)}
                </a>
              </p>
            )}
          </section>

          <section className="panel p-5">
            <p className="eyebrow">Signal feed</p>
            <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-ink-900">
              <span className={`h-2 w-2 rounded-full ${signalFreshness.active ? 'bg-signal-emerald' : 'bg-slate-300'}`} />
              {signalFreshness.status}
            </div>
            <a
              href={workspaceSignalFeedUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 block break-all font-mono text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              {workspaceSignalFeedUrl}
            </a>
            <p className="mt-2 text-xs text-slate-500">{signalFreshness.label}</p>
          </section>

          {snapshot?.signals?.length ? (
            <section className="panel p-5">
              <p className="eyebrow">Latest signals</p>
              <div className="mt-3 grid gap-3">
                {snapshot.signals.slice(0, 3).map((s) => (
                  <div key={s.key} className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm text-slate-500">{s.label}</span>
                    <span className="tnum shrink-0 text-sm font-semibold text-ink-900">
                      {s.value.toLocaleString()} <span className="text-xs font-normal text-slate-400">{s.unit}</span>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </section>

      {showRunHistory && (
        <RunHistoryPanel
          runs={workspaceRuns}
          openId={historyOpenId}
          detail={historyDetail}
          live={live}
          onToggle={onToggleRunHistory}
        />
      )}
    </div>
  );
}

function TreasuryAccessEmptyState({
  walletError,
  onConnectWallet,
  hasWalletProvider,
  manualAddress,
  onManualAddressChange,
  onUseManualAddress,
}: {
  walletError: string | null;
  onConnectWallet: () => void | Promise<void>;
  hasWalletProvider: boolean;
  manualAddress: string;
  onManualAddressChange: (value: string) => void;
  onUseManualAddress: () => void | Promise<void>;
}) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 pb-28 sm:px-6 lg:px-8 lg:py-10 lg:pb-10">
      <header className="max-w-2xl">
        <p className="eyebrow">Treasury workspace</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tightish text-ink-900">
          Start with a new treasury or open an existing one
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          New DAO operators can configure a treasury first and connect the owner wallet at activation. Existing operators can connect the owner wallet to load workspaces already associated with that account.
        </p>
      </header>

      <section className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-4 sm:grid-cols-2">
          <article className="rounded-2xl border border-brand-200 bg-white p-5 shadow-card">
            <p className="eyebrow text-brand-600">New treasury</p>
            <h2 className="mt-3 text-xl font-semibold text-ink-900">Create a fresh workspace</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Set the DAO vault, choose policy guardrails, select the managed signal feed, then connect the owner wallet only when you activate.
            </p>
            <Link href="/onboarding" className="btn-primary mt-5 w-full">
              Create treasury
            </Link>
          </article>

          <article className="rounded-2xl border border-slate-900/[0.07] bg-white p-5 shadow-card">
            <p className="eyebrow">Existing treasury</p>
            <h2 className="mt-3 text-xl font-semibold text-ink-900">Open by owner wallet</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Connect the wallet that owns the treasury workspace. Caliber will show only workspaces tied to that account.
            </p>
            <button onClick={onConnectWallet} className="btn-ghost mt-5 w-full">
              Connect owner wallet
            </button>
            <div className="mt-3 flex gap-2">
              <input
                className="input flex-1 font-mono text-xs"
                value={manualAddress}
                onChange={(event) => onManualAddressChange(event.target.value)}
                placeholder="Or paste owner public key (01... / 02...)"
              />
              <button
                onClick={onUseManualAddress}
                disabled={!manualAddress.trim()}
                className="btn-ghost disabled:opacity-40"
              >
                Use key
              </button>
            </div>
            {walletError && <p className="mt-3 text-sm text-signal-rose">{walletError}</p>}
            {!hasWalletProvider && (
              <p className="mt-3 rounded-lg border border-slate-900/[0.07] bg-slate-50 px-3 py-2 text-xs text-slate-500">
                Install or unlock a Casper wallet extension to open an existing treasury.
              </p>
            )}
          </article>
        </div>

        <TreasuryOperatingModel />
      </section>

      <section className="mt-5 rounded-2xl border border-slate-900/[0.07] bg-white p-5 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            ['Configure', 'Treasury name, vault, and ownership'],
            ['Set Policy', 'Allocation targets and risk ceiling'],
            ['Activate', 'Connect wallet and create workspace'],
            ['Monitor', 'Start agents and review actions'],
          ].map(([label, detail]) => (
            <div key={label} className="rounded-xl bg-slate-50 px-3 py-3">
              <p className="text-sm font-semibold text-ink-900">{label}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{detail}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function TreasuryWorkspaceEmptyState({
  ownerAccount,
  onDisconnectWallet,
}: {
  ownerAccount: string;
  onDisconnectWallet: () => void | Promise<void>;
}) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 pb-28 sm:px-6 lg:px-8 lg:py-10 lg:pb-10">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-2xl border border-slate-900/[0.07] bg-white p-6 shadow-card sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="eyebrow">Treasury setup</p>
              <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tightish text-ink-900">
                Create a treasury workspace for this wallet
              </h1>
            </div>
            <span className="pill border-signal-emerald/30 bg-emerald-50 font-mono text-signal-emerald">
              {shortDisplay(ownerAccount)}
            </span>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
            A workspace binds the DAO owner wallet, Casper vault, policy limits, signal feed, run history, and approval records into one operational view.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/onboarding" className="btn-primary w-full sm:w-auto">
              Create treasury workspace
            </Link>
            <button onClick={onDisconnectWallet} className="btn-ghost w-full sm:w-auto">
              Switch wallet
            </button>
          </div>
        </div>

        <TreasuryOperatingModel />
      </section>
    </div>
  );
}

function TreasuryOperatingModel() {
  const items = [
    {
      label: 'Owner wallet',
      detail: 'Identifies the DAO account that can view this workspace and approve execution.',
    },
    {
      label: 'Policy guardrails',
      detail: 'Defines allocation targets, risk limits, and how much the agent can recommend moving.',
    },
    {
      label: 'Background monitoring',
      detail: 'Active workspaces are checked by the backend on the configured interval.',
    },
    {
      label: 'Approval trail',
      detail: 'Recommended on-chain actions wait for wallet approval and stay visible in run history.',
    },
  ];
  return (
    <aside className="rounded-2xl border border-slate-900/[0.07] bg-slate-50 p-5">
      <p className="eyebrow">How Caliber operates</p>
      <div className="mt-4 grid gap-3">
        {items.map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-900/[0.06] bg-white p-3">
            <p className="text-sm font-semibold text-ink-900">{item.label}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{item.detail}</p>
          </div>
        ))}
      </div>
    </aside>
  );
}

function shortDisplay(value: string): string {
  return value.length > 18 ? `${value.slice(0, 10)}...${value.slice(-8)}` : value;
}

function RiskGauge({ score, band }: { score: number; band: RiskScore['band'] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const r = 52;
  const c = 2 * Math.PI * r;
  const shown = mounted ? score : 0;
  const offset = c * (1 - shown / 100);
  const { color, label } = BANDS[band];
  return (
    <div className="relative h-[132px] w-[132px]">
      <svg width="132" height="132" viewBox="0 0 132 132" className="-rotate-90">
        <circle className="gauge-track" cx="66" cy="66" r={r} fill="none" stroke="#eef1f6" strokeWidth="10" />
        <circle
          className="gauge-value"
          cx="66"
          cy="66"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tnum text-[2.4rem] font-semibold leading-none text-ink-900">{score}</span>
        <span
          className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em]"
          style={{ color }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

function DashboardStat({
  label,
  value,
  detail,
  status,
}: {
  label: string;
  value: string;
  detail?: string;
  status?: { label: string; tone: 'active' | 'inactive' };
}) {
  return (
    <div className="rounded-xl border border-slate-900/[0.07] bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 tnum truncate text-lg font-semibold text-ink-900">{value}</p>
      {status && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
          <span className={`h-2 w-2 rounded-full ${status.tone === 'active' ? 'bg-signal-emerald' : 'bg-slate-300'}`} />
          {status.label}
        </p>
      )}
      {detail && <p className="mt-2 truncate text-xs text-slate-500">{detail}</p>}
    </div>
  );
}

function EmptyRunMark() {
  return (
    <div className="flex h-[112px] w-[112px] shrink-0 items-center justify-center rounded-full border border-dashed border-slate-300 bg-slate-50">
      <div className="text-center">
        <span className="mx-auto block h-2 w-2 rounded-full bg-slate-300" />
        <span className="mt-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">No run</span>
      </div>
    </div>
  );
}

function PolicyMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-900/[0.06] bg-white px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-ink-900">{value}</p>
    </div>
  );
}

function AllocationGuardrail({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="tnum text-slate-500">{value}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-brand-500" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function RunHistoryPanel({
  runs,
  openId,
  detail,
  live,
  onToggle,
}: {
  runs: AgentRunLog[];
  openId: string | null;
  detail: RunDetail | null;
  live: boolean;
  onToggle: (runId: string) => void | Promise<void>;
}) {
  const recentRuns = runs.slice(0, HISTORY_PAGE_SIZE);
  return (
    <section className="mt-5 panel overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-900/[0.06] bg-slate-50/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow">Run history</p>
          <h2 className="mt-1 text-lg font-semibold text-ink-900">Recent agent activity</h2>
        </div>
        <span className="pill border-slate-200 bg-white text-slate-500">
          {runs.length} run{runs.length === 1 ? '' : 's'}
        </span>
      </div>

      {recentRuns.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm font-semibold text-ink-900">No runs yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Start agents for this workspace and the backend will create the first run after the workspace interval.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-900/[0.06]">
          {recentRuns.map((run) => {
            const open = openId === run.id;
            const loading = live && open && (!detail || detail.run.id !== run.id);
            return (
              <article key={run.id}>
                <button
                  onClick={() => void onToggle(run.id)}
                  className="flex w-full flex-col gap-3 px-5 py-4 text-left transition hover:bg-slate-50/60 sm:flex-row sm:items-center sm:justify-between"
                  aria-expanded={open}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Chevron open={open} />
                    <ActionBadge action={run.action} />
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs font-medium text-slate-600">{run.id}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{formatDateTime(run.startedAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:shrink-0">
                    <StatusPill status={run.status} />
                    <span className="tnum text-sm font-semibold text-ink-900">
                      Risk {run.riskScore ?? '-'}
                    </span>
                  </div>
                </button>
                {open && (
                  <div className="border-t border-slate-900/[0.05] bg-slate-50/40 px-5 py-5">
                    <InlineRunDetail run={run} detail={detail} loading={loading} />
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function InlineRunDetail({
  run,
  detail,
  loading,
}: {
  run: AgentRunLog;
  detail: RunDetail | null;
  loading: boolean;
}) {
  const rec = detail?.recommendation;
  const legs = rec?.rebalance?.legs ?? [];
  const trace = rec?.trace ?? [];
  if (loading) return <Spinner className="h-4 w-4" />;
  return (
    <div className="disclosure-panel grid gap-5 lg:grid-cols-2">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Decision rationale</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          {rec?.explanation ?? run.notes ?? 'No reasoning recorded for this run.'}
        </p>
        {rec?.review && (
          <p className={`mt-3 text-xs ${rec.review.approved ? 'text-signal-emerald' : 'text-signal-rose'}`}>
            {AGENT_ROLES.reviewer.name}: {rec.review.approved ? 'approved' : 'vetoed'} ({rec.review.severity}) - {rec.review.concern}
          </p>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Execution</p>
        {legs.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            No funds moved. Decision was <span className="font-medium">{run.action ?? 'hold'}</span>.
          </p>
        ) : (
          <div className="mt-2 grid gap-2">
            {legs.map((leg, index) => (
              <div key={index} className="flex items-center gap-2 rounded-lg border border-slate-900/[0.06] bg-white p-2.5">
                <Chip>{prettyAsset(leg.fromAssetId)}</Chip>
                <span className="text-slate-400">-&gt;</span>
                <Chip accent>{prettyAsset(leg.toAssetId)}</Chip>
                <span className="ml-auto text-right">
                  <span className="tnum block text-sm font-semibold text-ink-900">
                    ${Number(leg.amount).toLocaleString()}
                  </span>
                  <span className="tnum text-xs text-slate-400">{(leg.weight * 100).toFixed(1)}%</span>
                </span>
              </div>
            ))}
          </div>
        )}
        {detail?.transaction?.deployHash && (
          <a
            href={`${EXPLORER}/transaction/${detail.transaction.deployHash}`}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex font-mono text-xs text-brand-600 underline-offset-4 hover:underline"
          >
            View deploy {shortHash(detail.transaction.deployHash)}
          </a>
        )}
      </div>

      {trace.length > 0 && (
        <div className="lg:col-span-2">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Run trace</p>
          <TraceTimeline trace={trace} />
        </div>
      )}
    </div>
  );
}

function ActionBadge({ action }: { action?: AgentRunLog['action'] }) {
  if (!action) return <span className="text-slate-300">No decision</span>;
  const map = {
    hold: 'border-brand-200 bg-brand-50 text-brand-600',
    rebalance: 'border-signal-amber/30 bg-amber-50 text-signal-amber',
    halt: 'border-signal-rose/30 bg-rose-50 text-signal-rose',
  } as const;
  return <span className={`pill ${map[action]}`}>{action.toUpperCase()}</span>;
}

function StatusPill({ status }: { status: AgentRunLog['status'] }) {
  const map: Record<AgentRunLog['status'], string> = {
    completed: 'border-signal-emerald/30 bg-emerald-50 text-signal-emerald',
    running: 'border-brand-200 bg-brand-50 text-brand-600',
    rejected: 'border-signal-rose/30 bg-rose-50 text-signal-rose',
    failed: 'border-signal-rose/30 bg-rose-50 text-signal-rose',
  };
  return <span className={`pill ${map[status]}`}>{status}</span>;
}

function Chip({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span className={`rounded-md px-2 py-1 text-xs font-medium ${accent ? 'bg-brand-50 text-brand-600' : 'bg-slate-100 text-slate-600'}`}>
      {children}
    </span>
  );
}

function prettyAsset(id: string): string {
  return id.replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function shortHash(hash: string): string {
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function DeliberationStep({ role, ok, note }: { role: string; ok: boolean; note: string }) {
  return (
    <div className="flex gap-2.5 rounded-lg border border-slate-900/[0.06] bg-white p-3">
      <span
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${ok ? 'bg-signal-emerald' : 'bg-signal-rose'}`}
      >
        {ok ? '✓' : '!'}
      </span>
      <div>
        <p className="text-xs font-semibold text-ink-900">{role}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{note}</p>
      </div>
    </div>
  );
}

function TraceTimeline({ trace }: { trace: TraceStep[] }) {
  return (
    <ol className="grid gap-2.5">
      {trace.map((t) => (
        <li key={`${t.step}-${t.kind}-${t.label}`} className="flex gap-3 rounded-lg border border-slate-900/[0.06] bg-white p-3">
          <TraceIcon kind={t.kind} ok={t.ok} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] font-semibold text-slate-400">
                {String(t.step + 1).padStart(2, '0')}
              </span>
              <p className="text-sm font-medium text-ink-900">{t.label}</p>
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                {t.kind}
              </span>
            </div>
            {t.detail && <p className="mt-1 text-xs leading-relaxed text-slate-500">{t.detail}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

function TraceIcon({ kind, ok }: { kind: TraceStep['kind']; ok?: boolean }) {
  const tone =
    ok === false
      ? 'border-signal-rose/30 bg-rose-50 text-signal-rose'
      : ok === true
        ? 'border-signal-emerald/30 bg-emerald-50 text-signal-emerald'
        : 'border-slate-200 bg-slate-50 text-slate-500';
  const glyph =
    kind === 'proposal'
      ? 'P'
      : kind === 'tools'
        ? 'T'
        : kind === 'gate'
          ? 'G'
          : kind === 'review'
            ? 'R'
            : kind === 'revision'
              ? '↻'
              : kind === 'decision'
                ? 'D'
                : 'F';
  return (
    <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${tone}`}>
      {glyph}
    </span>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`}
    >
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
