/**
 * Extracts wake and bed hours (decimal) from optional Date values.
 * Handles post-midnight bedtimes (e.g. 1 AM → 25.0) and missing data defaults.
 */
export function getSleepHours(wakeTime?: Date, bedTime?: Date): { wakeHour: number; bedHour: number } {
  const valid = (d?: Date) => d instanceof Date && !isNaN(d.getTime());
  const wakeHour = valid(wakeTime) ? wakeTime!.getHours() + wakeTime!.getMinutes() / 60 : 7;
  const bedRaw   = valid(bedTime)  ? bedTime!.getHours()  + bedTime!.getMinutes()  / 60 : 23;
  const bedHour  = bedRaw < 6 ? bedRaw + 24 : bedRaw;
  return { wakeHour, bedHour };
}

// Formats a decimal hour (e.g. 8.5 → "8:30 AM", null → "—")
export function formatDecimalHour(hour: number | null): string {
  if (hour === null) return '—';
  const h   = Math.floor(hour) % 24;
  const m   = Math.round((hour % 1) * 60);
  const suf = h >= 12 ? 'PM' : 'AM';
  const dh  = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${dh}:${String(m).padStart(2, '0')} ${suf}`;
}

/**
 * Formats a duration in minutes as "Xh Ym" (e.g. "7h 32m") or "Ym" when < 1 hour.
 */
export function formatDurationHm(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Compact sleep/debt time format — omits zero-minute component.
 * 0→"0m", 60→"1h", 90→"1h 30m", 30→"30m"
 */
export function formatSleepTime(minutes: number): string {
  if (minutes < 1) return '0m';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

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
