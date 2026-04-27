type SleepSeg = { stage: string; startTime: Date; endTime: Date };

export function deriveLatencyMin(bedTime: Date | null, segments: SleepSeg[]): number {
  if (!bedTime || segments.length === 0) return 0;
  let ms = 0;
  for (const seg of segments) {
    if (seg.stage !== 'awake') break;
    ms += seg.endTime.getTime() - seg.startTime.getTime();
  }
  return Math.round(ms / 60000);
}

export function deriveSleepOnset(bedTime: Date | null, segments: SleepSeg[]): Date | null {
  if (!bedTime) return null;
  const first = segments.find(s => s.stage !== 'awake');
  return first ? first.startTime : bedTime;
}

export function deriveTimeInBedMin(deep: number, light: number, rem: number, awake: number): number {
  return deep + light + rem + awake;
}

export function deriveEfficiency(deep: number, light: number, rem: number, awake: number): number {
  const total = deep + light + rem + awake;
  if (total === 0) return 0;
  return Math.round(((deep + light + rem) / total) * 100);
}

/** Returns decimal hour, mapping hours < 12 to next-day (e.g. 1 AM → 25). Used for bedtime/sleep-onset charts. */
export function toNightDecimalHour(date: Date | null): number | null {
  if (!date) return null;
  let h = date.getHours() + date.getMinutes() / 60;
  if (h < 12) h += 24;
  return h;
}

export function toDecimalHour(date: Date | null): number | null {
  if (!date) return null;
  return date.getHours() + date.getMinutes() / 60;
}

/** Format a decimal hour (possibly >24 for next-day wrap) as "9 PM" / "6:30 AM". */
export function formatClockHour(decimalH: number): string {
  const h = decimalH % 24;
  const hour = Math.floor(h);
  const min = Math.round((h - hour) * 60);
  const period = hour < 12 ? 'AM' : 'PM';
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return min > 0 ? `${h12}:${String(min).padStart(2, '0')} ${period}` : `${h12} ${period}`;
}

export function formatMinutes(min: number): string {
  if (min <= 0) return '--';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
