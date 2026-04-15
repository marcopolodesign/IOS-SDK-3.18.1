import { useState, useEffect, useCallback, useRef } from 'react';
import { reportError } from '../utils/sentry';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18next from 'i18next';
import { SleepSegment, SleepStage } from '../components/home/SleepStagesChart';
import UnifiedSmartRingService from '../services/UnifiedSmartRingService';
import { supabase } from '../services/SupabaseService';
import TodayCardVitalsService, {
  CardDataStatus,
  TodayCardHydrationReason,
  TodayVitals,
  getCardDataStatusFromVitals,
  getMissingVitalKeys,
} from '../services/TodayCardVitalsService';
import dataSyncService from '../services/DataSyncService';
import type { FeatureAvailability, RecoveryContributors, SportData, X3ActivitySession } from '../types/sdk.types';
import type { SyncProgressState, MetricKey, MetricStatus, MetricSyncState } from '../types/syncStatus.types';
import type { StravaActivitySummary } from '../types/strava.types';
import type { UnifiedActivity } from '../types/activity.types';
import { Platform } from 'react-native';
import HealthKitService from '../services/HealthKitService';
import { stravaService } from '../services/StravaService';
import { mergeActivities } from '../services/ActivityDeduplicator';
import { formatSleepDuration, calculateSleepScore } from '../utils/ringData/sleep';

type AuthUser = { user_metadata?: Record<string, any>; email?: string | null } | null | undefined;

/** Resolve display name: nickname → full_name → email prefix → '' */
function resolveUserName(user: AuthUser): string {
  if (!user) return '';
  const meta = user.user_metadata;
  if (meta?.display_name) return meta.display_name;
  if (meta?.full_name) return meta.full_name;
  if (meta?.name) return meta.name;
  if (user.email) return user.email.split('@')[0];
  return '';
}

/** Resolve avatar URL from Google/OAuth metadata */
function resolveAvatarUrl(user: AuthUser): string {
  if (!user) return '';
  const meta = user.user_metadata;
  return meta?.avatar_url || meta?.picture || '';
}

const CACHE_KEY = 'home_data_cache';
const BASELINES_KEY = 'home_metric_baselines_v1';
const SYNC_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes — skip foreground sync if last sync was recent

type ContributorTrend = 'up' | 'down' | 'flat';
type ContributorConfidence = 'high' | 'medium' | 'low';

export interface ContributorChip {
  key: string;
  label: string;
  value: number | null;
  display: string;
  score: number | null;
  trend: ContributorTrend;
  confidence: ContributorConfidence;
}

export interface HomeContributors {
  sleep: ContributorChip[];
  activity: ContributorChip[];
  recovery: ContributorChip[];
  recommendations: string[];
}

interface MetricBaselines {
  sleepMinutes: number[];
  restingHR: number[];
  hrvSdnn: number[];
  temperature: number[];
  spo2: number[];
  steps: number[];
  calories: number[];
  activeMinutes: number[];
}

// Types
export interface SleepData {
  score: number;
  timeAsleep: string; // "7h 32m"
  timeAsleepMinutes: number;
  restingHR: number;
  respiratoryRate: number;
  segments: SleepSegment[];
  bedTime: Date;
  wakeTime: Date;
}

export interface ActivityData {
  score: number;
  steps: number;
  calories: number;
  distance: number; // meters
  adjustedActiveCalories: number;
  activeMinutes: number;
  workouts: Workout[];
}

export interface Workout {
  id: string;
  name: string;
  type: string;
  duration: number; // minutes
  calories: number;
  date: Date;
}

export interface StrainDayBreakdown {
  dateKey: string;                // 'YYYY-MM-DD'
  label: string;                  // 'Today' | 'Yesterday' | '2d ago' | ...
  load: number;                   // 0-100 per-day load
  weight: number;                 // normalized EWMA weight (0-1), sums to 1 across array
  activeCalories: number;
  steps: number;
  stravaSufferSum: number;
  stravaWorkouts: Array<{ name: string; sport: string; sufferScore: number }>;
}

export interface HomeData {
  overallScore: number;
  strain: number;
  strainBreakdown: StrainDayBreakdown[];  // newest-first, today at index 0
  readiness: number;
  sleepScore: number;
  lastNightSleep: SleepData;
  activity: ActivityData;
  ringBattery: number;
  isRingCharging: boolean;
  streakDays: number;
  insight: string;
  insightType: 'sleep' | 'activity' | 'general';
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;
  userName: string;
  avatarUrl: string;
  isRingConnected: boolean;
  hrChartData: Array<{ timeMinutes: number; heartRate: number }>;
  hrDataIsToday: boolean;
  hrvSdnn: number;
  todayVitals: TodayVitals;
  cardDataStatus: CardDataStatus;
  refreshMissingCardData: (reason?: TodayCardHydrationReason) => Promise<void>;
  contributors: HomeContributors;
  featureAvailability: FeatureAvailability;
  activitySessions: X3ActivitySession[];
  recoveryContributors: RecoveryContributors;
  syncProgress: SyncProgressState;
  lastSyncedAt: number | null;
  stravaActivities: StravaActivitySummary[];
  unifiedActivities: UnifiedActivity[];
  todayNaps: Array<{
    id: string;
    startTime: string;
    endTime: string;
    deepMin: number;
    lightMin: number;
    remMin: number;
    awakeMin: number;
    napScore: number | null;
    totalMin: number;
    segments: SleepSegment[];
  }>;
  totalNapMinutesToday: number;
  unifiedSleepSessions: Array<{ segments: SleepSegment[]; bedTime: Date; wakeTime: Date; label: string }>;
  totalSleepMinutes: number;
}

  // Data that we cache (subset of HomeData that makes sense to persist)
interface CachedData {
  sleepScore: number;
  lastNightSleep: {
    score: number;
    timeAsleep: string;
    timeAsleepMinutes: number;
    restingHR: number;
    respiratoryRate: number;
    bedTime: string;
    wakeTime: string;
  };
  activity: ActivityData;
  ringBattery: number;
  isRingCharging: boolean;
  overallScore: number;
  strain: number;
  readiness: number;
  cachedAt: number;
  lastSyncedAt: number | null;
  stravaActivities?: StravaActivitySummary[];
}

// Basal + adjusted active calorie estimation using static profile (to be made dynamic later)
const PROFILE = {
  age: 33,
  heightCm: 175,
  weightKg: 72,
};

const NOOP_REFRESH_MISSING_CARD_DATA = async () => {};

const getEmptyTodayVitals = (): TodayVitals => ({
  temperatureC: null,
  minSpo2: null,
  lastSpo2: null,
  updatedAt: null,
});

const getEmptyFeatureAvailability = (): FeatureAvailability => ({
  respiratoryRate: false,
  activitySessions: false,
  stressIndex: false,
  sleepHrv: false,
  osaEov: false,
  ppi: false,
});

const INITIAL_METRICS: MetricSyncState[] = [
  { key: 'sleep', label: 'Sleep', status: 'pending' },
  { key: 'battery', label: 'Battery', status: 'pending' },
  { key: 'heartRate', label: 'Heart Rate', status: 'pending' },
  { key: 'hrv', label: 'HRV', status: 'pending' },
  { key: 'steps', label: 'Steps', status: 'pending' },
  { key: 'vitals', label: 'SpO₂ & Temp', status: 'pending' },
  { key: 'cloud', label: 'Cloud Sync', status: 'pending' },
];

function updateMetric(prev: SyncProgressState, key: MetricKey, status: MetricStatus): SyncProgressState {
  return {
    ...prev,
    metrics: prev.metrics.map(m => m.key === key ? { ...m, status } : m),
  };
}

const getEmptyRecoveryContributors = (): RecoveryContributors => ({
  hrvBalance: null,
  restingHrDelta: null,
  tempDeviation: null,
  overnightSpo2: null,
  sleepImpact: null,
});

const getEmptyContributors = (): HomeContributors => ({
  sleep: [],
  activity: [],
  recovery: [],
  recommendations: [],
});

const getEmptyBaselines = (): MetricBaselines => ({
  sleepMinutes: [],
  restingHR: [],
  hrvSdnn: [],
  temperature: [],
  spo2: [],
  steps: [],
  calories: [],
  activeMinutes: [],
});

const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
};

const pushRolling = (values: number[], value: number, max: number = 14): number[] => {
  if (!Number.isFinite(value) || value <= 0) return values;
  const next = [...values, value];
  if (next.length <= max) return next;
  return next.slice(next.length - max);
};

// Compute a single day's activity load on a 0–100 scale.
// Uses the same formula as the old today-only strain, applied to any day's inputs.
const computeDailyLoad = (
  activeCalories: number,
  steps: number,
  stravaSufferSum: number | null,
): number => {
  const calStrain = Math.max(0, Math.min(100, ((activeCalories - 300) / 900) * 100));
  const stepsScore = Math.max(0, Math.min(100, (steps / 10000) * 100));
  if (stravaSufferSum != null && stravaSufferSum > 0) {
    const stravaStrain = Math.min(100, stravaSufferSum / 2);
    return 0.65 * stravaStrain + 0.35 * calStrain;
  }
  return 0.60 * calStrain + 0.40 * stepsScore;
};

// Aggregate daily loads with EWMA (newest-first order).
// α = 0.35 → today ~35%, yesterday ~23%, 2 days ago ~15%, decaying over ~5 days.
// Falls back to todayLoad when no prior days are available (no regression for new users).
const ewmaStrain = (loads: number[], alpha: number = 0.35): number => {
  if (loads.length === 0) return 0;
  let weight = 1;
  let weightedSum = 0;
  let totalWeight = 0;
  for (const load of loads) {
    weightedSum += load * weight;
    totalWeight += weight;
    weight *= (1 - alpha);
  }
  return Math.max(0, Math.min(100, Math.round(weightedSum / totalWeight)));
};

const trendFromBaseline = (
  value: number | null,
  baseline: number | null,
  epsilon: number
): ContributorTrend => {
  if (value === null || baseline === null) return 'flat';
  if (value > baseline + epsilon) return 'up';
  if (value < baseline - epsilon) return 'down';
  return 'flat';
};

const confidenceFromCoverage = (count: number): ContributorConfidence => {
  if (count >= 7) return 'high';
  if (count >= 3) return 'medium';
  return 'low';
};

const clampScore = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

const sportTypeLabel = (type: number): string => {
  switch (type) {
    case 0: return 'Walking';
    case 1: return 'Running';
    case 2: return 'Cycling';
    case 3: return 'Hiking';
    case 4: return 'Swimming';
    case 5: return 'Yoga';
    case 6: return 'Gym';
    default: return 'Workout';
  }
};

function buildContributors(
  sleep: SleepData,
  activity: ActivityData,
  hrvSdnn: number,
  vitals: TodayVitals,
  baselines: MetricBaselines,
  recoveryContributors: RecoveryContributors
): HomeContributors {
  const sleepMinutes = sleep.timeAsleepMinutes || 0;
  const restingHR = sleep.restingHR || 0;
  const tempC = vitals.temperatureC;
  const spo2 = vitals.lastSpo2 ?? vitals.minSpo2;

  const baselineSleep = median(baselines.sleepMinutes);
  const baselineRestingHR = median(baselines.restingHR);
  const baselineHrv = median(baselines.hrvSdnn);
  const baselineTemp = median(baselines.temperature);
  const baselineSpo2 = median(baselines.spo2);
  const baselineSteps = median(baselines.steps);
  const baselineCalories = median(baselines.calories);
  const baselineActive = median(baselines.activeMinutes);
  const baselineCount = Math.min(
    baselines.sleepMinutes.length,
    baselines.restingHR.length,
    baselines.steps.length
  );
  const confidence = confidenceFromCoverage(baselineCount);

  const sleepContributors: ContributorChip[] = [
    {
      key: 'duration',
      label: 'Duration',
      value: sleepMinutes > 0 ? sleepMinutes : null,
      display: sleepMinutes > 0 ? `${Math.floor(sleepMinutes / 60)}h ${sleepMinutes % 60}m` : '--',
      score: sleepMinutes > 0 ? clampScore((sleepMinutes / 480) * 100) : null,
      trend: trendFromBaseline(sleepMinutes || null, baselineSleep, 20),
      confidence,
    },
    {
      key: 'resting-hr',
      label: 'Rest HR',
      value: restingHR > 0 ? restingHR : null,
      display: restingHR > 0 ? `${restingHR} bpm` : '--',
      score: restingHR > 0 ? clampScore(((90 - restingHR) / 50) * 100) : null,
      trend: trendFromBaseline(
        restingHR > 0 && baselineRestingHR !== null ? baselineRestingHR - restingHR : null,
        0,
        2
      ),
      confidence,
    },
    {
      key: 'continuity',
      label: 'Continuity',
      value: sleep.segments.length > 0 ? sleep.segments.length : null,
      display: sleep.segments.length > 0 ? `${sleep.segments.length} segments` : '--',
      score: sleep.segments.length > 0 ? clampScore(100 - (sleep.segments.length - 4) * 7) : null,
      trend: 'flat',
      confidence,
    },
  ];

  const activityContributors: ContributorChip[] = [
    {
      key: 'steps',
      label: 'Steps',
      value: activity.steps > 0 ? activity.steps : null,
      display: activity.steps > 0 ? activity.steps.toLocaleString() : '--',
      score: activity.steps > 0 ? clampScore((activity.steps / 10000) * 100) : null,
      trend: trendFromBaseline(activity.steps || null, baselineSteps, 500),
      confidence,
    },
    {
      key: 'calories',
      label: 'Calories',
      value: activity.adjustedActiveCalories > 0 ? activity.adjustedActiveCalories : null,
      display: activity.adjustedActiveCalories > 0 ? `${activity.adjustedActiveCalories} kcal` : '--',
      score: activity.adjustedActiveCalories > 0 ? clampScore((activity.adjustedActiveCalories / 650) * 100) : null,
      trend: trendFromBaseline(activity.adjustedActiveCalories || null, baselineCalories, 60),
      confidence,
    },
    {
      key: 'active-min',
      label: 'Active Min',
      value: activity.activeMinutes > 0 ? activity.activeMinutes : null,
      display: activity.activeMinutes > 0 ? `${activity.activeMinutes} min` : '--',
      score: activity.activeMinutes > 0 ? clampScore((activity.activeMinutes / 60) * 100) : null,
      trend: trendFromBaseline(activity.activeMinutes || null, baselineActive, 8),
      confidence,
    },
  ];

  const recoveryChips: ContributorChip[] = [
    {
      key: 'hrv',
      label: 'HRV',
      value: hrvSdnn > 0 ? hrvSdnn : null,
      display: hrvSdnn > 0 ? `${hrvSdnn} ms` : '--',
      score: hrvSdnn > 0 ? clampScore((hrvSdnn / 80) * 100) : null,
      trend: trendFromBaseline(hrvSdnn || null, baselineHrv, 3),
      confidence,
    },
    {
      key: 'temp',
      label: 'Temp Dev',
      value: recoveryContributors.tempDeviation,
      display:
        recoveryContributors.tempDeviation !== null
          ? `${recoveryContributors.tempDeviation > 0 ? '+' : ''}${recoveryContributors.tempDeviation.toFixed(2)}°C`
          : '--',
      score:
        tempC !== null
          ? clampScore(100 - Math.abs((tempC - (baselineTemp ?? 36.5)) * 70))
          : null,
      trend: trendFromBaseline(tempC, baselineTemp, 0.15),
      confidence,
    },
    {
      key: 'spo2',
      label: 'SpO2',
      value: spo2 ?? null,
      display: spo2 !== null ? `${spo2}%` : '--',
      score: spo2 !== null ? clampScore(((spo2 - 90) / 10) * 100) : null,
      trend: trendFromBaseline(spo2 ?? null, baselineSpo2, 1),
      confidence,
    },
  ];

  const recommendations: string[] = [];
  if (sleepContributors[0].score !== null && sleepContributors[0].score < 65) {
    recommendations.push('Prioritize a longer sleep window tonight.');
  }
  if (activityContributors[0].score !== null && activityContributors[0].score < 60) {
    recommendations.push('Add a 20-minute walk to close your movement gap.');
  }
  if (recoveryChips[0].score !== null && recoveryChips[0].score < 45) {
    recommendations.push('Keep intensity low and focus on recovery today.');
  }
  if (recommendations.length === 0) {
    recommendations.push('Momentum is solid. Keep your routine consistent today.');
  }

  return {
    sleep: sleepContributors,
    activity: activityContributors,
    recovery: recoveryChips,
    recommendations,
  };
}

async function loadMetricBaselines(): Promise<MetricBaselines> {
  try {
    const raw = await AsyncStorage.getItem(BASELINES_KEY);
    if (!raw) return getEmptyBaselines();
    const parsed = JSON.parse(raw) as Partial<MetricBaselines>;
    return {
      sleepMinutes: Array.isArray(parsed.sleepMinutes) ? parsed.sleepMinutes.filter(v => Number.isFinite(v) && v > 0) : [],
      restingHR: Array.isArray(parsed.restingHR) ? parsed.restingHR.filter(v => Number.isFinite(v) && v > 0) : [],
      hrvSdnn: Array.isArray(parsed.hrvSdnn) ? parsed.hrvSdnn.filter(v => Number.isFinite(v) && v > 0) : [],
      temperature: Array.isArray(parsed.temperature) ? parsed.temperature.filter(v => Number.isFinite(v) && v >= 34 && v <= 42) : [],
      spo2: Array.isArray(parsed.spo2) ? parsed.spo2.filter(v => Number.isFinite(v) && v >= 70 && v <= 100) : [],
      steps: Array.isArray(parsed.steps) ? parsed.steps.filter(v => Number.isFinite(v) && v > 0) : [],
      calories: Array.isArray(parsed.calories) ? parsed.calories.filter(v => Number.isFinite(v) && v > 0) : [],
      activeMinutes: Array.isArray(parsed.activeMinutes) ? parsed.activeMinutes.filter(v => Number.isFinite(v) && v > 0) : [],
    };
  } catch (error) {
    console.log('😴 [useHomeData] Failed to load baselines:', error);
    return getEmptyBaselines();
  }
}

async function saveMetricBaselines(baselines: MetricBaselines): Promise<void> {
  try {
    await AsyncStorage.setItem(BASELINES_KEY, JSON.stringify(baselines));
  } catch (error) {
    console.log('😴 [useHomeData] Failed to save baselines:', error);
  }
}


const sanitizeActivity = (activity?: Partial<ActivityData>): ActivityData => {
  const rawCalories = Math.round(activity?.calories ?? 0);
  const steps = Math.round(activity?.steps ?? 0);
  let distanceMeters = (activity as any)?.distance ?? 0;

  // Estimate distance from steps when no distance source is available (~0.75m/step average stride)
  if (distanceMeters === 0 && steps > 0) {
    distanceMeters = steps * 0.75;
  }

  const distanceKm = distanceMeters / 1000;
  const distanceActiveEstimate = Math.max(0, distanceKm * PROFILE.weightKg); // ~1 kcal/kg/km

  // For now, lean toward the higher of ring calories and distance-derived active estimate to closer match Apple
  const adjustedActive = Math.max(rawCalories, distanceActiveEstimate);

  return {
    score: Math.round(activity?.score ?? 0),
    steps,
    calories: rawCalories,
    distance: Math.round(distanceMeters),
    adjustedActiveCalories: Math.round(adjustedActive),
    activeMinutes: Math.round(activity?.activeMinutes ?? 0),
    workouts: activity?.workouts ?? [],
  };
};

/**
 * Save data to cache for instant loading on next app open
 */
async function saveToCache(data: HomeData): Promise<void> {
  try {
    // Only cache if we have meaningful data
    if (data.sleepScore === 0 && data.activity.steps === 0) {
      return;
    }
    const cached: CachedData = {
      sleepScore: data.sleepScore,
      lastNightSleep: {
        score: data.lastNightSleep.score,
        timeAsleep: data.lastNightSleep.timeAsleep,
        timeAsleepMinutes: data.lastNightSleep.timeAsleepMinutes,
        restingHR: data.lastNightSleep.restingHR,
        respiratoryRate: data.lastNightSleep.respiratoryRate,
        bedTime: data.lastNightSleep.bedTime.toISOString(),
        wakeTime: data.lastNightSleep.wakeTime.toISOString(),
      },
      activity: data.activity,
      ringBattery: data.ringBattery,
      isRingCharging: data.isRingCharging,
      overallScore: data.overallScore,
      strain: data.strain,
      readiness: data.readiness,
      cachedAt: Date.now(),
      lastSyncedAt: data.lastSyncedAt ?? Date.now(),
      stravaActivities: data.stravaActivities,
    };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cached));
    console.log('😴 [useHomeData] Data cached successfully');
  } catch (error) {
    console.log('😴 [useHomeData] Failed to cache data:', error);
  }
}

/**
 * Load cached data from storage
 * Returns null if no cache or cache is older than 24 hours
 */
async function loadFromCache(): Promise<Partial<HomeData> | null> {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const data: CachedData = JSON.parse(cached);

    // Check if cache is older than 24 hours
    const cacheAge = Date.now() - data.cachedAt;
    const MAX_CACHE_AGE = 24 * 60 * 60 * 1000; // 24 hours

    if (cacheAge > MAX_CACHE_AGE) {
      console.log('😴 [useHomeData] Cache expired, ignoring');
      return null;
    }

    console.log('😴 [useHomeData] Loaded cached data from', new Date(data.cachedAt).toLocaleTimeString());
    return {
      sleepScore: data.sleepScore,
      lastNightSleep: {
        ...data.lastNightSleep,
        segments: [], // Don't cache segments
        bedTime: new Date(data.lastNightSleep.bedTime),
        wakeTime: new Date(data.lastNightSleep.wakeTime),
      },
      activity: sanitizeActivity(data.activity),
      ringBattery: data.ringBattery,
      isRingCharging: data.isRingCharging ?? false,
      overallScore: data.overallScore,
      strain: data.strain,
      readiness: data.readiness,
      lastSyncedAt: data.lastSyncedAt ?? data.cachedAt,
      stravaActivities: (data.stravaActivities as StravaActivitySummary[]) ?? [],
    };
  } catch (error) {
    console.log('😴 [useHomeData] Failed to load cache:', error);
    return null;
  }
}


/**
 * Map SDK sleep type to component SleepStage
 * SDK: 0=None, 1=Awake, 2=Light, 3=Deep, 4=REM, 5=Unweared
 * Component: 'awake', 'rem', 'core', 'deep'
 */
function mapSleepType(type: number): SleepStage {
  // SDK SLEEPTYPE per demo docs: 1=Deep, 2=Light, 3=REM, other=Awake/none
  switch (type) {
    case 1: return 'deep';
    case 2: return 'core';
    case 3: return 'rem';
    default: return 'awake';
  }
}

/**
 * Build SleepSegment[] from a nap's detail_json.
 * Uses rawQualityRecords if available, otherwise synthesizes a single 'core' segment.
 */
function buildNapSegments(detailJson: any, startTimeIso: string, endTimeIso: string): SleepSegment[] {
  const startDate = new Date(startTimeIso);
  const endDate = new Date(endTimeIso);

  if (detailJson?.rawQualityRecords?.length) {
    const segments: SleepSegment[] = [];
    for (const rec of detailJson.rawQualityRecords) {
      const unit = (rec.sleepUnitLength || 1) * 60000;
      let cursor = rec.startTimestamp ?? startDate.getTime();
      for (const q of (rec.arraySleepQuality || [])) {
        const stage = mapSleepType(Number(q));
        const segStart = new Date(cursor);
        const segEnd = new Date(cursor + unit);
        if (segments.length && segments[segments.length - 1].stage === stage) {
          segments[segments.length - 1].endTime = segEnd;
        } else {
          segments.push({ stage, startTime: segStart, endTime: segEnd });
        }
        cursor += unit;
      }
    }
    if (segments.length > 0) return segments;
  }

  // Fallback: single core segment spanning the full nap
  return [{ stage: 'core', startTime: startDate, endTime: endDate }];
}

/**
 * Parse "YYYY.MM.DD HH:MM:SS" string timestamps from raw SDK records.
 */
function parseStart(str?: string): number | undefined {
  if (!str) return;
  const [d, t] = str.split(' ');
  if (!d || !t) return;
  const [y, m, day] = d.split('.').map(Number);
  const [hh, mm, ss] = t.split(':').map(Number);
  if ([y, m, day, hh, mm, ss].some(n => Number.isNaN(n))) return;
  return new Date(y, (m ?? 1) - 1, day, hh, mm, ss).getTime();
}

function extractSleepVitalsFromRaw(rawRecords: any[]): { restingHR: number; respiratoryRate: number } {
  if (!Array.isArray(rawRecords) || rawRecords.length === 0) {
    return { restingHR: 0, respiratoryRate: 0 };
  }

  const hrCandidates: number[] = [];
  const respCandidates: number[] = [];
  const visited = new Set<any>();

  const pushIfValid = (target: number[], value: unknown, min: number, max: number) => {
    const n = Number(value);
    if (Number.isFinite(n) && n >= min && n <= max) {
      target.push(n);
    }
  };

  const visit = (node: any) => {
    if (!node || typeof node !== 'object' || visited.has(node)) return;
    visited.add(node);

    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }

    for (const [rawKey, value] of Object.entries(node as Record<string, unknown>)) {
      const key = String(rawKey);
      const lowerKey = key.toLowerCase();

      if (
        lowerKey === 'restinghr' ||
        lowerKey === 'resthr' ||
        lowerKey === 'restingheartrate' ||
        lowerKey === 'sleeprestinghr' ||
        lowerKey === 'minhr' ||
        lowerKey === 'minheartrate' ||
        lowerKey === 'lowestheartrate' ||
        /rest.*hr/.test(lowerKey) ||
        /resting.*heart/.test(lowerKey) ||
        /lowest.*heart/.test(lowerKey)
      ) {
        pushIfValid(hrCandidates, value, 30, 130);
      }

      if (
        lowerKey === 'respiratoryrate' ||
        lowerKey === 'respiratory_rate' ||
        lowerKey === 'resprate' ||
        lowerKey === 'respr' ||
        lowerKey === 'breathrate' ||
        lowerKey === 'breathingrate' ||
        /resp/.test(lowerKey) ||
        /breath/.test(lowerKey)
      ) {
        pushIfValid(respCandidates, value, 8, 40);
      }

      if (typeof value === 'object' && value !== null) {
        visit(value);
      }
    }
  };

  visit(rawRecords);

  return {
    restingHR: hrCandidates.length > 0 ? Math.round(hrCandidates[hrCandidates.length - 1]) : 0,
    respiratoryRate: respCandidates.length > 0 ? Math.round(respCandidates[respCandidates.length - 1]) : 0,
  };
}

/**
 * Build SleepData from raw JstyleService.getSleepData() records.
 * Smarter than buildSleepSegments: handles multi-record gaps (up to 60min),
 * builds a continuous 1-min timeline, and chooses the most recent sleep block.
 * Ported from testing.tsx (the cheatsheet).
 */
function deriveFromRaw(rawRecords: any[]): { night: SleepData | null; ringNaps: RingNapBlock[] } | null {
  if (!rawRecords || rawRecords.length === 0) return null;

  // ── RAW RECORD DUMP ────────────────────────────────────────────────────────
  console.log(`😴 [deriveFromRaw] RAW RECORDS (${rawRecords.length}):`);
  rawRecords.forEach((r, i) => {
    const startTs = r.startTimestamp || parseStart(r.startTime_SleepData);
    const startStr = startTs ? new Date(startTs).toLocaleString() : 'NO_START';
    const dur = Number(r.totalSleepTime) || (r.arraySleepQuality?.length || 0) * (Number(r.sleepUnitLength) || 1);
    console.log(`  [${i}] date=${r.date} startTime_SleepData=${r.startTime_SleepData} startTimestamp=${r.startTimestamp} → parsed=${startStr} totalSleepTime=${r.totalSleepTime} arraySleepQuality.length=${r.arraySleepQuality?.length} deep=${r.deepSleepTime} light=${r.lightSleepTime} durMin=${dur}`);
  });
  // ──────────────────────────────────────────────────────────────────────────

  const extractedVitals = extractSleepVitalsFromRaw(rawRecords);

  const normalizedAll = rawRecords.map(r => {
    const start = r.startTimestamp || parseStart(r.startTime_SleepData);
    const unit = Number(r.sleepUnitLength) || 1;
    const arr: number[] = r.arraySleepQuality || [];
    const durationMin = Number(r.totalSleepTime) || arr.length * unit;
    return { start, unit, arr, durationMin };
  }).filter(r => typeof r.start === 'number' && r.start > 0);

  if (normalizedAll.length === 0) return null;

  const sorted = [...normalizedAll].sort((a, b) => a.start! - b.start!);
  const MAX_GAP_MS = 60 * 60 * 1000;
  const blocks: { start: number; end: number; records: typeof normalizedAll }[] = [];
  let block: { start: number; end: number; records: typeof normalizedAll } | null = null;

  for (const rec of sorted) {
    const recStart = rec.start!;
    const recEnd = rec.start! + rec.durationMin * 60000;
    if (!block) {
      block = { start: recStart, end: recEnd, records: [rec] };
      continue;
    }
    if (recStart - block.end <= MAX_GAP_MS) {
      block.end = Math.max(block.end, recEnd);
      block.records.push(rec);
    } else {
      blocks.push(block);
      block = { start: recStart, end: recEnd, records: [rec] };
    }
  }
  if (block) blocks.push(block);
  if (blocks.length === 0) return null;

  console.log(`😴 [deriveFromRaw] BLOCKS (${blocks.length}):`);
  blocks.forEach((b, i) => {
    console.log(`  [${i}] ${new Date(b.start).toLocaleString()} → ${new Date(b.end).toLocaleString()} (${Math.round((b.end - b.start) / 60000)}min, ${b.records.length} records)`);
  });

  // Pick most recent night-length block (≥180min), fallback using Oura-style nap detection
  const NIGHT_THRESHOLD_MS = 180 * 60 * 1000; // 3 hours
  const nightCandidates = blocks.filter(b => (b.end - b.start) >= NIGHT_THRESHOLD_MS);

  // Oura-style: long block → always night; short block starting 8 PM–4 AM → disrupted night;
  // short block starting 4 AM–8 PM → nap (daytime), not night sleep
  let nightBlock: typeof blocks[0] | null = null;
  if (nightCandidates.length > 0) {
    nightBlock = nightCandidates.reduce((acc, b) => (b.end > acc.end ? b : acc), nightCandidates[0]);
  } else {
    const mostRecent = blocks.reduce((acc, b) => (b.end > acc.end ? b : acc), blocks[0]);
    const startHour = new Date(mostRecent.start).getHours();
    const endHour = new Date(mostRecent.end).getHours();
    // Early morning session (3–9 AM start, ends before 9 AM) = morning wake phase, not a daytime nap.
    // Catches V8 band behavior where only the last sleep fragment before waking is recorded.
    const isEarlyMorning = startHour >= 3 && startHour < 10 && endHour < 9;
    const isNapLike = startHour >= 4 && startHour < 20 && !isEarlyMorning;
    if (!isNapLike) nightBlock = mostRecent; // nighttime or early-morning wake phase → disrupted night
  }

  if (nightBlock) {
    console.log(`🛏️ [deriveFromRaw] ${blocks.length} blocks, ${nightCandidates.length} night candidates → chosen: ${new Date(nightBlock.start).toLocaleString()} → ${new Date(nightBlock.end).toLocaleString()} (${Math.round((nightBlock.end - nightBlock.start) / 60000)}min)`);
  } else {
    console.log(`🛏️ [deriveFromRaw] ${blocks.length} blocks are nap-like (daytime start) → no night block, will use Supabase fallback`);
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartMs = todayStart.getTime();

  // When all ring blocks are nap-like, return them as ringNaps with null night
  if (!nightBlock) {
    const ringNapsFromNullNight = blocks
      .filter(b => b.start >= todayStartMs && (b.end - b.start) <= NIGHT_THRESHOLD_MS)
      .map(blockToRingNap)
      .filter(n => n.totalMin > 0);
    console.log(`🛏️ [deriveFromRaw] ringNaps (null-night path): ${ringNapsFromNullNight.length}`);
    return { night: null, ringNaps: ringNapsFromNullNight };
  }

  const nightResult = buildBlockResult(nightBlock, extractedVitals);
  if (!nightResult) return null;

  // Remaining blocks are ring-detected nap candidates
  // Only include blocks from TODAY that are short (<180min = nap threshold from NapClassifierService)
  const MAX_NAP_DURATION_MS = 180 * 60 * 1000; // 3 hours

  const ringNaps: RingNapBlock[] = blocks
    .filter(b => b !== nightBlock)
    .filter(b => {
      const dur = b.end - b.start;
      const isToday = b.start >= todayStartMs;
      const isShort = dur <= MAX_NAP_DURATION_MS;
      return isToday && isShort;
    })
    .map(blockToRingNap)
    .filter(n => n.totalMin > 0);

  console.log(`🛏️ [deriveFromRaw] ringNaps after filter: ${ringNaps.length}`);

  return { night: nightResult, ringNaps };
}

interface RingNapBlock {
  startMs: number;
  endMs: number;
  segments: SleepSegment[];
  deepMin: number;
  lightMin: number;
  remMin: number;
  awakeMin: number;
  totalMin: number;
}

function blockToRingNap(b: { start: number; end: number; records: any[] }): RingNapBlock {
  const segs = buildBlockSegments(b);
  const totalMin = Math.max(0, Math.round((b.end - b.start) / 60000));
  let deepMin = 0, lightMin = 0, remMin = 0, awakeMin = 0;
  for (const seg of segs) {
    const durMin = Math.round((seg.endTime.getTime() - seg.startTime.getTime()) / 60000);
    if (seg.stage === 'deep') deepMin += durMin;
    else if (seg.stage === 'core') lightMin += durMin;
    else if (seg.stage === 'rem') remMin += durMin;
    else awakeMin += durMin;
  }
  return { startMs: b.start, endMs: b.end, segments: segs, deepMin, lightMin, remMin, awakeMin, totalMin: deepMin + lightMin + remMin };
}

function buildBlockSegments(block: { start: number; end: number; records: Array<{ start: number | undefined; unit: number; arr: number[]; durationMin: number }> }): SleepSegment[] {
  const totalMinutes = Math.max(0, Math.round((block.end - block.start) / 60000));
  if (totalMinutes === 0) return [];
  const timeline: number[] = new Array(totalMinutes).fill(0);
  for (const rec of block.records) {
    const startOffset = Math.round((rec.start! - block.start) / 60000);
    const unit = Math.max(1, rec.unit);
    rec.arr.forEach((val: number, idx: number) => {
      const stage = mapSleepType(Number(val));
      const stageVal = stage === 'deep' ? 3 : stage === 'rem' ? 2 : stage === 'core' ? 1 : 0;
      for (let k = 0; k < unit; k++) {
        const pos = startOffset + idx * unit + k;
        if (pos >= 0 && pos < timeline.length) timeline[pos] = stageVal;
      }
    });
  }
  const segments: SleepSegment[] = [];
  for (let i = 0; i < timeline.length; i++) {
    const val = timeline[i];
    const stage: SleepStage = val === 3 ? 'deep' : val === 2 ? 'rem' : val === 1 ? 'core' : 'awake';
    const startMs = block.start + i * 60000;
    const endMs = startMs + 60000;
    if (segments.length && segments[segments.length - 1].stage === stage) {
      segments[segments.length - 1].endTime = new Date(endMs);
    } else {
      segments.push({ stage, startTime: new Date(startMs), endTime: new Date(endMs) });
    }
  }
  return segments;
}

function buildBlockResult(
  block: { start: number; end: number; records: Array<{ start: number | undefined; unit: number; arr: number[]; durationMin: number }> },
  extractedVitals: { restingHR: number; respiratoryRate: number },
): SleepData | null {
  const totalMinutes = Math.max(0, Math.round((block.end - block.start) / 60000));
  if (totalMinutes === 0) return null;

  const segments = buildBlockSegments(block);
  const timeline = new Array(totalMinutes).fill(0);
  for (const rec of block.records) {
    const startOffset = Math.round((rec.start! - block.start) / 60000);
    const unit = Math.max(1, rec.unit);
    rec.arr.forEach((val: number, idx: number) => {
      const stage = mapSleepType(Number(val));
      const stageVal = stage === 'deep' ? 3 : stage === 'rem' ? 2 : stage === 'core' ? 1 : 0;
      for (let k = 0; k < unit; k++) {
        const pos = startOffset + idx * unit + k;
        if (pos >= 0 && pos < timeline.length) timeline[pos] = stageVal;
      }
    });
  }

  let deepMinutes = 0, remMinutes = 0, lightMinutes = 0, awakeMinutes = 0;
  for (const v of timeline) {
    if (v === 3) deepMinutes++;
    else if (v === 2) remMinutes++;
    else if (v === 1) lightMinutes++;
    else awakeMinutes++;
  }
  const actualSleepMinutes = deepMinutes + lightMinutes + remMinutes;
  const { score } = calculateSleepScore({
    totalSleepMinutes: actualSleepMinutes,
    deepMinutes,
    lightMinutes,
    remMinutes,
    awakeMinutes,
    totalNapMinutes: 0,
    fallAsleepDuration: 0,
    segments: [],
    napSegments: [],
    timestamp: 0,
    dayIndex: 0,
  });

  return {
    score,
    timeAsleep: formatSleepDuration(actualSleepMinutes),
    timeAsleepMinutes: actualSleepMinutes,
    restingHR: extractedVitals.restingHR,
    respiratoryRate: extractedVitals.respiratoryRate,
    segments,
    bedTime: new Date(block.start),
    wakeTime: new Date(block.end),
  };
}


function generateInsight(sleepScore: number, activityScore: number): { insight: string; type: 'sleep' | 'activity' | 'general' } {
  const t = i18next.t.bind(i18next);
  const insights = [
    {
      condition: sleepScore > 85,
      insight: t('overview.insight_sleep_great'),
      type: 'sleep' as const,
    },
    {
      condition: sleepScore < 70,
      insight: t('overview.insight_sleep_poor'),
      type: 'sleep' as const,
    },
    {
      condition: activityScore < 50,
      insight: t('overview.insight_activity_low'),
      type: 'activity' as const,
    },
    {
      condition: activityScore > 80,
      insight: t('overview.insight_activity_great'),
      type: 'activity' as const,
    },
    {
      condition: true,
      insight: t('overview.insight_general'),
      type: 'general' as const,
    },
  ];

  const match = insights.find(i => i.condition);
  return match || insights[insights.length - 1];
}

// Calculate overall score from components
function calculateOverallScore(sleep: number, activity: number, hrv?: number): number {
  // Weighted average: sleep 40%, activity 30%, HRV 30%
  const hrvScore = hrv || 70; // Default HRV score if not available
  return Math.round(sleep * 0.4 + activity * 0.3 + hrvScore * 0.3);
}

// Default empty data state
const getEmptyData = (): HomeData => ({
  overallScore: 0,
  strain: 0,
  strainBreakdown: [],
  readiness: 0,
  sleepScore: 0,
  lastNightSleep: {
    score: 0,
    timeAsleep: '0h 0m',
    timeAsleepMinutes: 0,
    restingHR: 0,
    respiratoryRate: 0,
    segments: [],
    bedTime: new Date(),
    wakeTime: new Date(),
  },
  activity: {
    score: 0,
    steps: 0,
    calories: 0,
    distance: 0,
    adjustedActiveCalories: 0,
    activeMinutes: 0,
    workouts: [],
  },
  ringBattery: 0,
  isRingCharging: false,
  streakDays: 0,
  insight: '',
  insightType: 'general',
  isLoading: true,
  isSyncing: true, // Start with syncing true so we show syncing indicator on app open
  error: null,
  userName: '',
  avatarUrl: '',
  isRingConnected: false,
  hrChartData: [],
  hrDataIsToday: false,
  hrvSdnn: 0,
  todayVitals: getEmptyTodayVitals(),
  cardDataStatus: 'idle',
  refreshMissingCardData: NOOP_REFRESH_MISSING_CARD_DATA,
  contributors: getEmptyContributors(),
  featureAvailability: getEmptyFeatureAvailability(),
  activitySessions: [],
  recoveryContributors: getEmptyRecoveryContributors(),
  syncProgress: {
    phase: 'idle',
    showSheet: false,
    metrics: [...INITIAL_METRICS],
  },
  lastSyncedAt: null,
  stravaActivities: [],
  unifiedActivities: [],
  todayNaps: [],
  totalNapMinutesToday: 0,
  unifiedSleepSessions: [],
  totalSleepMinutes: 0,
});

// Hook
export function useHomeData(enabled = true): HomeData & { refresh: () => Promise<void> } {
  const [data, setData] = useState<HomeData>(getEmptyData);

  // Track app state for foreground detection
  const appState = useRef(AppState.currentState);
  const lastFetchTime = useRef<number>(0);
  const MIN_FETCH_INTERVAL = 3000; // Minimum 3 seconds between fetches
  const hasLoadedRealData = useRef(false); // Track if we've successfully loaded real data
  const hasLoadedCache = useRef(false); // Track if we've loaded cached data
  const isFetchingData = useRef(false); // Track if we're currently fetching to prevent concurrent fetches
  const lastSyncCompletedAt = useRef<number>(0); // Timestamp of last successful sync (for foreground cooldown)
  const currentVitalsRef = useRef<TodayVitals>(getEmptyTodayVitals());
  const baselinesRef = useRef<MetricBaselines>(getEmptyBaselines());
  const delayedVitalsRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    currentVitalsRef.current = data.todayVitals;
  }, [data.todayVitals]);

  const runRefreshMissingCardData = useCallback(
    async (reason: TodayCardHydrationReason, allowDelayedRetry: boolean) => {
      const missingBefore = getMissingVitalKeys(currentVitalsRef.current);
      if (missingBefore.length === 0) {
        setData(prev => ({ ...prev, cardDataStatus: 'ready' }));
        return;
      }

      setData(prev => ({ ...prev, cardDataStatus: 'retrying' }));
      const cachedVitals = await TodayCardVitalsService.loadCachedVitals();
      const result = await TodayCardVitalsService.hydrateMissingVitals({
        reason,
        currentVitals: currentVitalsRef.current,
        cachedVitals,
      });

      setData(prev => ({
        ...prev,
        todayVitals: result.vitals,
        cardDataStatus: result.status,
        recoveryContributors: {
          ...prev.recoveryContributors,
          tempDeviation:
            result.vitals.temperatureC !== null
              ? Number(
                  (
                    result.vitals.temperatureC -
                    (median(baselinesRef.current.temperature) ?? 36.5)
                  ).toFixed(2)
                )
              : prev.recoveryContributors.tempDeviation,
          overnightSpo2: result.vitals.lastSpo2 ?? result.vitals.minSpo2 ?? prev.recoveryContributors.overnightSpo2,
        },
        contributors: buildContributors(
          prev.lastNightSleep,
          prev.activity,
          prev.hrvSdnn,
          result.vitals,
          baselinesRef.current,
          {
            ...prev.recoveryContributors,
            tempDeviation:
              result.vitals.temperatureC !== null
                ? Number(
                    (
                      result.vitals.temperatureC -
                      (median(baselinesRef.current.temperature) ?? 36.5)
                    ).toFixed(2)
                  )
                : prev.recoveryContributors.tempDeviation,
            overnightSpo2: result.vitals.lastSpo2 ?? result.vitals.minSpo2 ?? prev.recoveryContributors.overnightSpo2,
          }
        ),
      }));

      if (allowDelayedRetry && result.shouldScheduleDelayedRetry) {
        if (delayedVitalsRetryRef.current) {
          clearTimeout(delayedVitalsRetryRef.current);
        }
        delayedVitalsRetryRef.current = setTimeout(() => {
          delayedVitalsRetryRef.current = null;
          UnifiedSmartRingService.isConnected()
            .then(status => {
              if (!status.connected) {
                console.log('[useHomeData] Skipping delayed vitals retry (ring disconnected)');
                return;
              }
              void runRefreshMissingCardData(reason, false);
            })
            .catch(error => {
              console.log('[useHomeData] Delayed vitals retry connection check failed:', error);
            });
        }, 10000);
      }
    },
    []
  );

  const refreshMissingCardData = useCallback(
    async (reason: TodayCardHydrationReason = 'manual') => {
      await runRefreshMissingCardData(reason, true);
    },
    [runRefreshMissingCardData]
  );

  // Load cached data immediately on mount for instant display
  useEffect(() => {
    if (!enabled) {
      hasLoadedCache.current = false; // Reset so cache reloads on re-enable
      return;
    }
    if (hasLoadedCache.current) return;
    hasLoadedCache.current = true;

    loadFromCache().then(cached => {
      if (cached) {
        console.log('😴 [useHomeData] Applying cached data for instant display');
        setData(prev => ({
          ...prev,
          ...cached,
          isLoading: true, // Still loading fresh data
          isSyncing: true, // Show syncing indicator
        }));
      }
    });
  }, [enabled]);

  // Load cached today-card vitals immediately on mount.
  useEffect(() => {
    if (!enabled) return;
    TodayCardVitalsService.loadCachedVitals().then(cachedVitals => {
      if (!cachedVitals) return;
      setData(prev => {
        const mergedVitals: TodayVitals = {
          temperatureC: prev.todayVitals.temperatureC ?? cachedVitals.temperatureC,
          minSpo2: prev.todayVitals.minSpo2 ?? cachedVitals.minSpo2,
          lastSpo2: prev.todayVitals.lastSpo2 ?? cachedVitals.lastSpo2,
          updatedAt: prev.todayVitals.updatedAt ?? cachedVitals.updatedAt,
        };
        const nextStatus = getCardDataStatusFromVitals(mergedVitals);
        console.log('[useHomeData] Applied cached today vitals');
        return {
          ...prev,
          todayVitals: mergedVitals,
          cardDataStatus: prev.cardDataStatus === 'retrying' ? prev.cardDataStatus : nextStatus,
        };
      });
    });
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    loadMetricBaselines().then(baselines => {
      baselinesRef.current = baselines;
    });
  }, [enabled]);

  // Listen for auth state changes to update userName from user_metadata
  useEffect(() => {
    if (!enabled) return;
    // Get initial user
    supabase.auth.getUser().then(({ data: { user } }) => {
      const name = resolveUserName(user);
      const avatar = resolveAvatarUrl(user);
      if (name || avatar) {
        setData(prev => ({
          ...prev,
          ...(name && { userName: name }),
          ...(avatar && { avatarUrl: avatar }),
        }));
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const name = resolveUserName(session?.user);
      const avatar = resolveAvatarUrl(session?.user);
      if (name || avatar) {
        setData(prev => ({
          ...prev,
          ...(name && { userName: name }),
          ...(avatar && { avatarUrl: avatar }),
        }));
      }
    });

    return () => subscription.unsubscribe();
  }, [enabled]);

  const fetchData = useCallback(async (
    forceRefresh = false,
    hydrationReason: TodayCardHydrationReason = 'manual'
  ) => {
    // ─── EXACT testing.tsx pattern ───────────────────────────────────────────
    // Sequential, one BLE call at a time, each step individually caught.
    // Sleep uses getSleepData() raw (not getSleepByDay) + deriveFromRaw().
    // On retry the native SDK already has the data → returns immediately.

    if (isFetchingData.current) return;
    isFetchingData.current = true;
    try {
      const now = Date.now();
      if (!forceRefresh && now - lastFetchTime.current < MIN_FETCH_INTERVAL) {
        return;
      }
      lastFetchTime.current = now;

      // ── Stage timing instrumentation ─────────────────────────────────────────
      const syncStart = Date.now();
      const logStage = (label: string, since: number) =>
        console.log(`[sync] ${label} ${Date.now() - since}ms`);

      // ── Pre-check: BLE status + auth — runs before isSyncing so we know
      // alreadyConnected before deciding whether to show the bottom sheet ──
      const [statusResult, authResult] = await Promise.all([
        UnifiedSmartRingService.isConnected().catch(() => ({ connected: false })),
        supabase.auth.getUser(),
      ]);
      logStage('precheck', syncStart);
      const alreadyConnected = (statusResult as any).connected ?? false;
      const userName = resolveUserName(authResult.data?.user);
      const avatarUrl = resolveAvatarUrl(authResult.data?.user);
      const userId = authResult.data?.user?.id;

      // ── Sync progress tracking ──
      // showSheet: only on cold-start (initial) when ring is not already connected
      const showSheet = hydrationReason === 'initial' && !alreadyConnected;
      let sp: SyncProgressState = {
        phase: 'connecting',
        showSheet,
        metrics: [...INITIAL_METRICS],
      };
      const updateSP = (update: Partial<SyncProgressState> | ((prev: SyncProgressState) => SyncProgressState)) => {
        sp = typeof update === 'function' ? update(sp) : { ...sp, ...update };
        setData(prev => ({ ...prev, syncProgress: sp }));
      };

      setData(prev => ({ ...prev, isSyncing: true, error: null, syncProgress: sp }));

      // Fire reconnect immediately if needed (don't await yet)
      const reconnectPromise: Promise<{ success: boolean }> = alreadyConnected
        ? Promise.resolve({ success: true })
        : UnifiedSmartRingService.autoReconnect();
      if (!alreadyConnected) {
        console.log('🔄 [useHomeData] autoReconnect...');
      }

      // Auto-sync Strava before reading from Supabase (rate-limited: once per 30 min).
      // Awaited so the Supabase query below always sees the freshest activities.
      // Runs in parallel with ring reconnect above — no added wall-clock time on most calls.
      const STRAVA_SYNC_INTERVAL_MS = 10 * 60 * 1000;
      try {
        const lastSyncRaw = await AsyncStorage.getItem('strava_last_auto_sync_v1');
        if (!lastSyncRaw || Date.now() - Number(lastSyncRaw) > STRAVA_SYNC_INTERVAL_MS) {
          const r = await stravaService.backgroundSync(3).catch(() => null);
          if (r !== null) {
            await AsyncStorage.setItem('strava_last_auto_sync_v1', String(Date.now()));
            console.log(`🏃 [useHomeData] Auto Strava sync: ${r.count} new activities`);
          }
        }
      } catch {}

      // Fetch Strava + naps + HealthKit workouts + HK activity metrics in parallel while ring connects
      let stravaActivities: StravaActivitySummary[] = [];
      let todayNaps: HomeData['todayNaps'] = [];
      let hkWorkouts: import('../types/activity.types').HKWorkoutResult[] = [];
      let hkSteps = 0;
      let hkActiveCalories = 0;
      let hkDistanceM = 0;
      if (userId) {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0); // local midnight
        const todayEnd = new Date(todayStart);
        todayEnd.setDate(todayEnd.getDate() + 1);

        const [stravaResult, napResult, hkWorkoutResult, hkStepsResult, hkCalResult, hkDistResult] = await Promise.all([
          supabase
            .from('strava_activities')
            .select('id, name, sport_type, start_date, distance_m, moving_time_sec, average_heartrate, max_heartrate, suffer_score, calories, splits_metric_json, zones_json')
            .eq('user_id', userId)
            .gte('start_date', sevenDaysAgo.toISOString())
            .order('start_date', { ascending: false }),
          supabase
            .from('sleep_sessions')
            .select('id, start_time, end_time, deep_min, light_min, rem_min, awake_min, nap_score, detail_json')
            .eq('user_id', userId)
            .eq('session_type', 'nap')
            .gte('start_time', todayStart.toISOString())
            .lte('start_time', todayEnd.toISOString())
            .order('start_time', { ascending: true }),
          // HealthKit workouts (7 days, iOS only — returns [] on Android)
          HealthKitService.fetchWeekWorkouts().catch(() => []),
          // HealthKit activity metrics (iOS only — for max() blending with ring)
          Platform.OS === 'ios' ? HealthKitService.fetchSteps().catch(() => ({ steps: 0, samples: [], source: 'error' })) : { steps: 0, samples: [], source: 'skip' },
          Platform.OS === 'ios' ? HealthKitService.fetchActiveCalories().catch(() => ({ calories: 0, source: 'error' })) : { calories: 0, source: 'skip' },
          Platform.OS === 'ios' ? HealthKitService.fetchDistance().catch(() => ({ distanceM: 0, source: 'error' })) : { distanceM: 0, source: 'skip' },
        ]);
        stravaActivities = (stravaResult.data as unknown as StravaActivitySummary[]) ?? [];
        hkWorkouts = hkWorkoutResult;
        hkSteps = (hkStepsResult as any).steps || 0;
        hkActiveCalories = (hkCalResult as any).calories || 0;
        hkDistanceM = (hkDistResult as any).distanceM || 0;
        if (hkSteps > 0 || hkActiveCalories > 0 || hkDistanceM > 0) {
          console.log(`🍎 [useHomeData] HealthKit activity: steps=${hkSteps}, cal=${hkActiveCalories}, dist=${hkDistanceM}m`);
        }
        todayNaps = ((napResult.data as any[]) ?? []).map(s => ({
          id: s.id,
          startTime: s.start_time,
          endTime: s.end_time,
          deepMin: s.deep_min || 0,
          lightMin: s.light_min || 0,
          remMin: s.rem_min || 0,
          awakeMin: s.awake_min || 0,
          napScore: s.nap_score,
          totalMin: (s.deep_min || 0) + (s.light_min || 0) + (s.rem_min || 0),
          segments: buildNapSegments(s.detail_json, s.start_time, s.end_time),
        }));
      }

      // Await reconnect (likely already done since Strava fetch ran concurrently)
      const reconnectStart = Date.now();
      const reconnectResult = await reconnectPromise;
      if (!alreadyConnected) logStage('autoReconnect', reconnectStart);
      if (!alreadyConnected) {
        if (!reconnectResult.success) {
          // ── HealthKit fallback when ring is not connected ──
          if (Platform.OS === 'ios') {
            try {
              const hkConnected = await HealthKitService.isConnected();
              if ((hkConnected && HealthKitService.hasAuthorization) || await HealthKitService.checkPermissions()) {
                console.log('🍎 [useHomeData] Ring not connected, trying HealthKit fallback...');
                const hkData = await HealthKitService.fetchAllHealthData().catch(() => null);
                if (hkData) {
                  const hkFbSleep = hkData.sleep;
                  const hkFbSteps = hkData.steps;
                  const hkFbHR = hkData.heartRate;
                  const hkFbHRV = hkData.hrv;

                  setData(prev => ({
                    ...prev,
                    userName,
                    isLoading: false,
                    isSyncing: false,
                    isRingConnected: false,
                    error: null,
                    syncProgress: { ...sp, phase: 'idle' },
                    // Fill in HealthKit data as fallback
                    ...(hkFbSleep ? {
                      sleepScore: hkFbSleep.sleepEfficiency,
                      lastNightSleep: {
                        score: hkFbSleep.sleepEfficiency,
                        timeAsleep: formatSleepDuration(hkFbSleep.totalSleep),
                        timeAsleepMinutes: hkFbSleep.totalSleep,
                        restingHR: prev.lastNightSleep.restingHR,
                        respiratoryRate: prev.lastNightSleep.respiratoryRate,
                        segments: prev.lastNightSleep.segments,
                        bedTime: hkFbSleep.bedTime ? new Date(hkFbSleep.bedTime) : prev.lastNightSleep.bedTime,
                        wakeTime: hkFbSleep.wakeTime ? new Date(hkFbSleep.wakeTime) : prev.lastNightSleep.wakeTime,
                      },
                    } : {}),
                    ...((hkFbSteps.steps > 0 || hkActiveCalories > 0 || hkDistanceM > 0) ? {
                      activity: (() => {
                        const s = Math.max(prev.activity.steps, hkFbSteps.steps);
                        return sanitizeActivity({
                          ...prev.activity,
                          steps: s,
                          calories: Math.max(prev.activity.calories, hkActiveCalories),
                          distance: Math.max(prev.activity.distance, hkDistanceM),
                          score: Math.min(100, Math.round((s / 10000) * 100)),
                        });
                      })(),
                    } : {}),
                    ...(hkFbHRV ? { hrvSdnn: hkFbHRV.sdnn } : {}),
                    // Unified activities from Strava + HealthKit (no ring sessions when disconnected)
                    stravaActivities,
                    unifiedActivities: mergeActivities(stravaActivities, hkWorkouts, []),
                  }));
                  console.log('🍎 [useHomeData] HealthKit fallback applied:', {
                    sleep: hkFbSleep?.totalSleep,
                    steps: hkFbSteps.steps,
                    calories: hkActiveCalories,
                    distance: hkDistanceM,
                    hr: hkFbHR?.heartRate,
                    hrv: hkFbHRV?.sdnn,
                  });
                  return;
                }
              }
            } catch (hkError) {
              console.log('🍎 [useHomeData] HealthKit fallback failed:', hkError);
            }
          }

          updateSP({ phase: 'idle' });
          setData(prev => ({ ...prev, userName, avatarUrl, isLoading: false, isSyncing: false, isRingConnected: false, error: 'Ring not connected.', syncProgress: sp }));
          return;
        }
        updateSP({ phase: 'connected' });
        await new Promise(r => setTimeout(r, 50));
      } else {
        console.log('✅ [useHomeData] already connected, skipping autoReconnect');
      }
      updateSP({ phase: 'syncing' });
      console.log('📱 [useHomeData] SDK path:', UnifiedSmartRingService.getConnectedSDKType());
      console.log('✅ [useHomeData] connected');

      // 2. Sleep — getSleepData() raw + deriveFromRaw() (EXACT testing.tsx pattern)
      //    First call always times out (~10 s) while BLE transfers data from ring.
      //    Second call returns immediately from native cache. We retry automatically.
      let finalSleepData: SleepData | null = null;
      let ringNaps: RingNapBlock[] = [];

      const sleepStart = Date.now();
      updateSP(prev => updateMetric(prev, 'sleep', 'loading'));
      for (let attempt = 1; attempt <= 3 && !finalSleepData; attempt++) {
        try {
          console.log(`😴 [useHomeData] getSleepData attempt ${attempt}...`);
          const rawResult = await UnifiedSmartRingService.getSleepDataRaw();
          const rawRecords: any[] = (rawResult as any).data || (rawResult as any).records || [];
          console.log(`😴 [useHomeData] getSleepData attempt ${attempt} records:`, rawRecords.length);
          const derived = deriveFromRaw(rawRecords);
          if (derived) {
            finalSleepData = derived.night; // may be null if all ring blocks were nap-like
            ringNaps = derived.ringNaps;
            console.log('✅ [useHomeData] sleep derived:', derived.night?.score, derived.night?.timeAsleep, 'ringNaps:', ringNaps.length);
          }
        } catch (e: any) {
          console.log(`😴 [useHomeData] getSleepData attempt ${attempt} failed:`, e?.message);
          // Brief pause before retry so native SDK can settle (mirrors time between user taps in testing.tsx)
          if (attempt < 3) await new Promise(r => setTimeout(r, 1000));
        }
      }
      // Supabase fallback: if ring returned no sleep, try last night from cloud
      if (!finalSleepData && userId) {
        try {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          yesterday.setHours(18, 0, 0, 0); // 6 PM yesterday (overnight window)
          const { data: sbSleep } = await supabase
            .from('sleep_sessions')
            .select('sleep_score, deep_min, light_min, rem_min, awake_min, start_time, end_time, detail_json')
            .eq('user_id', userId)
            .neq('session_type', 'nap')
            .gte('start_time', yesterday.toISOString())
            .order('start_time', { ascending: false })
            .limit(1);
          const s = (sbSleep as any)?.[0];
          if (s && s.start_time && s.end_time) {
            const deepMin = s.deep_min || 0;
            const lightMin = s.light_min || 0;
            const remMin = s.rem_min || 0;
            const awakeMin = s.awake_min || 0;
            const totalMin = deepMin + lightMin + remMin;
            finalSleepData = {
              score: s.sleep_score || 0,
              timeAsleep: formatSleepDuration(totalMin),
              timeAsleepMinutes: totalMin,
              restingHR: 0,
              respiratoryRate: 0,
              segments: [],
              bedTime: new Date(s.start_time),
              wakeTime: new Date(s.end_time),
            };
            console.log(`✅ [useHomeData] sleep from Supabase: score=${s.sleep_score}, ${formatSleepDuration(totalMin)}`);
          }
        } catch (e: any) {
          console.log('⚠️ [useHomeData] Supabase sleep fallback failed:', e?.message);
        }
      }

      updateSP(prev => updateMetric(prev, 'sleep', finalSleepData ? 'done' : 'error'));
      logStage('sleep', sleepStart);

      if (finalSleepData) hasLoadedRealData.current = true;

      // 3. Battery (testing.tsx pattern)
      let ringBattery = 0;
      let isRingCharging = false;
      const battStart = Date.now();
      updateSP(prev => updateMetric(prev, 'battery', 'loading'));
      try {
        const batt = await UnifiedSmartRingService.getBattery();
        ringBattery = batt.battery;
        isRingCharging = batt.isCharging ?? false;
        console.log('✅ [useHomeData] battery:', ringBattery, 'charging:', isRingCharging);
        updateSP(prev => updateMetric(prev, 'battery', 'done'));
      } catch (e) {
        console.log('⚠️ [useHomeData] battery failed:', e);
        updateSP(prev => updateMetric(prev, 'battery', 'error'));
      }
      logStage('battery', battStart);

      // 4. Continuous HR → resting HR + hrChartData (testing.tsx pattern)
      let restingHR = 0;
      let hrDataIsToday = false;
      const hrChartData: Array<{ timeMinutes: number; heartRate: number }> = [];
      const hrStart = Date.now();
      updateSP(prev => updateMetric(prev, 'heartRate', 'loading'));
      try {
      const hrRaw = await UnifiedSmartRingService.getContinuousHeartRateRaw();
      console.log('📊 [useHomeData] HR raw records:', hrRaw.records?.length, hrRaw.records?.map((r: any) => ({
        date: r.date,
        ts: r.startTimestamp,
        dynLen: r.arrayDynamicHR?.length,
      })));
      const samples: number[] = [];
      const now = new Date();
      const todayDateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
      const getRecordDateStr = (rec: any): string => {
        const ts = rec.startTimestamp;
        if (typeof ts === 'number' && ts > 1e10) {
          const d = new Date(ts);
          return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
        }
        const dateStr = typeof rec.date === 'string' ? rec.date : '';
        return dateStr.split(' ')[0] || ''; // "2026.03.20 19:36:02" → "2026.03.20"
      };
      // Find the best date to use: today if available, otherwise most recent day in records
      const allRecords = hrRaw.records || [];
      let targetDateStr = todayDateStr;
      const hasToday = allRecords.some((r: any) => getRecordDateStr(r) === todayDateStr);
      if (!hasToday && allRecords.length > 0) {
        // Find the most recent date across all records
        const dates = allRecords.map((r: any) => getRecordDateStr(r)).filter((d: string) => d.length > 0);
        dates.sort();
        targetDateStr = dates[dates.length - 1] || todayDateStr;
        console.log(`📊 [useHomeData] HR: no today data, using most recent day: ${targetDateStr}`);
      }
      hrDataIsToday = targetDateStr === todayDateStr;
      const isRecordFromTargetDate = (rec: any): boolean => {
        return getRecordDateStr(rec) === targetDateStr;
      };
      const parseX3DateToMinutes = (value?: string): number | undefined => {
        if (!value || typeof value !== 'string') return undefined;
        const [datePart, timePart] = value.trim().split(/\s+/);
        if (!datePart) return undefined;
        const [y, m, d] = datePart.split('.').map(Number);
        const [hh, mm, ss] = (timePart || '00:00:00').split(':').map(Number);
        if ([y, m, d, hh, mm, ss].some((n) => Number.isNaN(n))) return undefined;
        const ts = new Date(y, m - 1, d, hh, mm, ss);
        if (!Number.isFinite(ts.getTime()) || ts.getTime() <= 0) return undefined;
        return ts.getHours() * 60 + ts.getMinutes();
      };
      for (const rec of allRecords) {
        if (!isRecordFromTargetDate(rec)) continue;
        const arr = Array.isArray(rec.arrayDynamicHR)
          ? rec.arrayDynamicHR.map((v: any) => Number(v)).filter((v: number) => Number.isFinite(v))
          : [];
        // startTimestamp: if > 1e10 it's epoch ms, else treat as seconds-since-midnight
        const ts = rec.startTimestamp;
        const startMin = typeof ts === 'number'
          ? (ts > 1e10 ? new Date(ts).getHours() * 60 + new Date(ts).getMinutes() : Math.round(ts / 60))
          : (parseX3DateToMinutes(rec.date) ?? 0);
        arr.forEach((v: number, idx: number) => {
          if (v > 0) {
            samples.push(v);
            hrChartData.push({ timeMinutes: startMin + idx, heartRate: v });
          }
        });

        // Backward-compat fallback for raw arrayContinuousHR packets.
        if (arr.length === 0 && Array.isArray(rec?.arrayContinuousHR)) {
          for (const seg of rec.arrayContinuousHR) {
            const segVals = Array.isArray(seg?.arrayHR)
              ? seg.arrayHR.map((v: any) => Number(v)).filter((v: number) => Number.isFinite(v))
              : [];
            const segStart = parseX3DateToMinutes(seg?.date) ?? startMin;
            segVals.forEach((v: number, idx: number) => {
              if (v > 0) {
                samples.push(v);
                hrChartData.push({ timeMinutes: segStart + idx, heartRate: v });
              }
            });
          }
        }
      }
      // Helper: merge HR records, skipping already-covered timeMinutes (dedup)
      const mergeHRRecords = (records: any[], coveredMinutes: Set<number>) => {
        for (const rec of records) {
          if (!isRecordFromTargetDate(rec)) continue;
          const arr = Array.isArray(rec.arrayDynamicHR)
            ? rec.arrayDynamicHR.map((v: any) => Number(v)).filter((v: number) => Number.isFinite(v))
            : [];
          const ts = rec.startTimestamp;
          const startMin = typeof ts === 'number'
            ? (ts > 1e10 ? new Date(ts).getHours() * 60 + new Date(ts).getMinutes() : Math.round(ts / 60))
            : (parseX3DateToMinutes(rec.date) ?? 0);
          arr.forEach((v: number, idx: number) => {
            const minute = startMin + idx;
            if (v > 0 && !coveredMinutes.has(minute)) {
              coveredMinutes.add(minute);
              samples.push(v);
              hrChartData.push({ timeMinutes: minute, heartRate: v });
            }
          });
        }
      };

      // If continuous HR is empty, try single/static HR as secondary source
      if (samples.length === 0) {
        try {
          const singleHR = await UnifiedSmartRingService.getSingleHeartRateRaw();
          console.log('📊 [useHomeData] Single HR records:', singleHR.records?.length);
          const covered = new Set(hrChartData.map(p => p.timeMinutes));
          mergeHRRecords(singleHR.records || [], covered);
        } catch (e2) {
          console.log('⚠️ [useHomeData] Single HR fetch failed:', e2);
        }
      } else {
        // Continuous HR has data — detect interior gaps and retry once if any exist
        const coveredHours = new Set(hrChartData.map(p => Math.floor(p.timeMinutes / 60)));
        const minHour = Math.min(...coveredHours);
        const maxHour = Math.max(...coveredHours);
        const hasInteriorGaps = maxHour > minHour &&
          Array.from({ length: maxHour - minHour + 1 }, (_, i) => minHour + i)
            .some(h => !coveredHours.has(h));

        if (hasInteriorGaps) {
          console.log(`📊 [useHomeData] HR interior gaps (hours ${minHour}-${maxHour}), retrying after 2s…`);
          await new Promise(r => setTimeout(r, 2000));
          try {
            const coveredMinutes = new Set(hrChartData.map(p => p.timeMinutes));
            const hrRaw2 = await UnifiedSmartRingService.getContinuousHeartRateRaw();
            const beforeCount = hrChartData.length;
            mergeHRRecords(hrRaw2.records || [], coveredMinutes);
            console.log(`📊 [useHomeData] HR retry added ${hrChartData.length - beforeCount} pts`);

            // Also merge single HR for any still-uncovered hours after retry
            const singleHR = await UnifiedSmartRingService.getSingleHeartRateRaw();
            const beforeCount2 = hrChartData.length;
            mergeHRRecords(singleHR.records || [], coveredMinutes);
            console.log(`📊 [useHomeData] Single HR gap-fill added ${hrChartData.length - beforeCount2} pts`);
          } catch (e2) {
            console.log('⚠️ [useHomeData] HR gap-fill retry failed:', e2);
          }
        }
      }
      if (samples.length > 0) restingHR = Math.min(...samples);
      console.log(samples.length > 0
        ? `✅ [useHomeData] restingHR: ${restingHR} (${samples.length} samples, ${hrChartData.length} chart pts)`
        : `⚠️ [useHomeData] HR: no continuous or single HR data - will use HRV fallback`);
      updateSP(prev => updateMetric(prev, 'heartRate', 'done'));
      } catch (e) {
        console.log('⚠️ [useHomeData] HR failed:', e);
        updateSP(prev => updateMetric(prev, 'heartRate', 'error'));
      }
      logStage('heartRate', hrStart);

      // 5. HRV (testing.tsx pattern)
      let hrvSdnn = 0;
      const hrvHrPoints: Array<{ timeMinutes: number; heartRate: number }> = [];
      const hrvStart = Date.now();
      updateSP(prev => updateMetric(prev, 'hrv', 'loading'));
      try {
      const hrvNorm = await UnifiedSmartRingService.getHRVDataNormalizedArray();
      const valid = hrvNorm.filter(h => (h.sdnn ?? 0) > 0);
      console.log('RAW_HRV count:', hrvNorm.length, 'valid:', valid.length, 'first:', JSON.stringify(hrvNorm[0]));
      if (valid.length > 0) {
        // Filter to today/overnight window (noon yesterday → now) for representative values
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        const overnightCutoff = todayStart.getTime() - 12 * 3600000; // noon yesterday
        const todayHrv = valid.filter(h => typeof h.timestamp === 'number' && h.timestamp >= overnightCutoff);
        const hrvSource = todayHrv.length > 0 ? todayHrv : valid; // fallback to all if no today data

        // Compute median SDNN (more robust than mean for HRV, matches Oura approach)
        const sdnnValues = hrvSource.map(h => h.sdnn || 0).filter(v => v > 0).sort((a, b) => a - b);
        if (sdnnValues.length > 0) {
          const mid = Math.floor(sdnnValues.length / 2);
          hrvSdnn = sdnnValues.length % 2 === 0
            ? Math.round((sdnnValues[mid - 1] + sdnnValues[mid]) / 2)
            : sdnnValues[mid];
        }
        console.log(`✅ [useHomeData] HRV sdnn: ${hrvSdnn} (median of ${sdnnValues.length} readings, ${todayHrv.length} today)`);

        // Extract HR readings from today's HRV records only for the daily HR chart fallback
        for (const h of hrvSource) {
          const hr = h.heartRate ?? 0;
          if (hr > 0 && typeof h.timestamp === 'number' && h.timestamp > 0) {
            const _d = new Date(h.timestamp);
            const timeMinutes = _d.getHours() * 60 + _d.getMinutes();
            hrvHrPoints.push({ timeMinutes, heartRate: hr });
          }
        }
        console.log('📊 [useHomeData] HRV-derived HR points:', hrvHrPoints.length, hrvHrPoints.slice(0,3));
      }
      updateSP(prev => updateMetric(prev, 'hrv', 'done'));
      } catch (e) {
        console.log('⚠️ [useHomeData] HRV failed:', e);
        updateSP(prev => updateMetric(prev, 'hrv', 'error'));
      }
      logStage('hrv', hrvStart);

      if (restingHR === 0 && hrvHrPoints.length > 0) {
        // Use 10th percentile instead of absolute min to avoid outliers
        const sortedHR = hrvHrPoints.map(p => p.heartRate).sort((a, b) => a - b);
        const p10Index = Math.max(0, Math.floor(sortedHR.length * 0.1));
        restingHR = sortedHR[p10Index];
        console.log(`✅ [useHomeData] restingHR fallback from HRV: ${restingHR} (10th pct of ${sortedHR.length} pts)`);
      }

      // 6. Steps
      let activity: ActivityData = sanitizeActivity();
      const stepsStart = Date.now();
      updateSP(prev => updateMetric(prev, 'steps', 'loading'));
      try {
      const stepsData = await UnifiedSmartRingService.getSteps();
      activity = sanitizeActivity({
        score: Math.min(100, Math.round((stepsData.steps / 10000) * 100)),
        steps: stepsData.steps,
        calories: stepsData.calories,
        activeMinutes: stepsData.time ? stepsData.time / 60 : 0,
        distance: (stepsData as any)?.distance ?? 0,
        workouts: [],
      });
      console.log('✅ [useHomeData] steps:', stepsData.steps);
      updateSP(prev => updateMetric(prev, 'steps', 'done'));
      } catch (e) {
        console.log('⚠️ [useHomeData] steps failed:', e);
        updateSP(prev => updateMetric(prev, 'steps', 'error'));
      }

      // Blend HealthKit activity metrics using max(ring, healthKit)
      if (Platform.OS === 'ios' && (hkSteps > 0 || hkActiveCalories > 0 || hkDistanceM > 0)) {
        const blendedSteps = Math.max(activity.steps, hkSteps);
        const blendedCalories = Math.max(activity.calories, hkActiveCalories);
        const blendedDistance = Math.max(activity.distance, hkDistanceM);
        if (blendedSteps > activity.steps || blendedCalories > activity.calories || blendedDistance > activity.distance) {
          activity = sanitizeActivity({
            ...activity,
            steps: blendedSteps,
            calories: blendedCalories,
            distance: blendedDistance,
            score: Math.min(100, Math.round((blendedSteps / 10000) * 100)),
          });
          console.log(`🍎 [useHomeData] HealthKit blended into activity: steps=${activity.steps}, cal=${activity.calories}, dist=${activity.distance}m, score=${activity.score}`);
        }
      }

      const featureAvailability = UnifiedSmartRingService.getFeatureAvailability();

      let activitySessions: X3ActivitySession[] = [];
      try {
        const sportRecords: SportData[] = await UnifiedSmartRingService.getSportData();
        activitySessions = sportRecords.map((record) => ({
          type: record.type,
          typeLabel: sportTypeLabel(record.type),
          startTime: record.startTime,
          endTime: record.endTime,
          duration: record.duration,
          steps: record.steps,
          distance: record.distance,
          calories: record.calories,
          heartRateAvg: record.heartRateAvg,
          heartRateMax: record.heartRateMax,
        }));
        if (activitySessions.length > 0) {
          console.log(`✅ [useHomeData] activity sessions: ${activitySessions.length}`);
        }
      } catch (e) {
        console.log('⚠️ [useHomeData] sport sessions failed:', e);
      }
      logStage('steps+sport', stepsStart);

      // Build final state
      if (restingHR === 0 && finalSleepData?.restingHR && finalSleepData.restingHR > 0) {
        restingHR = finalSleepData.restingHR;
        console.log(`✅ [useHomeData] restingHR fallback from sleep payload: ${restingHR}`);
      }
      if (finalSleepData && restingHR > 0) finalSleepData.restingHR = restingHR;

      const sleep: SleepData = finalSleepData || {
        score: 0, timeAsleep: '0h 0m', timeAsleepMinutes: 0,
        restingHR, respiratoryRate: 0, segments: [], bedTime: new Date(), wakeTime: new Date(),
      };

      const vitalsStart = Date.now();
      updateSP(prev => updateMetric(prev, 'vitals', 'loading'));
      if (!sleep.respiratoryRate || sleep.respiratoryRate <= 0) {
        try {
          const respiratoryRate = await UnifiedSmartRingService.getRespiratoryRateNightly(0);
          if (respiratoryRate && respiratoryRate >= 8 && respiratoryRate <= 40) {
            sleep.respiratoryRate = respiratoryRate;
            console.log(`✅ [useHomeData] respiratoryRate from breathing data: ${respiratoryRate}`);
          }
        } catch (e) {
          console.log('⚠️ [useHomeData] respiratory rate fetch failed:', e);
        }
      }
      updateSP(prev => updateMetric(prev, 'vitals', 'done'));
      logStage('vitals', vitalsStart);

      updateSP({ phase: 'complete' });
      updateSP(prev => updateMetric(prev, 'cloud', 'loading'));

      const { insight, type } = generateInsight(sleep.score, activity.score);
      const overallScore = calculateOverallScore(sleep.score, activity.score);

      const restingHRScore = restingHR > 0 ? Math.max(0, Math.min(100, Math.round(((90 - restingHR) / 50) * 100))) : 50;
      const readiness = Math.max(0, Math.min(100, Math.round(sleep.score * 0.50 + restingHRScore * 0.30 + Math.max(0, 100 - activity.score) * 0.20)));
      // ── Multi-day accumulated strain (EWMA, newest-first window of up to 7 days) ──
      // Build a map of Strava suffer_score totals by date (already fetched as 7-day window).
      const stravaSufferByDate = new Map<string, number>();
      for (const a of stravaActivities) {
        if (!a.start_date) continue;
        const dayKey = a.start_date.slice(0, 10);
        stravaSufferByDate.set(dayKey, (stravaSufferByDate.get(dayKey) ?? 0) + (a.suffer_score ?? 0));
      }

      const todayIso = new Date().toISOString().slice(0, 10);
      const todayStravaSuffer = stravaSufferByDate.get(todayIso) ?? null;
      const todayLoad = computeDailyLoad(
        activity.adjustedActiveCalories,
        activity.steps,
        todayStravaSuffer,
      );

      // Fetch prior days from daily_summaries (userId already in scope from auth call above).
      let priorDaysSummaries: Array<{ date: string; total_calories: number; total_steps: number }> = [];
      try {
        if (userId) {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const { data: priorData } = await supabase
            .from('daily_summaries')
            .select('date, total_calories, total_steps')
            .eq('user_id', userId)
            .gte('date', sevenDaysAgo.toISOString().slice(0, 10))
            .lte('date', yesterday.toISOString().slice(0, 10))
            .order('date', { ascending: false });
          if (priorData) priorDaysSummaries = priorData as any;
        }
      } catch (e) {
        console.log('⚠️ [useHomeData] prior days fetch failed, using today-only strain:', e);
      }

      const priorLoads = priorDaysSummaries.map(row =>
        computeDailyLoad(
          row.total_calories || 0,
          row.total_steps || 0,
          stravaSufferByDate.get(row.date) ?? null,
        )
      );

      const strain = ewmaStrain([todayLoad, ...priorLoads], 0.35);

      if (__DEV__) {
        console.log(`💪 [strain] today=${Math.round(todayLoad)} priors=${priorLoads.map(l => Math.round(l)).join(',')} ewma=${strain}`);
      }

      // Build per-day breakdown for the Recovery detail explainer.
      // Same α as ewmaStrain; weights are normalized so they sum to 1.
      const STRAIN_ALPHA = 0.35;
      const stravaWorkoutsByDate = new Map<string, Array<{ name: string; sport: string; sufferScore: number }>>();
      for (const a of stravaActivities) {
        if (!a.start_date) continue;
        const key = a.start_date.slice(0, 10);
        const arr = stravaWorkoutsByDate.get(key) ?? [];
        arr.push({
          name: a.name ?? 'Activity',
          sport: a.sport_type ?? 'Workout',
          sufferScore: a.suffer_score ?? 0,
        });
        stravaWorkoutsByDate.set(key, arr);
      }

      const breakdownRaw: Array<{
        dateKey: string;
        load: number;
        activeCalories: number;
        steps: number;
      }> = [
        { dateKey: todayIso, load: todayLoad, activeCalories: activity.adjustedActiveCalories, steps: activity.steps },
        ...priorDaysSummaries.map((row, i) => ({
          dateKey: row.date,
          load: priorLoads[i],
          activeCalories: row.total_calories || 0,
          steps: row.total_steps || 0,
        })),
      ];

      // Compute normalized weights for display (same decay as ewmaStrain).
      const rawWeights: number[] = [];
      let w = 1;
      for (let i = 0; i < breakdownRaw.length; i++) {
        rawWeights.push(w);
        w *= (1 - STRAIN_ALPHA);
      }
      const weightTotal = rawWeights.reduce((a, b) => a + b, 0) || 1;

      const strainBreakdown: StrainDayBreakdown[] = breakdownRaw.map((b, i) => ({
        dateKey: b.dateKey,
        label: i === 0 ? 'Today' : i === 1 ? 'Yesterday' : `${i}d ago`,
        load: Math.round(b.load),
        weight: rawWeights[i] / weightTotal,
        activeCalories: Math.round(b.activeCalories),
        steps: b.steps,
        stravaSufferSum: Math.round(stravaSufferByDate.get(b.dateKey) ?? 0),
        stravaWorkouts: stravaWorkoutsByDate.get(b.dateKey) ?? [],
      }));

      // Merge ring-detected naps with Supabase naps (dedup by time overlap)
      console.log(`🛏️ [useHomeData] pre-merge: supabaseNaps=${todayNaps.length}, ringNaps=${ringNaps.length}`);
      for (const rn of ringNaps) {
        const rnStart = rn.startMs;
        const rnEnd = rn.endMs;
        const rnDur = rnEnd - rnStart;
        const overlaps = todayNaps.some(sn => {
          const snStart = new Date(sn.startTime).getTime();
          const snEnd = new Date(sn.endTime).getTime();
          const overlapStart = Math.max(rnStart, snStart);
          const overlapEnd = Math.min(rnEnd, snEnd);
          const overlapMs = Math.max(0, overlapEnd - overlapStart);
          return overlapMs > rnDur * 0.5;
        });
        if (!overlaps) {
          todayNaps.push({
            id: `ring-nap-${rn.startMs}`,
            startTime: new Date(rn.startMs).toISOString(),
            endTime: new Date(rn.endMs).toISOString(),
            deepMin: rn.deepMin,
            lightMin: rn.lightMin,
            remMin: rn.remMin,
            awakeMin: rn.awakeMin,
            napScore: null,
            totalMin: rn.totalMin,
            segments: rn.segments,
          });
        }
      }
      const totalNapMinutesUpdated = todayNaps.reduce((s, n) => s + n.totalMin, 0);
      console.log(`🛏️ [useHomeData] post-merge: totalNaps=${todayNaps.length}, totalNapMin=${totalNapMinutesUpdated}`);

      // Build unified sleep sessions (night + naps) for hypnogram
      const unifiedSleepSessions: HomeData['unifiedSleepSessions'] = [];
      if (sleep.segments.length > 0) {
        unifiedSleepSessions.push({
          segments: sleep.segments,
          bedTime: sleep.bedTime,
          wakeTime: sleep.wakeTime,
          label: 'Night',
        });
        for (const nap of todayNaps) {
          if (nap.segments.length > 0) {
            unifiedSleepSessions.push({
              segments: nap.segments,
              bedTime: nap.segments[0].startTime,
              wakeTime: nap.segments[nap.segments.length - 1].endTime,
              label: 'Nap',
            });
          }
        }
      }
      const totalSleepMinutes = sleep.timeAsleepMinutes + totalNapMinutesUpdated;

      setData(prev => {
      // Keep previously fetched hrChartData if the new fetch returned nothing.
      // Fall back to HRV-derived HR points if continuous HR is empty.
        const finalHrChartData = hrChartData.length > 0
          ? hrChartData
          : hrvHrPoints.length > 0
          ? hrvHrPoints
          : prev.hrChartData;

        const recoveryContributors: RecoveryContributors = {
          hrvBalance: hrvSdnn > 0 ? clampScore((hrvSdnn / 80) * 100) : null,
          restingHrDelta:
            restingHR > 0
              ? Number(
                  (
                    restingHR -
                    (median(baselinesRef.current.restingHR) ?? 60)
                  ).toFixed(1)
                )
              : null,
          tempDeviation:
            prev.todayVitals.temperatureC !== null
              ? Number(
                  (
                    prev.todayVitals.temperatureC -
                    (median(baselinesRef.current.temperature) ?? 36.5)
                  ).toFixed(2)
                )
              : null,
          overnightSpo2: prev.todayVitals.lastSpo2 ?? prev.todayVitals.minSpo2,
          sleepImpact: totalSleepMinutes > 0 ? clampScore((totalSleepMinutes / 480) * 100) : null,
        };

        const contributors = buildContributors(
          sleep,
          activity,
          hrvSdnn,
          prev.todayVitals,
          baselinesRef.current,
          recoveryContributors
        );

        // Blend unified workout calories/distance into activity total
        const unifiedActs = mergeActivities(stravaActivities, hkWorkouts, activitySessions);
        const todayMidnightMs = new Date().setHours(0, 0, 0, 0);
        const todayActs = unifiedActs.filter(a => new Date(a.startDate).getTime() >= todayMidnightMs);
        const workoutCalories = todayActs.reduce((sum, a) => sum + (a.calories || 0), 0);
        const workoutDistance = todayActs.reduce((sum, a) => sum + (a.distanceM || 0), 0);
        if (workoutCalories > activity.calories || workoutDistance > activity.distance) {
          activity = sanitizeActivity({
            ...activity,
            calories: Math.max(activity.calories, workoutCalories),
            distance: Math.max(activity.distance, workoutDistance),
          });
          console.log(`🏋️ [useHomeData] Workout calories/distance blended: cal=${activity.calories}, dist=${activity.distance}m`);
        }

        const newData: HomeData = {
          overallScore, strain, strainBreakdown, readiness,
          sleepScore: sleep.score,
          lastNightSleep: sleep,
          activity,
          ringBattery,
          isRingCharging,
          streakDays: 0,
          insight, insightType: type,
          isLoading: false, isSyncing: false, error: null,
          userName,
          isRingConnected: true,
          hrChartData: finalHrChartData,
          hrDataIsToday,
          hrvSdnn,
          todayVitals: prev.todayVitals,
          cardDataStatus: prev.cardDataStatus === 'retrying' ? 'retrying' : getCardDataStatusFromVitals(prev.todayVitals),
          refreshMissingCardData: prev.refreshMissingCardData,
          contributors,
          featureAvailability,
          activitySessions,
          recoveryContributors,
          syncProgress: sp,
          lastSyncedAt: Date.now(),
          stravaActivities,
          unifiedActivities: unifiedActs,
          todayNaps,
          totalNapMinutesToday: totalNapMinutesUpdated,
          unifiedSleepSessions,
          totalSleepMinutes,
        };

        baselinesRef.current = {
          sleepMinutes: pushRolling(baselinesRef.current.sleepMinutes, sleep.timeAsleepMinutes),
          restingHR: pushRolling(baselinesRef.current.restingHR, sleep.restingHR),
          hrvSdnn: pushRolling(baselinesRef.current.hrvSdnn, hrvSdnn),
          temperature: pushRolling(baselinesRef.current.temperature, prev.todayVitals.temperatureC ?? 0),
          spo2: pushRolling(
            baselinesRef.current.spo2,
            (prev.todayVitals.lastSpo2 ?? prev.todayVitals.minSpo2) ?? 0
          ),
          steps: pushRolling(baselinesRef.current.steps, activity.steps),
          calories: pushRolling(baselinesRef.current.calories, activity.adjustedActiveCalories),
          activeMinutes: pushRolling(baselinesRef.current.activeMinutes, activity.activeMinutes),
        };
        void saveMetricBaselines(baselinesRef.current);

        lastSyncCompletedAt.current = Date.now();
        logStage('TOTAL', syncStart);
        console.log('📊 [useHomeData] setData →', { sleepScore: newData.sleepScore, overallScore: newData.overallScore, steps: newData.activity.steps, battery: ringBattery, hrPts: finalHrChartData.length });
        saveToCache(newData);
        // Push all ring data (7 days of sleep + vitals) to Supabase in the background
        void dataSyncService.syncAllData()
          .then(() => {
            setData(prev => ({ ...prev, syncProgress: updateMetric(prev.syncProgress, 'cloud', 'done') }));
          })
          .catch(e => {
            reportError(e, { op: 'homeData.syncAllData' });
            setData(prev => ({ ...prev, syncProgress: updateMetric(prev.syncProgress, 'cloud', 'error') }));
          });
        return newData;
      });
      void refreshMissingCardData(hydrationReason);
    } catch (error: any) {
      const message = error?.message || 'Failed to sync ring data.';
      console.log('⚠️ [useHomeData] fetchData fatal error:', message);
      reportError(error, { op: 'homeData.fetchData' });
      setData(prev => ({
        ...prev,
        isLoading: false,
        isSyncing: false,
        error: message,
        syncProgress: { ...prev.syncProgress, phase: 'idle' },
      }));
    } finally {
      isFetchingData.current = false;
    }
  }, [refreshMissingCardData]);

  // Initial fetch — call autoReconnect() immediately (same pattern as testing.tsx)
  useEffect(() => {
    if (!enabled) return;
    console.log('🚀 [useHomeData] HOOK MOUNTED at', new Date().toLocaleTimeString());
    fetchData(true, 'initial');
  }, [enabled, fetchData]);

  // Listen for ring connection state changes.
  // We update connection UI state and trigger targeted card hydration on reconnect.
  useEffect(() => {
    if (!enabled) return;
    const unsubscribe = UnifiedSmartRingService.onConnectionStateChanged((state) => {
      console.log('📡 [useHomeData] Connection state changed:', state, 'at', new Date().toLocaleTimeString());

      if (state === 'connected') {
        // Mount/foreground/manual refresh handles full data sync.
        // Here we focus on connection UI state and missing card hydration.
        console.log('📡 [useHomeData] Connected - UI will update and missing card hydration will run.');

        // Only update the connection flag if we're NOT mid-fetch.
        // If we're mid-fetch, isRingConnected will be set true in the final newData update.
        // Setting it here early would trigger DailySleepTrendCard's 7-day BLE loop
        // concurrently with our sleep fetch, causing a race for the native sleep data.
        if (!isFetchingData.current) {
          setData(prev => ({
            ...prev,
            isRingConnected: true,
            error: null,
          }));
          void refreshMissingCardData('reconnect');
        }
      } else if (state === 'disconnected') {
        // Keep existing data — user will see cached values instantly on next open
        console.log('📡 [useHomeData] Ring disconnected — preserving cached data');
        hasLoadedRealData.current = false;
        setData(prev => ({
          ...prev,
          isRingConnected: false,
          isLoading: false,
          isSyncing: false,
          syncProgress: { phase: 'idle', showSheet: false, metrics: [...INITIAL_METRICS] },
        }));
      }
    });

    return () => {
      unsubscribe();
    };
  }, [enabled, refreshMissingCardData]);

  // Reactively update battery level and charging state from passive ring notifications
  useEffect(() => {
    if (!enabled) return;
    const unsubscribe = UnifiedSmartRingService.onBatteryReceived((batt) => {
      setData(prev => ({
        ...prev,
        ringBattery: batt.battery,
        isRingCharging: batt.isCharging ?? false,
      }));
    });
    return () => unsubscribe();
  }, [enabled]);

  // Listen for app state changes (foreground/background)
  useEffect(() => {
    if (!enabled) return;
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      // App came to foreground from background
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        const elapsed = Date.now() - lastSyncCompletedAt.current;
        if (lastSyncCompletedAt.current > 0 && elapsed < SYNC_COOLDOWN_MS) {
          console.log(`⏳ [useHomeData] Foreground sync skipped — last sync ${Math.round(elapsed / 1000)}s ago (cooldown ${SYNC_COOLDOWN_MS / 1000}s)`);
          void refreshMissingCardData('foreground');
        } else {
          console.log('😴 [useHomeData] App came to foreground - syncing data');
          hasLoadedRealData.current = false;
          fetchData(true, 'foreground');
          void refreshMissingCardData('foreground');
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [enabled, fetchData, refreshMissingCardData]);

  useEffect(() => {
    return () => {
      if (delayedVitalsRetryRef.current) {
        clearTimeout(delayedVitalsRetryRef.current);
        delayedVitalsRetryRef.current = null;
      }
    };
  }, []);

  return {
    ...data,
    refreshMissingCardData,
    refresh: async () => {
      await fetchData(true, 'manual');
    }, // Always force refresh on manual refresh
  };
}

// Score interpretation helpers
export function getScoreMessage(score: number, t: (key: string) => string): string {
  if (score >= 90) return t('overview.score_msg_90');
  if (score >= 80) return t('overview.score_msg_80');
  if (score >= 70) return t('overview.score_msg_70');
  if (score >= 60) return t('overview.score_msg_60');
  return t('overview.score_msg_low');
}

export function getSleepMessage(score: number, t: (key: string) => string): string {
  if (score >= 90) return t('overview.sleep_msg_90');
  if (score >= 80) return t('overview.sleep_msg_80');
  if (score >= 70) return t('overview.sleep_msg_70');
  if (score >= 60) return t('overview.sleep_msg_60');
  return t('overview.sleep_msg_low');
}

export function getActivityMessage(score: number, t: (key: string) => string): string {
  if (score >= 90) return t('overview.activity_msg_90');
  if (score >= 80) return t('overview.activity_msg_80');
  if (score >= 70) return t('overview.activity_msg_70');
  if (score >= 60) return t('overview.activity_msg_60');
  return t('overview.activity_msg_low');
}

export default useHomeData;
