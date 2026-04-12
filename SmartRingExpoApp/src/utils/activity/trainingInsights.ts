/**
 * Pure aggregation utility for Training Insights card.
 * Derives weekly training stats, HR zone distribution, and sport breakdown
 * from unified activities and Strava activity summaries.
 */

import { UnifiedActivity } from '../../types/activity.types';
import { StravaActivitySummary } from '../../types/strava.types';
import { getSportConfig } from '../../services/ActivityDeduplicator';

export const ZONE_COLORS = ['#6B8EFF', '#8AAAFF', '#FFD700', '#FC4C02', '#FF2D2D'];

// Strava's default 5-zone model (from Strava help docs):
//   Z1 Active Recovery : < 55%
//   Z2 Endurance       : 55 – 75%
//   Z3 Aerobic         : 75 – 87%
//   Z4 Threshold       : 87 – 95%
//   Z5 Anaerobic       : ≥ 95%
const ZONE_UPPER_PCT = [0.55, 0.75, 0.87, 0.95, 1.0] as const;

function hrToZoneIndex(hr: number, maxHR: number): number {
  const pct = hr / maxHR;
  if (pct < 0.55) return 0;
  if (pct < 0.75) return 1;
  if (pct < 0.87) return 2;
  if (pct < 0.95) return 3;
  return 4;
}

/** Fallback BPM ranges using Strava's default percentages when no zones_json is available. */
function getFallbackBpmRanges(age: number = 30): Array<{ min: number; max: number }> {
  const maxHR = 220 - age;
  const lowers = [0, ...ZONE_UPPER_PCT.slice(0, 4)];
  return lowers.map((low, i) => ({
    min: Math.round(low * maxHR),
    max: Math.round(ZONE_UPPER_PCT[i] * maxHR) - 1,
  }));
}

/**
 * Try to extract actual BPM zone boundaries from Strava's zones_json.
 * Strava provides {min, max, time} per zone from /activities/{id}/zones endpoint.
 * These are athlete-specific and far more accurate than age-formula defaults.
 */
function extractStravaBpmRanges(
  stravaActivities: StravaActivitySummary[],
  weekStravaIds: Set<number>,
): Array<{ min: number; max: number }> | null {
  for (const sa of stravaActivities) {
    if (!weekStravaIds.has(sa.id)) continue;
    const zones = (sa.zones_json as any)?.heart_rate?.zones;
    if (Array.isArray(zones) && zones.length === 5) {
      return zones.map((z: { min: number; max: number }) => ({ min: z.min, max: z.max }));
    }
  }
  return null;
}

export interface ZoneEntry {
  zoneIndex: number;
  seconds: number;
  color: string;
  bpmMin: number;
  bpmMax: number;
  percentage: number;
}

export interface TrainingInsightsData {
  weeklyStats: {
    sessionCount: number;
    totalDurationSec: number;
    totalDistanceM: number;
  };
  zoneSummary: {
    zones: ZoneEntry[];
    totalSeconds: number;
    hasExactData: boolean;
    dominantZoneIndex: number;
  };
  sportBreakdown: Array<{
    sportType: string;
    durationSec: number;
    color: string;
  }>;
  overflowCount: number;
  hasData: boolean;
}

export function deriveTrainingInsights(
  unifiedActivities: UnifiedActivity[],
  stravaActivities: StravaActivitySummary[],
): TrainingInsightsData {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weekActivities = unifiedActivities.filter(
    (a) => new Date(a.startDate).getTime() >= cutoff,
  );

  const weekStravaIds = new Set(
    weekActivities
      .filter((a) => a.source === 'strava')
      .map((a) => parseInt(a.id.replace('strava_', ''), 10)),
  );

  // Use actual Strava zone boundaries if available; otherwise fall back to age formula.
  const bpmRanges = extractStravaBpmRanges(stravaActivities, weekStravaIds)
    ?? getFallbackBpmRanges();

  const makeEmptyZones = (): ZoneEntry[] =>
    bpmRanges.map((r, i) => ({
      zoneIndex: i,
      seconds: 0,
      color: ZONE_COLORS[i],
      bpmMin: r.min,
      bpmMax: r.max,
      percentage: 0,
    }));

  const empty: TrainingInsightsData = {
    weeklyStats: { sessionCount: 0, totalDurationSec: 0, totalDistanceM: 0 },
    zoneSummary: {
      zones: makeEmptyZones(),
      totalSeconds: 0,
      hasExactData: false,
      dominantZoneIndex: 0,
    },
    sportBreakdown: [],
    overflowCount: 0,
    hasData: false,
  };

  if (weekActivities.length === 0) return empty;

  const [totalDurationSec, totalDistanceM] = weekActivities.reduce(
    ([dur, dist], a) => [dur + a.durationSec, dist + (a.distanceM ?? 0)],
    [0, 0],
  );

  const stravaZoneMap = new Map(
    stravaActivities
      .filter((sa) => weekStravaIds.has(sa.id))
      .map((sa) => [sa.id, sa]),
  );

  // Zone aggregation
  const zoneBuckets = [0, 0, 0, 0, 0];
  let hasExactData = false;
  const defaultMaxHR = 190; // 220 - 30 (default age)

  for (const activity of weekActivities) {
    if (activity.source === 'strava') {
      const numericId = parseInt(activity.id.replace('strava_', ''), 10);
      const hrZones = (stravaZoneMap.get(numericId)?.zones_json as any)?.heart_rate?.zones;
      if (Array.isArray(hrZones) && hrZones.length > 0) {
        hrZones.forEach((zone: { time: number }, i: number) => {
          if (i < 5) zoneBuckets[i] += zone.time;
        });
        hasExactData = true;
        continue;
      }
    }
    if (activity.avgHeartRate && activity.avgHeartRate > 0) {
      zoneBuckets[hrToZoneIndex(activity.avgHeartRate, defaultMaxHR)] += activity.durationSec;
    }
  }

  const totalZoneSeconds = zoneBuckets.reduce((s, v) => s + v, 0);

  const zones: ZoneEntry[] = bpmRanges.map((r, i) => ({
    zoneIndex: i,
    seconds: zoneBuckets[i],
    color: ZONE_COLORS[i],
    bpmMin: r.min,
    bpmMax: r.max,
    percentage: totalZoneSeconds > 0 ? (zoneBuckets[i] / totalZoneSeconds) * 100 : 0,
  }));

  const dominantZoneIndex = zoneBuckets.indexOf(Math.max(...zoneBuckets));

  // Sport breakdown
  const sportMap = new Map<string, number>();
  for (const a of weekActivities) {
    sportMap.set(a.sportType, (sportMap.get(a.sportType) ?? 0) + a.durationSec);
  }
  const sortedSports = [...sportMap.entries()].sort((a, b) => b[1] - a[1]);
  const MAX_CHIPS = 4;
  const overflowCount = Math.max(0, sortedSports.length - MAX_CHIPS);
  const sportBreakdown = sortedSports.slice(0, MAX_CHIPS).map(([sportType, durationSec]) => ({
    sportType,
    durationSec,
    color: getSportConfig(sportType).color,
  }));

  return {
    weeklyStats: { sessionCount: weekActivities.length, totalDurationSec, totalDistanceM },
    zoneSummary: { zones, totalSeconds: totalZoneSeconds, hasExactData, dominantZoneIndex },
    sportBreakdown,
    overflowCount,
    hasData: true,
  };
}
