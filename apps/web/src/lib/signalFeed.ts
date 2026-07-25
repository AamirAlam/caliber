const managedSignalFeedUrlValue = 'https://caliber-production-d4ee.up.railway.app/signals/feed';

export function managedSignalFeedUrl(): string {
  return managedSignalFeedUrlValue;
}

export function feedFreshness(capturedAt?: string): { active: boolean; status: string; label: string } {
  if (!capturedAt) return { active: false, status: 'No feed data yet', label: 'Freshness pending' };
  const capturedMs = Date.parse(capturedAt);
  if (!Number.isFinite(capturedMs)) return { active: false, status: 'Feed timestamp invalid', label: 'Freshness unknown' };
  const ageSeconds = Math.max(0, Math.floor((Date.now() - capturedMs) / 1000));
  const active = ageSeconds <= 300;
  return {
    active,
    status: active ? 'Feed active' : 'Feed stale',
    label: `Updated ${formatAge(ageSeconds)} ago`,
  };
}

function formatAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
