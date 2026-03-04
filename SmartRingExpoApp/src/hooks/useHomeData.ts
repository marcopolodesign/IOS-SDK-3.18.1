import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SleepSegment, SleepStage } from '../components/home/SleepStagesChart';
import UnifiedSmartRingService from '../services/UnifiedSmartRingService';
import JstyleService from '../services/JstyleService';
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

const CACHE_KEY = 'home_data_cache';
const BASELINES_KEY = 'home_metric_baselines_v1';

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

export interface HomeData {
  overallScore: number;
  strain: number;
  readiness: number;
  sleepScore: number;
  lastNightSleep: SleepData;
  activity: ActivityData;
  ringBattery: number;
  streakDays: number;
  insight: string;
  insightType: 'sleep' | 'activity' | 'nutrition' | 'general';
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;
  userName: string;
  isRingConnected: boolean;
  hrChartData: Array<{ timeMinutes: number; heartRate: number }>;
  hrvSdnn: number;
  todayVitals: TodayVitals;
  cardDataStatus: CardDataStatus;
  refreshMissingCardData: (reason?: TodayCardHydrationReason) => Promise<void>;
  contributors: HomeContributors;
  featureAvailability: FeatureAvailability;
  activitySessions: X3ActivitySession[];
  recoveryContributors: RecoveryContributors;
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
  overallScore: number;
  strain: number;
  readiness: number;
  cachedAt: number;
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
  const distanceMeters = (activity as any)?.distance ?? 0;
  const distanceKm = distanceMeters / 1000;
  const distanceActiveEstimate = Math.max(0, distanceKm * PROFILE.weightKg); // ~1 kcal/kg/km

  // For now, lean toward the higher of ring calories and distance-derived active estimate to closer match Apple
  const adjustedActive = Math.max(rawCalories, distanceActiveEstimate);

  return {
    score: Math.round(activity?.score ?? 0),
    steps: Math.round(activity?.steps ?? 0),
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
      overallScore: data.overallScore,
      strain: data.strain,
      readiness: data.readiness,
      cachedAt: Date.now(),
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
      overallScore: data.overallScore,
      strain: data.strain,
      readiness: data.readiness,
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
function deriveFromRaw(rawRecords: any[]): SleepData | null {
  if (!rawRecords || rawRecords.length === 0) return null;
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

  // Use the most recent sleep block
  const chosen = blocks.reduce((acc, b) => (b.end > acc.end ? b : acc), blocks[0]);
  const earliestStart = chosen.start;
  const latestEnd = chosen.end;
  const totalMinutes = Math.max(0, Math.round((latestEnd - earliestStart) / 60000));
  if (totalMinutes === 0) return null;

  const timeline: number[] = new Array(totalMinutes).fill(0);
  for (const rec of chosen.records) {
    const startOffset = Math.round((rec.start! - earliestStart) / 60000);
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
    const startMs = earliestStart + i * 60000;
    const endMs = startMs + 60000;
    if (segments.length && segments[segments.length - 1].stage === stage) {
      segments[segments.length - 1].endTime = new Date(endMs);
    } else {
      segments.push({ stage, startTime: new Date(startMs), endTime: new Date(endMs) });
    }
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const score = Math.min(100, Math.round(
    (totalMinutes / 480) * 35 +
    ((timeline.filter(v => v === 3).length / totalMinutes) * 25) +
    ((timeline.filter(v => v === 2).length / totalMinutes) * 15) +
    Math.max(5, 25 - Math.round((timeline.filter(v => v === 0).length / totalMinutes) * 50))
  ));

  return {
    score,
    timeAsleep: `${hours}h ${minutes}m`,
    timeAsleepMinutes: totalMinutes,
    restingHR: extractedVitals.restingHR, // overwritten by HR stream when available
    respiratoryRate: extractedVitals.respiratoryRate,
    segments,
    bedTime: new Date(earliestStart),
    wakeTime: new Date(latestEnd),
  };
}


function generateInsight(sleepScore: number, activityScore: number): { insight: string; type: 'sleep' | 'activity' | 'general' } {
  const insights = [
    {
      condition: sleepScore > 85,
      insight: "Great sleep last night! Your recovery is optimal. Consider a higher intensity workout today.",
      type: 'sleep' as const,
    },
    {
      condition: sleepScore < 70,
      insight: "Your sleep quality was below average. Try to wind down earlier tonight and limit screen time before bed.",
      type: 'sleep' as const,
    },
    {
      condition: activityScore < 50,
      insight: "You've been less active lately. Even a short 10-minute walk can boost your energy and mood.",
      type: 'activity' as const,
    },
    {
      condition: activityScore > 80,
      insight: "You're crushing it! Your activity levels are excellent. Remember to stay hydrated and fuel properly.",
      type: 'activity' as const,
    },
    {
      condition: true,
      insight: "Your vitals look good today. Keep up the consistent routine for optimal health.",
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
  streakDays: 0,
  insight: '',
  insightType: 'general',
  isLoading: true,
  isSyncing: true, // Start with syncing true so we show syncing indicator on app open
  error: null,
  userName: '',
  isRingConnected: false,
  hrChartData: [],
  hrvSdnn: 0,
  todayVitals: getEmptyTodayVitals(),
  cardDataStatus: 'idle',
  refreshMissingCardData: NOOP_REFRESH_MISSING_CARD_DATA,
  contributors: getEmptyContributors(),
  featureAvailability: getEmptyFeatureAvailability(),
  activitySessions: [],
  recoveryContributors: getEmptyRecoveryContributors(),
});

// Hook
export function useHomeData(): HomeData & { refresh: () => Promise<void> } {
  const [data, setData] = useState<HomeData>(getEmptyData);

  // Track app state for foreground detection
  const appState = useRef(AppState.currentState);
  const lastFetchTime = useRef<number>(0);
  const MIN_FETCH_INTERVAL = 3000; // Minimum 3 seconds between fetches
  const hasLoadedRealData = useRef(false); // Track if we've successfully loaded real data
  const hasLoadedCache = useRef(false); // Track if we've loaded cached data
  const isFetchingData = useRef(false); // Track if we're currently fetching to prevent concurrent fetches
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
  }, []);

  // Load cached today-card vitals immediately on mount.
  useEffect(() => {
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
  }, []);

  useEffect(() => {
    loadMetricBaselines().then(baselines => {
      baselinesRef.current = baselines;
    });
  }, []);

  // Listen for auth state changes to update userName from user_metadata
  useEffect(() => {
    // Get initial user
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.user_metadata?.display_name) {
        setData(prev => ({
          ...prev,
          userName: user.user_metadata.display_name,
        }));
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const displayName = session?.user?.user_metadata?.display_name;
      if (displayName) {
        setData(prev => ({
          ...prev,
          userName: displayName,
        }));
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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

      setData(prev => ({ ...prev, isSyncing: true, error: null }));

      // user display name
      const { data: { user } } = await supabase.auth.getUser();
      const userName = user?.user_metadata?.display_name || '';

      let alreadyConnected = false;
      try {
        const status = await UnifiedSmartRingService.isConnected();
        alreadyConnected = status.connected;
      } catch {
        alreadyConnected = false;
      }

      // 1. autoReconnect only if not already connected.
      if (!alreadyConnected) {
        console.log('🔄 [useHomeData] autoReconnect...');
        const reconnectResult = await UnifiedSmartRingService.autoReconnect();
        if (!reconnectResult.success) {
          setData(prev => ({ ...prev, userName, isLoading: false, isSyncing: false, isRingConnected: false, error: 'Ring not connected.' }));
          return;
        }
      } else {
        console.log('✅ [useHomeData] already connected, skipping autoReconnect');
      }
      console.log('✅ [useHomeData] connected');

      // 2. Sleep — getSleepData() raw + deriveFromRaw() (EXACT testing.tsx pattern)
      //    First call always times out (~10 s) while BLE transfers data from ring.
      //    Second call returns immediately from native cache. We retry automatically.
      let finalSleepData: SleepData | null = null;

      for (let attempt = 1; attempt <= 3 && !finalSleepData; attempt++) {
        try {
          console.log(`😴 [useHomeData] getSleepData attempt ${attempt}...`);
          const rawResult = await JstyleService.getSleepData();
          const rawRecords: any[] = (rawResult as any).data || (rawResult as any).records || [];
          console.log(`😴 [useHomeData] getSleepData attempt ${attempt} records:`, rawRecords.length);
          finalSleepData = deriveFromRaw(rawRecords);
          if (finalSleepData) console.log('✅ [useHomeData] sleep derived:', finalSleepData.score, finalSleepData.timeAsleep);
        } catch (e: any) {
          console.log(`😴 [useHomeData] getSleepData attempt ${attempt} failed:`, e?.message);
          // Brief pause before retry so native SDK can settle (mirrors time between user taps in testing.tsx)
          if (attempt < 3) await new Promise(r => setTimeout(r, 1000));
        }
      }

      if (finalSleepData) hasLoadedRealData.current = true;

      // 3. Battery (testing.tsx pattern)
      let ringBattery = 0;
      try {
        const batt = await UnifiedSmartRingService.getBattery();
        ringBattery = batt.battery;
        console.log('✅ [useHomeData] battery:', ringBattery);
      } catch (e) { console.log('⚠️ [useHomeData] battery failed:', e); }

      // 4. Continuous HR → resting HR + hrChartData (testing.tsx pattern)
      let restingHR = 0;
      const hrChartData: Array<{ timeMinutes: number; heartRate: number }> = [];
      try {
      const hrRaw = await JstyleService.getContinuousHeartRate();
      const firstRec = hrRaw.records?.[0];
      console.log('RAW_HR records:', hrRaw.records?.length, 'first keys:', JSON.stringify(Object.keys(firstRec || {})), 'dynLen:', firstRec?.arrayDynamicHR?.length, 'contLen:', firstRec?.arrayContinuousHR?.length);
      const samples: number[] = [];
      const parseX3DateToMinutes = (value?: string): number | undefined => {
        if (!value || typeof value !== 'string') return undefined;
        const [datePart, timePart] = value.trim().split(/\s+/);
        if (!datePart) return undefined;
        const [y, m, d] = datePart.split('.').map(Number);
        const [hh, mm, ss] = (timePart || '00:00:00').split(':').map(Number);
        if ([y, m, d, hh, mm, ss].some((n) => Number.isNaN(n))) return undefined;
        const ts = new Date(y, m - 1, d, hh, mm, ss).getTime();
        if (!Number.isFinite(ts) || ts <= 0) return undefined;
        return Math.round((ts % 86400000) / 60000);
      };
      for (const rec of hrRaw.records || []) {
        const arr = Array.isArray(rec.arrayDynamicHR)
          ? rec.arrayDynamicHR.map((v: any) => Number(v)).filter((v: number) => Number.isFinite(v))
          : [];
        // startTimestamp: if > 1e10 it's epoch ms, else treat as seconds-since-midnight
        const ts = rec.startTimestamp;
        const startMin = typeof ts === 'number'
          ? (ts > 1e10 ? Math.round((ts % 86400000) / 60000) : Math.round(ts / 60))
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
      if (samples.length > 0) restingHR = Math.min(...samples);
      console.log(samples.length > 0
        ? `✅ [useHomeData] restingHR: ${restingHR} (${samples.length} samples, ${hrChartData.length} chart pts)`
        : `⚠️ [useHomeData] HR: ${hrRaw.records?.length} records but all empty - will use HRV fallback`);
      } catch (e) { console.log('⚠️ [useHomeData] HR failed:', e); }

      // 5. HRV (testing.tsx pattern)
      let hrvSdnn = 0;
      const hrvHrPoints: Array<{ timeMinutes: number; heartRate: number }> = [];
      try {
      const hrvNorm = await JstyleService.getHRVDataNormalized();
      const valid = hrvNorm.filter(h => (h.sdnn ?? 0) > 0);
      console.log('RAW_HRV count:', hrvNorm.length, 'valid:', valid.length, 'first:', JSON.stringify(hrvNorm[0]));
      if (valid.length > 0) {
        hrvSdnn = valid[valid.length - 1].sdnn || 0;
        console.log('✅ [useHomeData] HRV sdnn:', hrvSdnn);
        // Extract HR readings from HRV records as fallback for the daily HR chart
        for (const h of hrvNorm) {
          const hr = h.heartRate ?? 0;
          if (hr > 0 && typeof h.timestamp === 'number' && h.timestamp > 0) {
            const timeMinutes = Math.round((h.timestamp % 86400000) / 60000);
            hrvHrPoints.push({ timeMinutes, heartRate: hr });
          }
        }
        console.log('📊 [useHomeData] HRV-derived HR points:', hrvHrPoints.length, hrvHrPoints.slice(0,3));
      }
      } catch (e) { console.log('⚠️ [useHomeData] HRV failed:', e); }

      if (restingHR === 0 && hrvHrPoints.length > 0) {
        restingHR = Math.min(...hrvHrPoints.map(p => p.heartRate));
        console.log(`✅ [useHomeData] restingHR fallback from HRV: ${restingHR}`);
      }

      // 6. Steps
      let activity: ActivityData = sanitizeActivity();
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
      } catch (e) { console.log('⚠️ [useHomeData] steps failed:', e); }

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

      const { insight, type } = generateInsight(sleep.score, activity.score);
      const overallScore = calculateOverallScore(sleep.score, activity.score);

      const restingHRScore = restingHR > 0 ? Math.max(0, Math.min(100, Math.round(((90 - restingHR) / 50) * 100))) : 50;
      const readiness = Math.max(0, Math.min(100, Math.round(sleep.score * 0.50 + restingHRScore * 0.30 + Math.max(0, 100 - activity.score) * 0.20)));
      const calStrain = Math.max(0, Math.min(100, Math.round(((activity.adjustedActiveCalories - 300) / 900) * 100)));
      const strain = Math.max(0, Math.min(100, Math.round(calStrain * 0.60 + activity.score * 0.40)));

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
          sleepImpact: sleep.timeAsleepMinutes > 0 ? clampScore((sleep.timeAsleepMinutes / 480) * 100) : null,
        };

        const contributors = buildContributors(
          sleep,
          activity,
          hrvSdnn,
          prev.todayVitals,
          baselinesRef.current,
          recoveryContributors
        );

        const newData: HomeData = {
          overallScore, strain, readiness,
          sleepScore: sleep.score,
          lastNightSleep: sleep,
          activity,
          ringBattery,
          streakDays: 0,
          insight, insightType: type,
          isLoading: false, isSyncing: false, error: null,
          userName,
          isRingConnected: true,
          hrChartData: finalHrChartData,
          hrvSdnn,
          todayVitals: prev.todayVitals,
          cardDataStatus: prev.cardDataStatus === 'retrying' ? 'retrying' : getCardDataStatusFromVitals(prev.todayVitals),
          refreshMissingCardData: prev.refreshMissingCardData,
          contributors,
          featureAvailability,
          activitySessions,
          recoveryContributors,
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

        console.log('📊 [useHomeData] setData →', { sleepScore: newData.sleepScore, overallScore: newData.overallScore, steps: newData.activity.steps, battery: ringBattery, hrPts: finalHrChartData.length });
        saveToCache(newData);
        // Push all ring data (7 days of sleep + vitals) to Supabase in the background
        void dataSyncService.syncAllData();
        return newData;
      });
      void refreshMissingCardData(hydrationReason);
    } catch (error: any) {
      const message = error?.message || 'Failed to sync ring data.';
      console.log('⚠️ [useHomeData] fetchData fatal error:', message);
      setData(prev => ({
        ...prev,
        isLoading: false,
        isSyncing: false,
        error: message,
      }));
    } finally {
      isFetchingData.current = false;
    }
  }, [refreshMissingCardData]);

  // Initial fetch — call autoReconnect() immediately (same pattern as testing.tsx)
  useEffect(() => {
    console.log('🚀 [useHomeData] HOOK MOUNTED at', new Date().toLocaleTimeString());
    fetchData(true, 'initial');
  }, [fetchData]);

  // Listen for ring connection state changes.
  // We update connection UI state and trigger targeted card hydration on reconnect.
  useEffect(() => {
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
        // When ring disconnects, clear data and mark as disconnected
        console.log('😴 [useHomeData] Ring disconnected - clearing data');
        hasLoadedRealData.current = false;
        supabase.auth.getUser().then(({ data: { user } }) => {
          setData(prev => ({
            ...getEmptyData(),
            userName: user?.user_metadata?.display_name || '',
            isLoading: false,
            isSyncing: false,
            isRingConnected: false,
            todayVitals: prev.todayVitals,
            cardDataStatus: getCardDataStatusFromVitals(prev.todayVitals),
          }));
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [refreshMissingCardData]);

  // Listen for app state changes (foreground/background)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      // App came to foreground from background
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('😴 [useHomeData] App came to foreground - syncing data');
        // Reset the real data flag so we try to fetch fresh data
        hasLoadedRealData.current = false;
        fetchData(true, 'foreground'); // Force refresh
        void refreshMissingCardData('foreground');
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [fetchData, refreshMissingCardData]);

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
export function getScoreMessage(score: number): string {
  if (score >= 90) return "Rise and shine! You're at your peak.";
  if (score >= 80) return "Great day ahead! You're well-recovered.";
  if (score >= 70) return "Solid baseline. Ready for a productive day.";
  if (score >= 60) return "Take it easy today. Focus on recovery.";
  return "Rest up. Your body needs recovery time.";
}

export function getSleepMessage(score: number): string {
  if (score >= 90) return "Exceptional sleep quality!";
  if (score >= 80) return "Great night's rest.";
  if (score >= 70) return "Good sleep overall.";
  if (score >= 60) return "Room for improvement.";
  return "Poor sleep quality. Prioritize rest tonight.";
}

export function getActivityMessage(score: number): string {
  if (score >= 90) return "Outstanding activity level!";
  if (score >= 80) return "Very active day.";
  if (score >= 70) return "Good activity level.";
  if (score >= 60) return "Moderate activity.";
  return "Time to get moving!";
}

export default useHomeData;
