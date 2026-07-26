'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { TreasuryWorkspace } from '@caliber/shared';
import { api } from '@/lib/api';
import {
  activateWorkspace,
  getActiveWorkspace,
  getWorkspace,
  listWorkspaces,
  saveWorkspaces,
} from '@/lib/workspaces';
import { loadWalletSession, subscribeWalletPublicKey } from '@/lib/walletClient';

export function WorkspaceSwitcher({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [workspaces, setWorkspaces] = useState<TreasuryWorkspace[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [ownerAccount, setOwnerAccount] = useState<string | null>(null);

  const refreshLocal = useCallback(() => {
    const selectedWorkspaceId =
      typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('workspace');
    const selected = getWorkspace(selectedWorkspaceId) ?? getActiveWorkspace();
    const visibleWorkspaces = ownerAccount
      ? listWorkspaces().filter((workspace) => workspace.ownerAccount === ownerAccount)
      : [];
    setWorkspaces(visibleWorkspaces);
    setActiveId(selected?.id ?? '');
  }, [ownerAccount]);

  useEffect(() => {
    const unsubscribe = subscribeWalletPublicKey((publicKey) => setOwnerAccount(publicKey));
    void loadWalletSession()
      .then((session) => setOwnerAccount(session?.accountHash ?? null))
      .catch(() => setOwnerAccount(null));
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!ownerAccount) {
      setWorkspaces([]);
      setActiveId('');
      return;
    }
    refreshLocal();
    void api.getWorkspaces(ownerAccount).then((remoteWorkspaces) => {
      if (!remoteWorkspaces) return;
      saveWorkspaces(remoteWorkspaces);
      refreshLocal();
    });
  }, [ownerAccount, refreshLocal]);

  const active = useMemo(
    () => workspaces.find((workspace) => workspace.id === activeId) ?? workspaces[0] ?? null,
    [activeId, workspaces],
  );

  const onSelect = (workspaceId: string) => {
    if (!workspaceId) {
      setActiveId('');
      router.push(pathname);
      return;
    }
    const workspace = workspaces.find((item) => item.id === workspaceId);
    if (!workspace) return;
    activateWorkspace(workspace);
    setActiveId(workspace.id);
    const params = new URLSearchParams(window.location.search);
    params.set('workspace', workspace.id);
    router.push(`${pathname}?${params.toString()}`);
  };

  if (workspaces.length === 0) {
    return (
      <div className={compact ? 'px-4 py-2' : 'px-3 pb-3'}>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Treasury
        </p>
        <p className="mt-1 truncate text-sm font-medium text-slate-700">
          {ownerAccount ? 'No workspace yet' : 'Connect owner wallet'}
        </p>
        {ownerAccount && (
          <Link
            href="/onboarding"
            className="mt-2 inline-flex rounded-lg border border-slate-900/10 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-brand-200 hover:text-brand-600"
          >
            Create treasury
          </Link>
        )}
      </div>
    );
  }

  return (
    <label className={compact ? 'block px-4 py-2' : 'block px-3 pb-3'}>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        Treasury
      </span>
      <select
        value={active?.id ?? ''}
        onChange={(event) => onSelect(event.target.value)}
        className="mt-1.5 w-full rounded-lg border border-slate-900/10 bg-white px-2.5 py-2 text-sm font-medium text-ink-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
      >
        {workspaces.map((workspace) => (
          <option key={workspace.id} value={workspace.id}>
            {workspace.name}
          </option>
        ))}
      </select>
      <Link
        href="/onboarding"
        className="mt-2 inline-flex text-xs font-semibold text-brand-600 underline-offset-4 hover:underline"
      >
        Add another treasury
      </Link>
    </label>
  );
}
