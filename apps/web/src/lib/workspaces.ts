import type { TreasuryWorkspace } from '@caliber/shared';

export type { TreasuryWorkspace } from '@caliber/shared';

const STORAGE_KEY = 'caliber.workspaces.v1';
const ACTIVE_KEY = 'caliber.activeWorkspaceId.v1';

export function workspaceSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `${base || 'treasury'}-${Date.now().toString(36)}`;
}

export function activateWorkspace(workspace: TreasuryWorkspace): void {
  saveWorkspace(workspace);
}

export function saveWorkspace(workspace: TreasuryWorkspace): void {
  const workspaces = listWorkspaces().filter((w) => w.id !== workspace.id);
  workspaces.unshift(workspace);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workspaces));
  localStorage.setItem(ACTIVE_KEY, workspace.id);
}

export function listWorkspaces(): TreasuryWorkspace[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TreasuryWorkspace[]) : [];
  } catch {
    return [];
  }
}

export function getWorkspace(id: string | null): TreasuryWorkspace | null {
  if (!id) return getActiveWorkspace();
  return listWorkspaces().find((workspace) => workspace.id === id) ?? null;
}

export function getActiveWorkspace(): TreasuryWorkspace | null {
  if (typeof window === 'undefined') return null;
  const activeId = localStorage.getItem(ACTIVE_KEY);
  return listWorkspaces().find((workspace) => workspace.id === activeId) ?? null;
}
