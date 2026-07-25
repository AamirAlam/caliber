'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AGENT_ROLES } from '@caliber/shared';
import type { AgentRunLog, Recommendation, RiskScore, SignalSnapshot, TraceStep, TreasuryPolicy } from '@caliber/shared';
import { api, type FeedStatus, type VaultState } from '@/lib/api';
import { PageLoader } from '@/components/Spinner';
import { MaintenanceMode } from '@/components/MaintenanceMode';
import { feedFreshness, managedSignalFeedUrl } from '@/lib/signalFeed';
import { activateWorkspace, getWorkspace, type TreasuryWorkspace } from '@/lib/workspaces';
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
const TOTAL_FUNDS_UNDER_MANAGEMENT_USD = 1_200_000;

const BANDS = {
  low: { label: 'Low', color: '#059669', tint: 'text-signal-emerald' },
  moderate: { label: 'Moderate', color: '#3657d5', tint: 'text-brand-600' },
  elevated: { label: 'Elevated', color: '#d97706', tint: 'text-signal-amber' },
  critical: { label: 'Critical', color: '#e11d48', tint: 'text-signal-rose' },
} as const;

export default function DashboardPage() {
  const [policy, setPolicy] = useState<TreasuryPolicy | null>(null);
  const [workspace, setWorkspace] = useState<TreasuryWorkspace | null>(null);
  const [workspaceResolved, setWorkspaceResolved] = useState(false);
  const [snapshot, setSnapshot] = useState<SignalSnapshot | null>(null);
  const [risk, setRisk] = useState<RiskScore | null>(null);
  const [vault, setVault] = useState<VaultState | null>(null);
  const [feedStatus, setFeedStatus] = useState<FeedStatus | null>(null);
  const [workspaceRuns, setWorkspaceRuns] = useState<AgentRunLog[]>([]);
  const [workspaceRecommendation, setWorkspaceRecommendation] = useState<Recommendation | null>(null);
  const [pendingRunId, setPendingRunId] = useState<string | null>(null);
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
      setPendingRunId(null);
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
    const workspaceId = new URLSearchParams(window.location.search).get('workspace');
    const localWorkspace = getWorkspace(workspaceId);
    setWorkspace(localWorkspace);
    setWorkspaceResolved(Boolean(localWorkspace) || !workspaceId);
    if (workspaceId && !localWorkspace) {
      void api.getWorkspace(workspaceId).then((remoteWorkspace) => {
        if (remoteWorkspace) {
          activateWorkspace(remoteWorkspace);
          setWorkspace(remoteWorkspace);
        }
        setWorkspaceResolved(true);
      });
    }
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

  const onConnectWallet = async () => {
    setWalletError(null);
    try {
      const publicKey = connectedAddress ?? manualAddress.trim();
      if (publicKey) {
        setConnectedAddress(publicKey);
        setWallet(await authenticateWallet(publicKey));
        return;
      }
      if (walletPermissionConfirmed) {
        setWalletError('Wallet is connected, but the extension did not expose an active public key. Paste the wallet public key to continue.');
        return;
      }
      const connectedPublicKey = await connectWalletProvider();
      setWalletPermissionConfirmed(true);
      if (!connectedPublicKey) return;
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
    setPendingRunId(null);
  };

  const onRunNow = async () => {
    if (!wallet) {
      setWalletError('Connect the treasury wallet before running the agent.');
      return;
    }
    setBusy(true);
    setError(null);
    setDeployHash(null);
    try {
      const res = await api.runNow(workspace?.id);
      setPendingRunId(res.pendingRunId);
      await refresh();
      if (workspace?.id) {
        const runs = (await api.getRuns(workspace.id)) ?? [];
        setWorkspaceRuns(runs);
        const latest = runs[0];
        const detail = latest ? await api.getRun(latest.id) : null;
        setWorkspaceRecommendation(detail?.recommendation ?? null);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const onApprove = async () => {
    const runId = pendingRunId ?? (workspaceRecommendation?.action === 'rebalance' ? workspaceRecommendation.runId : null);
    if (!runId || !workspace || !wallet) return;
    setBusy(true);
    setError(null);
    try {
      const approval = await signApproval(runId, workspace.id, wallet);
      const res = await api.approve(runId, workspace.id, approval);
      setDeployHash(res.tx.deployHash ?? null);
      setPendingRunId(null);
      await refresh();
      const runs = (await api.getRuns(workspace.id)) ?? [];
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
  if (!workspace) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <p className="eyebrow">Treasury control plane</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tightish text-ink-900">
          Connect a treasury workspace
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Caliber requires a persisted workspace before it can run agents, apply policy, request approval, or write audit records.
        </p>
        <Link href="/onboarding" className="btn-primary mt-6">
          Create workspace
        </Link>
      </div>
    );
  }

  const walletOwnsWorkspace =
    wallet && (workspace.ownerAccount === wallet.accountHash || workspace.ownerAccount === wallet.publicKey);
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
  const latestRunStarted = latestWorkspaceRun ? new Date(latestWorkspaceRun.startedAt).toLocaleString() : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 pb-28 sm:px-6 sm:py-8 lg:px-8 lg:py-10 lg:pb-10">
      <header className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Treasury control plane</p>
          <h1 className="mt-1.5 text-[1.6rem] font-semibold tracking-tightish text-ink-900">
            {workspaceTitle}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{workspacePolicy}</p>
        </div>
        <span
          className={`pill ${live ? 'border-signal-emerald/30 bg-emerald-50 text-signal-emerald' : 'border-slate-200 bg-slate-50 text-slate-500'}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-signal-emerald' : 'bg-slate-400'}`} />
          {live ? 'Live · testnet' : 'Offline'}
        </span>
      </header>

      <section className="mt-5 rounded-xl border border-slate-900/[0.07] bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-ink-900">
              {wallet
                ? 'Treasury wallet connected'
                : walletPermissionConfirmed
                  ? 'Wallet permission confirmed'
                  : 'Read-only treasury view'}
            </p>
            <p className="mt-0.5 text-sm text-slate-500">
              {wallet
                ? walletOwnsWorkspace
                  ? 'You can trigger runs and sign approvals for this treasury.'
                  : 'This wallet is connected, but it does not own the selected treasury.'
                  : connectedAddress
                  ? 'Wallet address detected. Continue to create the treasury session.'
                  : walletPermissionConfirmed
                    ? 'Paste the wallet public key to continue.'
                : 'Connect the treasury wallet to create runs or approve policy-gated rebalances.'}
            </p>
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

      <section className="mt-4 grid gap-3 rounded-xl border border-slate-900/[0.07] bg-white p-4 shadow-sm sm:grid-cols-4">
        <WorkspaceFact label="Owner" value={workspace.ownerAccount || 'Not connected'} />
        <WorkspaceFact label="Vault" value={`${workspace.vaultContractHash.slice(0, 10)}...${workspace.vaultContractHash.slice(-8)}`} />
        <WorkspaceFact
          label="Signals"
          value={workspace.signals.mode === 'operator' ? 'Self managed feed' : 'External feed'}
          status={{
            label: signalFreshness.status,
            tone: signalFreshness.active ? 'active' : 'inactive',
          }}
        />
        <WorkspaceFact label="Feed URL" value={workspaceSignalFeedUrl} href={workspaceSignalFeedUrl} detail={signalFreshness.label} />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="panel p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Step 1 · Policy</p>
              <h2 className="mt-2 text-xl font-semibold text-ink-900">Current policy configuration</h2>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Funds under management</p>
              <p className="tnum mt-0.5 text-lg font-semibold text-ink-900">
                {formatUsd(TOTAL_FUNDS_UNDER_MANAGEMENT_USD)}
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <PolicyMetric label="RWA target" value={`${workspace.policy.rwaTarget}%`} />
            <PolicyMetric label="Stable buffer" value={`${workspace.policy.stableTarget}%`} />
            <PolicyMetric label="Native CSPR" value={`${workspace.policy.nativeTarget}%`} />
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <PolicyMetric label="Risk ceiling" value={`${workspace.policy.maxRiskScore}/100`} />
            <PolicyMetric label="Single rebalance cap" value={`${(policy.constraints.maxSingleRebalancePct * 100).toFixed(0)}%`} />
          </div>
        </div>

        <div className="panel p-5">
          <p className="eyebrow">Step 2 · Analysis</p>
          <h2 className="mt-2 text-xl font-semibold text-ink-900">
            {hasWorkspaceAnalysis ? 'Latest agent run' : 'No analysis run yet'}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {hasWorkspaceAnalysis
              ? currentDecision?.explanation ?? latestWorkspaceRun?.notes ?? 'The latest run is still being processed.'
              : 'This policy has been created, but the agent has not analyzed the treasury against live signals yet.'}
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <PolicyMetric label="Run status" value={latestWorkspaceRun?.status ?? 'Not run'} />
            <PolicyMetric label="Stage" value={latestWorkspaceRun?.stage ?? 'Pending'} />
            <PolicyMetric label="Started" value={latestRunStarted ?? 'Pending'} />
          </div>
          {currentDecision && (
            <div className="mt-5 grid gap-4 sm:grid-cols-[auto_1fr]">
              <RiskGauge score={currentDecision.riskScore} band={risk?.band ?? 'low'} />
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${BANDS[risk?.band ?? 'low'].tint}`}>
                  Decision · {currentDecision.action.toUpperCase()}
                </p>
                <dl className="mt-3 space-y-1.5 text-sm">
                  <Row k="Compliance" v={currentDecision.compliancePassed ? 'Passing' : 'Blocked'} good={currentDecision.compliancePassed} />
                  <Row k="Confidence" v={`${(currentDecision.confidence * 100).toFixed(0)}%`} />
                  <Row k="Run ID" v={currentDecision.runId} />
                </dl>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="mt-4 overflow-hidden rounded-xl border border-slate-900/[0.07] bg-white shadow-sm">
        <div className="grid gap-6 p-5 lg:grid-cols-[1fr_360px]">
          <div>
            <p className="eyebrow">Step 3 · Action pane</p>
            <h2 className="mt-2 text-xl font-semibold text-ink-900">
              {currentDecision ? headline : 'No recommended action yet'}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {currentDecision
                ? currentDecision.explanation
                : 'Run an agent cycle to collect signals, score risk, evaluate policy, and produce a decision. Caliber will not ask for an on-chain action before that analysis exists.'}
            </p>

            {currentDecision?.violations.length ? (
              <ul className="mt-4 space-y-1 text-sm text-signal-amber">
                {currentDecision.violations.map((v, i) => (
                  <li key={i}>{v.detail}</li>
                ))}
              </ul>
            ) : null}

            {error && (
              <p className="mt-4 rounded-lg border border-signal-rose/20 bg-rose-50 px-3 py-2 text-sm text-signal-rose">
                {error}
              </p>
            )}
            {deployHash && (
              <p className="mt-4 rounded-lg border border-signal-emerald/20 bg-emerald-50 px-3 py-2 text-sm text-slate-700">
                Settled on-chain:{' '}
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
          </div>

          <div className="rounded-xl border border-slate-900/[0.07] bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Available action</p>
            {canApprove ? (
              <>
                <p className="mt-2 text-sm text-slate-600">A policy-compliant rebalance is waiting for owner approval.</p>
                <button
                  onClick={onApprove}
                  disabled={busy}
                  className="btn-primary mt-4 w-full bg-signal-emerald shadow-pop hover:bg-emerald-700 disabled:opacity-40"
                >
                  {busy ? 'Submitting…' : 'Approve & settle on Casper'}
                </button>
              </>
            ) : walletOwnsWorkspace ? (
              <>
                <p className="mt-2 text-sm text-slate-600">
                  {currentDecision
                    ? 'Run another analysis cycle when you want the agent to evaluate fresh signals.'
                    : 'Start the first analysis cycle for this policy.'}
                </p>
                <button
                  onClick={onRunNow}
                  disabled={busy || !live}
                  className="btn-primary mt-4 w-full shadow-pop disabled:opacity-40"
                >
                  {busy ? 'Running…' : hasWorkspaceAnalysis ? 'Run new analysis' : 'Run first analysis'}
                </button>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm text-slate-600">Connect the treasury owner wallet to run analysis or approve actions.</p>
                <button
                  onClick={onConnectWallet}
                  disabled={walletPermissionConfirmed && !walletHasPublicKeyInput}
                  className="btn-primary mt-4 w-full shadow-pop disabled:opacity-40"
                >
                  {walletPermissionConfirmed ? 'Use pasted public key' : 'Connect wallet'}
                </button>
              </>
            )}
            {!walletOwnsWorkspace && currentDecision?.action === 'rebalance' && (
              <p className="mt-3 text-xs text-slate-500">
                Rebalance approval requires the treasury owner wallet.
              </p>
            )}
            {!live && (
              <p className="mt-3 text-xs text-slate-500">
                Configure and start the services API to stream live treasury signals.
              </p>
            )}
          </div>
        </div>

        {currentDecision && (
          <div className="border-t border-slate-900/[0.06] px-5 py-4">
            <button onClick={() => setShowReasoning((v) => !v)} className="disclosure-btn">
              {showReasoning ? 'Hide reasoning' : 'Show reasoning and trace'}
              <Chevron open={showReasoning} />
            </button>
            {showReasoning && (
              <div className="disclosure-panel mt-4 grid gap-6 sm:grid-cols-2">
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
                    Agent deliberation
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
                    Execution boundary
                  </p>
                  <div className="grid gap-2.5 sm:grid-cols-3">
                    <BoundaryItem label="AI role" value="Analyze and recommend" />
                    <BoundaryItem
                      label="Hard gate"
                      value={currentDecision.compliancePassed ? 'Policy passed' : 'Policy blocked'}
                      ok={currentDecision.compliancePassed}
                    />
                    <BoundaryItem
                      label="Settlement"
                      value={currentDecision.action === 'rebalance' ? 'Human approval required' : 'No deploy prepared'}
                    />
                  </div>
                </div>

                {currentDecision.trace.length > 0 && (
                  <div className="sm:col-span-2">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Tool and decision trace
                    </p>
                    <TraceTimeline trace={currentDecision.trace} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Signals */}
      <section id="signals" className="mt-8 scroll-mt-20">
        <SectionTitle>Live signals</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-3">
          {(snapshot?.signals ?? []).map((s) => (
            <div key={s.key} className="panel p-5">
              <p className="text-sm text-slate-500">{s.label}</p>
              <p className="mt-1.5 tnum text-2xl font-semibold text-ink-900">
                {s.value.toLocaleString()}
                <span className="ml-1.5 text-xs font-normal text-slate-400">{s.unit}</span>
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Policy */}
      <section id="policy" className="mt-8 scroll-mt-20">
        <SectionTitle>Policy allocations</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-3">
          {policy.allocations.map((a) => (
            <div key={a.assetId} className="panel p-5">
              <p className="text-sm font-semibold text-ink-900">{a.label}</p>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-brand-500" style={{ width: `${a.target * 100}%` }} />
              </div>
              <p className="mt-2 font-mono text-xs text-slate-500">
                target {(a.target * 100).toFixed(0)}% · band {(a.min * 100).toFixed(0)}–{(a.max * 100).toFixed(0)}%
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{children}</h2>;
}

function WorkspaceFact({
  label,
  value,
  href,
  detail,
  status,
}: {
  label: string;
  value: string;
  href?: string;
  detail?: string;
  status?: { label: string; tone: 'active' | 'inactive' };
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="mt-1 block truncate text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          {value}
        </a>
      ) : (
        <p className="mt-1 truncate text-sm font-medium text-slate-700">{value}</p>
      )}
      {status && (
        <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
          <span className={`h-2 w-2 rounded-full ${status.tone === 'active' ? 'bg-signal-emerald' : 'bg-slate-300'}`} />
          {status.label}
        </p>
      )}
      {detail && <p className="mt-1 truncate text-xs text-slate-500">{detail}</p>}
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

function BoundaryItem({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-900/[0.06] bg-white p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p
        className={`mt-1 text-sm font-medium ${
          ok === undefined ? 'text-slate-700' : ok ? 'text-signal-emerald' : 'text-signal-rose'
        }`}
      >
        {value}
      </p>
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

function Row({ k, v, good }: { k: string; v: string; good?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-400">{k}</dt>
      <dd
        className={`text-right ${
          good === undefined ? 'text-slate-700' : good ? 'text-signal-emerald' : 'text-signal-amber'
        }`}
      >
        {v}
      </dd>
    </div>
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
