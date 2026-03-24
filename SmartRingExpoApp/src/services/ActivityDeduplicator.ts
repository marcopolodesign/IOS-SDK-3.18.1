/**
 * ActivityDeduplicator — merge + deduplicate activities from Strava, Apple Health, and ring
 * Pure functions, no side effects. Follows NapClassifierService pattern.
 *
 * Priority: Strava > Apple Health > Ring
 * Dedup rule: if two activities overlap >70% of the shorter one's duration
 *   AND share the same sport category → keep the higher-priority source.
 */

import type { UnifiedActivity, HKWorkoutResult } from '../types/activity.types';
import type { StravaActivitySummary } from '../types/strava.types';
import type { X3ActivitySession } from '../types/sdk.types';

// ── Sport color + icon mapping ──────────────────────────────────────────────

const SPORT_CONFIG: Record<string, { color: string; icon: string }> = {
  Run:            { color: '#FC4C02', icon: 'fitness-outline' },
  TrailRun:       { color: '#FC4C02', icon: 'trail-sign-outline' },
  Ride:           { color: '#6B8EFF', icon: 'bicycle-outline' },
  Hike:           { color: '#FFB84D', icon: 'walk-outline' },
  Swim:           { color: '#B16BFF', icon: 'water-outline' },
  Walk:           { color: '#00D4AA', icon: 'walk-outline' },
  Yoga:           { color: '#E879F9', icon: 'body-outline' },
  Pilates:        { color: '#E879F9', icon: 'body-outline' },
  WeightTraining: { color: '#F97316', icon: 'barbell-outline' },
  HIIT:           { color: '#EF4444', icon: 'flame-outline' },
  CrossTraining:  { color: '#F97316', icon: 'barbell-outline' },
  CoreTraining:   { color: '#F97316', icon: 'body-outline' },
  Elliptical:     { color: '#6B8EFF', icon: 'fitness-outline' },
  Rowing:         { color: '#6B8EFF', icon: 'boat-outline' },
  Dance:          { color: '#E879F9', icon: 'musical-notes-outline' },
  Climbing:       { color: '#FFB84D', icon: 'trending-up-outline' },
  Boxing:         { color: '#EF4444', icon: 'fitness-outline' },
  Kickboxing:     { color: '#EF4444', icon: 'fitness-outline' },
  MartialArts:    { color: '#EF4444', icon: 'fitness-outline' },
  Soccer:         { color: '#22C55E', icon: 'football-outline' },
  Tennis:         { color: '#22C55E', icon: 'tennisball-outline' },
  Pickleball:     { color: '#22C55E', icon: 'tennisball-outline' },
  Basketball:     { color: '#F97316', icon: 'basketball-outline' },
  SnowSports:     { color: '#38BDF8', icon: 'snow-outline' },
  Snowboarding:   { color: '#38BDF8', icon: 'snow-outline' },
  Triathlon:      { color: '#FC4C02', icon: 'trophy-outline' },
  MixedCardio:    { color: '#EF4444', icon: 'flame-outline' },
  StairClimbing:  { color: '#FFB84D', icon: 'trending-up-outline' },
};

const DEFAULT_CONFIG = { color: '#00D4AA', icon: 'fitness-outline' };

function getSportConfig(sport: string): { color: string; icon: string } {
  return SPORT_CONFIG[sport] || DEFAULT_CONFIG;
}

// ── Normalization — group similar sports for dedup matching ──────────────────

const SPORT_CATEGORY: Record<string, string> = {
  Run: 'run', TrailRun: 'run',
  Ride: 'ride',
  Hike: 'hike', Walk: 'hike',
  Swim: 'swim',
  Yoga: 'mind_body', Pilates: 'mind_body',
  WeightTraining: 'strength', CrossTraining: 'strength', CoreTraining: 'strength',
  HIIT: 'cardio', MixedCardio: 'cardio', Elliptical: 'cardio',
  Dance: 'cardio',
  Boxing: 'combat', Kickboxing: 'combat', MartialArts: 'combat',
};

function sportCategory(sport: string): string {
  return SPORT_CATEGORY[sport] || sport.toLowerCase();
}

// ── Overlap detection ───────────────────────────────────────────────────────

interface TimeRange {
  start: number; // ms
  end: number;   // ms
}

function overlapRatio(a: TimeRange, b: TimeRange): number {
  const overlapStart = Math.max(a.start, b.start);
  const overlapEnd = Math.min(a.end, b.end);
  const overlap = Math.max(0, overlapEnd - overlapStart);
  const shorter = Math.min(a.end - a.start, b.end - b.start);
  return shorter > 0 ? overlap / shorter : 0;
}

// ── Convert sources to UnifiedActivity ──────────────────────────────────────

function stravaToUnified(s: StravaActivitySummary): UnifiedActivity {
  const sport = s.sport_type || 'Workout';
  const config = getSportConfig(sport);
  const startDate = s.start_date || new Date().toISOString();
  const startMs = new Date(startDate).getTime();
  const durationSec = s.moving_time_sec || 0;
  return {
    id: `strava_${s.id}`,
    source: 'strava',
    sportType: sport,
    name: s.name || sport,
    startDate,
    endDate: new Date(startMs + durationSec * 1000).toISOString(),
    durationSec,
    distanceM: s.distance_m ?? undefined,
    calories: s.calories ?? undefined,
    avgHeartRate: s.average_heartrate ?? undefined,
    maxHeartRate: s.max_heartrate ?? undefined,
    sufferScore: s.suffer_score ?? undefined,
    splitsJson: s.splits_metric_json,
    zonesJson: s.zones_json,
    color: config.color,
    icon: config.icon,
  };
}

function healthKitToUnified(w: HKWorkoutResult): UnifiedActivity {
  const config = getSportConfig(w.sportType);
  return {
    id: `hk_${w.uuid}`,
    source: 'appleHealth',
    sportType: w.sportType,
    name: w.name,
    startDate: w.startDate,
    endDate: w.endDate,
    durationSec: w.durationSec,
    distanceM: w.distanceM,
    calories: w.calories,
    color: config.color,
    icon: config.icon,
  };
}

function ringToUnified(session: X3ActivitySession): UnifiedActivity {
  const sport = session.typeLabel || 'Workout';
  const config = getSportConfig(sport);
  const startMs = new Date(session.startTime).getTime();
  const endMs = session.endTime
    ? new Date(session.endTime).getTime()
    : startMs + (session.duration || 0) * 60000;
  return {
    id: `ring_${startMs}`,
    source: 'ring',
    sportType: sport,
    name: sport,
    startDate: new Date(startMs).toISOString(),
    endDate: new Date(endMs).toISOString(),
    durationSec: session.duration ? session.duration * 60 : Math.round((endMs - startMs) / 1000),
    calories: session.calories,
    avgHeartRate: session.heartRateAvg,
    maxHeartRate: session.heartRateMax,
    color: config.color,
    icon: config.icon,
  };
}

// ── Main merge + dedup ──────────────────────────────────────────────────────

const OVERLAP_THRESHOLD = 0.7;

export function mergeActivities(
  strava: StravaActivitySummary[],
  healthKit: HKWorkoutResult[],
  ringActivities: X3ActivitySession[],
): UnifiedActivity[] {
  // Convert all to unified format
  const stravaUnified = strava.map(stravaToUnified);
  const hkUnified = healthKit.map(healthKitToUnified);
  const ringUnified = ringActivities.map(ringToUnified);

  // Start with Strava (highest priority)
  const result: UnifiedActivity[] = [...stravaUnified];

  // Add HealthKit workouts that don't overlap with Strava
  for (const hk of hkUnified) {
    const hkRange: TimeRange = {
      start: new Date(hk.startDate).getTime(),
      end: new Date(hk.endDate).getTime(),
    };
    const hkCat = sportCategory(hk.sportType);

    const isDuplicate = result.some((existing) => {
      const existingRange: TimeRange = {
        start: new Date(existing.startDate).getTime(),
        end: new Date(existing.endDate).getTime(),
      };
      const existingCat = sportCategory(existing.sportType);
      return hkCat === existingCat && overlapRatio(hkRange, existingRange) >= OVERLAP_THRESHOLD;
    });

    if (!isDuplicate) result.push(hk);
  }

  // Add ring activities that don't overlap with anything already in result
  for (const ring of ringUnified) {
    const ringRange: TimeRange = {
      start: new Date(ring.startDate).getTime(),
      end: new Date(ring.endDate).getTime(),
    };
    const ringCat = sportCategory(ring.sportType);

    const isDuplicate = result.some((existing) => {
      const existingRange: TimeRange = {
        start: new Date(existing.startDate).getTime(),
        end: new Date(existing.endDate).getTime(),
      };
      const existingCat = sportCategory(existing.sportType);
      return ringCat === existingCat && overlapRatio(ringRange, existingRange) >= OVERLAP_THRESHOLD;
    });

    if (!isDuplicate) result.push(ring);
  }

  // Sort by start date descending (newest first)
  result.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

  return result;
}

export { getSportConfig, sportCategory, stravaToUnified, healthKitToUnified, ringToUnified };
