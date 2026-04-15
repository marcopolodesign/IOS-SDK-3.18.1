/**
 * Returns a human-readable relative time label for a timestamp.
 * Returns null when ts is null (no cache yet — callers should hide the label).
 */
export function formatRelativeTime(ts: number | null, now = Date.now()): string | null {
  if (ts == null) return null;
  const diffSec = Math.floor((now - ts) / 1000);
  if (diffSec < 60) return 'Now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}
