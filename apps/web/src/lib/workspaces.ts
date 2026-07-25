import type { TreasuryWorkspace } from '@caliber/shared';

export type { TreasuryWorkspace } from '@caliber/shared';

const STORAGE_KEY = 'caliber.workspaces.v1';
const ACTIVE_KEY = 'caliber.activeWorkspaceId.v1';

export function activateWorkspace(workspace: TreasuryWorkspace): void {
  saveWorkspace(workspace);
}

export function saveWorkspaces(nextWorkspaces: TreasuryWorkspace[]): void {
  if (typeof window === 'undefined') return;
  const existing = listWorkspaces();
  const byId = new Map<string, TreasuryWorkspace>();
  for (const workspace of [...existing, ...nextWorkspaces]) {
    byId.set(workspace.id, workspace);
  }
  const merged = [...byId.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
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
  const workspaces = listWorkspaces();
  return workspaces.find((workspace) => workspace.id === activeId) ?? workspaces[0] ?? null;
}
