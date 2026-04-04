/**
 * Pure aggregation utility for Training Insights card.
 * Derives weekly training stats, HR zone distribution, and sport breakdown
 * from unified activities and Strava activity summaries.
 */

import { UnifiedActivity } from '../../types/activity.types';
import { StravaActivitySummary } from '../../types/strava.types';
import { getHeartRateZone } from '../ringData/heartRate';
import { getSportConfig } from '../../services/ActivityDeduplicator';

const ZONE_COLORS = ['#6B8EFF', '#8AAAFF', '#FFD700', '#FC4C02', '#FF2D2D'];

function hrToZoneIndex(hr: number): number {
  const zone = getHeartRateZone(hr);
  const ZONE_MAP: Record<string, number> = {
    'Rest': 0, 'Light': 0, 'Fat Burn': 1, 'Cardio': 2, 'Hard': 3, 'Maximum': 4,
  };
  return ZONE_MAP[zone] ?? 0;
}

export interface ZoneEntry {
  zoneIndex: number;
  seconds: number;
  color: string;
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

  const empty: TrainingInsightsData = {
    weeklyStats: { sessionCount: 0, totalDurationSec: 0, totalDistanceM: 0 },
    zoneSummary: { zones: [], totalSeconds: 0, hasExactData: false },
    sportBreakdown: [],
    overflowCount: 0,
    hasData: false,
  };

  if (weekActivities.length === 0) return empty;

  // Weekly stats — single pass
  const [totalDurationSec, totalDistanceM] = weekActivities.reduce(
    ([dur, dist], a) => [dur + a.durationSec, dist + (a.distanceM ?? 0)],
    [0, 0],
  );

  // Build zone map only from Strava activities that appear in the week window
  const weekStravaIds = new Set(
    weekActivities
      .filter((a) => a.source === 'strava')
      .map((a) => parseInt(a.id.replace('strava_', ''), 10)),
  );
  const stravaZoneMap = new Map(
    stravaActivities
      .filter((sa) => weekStravaIds.has(sa.id))
      .map((sa) => [sa.id, sa]),
  );

  // Zone aggregation
  const zoneBuckets = [0, 0, 0, 0, 0];
  let hasExactData = false;

  for (const activity of weekActivities) {
    if (activity.source === 'strava') {
      const numericId = parseInt(activity.id.replace('strava_', ''), 10);
      const hrZones = stravaZoneMap.get(numericId)?.zones_json?.heart_rate?.zones;
      if (hrZones && hrZones.length > 0) {
        hrZones.forEach((zone, i) => { if (i < 5) zoneBuckets[i] += zone.time; });
        hasExactData = true;
        continue;
      }
    }
    if (activity.avgHeartRate && activity.avgHeartRate > 0) {
      zoneBuckets[hrToZoneIndex(activity.avgHeartRate)] += activity.durationSec;
    }
  }

  const totalZoneSeconds = zoneBuckets.reduce((s, v) => s + v, 0);
  const zones: ZoneEntry[] = zoneBuckets
    .map((seconds, i) => ({ zoneIndex: i, seconds, color: ZONE_COLORS[i] }))
    .filter((z) => z.seconds > 0);

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
    zoneSummary: { zones, totalSeconds: totalZoneSeconds, hasExactData },
    sportBreakdown,
    overflowCount,
    hasData: true,
  };
}
