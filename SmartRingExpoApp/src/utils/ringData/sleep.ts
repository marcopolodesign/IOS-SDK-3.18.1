/**
 * Sleep data utilities for Smart Ring
 *
 * SDK SLEEPTYPE enum:
 * 0 = SLEEPTYPENONE    (no data)
 * 1 = SLEEPTYPESOBER   (awake)
 * 2 = SLEEPTYPELIGHT   (light sleep)
 * 3 = SLEEPTYPEDEEP    (deep sleep)
 * 4 = SLEEPTYPEREM     (REM)
 * 5 = SLEEPTYPEUNWEARED (not wearing)
 */

import UnifiedSmartRingService from '../../services/UnifiedSmartRingService';

export interface SleepSegment {
  startTime: string;
  endTime: string;
  duration: number;  // minutes
  type: number;      // 0-5 (see enum above)
  typeName: string;  // Human-readable type
}

export interface SleepInfo {
  // Total times in minutes
  totalSleepMinutes: number;
  deepMinutes: number;
  lightMinutes: number;
  remMinutes: number;
  awakeMinutes: number;
  
  // Nap data
  totalNapMinutes: number;
  
  // Timing
  fallAsleepDuration: number;  // Minutes to fall asleep
  bedTime?: string;
  wakeTime?: string;
  
  // Raw segments for detailed analysis
  segments: SleepSegment[];
  napSegments: SleepSegment[];
  
  // Metadata
  timestamp: number;
  dayIndex: number;
}

export interface SleepScore {
  score: number;      // 0-100
  quality: 'Poor' | 'Fair' | 'Good' | 'Excellent';
  breakdown: {
    duration: number;     // Points for total sleep duration
    deepSleep: number;    // Points for deep sleep %
    efficiency: number;   // Points for sleep efficiency (less awake time)
    consistency: number;  // Points for consistent sleep/wake times
  };
}

const SLEEP_TYPE_NAMES = ['None', 'Awake', 'Light', 'Deep', 'REM', 'Unweared'];

/**
 * Get sleep data for a specific day
 * @param dayIndex 0 = today, 1 = yesterday, etc. (up to 6 days)
 * @returns Detailed sleep information
 */
export async function getSleep(dayIndex: number = 0): Promise<SleepInfo> {
  const rawData = await UnifiedSmartRingService.getSleepData();

  // Log raw data
  // Process segments with type names
  const segments: SleepSegment[] = rawData.sleepSegments.map(s => ({
    ...s,
    typeName: SLEEP_TYPE_NAMES[s.type] || 'Unknown',
  }));
  
  const napSegments: SleepSegment[] = rawData.napSegments.map(s => ({
    ...s,
    typeName: SLEEP_TYPE_NAMES[s.type] || 'Unknown',
  }));
  
  // Calculate totals by type (correct mapping)
  const awakeMinutes = segments.filter(s => s.type === 1).reduce((acc, s) => acc + s.duration, 0);
  const lightMinutes = segments.filter(s => s.type === 2).reduce((acc, s) => acc + s.duration, 0);
  const deepMinutes = segments.filter(s => s.type === 3).reduce((acc, s) => acc + s.duration, 0);
  const remMinutes = segments.filter(s => s.type === 4).reduce((acc, s) => acc + s.duration, 0);
  
  const info: SleepInfo = {
    totalSleepMinutes: rawData.totalSleepMinutes,
    deepMinutes,
    lightMinutes,
    remMinutes,
    awakeMinutes,
    totalNapMinutes: rawData.totalNapMinutes,
    fallAsleepDuration: rawData.fallAsleepDuration,
    bedTime: segments[0]?.startTime,
    wakeTime: segments[segments.length - 1]?.endTime,
    segments,
    napSegments,
    timestamp: rawData.timestamp,
    dayIndex,
  };
  return info;
}

/**
 * Get sleep data for multiple days
 * @param days Number of days to fetch (1-7)
 * @returns Array of sleep info for each day
 */
export async function getSleepHistory(days: number = 7): Promise<SleepInfo[]> {
  const results: SleepInfo[] = [];
  for (let i = 0; i < Math.min(days, 7); i++) {
    try {
      const sleepData = await getSleep(i);
      results.push(sleepData);
    } catch (err) {
    }
  }
  
  return results;
}

interface SleepBreakdown {
  duration: number;
  deepSleep: number;
  efficiency: number;
  consistency: number;
}

function computeSleepBreakdown(deep: number, light: number, rem: number, awake: number): SleepBreakdown {
  const total = deep + light + rem;

  let duration = 0;
  if (total >= 420 && total <= 540) duration = 35;
  else if ((total >= 360 && total < 420) || (total > 540 && total <= 600)) duration = 25;
  else if ((total >= 300 && total < 360) || total > 600) duration = 15;
  else duration = 5;

  const deepPct = total > 0 ? (deep / total) * 100 : 0;
  let deepSleep = 0;
  if (deepPct >= 15 && deepPct <= 25) deepSleep = 25;
  else if ((deepPct >= 10 && deepPct < 15) || (deepPct > 25 && deepPct <= 30)) deepSleep = 18;
  else if (deepPct >= 5 && deepPct < 10) deepSleep = 10;
  else deepSleep = 5;

  const awakePct = total > 0 ? (awake / total) * 100 : 0;
  let efficiency = 0;
  if (awakePct <= 5) efficiency = 25;
  else if (awakePct <= 10) efficiency = 20;
  else if (awakePct <= 15) efficiency = 15;
  else if (awakePct <= 20) efficiency = 10;
  else efficiency = 5;

  const remPct = total > 0 ? (rem / total) * 100 : 0;
  let consistency = 0;
  if (remPct >= 20 && remPct <= 25) consistency = 15;
  else if ((remPct >= 15 && remPct < 20) || (remPct > 25 && remPct <= 30)) consistency = 12;
  else if (remPct >= 10) consistency = 8;
  else consistency = 5;

  return { duration, deepSleep, efficiency, consistency };
}

/** Returns a 0-100 sleep score from raw stage minutes. Single source of truth for the formula. */
export function calculateSleepScoreFromStages({
  deep,
  light,
  rem,
  awake,
}: {
  deep: number;
  light: number;
  rem: number;
  awake: number;
}): number {
  const b = computeSleepBreakdown(deep, light, rem, awake);
  return b.duration + b.deepSleep + b.efficiency + b.consistency;
}

/** Calculate a sleep quality score (0-100) with quality label and component breakdown. */
export function calculateSleepScore(sleep: SleepInfo): SleepScore {
  const breakdown = computeSleepBreakdown(
    sleep.deepMinutes,
    sleep.lightMinutes,
    sleep.remMinutes,
    sleep.awakeMinutes,
  );
  const score = breakdown.duration + breakdown.deepSleep + breakdown.efficiency + breakdown.consistency;

  let quality: SleepScore['quality'] = 'Poor';
  if (score >= 85) quality = 'Excellent';
  else if (score >= 70) quality = 'Good';
  else if (score >= 50) quality = 'Fair';

  return { score, quality, breakdown };
}

/**
 * Format sleep duration for display
 */
export function formatSleepDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/**
 * Get sleep stage color
 */
export function getSleepStageColor(type: number): string {
  switch (type) {
    case 1: return 'rgba(255, 255, 255, 0.3)'; // Awake - light gray
    case 2: return '#818CF8'; // Light - medium indigo
    case 3: return '#6366F1'; // Deep - dark indigo
    case 4: return '#A5B4FC'; // REM - light indigo
    default: return 'transparent';
  }
}

const MIN_NIGHT_DURATION_MS = 180 * 60 * 1000; // 3 hours
const MIN_WAKE_HOUR = 7; // Don't treat wakes before 7 AM as a full night

/**
 * Extracts the latest wake time (end of night) from raw SDK sleep records.
 * Only considers blocks ≥180 min that ended at or after 7 AM today.
 * Returns null if no qualifying record is found.
 */
export function extractWakeTime(rawRecords: any[]): Date | null {
  if (!rawRecords || rawRecords.length === 0) return null;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  // Look back to 6 PM yesterday to capture sleep that started the evening before
  const windowStart = todayStart - 6 * 60 * 60 * 1000;

  let latestEnd: number | null = null;

  for (const record of rawRecords) {
    const startMs = (() => {
      const candidates = [record.startTimestamp, record.startTime]
        .filter((v: any) => typeof v === 'number' && Number.isFinite(v) && v > 0);
      return candidates.length ? candidates[0] : undefined;
    })();

    if (typeof startMs !== 'number') continue;
    if (startMs < windowStart) continue;

    const qualityArray: number[] = record.arraySleepQuality || [];
    const unitLength = Number(record.sleepUnitLength || 1);
    const durationMin = Number(record.totalSleepTime) || qualityArray.length * unitLength;
    const durationMs = durationMin * 60 * 1000;

    if (durationMs < MIN_NIGHT_DURATION_MS) continue;

    const endMs = startMs + durationMs;
    if (new Date(endMs).getHours() < MIN_WAKE_HOUR) continue;

    if (!latestEnd || endMs > latestEnd) latestEnd = endMs;
  }

  return latestEnd ? new Date(latestEnd) : null;
}

/**
 * Extracts resting HR and respiratory rate from raw SDK sleep records.
 * Recursively visits the payload looking for keys like restingHR, minHR,
 * respiratoryRate, etc. Returns the last valid candidate found in each category.
 */
export function extractSleepVitalsFromRaw(rawRecords: any[]): { restingHR: number; respiratoryRate: number } {
  if (!Array.isArray(rawRecords) || rawRecords.length === 0) {
    return { restingHR: 0, respiratoryRate: 0 };
  }

  const hrCandidates: number[] = [];
  const respCandidates: number[] = [];
  const visited = new Set<any>();

  const pushIfValid = (target: number[], value: unknown, min: number, max: number) => {
    const n = Number(value);
    if (Number.isFinite(n) && n >= min && n <= max) target.push(n);
  };

  const visit = (node: any) => {
    if (!node || typeof node !== 'object' || visited.has(node)) return;
    visited.add(node);
    if (Array.isArray(node)) { for (const item of node) visit(item); return; }
    for (const [rawKey, value] of Object.entries(node as Record<string, unknown>)) {
      const lk = String(rawKey).toLowerCase();
      if (lk === 'restinghr' || lk === 'resthr' || lk === 'restingheartrate' ||
          lk === 'sleeprestinghr' || lk === 'minhr' || lk === 'minheartrate' ||
          lk === 'lowestheartrate' || /rest.*hr/.test(lk) ||
          /resting.*heart/.test(lk) || /lowest.*heart/.test(lk)) {
        pushIfValid(hrCandidates, value, 30, 90);
      }
      if (lk === 'respiratoryrate' || lk === 'respiratory_rate' || lk === 'resprate' ||
          lk === 'respr' || lk === 'breathrate' || lk === 'breathingrate' ||
          /resp/.test(lk) || /breath/.test(lk)) {
        pushIfValid(respCandidates, value, 8, 40);
      }
      if (typeof value === 'object' && value !== null) visit(value);
    }
  };

  visit(rawRecords);
  return {
    restingHR: hrCandidates.length > 0 ? Math.round(hrCandidates[hrCandidates.length - 1]) : 0,
    respiratoryRate: respCandidates.length > 0 ? Math.round(respCandidates[respCandidates.length - 1]) : 0,
  };
}
