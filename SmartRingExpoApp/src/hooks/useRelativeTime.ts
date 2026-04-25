import { useEffect, useRef, useState } from 'react';
import { formatRelativeTime } from '../utils/time';

/**
 * Returns a live relative-time label (e.g. "Now", "3m ago") that refreshes
 * every 60 seconds without triggering a sync. Returns null when ts is null.
 */
export function useRelativeTime(ts: number | null): string | null {
  const [, setRefreshKey] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (ts == null) return;
    intervalRef.current = setInterval(() => setRefreshKey(k => k + 1), 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [ts]);

  return formatRelativeTime(ts);
}
