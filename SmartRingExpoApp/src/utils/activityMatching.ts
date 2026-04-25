import type { UnifiedActivity } from '../types/activity.types';

export function findActivitiesForDay(activities: UnifiedActivity[], dayISO: string): UnifiedActivity[] {
  return activities.filter(a => a.startDate.startsWith(dayISO));
}

export function findActivitiesStartingInHour(
  activities: UnifiedActivity[],
  hour: number,
  refDate: Date,
): UnifiedActivity[] {
  const y = refDate.getFullYear();
  const m = String(refDate.getMonth() + 1).padStart(2, '0');
  const d = String(refDate.getDate()).padStart(2, '0');
  const dateStr = `${y}-${m}-${d}`;
  return activities.filter(a => {
    if (!a.startDate.startsWith(dateStr)) return false;
    return new Date(a.startDate).getHours() === hour;
  });
}

// Returns the activity whose [startDate, endDate] window contains timestampMs.
// When multiple activities overlap the timestamp, returns the latest-starting one.
export function findActivityAtTime(
  activities: UnifiedActivity[],
  timestampMs: number,
): UnifiedActivity | null {
  const matches = activities.filter(a => {
    const start = new Date(a.startDate).getTime();
    const end = new Date(a.endDate).getTime();
    return timestampMs >= start && timestampMs <= end;
  });
  if (!matches.length) return null;
  return matches.reduce((a, b) =>
    new Date(a.startDate).getTime() >= new Date(b.startDate).getTime() ? a : b,
  );
}
