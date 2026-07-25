'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { TreasuryWorkspace } from '@caliber/shared';
import { api } from '@/lib/api';
import {
  activateWorkspace,
  getActiveWorkspace,
  getWorkspace,
  listWorkspaces,
  saveWorkspaces,
} from '@/lib/workspaces';

export function WorkspaceSwitcher({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [workspaces, setWorkspaces] = useState<TreasuryWorkspace[]>([]);
  const [activeId, setActiveId] = useState<string>('');

  const refreshLocal = useCallback(() => {
    const selectedWorkspaceId =
      typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('workspace');
    const selected = getWorkspace(selectedWorkspaceId) ?? getActiveWorkspace();
    setWorkspaces(listWorkspaces());
    setActiveId(selected?.id ?? '');
  }, []);

  useEffect(() => {
    refreshLocal();
    void api.getWorkspaces().then((remoteWorkspaces) => {
      if (!remoteWorkspaces) return;
      saveWorkspaces(remoteWorkspaces);
      refreshLocal();
    });
  }, [refreshLocal]);

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
          Workspace
        </p>
        <p className="mt-1 truncate text-sm font-medium text-slate-700">No treasury connected</p>
      </div>
    );
  }

  return (
    <label className={compact ? 'block px-4 py-2' : 'block px-3 pb-3'}>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        Workspace
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
    </label>
  );
}
