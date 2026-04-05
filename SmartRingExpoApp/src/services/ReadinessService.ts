/**
 * ReadinessService — pure calculation, no React, no BLE.
 * Reads baselines from AsyncStorage, computes readiness/illness/lastRun.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './SupabaseService';
import type {
  FocusBaselines,
  ReadinessScore,
  ReadinessComponents,
  ReadinessRecommendation,
  IllnessWatch,
  IllnessWatchDetails,
  IllnessSignals,
  IllnessStatus,
  LastRunContext,
  EffortVerdict,
} from '../types/focus.types';
import type { SleepBaselineTier, SleepBaselineState } from '../types/sleepBaseline.types';

const BASELINES_KEY = 'focus_baselines_v1';

// ─── Baseline persistence ──────────────────────────────────────────────────────

function emptyBaselines(): FocusBaselines {
  return {
    hrv: [],
    restingHR: [],
    temperature: [],
    sleepScore: [],
    sleepMinutes: [],
    respiratoryRate: [],
    spo2Min: [],
    sleepAwakeMin: [],
    nocturnalHR: [],
    updatedAt: null,
    daysLogged: 0,
  };
}

export async function loadBaselines(): Promise<FocusBaselines> {
  try {
    const raw = await AsyncStorage.getItem(BASELINES_KEY);
    if (!raw) return emptyBaselines();
    // Merge against emptyBaselines() so any field added after initial storage
    // (e.g. sleepMinutes) is populated with [] instead of undefined.
    return { ...emptyBaselines(), ...(JSON.parse(raw) as Partial<FocusBaselines>) };
  } catch {
    return emptyBaselines();
  }
}

export async function saveBaselines(b: FocusBaselines): Promise<void> {
  try {
    await AsyncStorage.setItem(BASELINES_KEY, JSON.stringify(b));
  } catch {}
}

export async function bootstrapBaselinesFromSupabase(userId: string): Promise<FocusBaselines> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);
  const since = cutoff.toISOString();

  const [hrvRes, sleepRes, tempRes, hrRes] = await Promise.allSettled([
    supabase.from('hrv_readings').select('sdnn, recorded_at')
      .eq('user_id', userId).gte('recorded_at', since).order('recorded_at'),
    supabase.from('sleep_sessions').select('sleep_score, deep_min, light_min, rem_min, start_time')
      .eq('user_id', userId).gte('start_time', since).order('start_time'),
    supabase.from('temperature_readings').select('temperature_c, recorded_at')
      .eq('user_id', userId).gte('recorded_at', since).order('recorded_at'),
    supabase.from('heart_rate_readings').select('heart_rate, recorded_at')
      .eq('user_id', userId).gte('recorded_at', since).order('heart_rate', { ascending: true }),
  ]);

  const byDay = new Map<string, DayReadings>();

  if (hrvRes.status === 'fulfilled') {
    for (const row of (hrvRes.value.data ?? []) as { sdnn: number; recorded_at: string }[]) {
      const day = row.recorded_at.slice(0, 10);
      if (!byDay.has(day)) byDay.set(day, {});
      byDay.get(day)!.hrv ??= row.sdnn;
    }
  }
  if (sleepRes.status === 'fulfilled') {
    for (const row of (sleepRes.value.data ?? []) as { sleep_score: number; deep_min: number; light_min: number; rem_min: number; start_time: string }[]) {
      const day = row.start_time.slice(0, 10);
      if (!byDay.has(day)) byDay.set(day, {});
      const d = byDay.get(day)!;
      d.sleepScore ??= row.sleep_score;
      d.sleepMinutes ??= (row.deep_min ?? 0) + (row.light_min ?? 0) + (row.rem_min ?? 0);
    }
  }
  if (tempRes.status === 'fulfilled') {
    for (const row of (tempRes.value.data ?? []) as { temperature_c: number; recorded_at: string }[]) {
      const day = row.recorded_at.slice(0, 10);
      if (!byDay.has(day)) byDay.set(day, {});
      byDay.get(day)!.temperature ??= row.temperature_c;
    }
  }
  if (hrRes.status === 'fulfilled') {
    for (const row of (hrRes.value.data ?? []) as { heart_rate: number; recorded_at: string }[]) {
      const day = row.recorded_at.slice(0, 10);
      if (!byDay.has(day)) byDay.set(day, {});
      byDay.get(day)!.restingHR ??= row.heart_rate;
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  let baselines = emptyBaselines();
  const sortedDays = [...byDay.keys()].sort();
  for (const day of sortedDays) {
    const r = byDay.get(day)!;
    baselines = {
      hrv: r.hrv ? pushRolling(baselines.hrv, r.hrv) : baselines.hrv,
      restingHR: r.restingHR ? pushRolling(baselines.restingHR, r.restingHR) : baselines.restingHR,
      temperature: r.temperature ? pushRolling(baselines.temperature, r.temperature) : baselines.temperature,
      sleepScore: r.sleepScore ? pushRolling(baselines.sleepScore, r.sleepScore) : baselines.sleepScore,
      sleepMinutes: r.sleepMinutes ? pushRolling(baselines.sleepMinutes, r.sleepMinutes) : baselines.sleepMinutes,
      respiratoryRate: baselines.respiratoryRate,
      spo2Min: baselines.spo2Min,
      sleepAwakeMin: baselines.sleepAwakeMin,
      nocturnalHR: baselines.nocturnalHR,
      updatedAt: day,
      daysLogged: baselines.daysLogged + 1,
    };
  }
  baselines = { ...baselines, updatedAt: today };

  console.log(`[Bootstrap] daysLogged=${baselines.daysLogged}`);

  await saveBaselines(baselines);
  return baselines;
}

function pushRolling(values: number[] | undefined, value: number, max = 14): number[] {
  if (!Number.isFinite(value) || value <= 0) return values ?? [];
  const next = [...(values ?? []), value];
  return next.length <= max ? next : next.slice(next.length - max);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

interface DayReadings {
  hrv?: number | null;
  sleepScore?: number | null;
  sleepMinutes?: number | null;
  restingHR?: number | null;
  temperature?: number | null;
  respiratoryRate?: number | null;
}

export function updateBaselines(
  current: FocusBaselines,
  readings: DayReadings
): FocusBaselines {
  const today = new Date().toISOString().slice(0, 10);
  if (current.updatedAt === today) return current;

  return {
    hrv: readings.hrv ? pushRolling(current.hrv, readings.hrv) : current.hrv,
    restingHR: readings.restingHR
      ? pushRolling(current.restingHR, readings.restingHR)
      : current.restingHR,
    temperature: readings.temperature
      ? pushRolling(current.temperature, readings.temperature)
      : current.temperature,
    sleepScore: readings.sleepScore
      ? pushRolling(current.sleepScore, readings.sleepScore)
      : current.sleepScore,
    sleepMinutes: readings.sleepMinutes
      ? pushRolling(current.sleepMinutes, readings.sleepMinutes)
      : current.sleepMinutes,
    respiratoryRate: readings.respiratoryRate
      ? pushRolling(current.respiratoryRate, readings.respiratoryRate)
      : current.respiratoryRate,
    spo2Min: current.spo2Min ?? [],
    sleepAwakeMin: current.sleepAwakeMin ?? [],
    nocturnalHR: current.nocturnalHR ?? [],
    updatedAt: today,
    daysLogged: current.daysLogged + 1,
  };
}

// ─── Clamp helper ──────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ─── Component scorers ────────────────────────────────────────────────────────

function scoreHRVComponent(sdnn: number | null, baseline: number[]): number | null {
  if (sdnn == null) return null;
  const med = median(baseline);
  if (med == null) return null;
  return clamp(50 + ((sdnn - med) / med) * 75, 0, 100);
}

function scoreSleepComponent(
  sleepScore: number | null,
  sleepMinutes: number | null,
  scoreBaseline: number[],
  minutesBaseline: number[]
): number | null {
  // sleep_score is not persisted in Supabase, so fall back to minutes-only scoring
  if (sleepScore == null && sleepMinutes == null) return null;
  const baselineMins = median(minutesBaseline) ?? 480;
  const minsScore = sleepMinutes != null ? clamp((sleepMinutes / baselineMins) * 100, 0, 100) : 50;
  if (sleepScore == null) return minsScore;
  return clamp(sleepScore * 0.7 + minsScore * 0.3, 0, 100);
}

function scoreRestingHRComponent(
  hr: number | null,
  baseline: number[]
): number | null {
  if (hr == null) return null;
  const med = median(baseline);
  if (med == null) {
    // No personal baseline yet — score against population norms so the bar isn't empty.
    // < 50 bpm = athlete level (excellent), 60 = average, 80+ = poor.
    return clamp(100 - (hr - 40) * 2.5, 0, 100);
  }
  return clamp(50 - ((hr - med) / med) * 100, 0, 100);
}

async function scoreTrainingLoadComponent(userId: string): Promise<number | null> {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString();
    const twentyEightDaysAgo = new Date(now.getTime() - 28 * 24 * 3600 * 1000).toISOString();

    const [{ data: recent }, { data: chronic }] = await Promise.all([
      supabase
        .from('strava_activities')
        .select('moving_time_sec, start_date')
        .eq('user_id', userId)
        .gte('start_date', sevenDaysAgo)
        .in('sport_type', ['Run', 'TrailRun', 'Hike', 'Ride']),
      supabase
        .from('strava_activities')
        .select('moving_time_sec, start_date')
        .eq('user_id', userId)
        .gte('start_date', twentyEightDaysAgo)
        .in('sport_type', ['Run', 'TrailRun', 'Hike', 'Ride']),
    ]);

    if (!recent || !chronic || chronic.length === 0) return null;

    const acuteLoad = recent.reduce((s, a) => s + (a.moving_time_sec ?? 0), 0) / 60; // mins
    const chronicLoad =
      chronic.reduce((s, a) => s + (a.moving_time_sec ?? 0), 0) / 60 / 4; // weekly avg

    if (chronicLoad === 0) return 70; // no prior data → neutral

    const ratio = acuteLoad / chronicLoad;
    // ratio ~1.0 → neutral; >1.3 → stressed; <0.6 → deloading (also good for recovery)
    if (ratio > 1.5) return clamp(50 - (ratio - 1.5) * 40, 0, 60);
    if (ratio > 1.3) return clamp(70 - (ratio - 1.3) * 50, 50, 70);
    if (ratio < 0.6) return 80; // deload week — great for readiness
    return 75;
  } catch {
    return null;
  }
}

// ─── Readiness orchestration ──────────────────────────────────────────────────

function computeWeightedScore(
  components: ReadinessComponents & { trainingLoad: number | null }
): number {
  const weights: Record<keyof ReadinessComponents, number> = {
    hrv: 0.35,
    sleep: 0.25,
    restingHR: 0.20,
    trainingLoad: 0.20,
  };

  let totalWeight = 0;
  let weightedSum = 0;

  (Object.keys(weights) as Array<keyof ReadinessComponents>).forEach((key) => {
    const val = components[key];
    if (val != null) {
      totalWeight += weights[key];
      weightedSum += val * weights[key];
    }
  });

  if (totalWeight === 0) return 50;
  return Math.round(weightedSum / totalWeight);
}

function scoreToRecommendation(score: number): ReadinessRecommendation {
  if (score >= 70) return 'GO';
  if (score >= 45) return 'EASY';
  return 'REST';
}

function confidenceFromDays(daysLogged: number): 'high' | 'medium' | 'low' {
  if (daysLogged >= 10) return 'high';
  if (daysLogged >= 5) return 'medium';
  return 'low';
}

export interface ReadinessParams {
  userId: string;
  hrv: number | null;
  sleepScore: number | null;
  sleepMinutes: number | null;
  restingHR: number | null;
  baselines: FocusBaselines;
}

export async function computeReadiness(
  params: ReadinessParams
): Promise<ReadinessScore> {
  const { userId, hrv, sleepScore, sleepMinutes, restingHR, baselines } = params;

  console.log(`[Readiness] inputs: hrv=${hrv}, sleepScore=${sleepScore}, sleepMin=${sleepMinutes}, restingHR=${restingHR}, baselineDays=${baselines.daysLogged}`);

  const [tLoad] = await Promise.all([scoreTrainingLoadComponent(userId)]);

  const components: ReadinessComponents = {
    hrv: scoreHRVComponent(hrv, baselines.hrv),
    sleep: scoreSleepComponent(sleepScore, sleepMinutes, baselines.sleepScore, baselines.sleepMinutes ?? []),
    restingHR: scoreRestingHRComponent(restingHR, baselines.restingHR),
    trainingLoad: tLoad,
  };

  const score = computeWeightedScore(components);
  if (__DEV__) console.log(`[Readiness] score=${score}, components=${JSON.stringify(components)}`);

  return {
    score,
    recommendation: scoreToRecommendation(score),
    components,
    confidence: confidenceFromDays(baselines.daysLogged),
    computedAt: new Date().toISOString(),
  };
}

// ─── Illness Watch ────────────────────────────────────────────────────────────

export interface IllnessParams {
  temperature: number | null;
  restingHR: number | null;
  hrv: number | null;
  sleepFragmentCount?: number | null;
  baselines: FocusBaselines;
}

function buildIllnessSummary(status: IllnessStatus, signals: IllnessSignals): string {
  if (status === 'CLEAR') return 'All signals within your normal range.';
  if (status === 'SICK') {
    const flagged: string[] = [];
    if (signals.tempDeviation) flagged.push('elevated temperature');
    if (signals.restingHRElevated) flagged.push('elevated nocturnal HR');
    if (signals.hrvSuppressed) flagged.push('suppressed HRV');
    if (signals.spo2Low) flagged.push('low blood oxygen');
    if (signals.sleepFragmented) flagged.push('fragmented sleep');
    return `Multiple signals suggest your body is under strain. Consider resting today.`;
  }
  // WATCH
  const active: string[] = [];
  if (signals.tempDeviation) active.push('temperature');
  if (signals.restingHRElevated) active.push('nocturnal HR');
  if (signals.hrvSuppressed) active.push('HRV');
  if (signals.spo2Low) active.push('blood oxygen');
  if (signals.sleepFragmented) active.push('sleep quality');
  return `Some signals are deviating from your baseline. Keep an eye on how you feel.`;
}

export function computeIllnessWatch(params: IllnessParams): IllnessWatch {
  const {
    temperature,
    restingHR,
    hrv,
    sleepFragmentCount,
    baselines,
  } = params;

  const tempMed = median(baselines.temperature);
  const hrMed = median(baselines.restingHR);
  const hrvMed = median(baselines.hrv);

  let signalCount = 0;

  const tempDeviation = (() => {
    if (temperature == null || tempMed == null) return false;
    const dev = temperature - tempMed; // positive = warmer than baseline
    if (dev > 1.0) { signalCount += 2; return true; }  // Major: >1.0°C above baseline
    if (dev > 0.5) { signalCount += 1; return true; }  // Minor: >0.5°C above baseline
    return false; // Lower temps or small deviations are not illness signals
  })();

  const restingHRElevated = (() => {
    if (restingHR == null || hrMed == null) return false;
    // Only flag if meaningfully above baseline AND above a minimum absolute threshold.
    // This prevents false positives when personal baseline is skewed by bad data.
    if (restingHR > hrMed + 5 && restingHR > 52) { signalCount += 1; return true; }
    return false;
  })();

  const hrvSuppressed = (() => {
    if (hrv == null || hrvMed == null) return false;
    if (hrv < hrvMed * 0.85) { signalCount += 1; return true; } // 15% below baseline
    return false;
  })();

  const sleepFragmented = (() => {
    if (sleepFragmentCount == null) return false;
    if (sleepFragmentCount > 4) { signalCount += 1; return true; }
    return false;
  })();

  const signals: IllnessSignals = {
    tempDeviation,
    restingHRElevated,
    hrvSuppressed,
    spo2Low: false, // not available client-side; server-computed scores use real SpO2
    sleepFragmented,
  };

  const status: IllnessStatus =
    signalCount >= 3 ? 'SICK' : signalCount >= 1 ? 'WATCH' : 'CLEAR';

  if (__DEV__) console.log(`[Illness] status=${status}, signals=${JSON.stringify(signals)}`);

  const details: IllnessWatchDetails = {
    hrvDelta: (() => {
      if (hrv == null || hrvMed == null) return null;
      const pct = Math.round(((hrv - hrvMed) / hrvMed) * 100);
      return `${pct >= 0 ? '+' : ''}${pct}%`;
    })(),
    hrDelta: (() => {
      if (restingHR == null || hrMed == null) return null;
      const diff = Math.round(restingHR - hrMed);
      return `${diff >= 0 ? '+' : ''}${diff} bpm`;
    })(),
    tempDelta: (() => {
      if (temperature == null || tempMed == null) return null;
      const diff = temperature - tempMed;
      return `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}°C`;
    })(),
    spo2Delta: null,
    sleepDelta: null,
  };

  return {
    status,
    score: 0, // client fallback — server hasn't run yet
    signals,
    summary: buildIllnessSummary(status, signals),
    details,
  };
}

// ─── Last Run Context ─────────────────────────────────────────────────────────

function buildRunExplanation(params: {
  effortVerdict: EffortVerdict;
  avgHR: number;
  expectedHR: number;
  hrvVsNorm: 'above' | 'below' | 'normal' | null;
  paceMinsPerKm: number;
}): string {
  const { effortVerdict, avgHR, expectedHR, hrvVsNorm, paceMinsPerKm } = params;
  const diff = Math.abs(avgHR - expectedHR);
  const paceStr = `${Math.floor(paceMinsPerKm)}:${String(
    Math.round((paceMinsPerKm % 1) * 60)
  ).padStart(2, '0')}/km`;

  if (effortVerdict === 'harder_than_expected') {
    const hrvNote =
      hrvVsNorm === 'below'
        ? ' Your HRV was suppressed that morning — your body was working harder.'
        : '';
    return `Your effort was ${Math.round((diff / expectedHR) * 100)}% higher than usual for ${paceStr}.${hrvNote}`;
  }
  if (effortVerdict === 'easier_than_expected') {
    return `Great efficiency — your HR was ${diff}bpm lower than expected for ${paceStr}. Your body handled it well.`;
  }
  return `A solid run at ${paceStr}. Your effort matched what your body expected.`;
}

export async function computeLastRunContext(
  userId: string,
  baselines: FocusBaselines
): Promise<LastRunContext | null> {
  try {
    // Fetch most recent run from Supabase
    const { data: activities } = await supabase
      .from('strava_activities')
      .select(
        'id, name, start_date, distance_m, moving_time_sec, average_heartrate, sport_type'
      )
      .eq('user_id', userId)
      .in('sport_type', ['Run', 'TrailRun'])
      .order('start_date', { ascending: false })
      .limit(1);

    console.log(`[LastRun] lastRun=${activities?.[0]?.start_date?.slice(0, 10) ?? null} (null = no Strava data)`);
    if (!activities || activities.length === 0) return null;

    const act = activities[0];
    const distanceKm = (act.distance_m ?? 0) / 1000;
    const movingTimeSecs = act.moving_time_sec ?? 0;
    const paceMinsPerKm =
      distanceKm > 0 ? movingTimeSecs / 60 / distanceKm : 0;
    const avgHR = act.average_heartrate ?? 0;
    const runDate = act.start_date?.slice(0, 10) ?? '';

    // Fetch biometrics for that run date (runDate is YYYY-MM-DD)
    const runDayStart = new Date(runDate + 'T00:00:00Z').toISOString();
    const runDayEnd = new Date(
      new Date(runDate + 'T00:00:00Z').getTime() + 24 * 60 * 60 * 1000
    ).toISOString();

    const [{ data: hrvData }, { data: sleepData }] = await Promise.all([
      supabase
        .from('hrv_readings')
        .select('sdnn')
        .eq('user_id', userId)
        .gte('recorded_at', runDayStart)
        .lt('recorded_at', runDayEnd)
        .order('recorded_at', { ascending: false })
        .limit(1),
      supabase
        .from('sleep_sessions')
        .select('deep_min, light_min, rem_min')
        .eq('user_id', userId)
        .gte('start_time', runDayStart)
        .lt('start_time', runDayEnd)
        .order('start_time', { ascending: false })
        .limit(1),
    ]);

    const runHrv = hrvData?.[0]?.sdnn ?? null;
    const s = sleepData?.[0];
    const runSleepMinutes = s ? (s.deep_min ?? 0) + (s.light_min ?? 0) + (s.rem_min ?? 0) : null;

    const hrMed = median(baselines.restingHR);
    // HR reserve model: zone-2 running HR ≈ restingHR + 65% of estimated HR reserve
    // Anchor pace: 5:30/km (easy run). Each min/km faster → +8 bpm, slower → -8 bpm.
    const estimatedMaxHR = 190;
    const hrReserve = hrMed != null ? estimatedMaxHR - hrMed : 130;
    const easyRunHR = (hrMed ?? 60) + hrReserve * 0.65;
    const expectedHR = Math.round(easyRunHR + (5.5 - paceMinsPerKm) * 8);

    let effortVerdict: EffortVerdict = 'as_expected';
    if (avgHR > expectedHR + 8) effortVerdict = 'harder_than_expected';
    else if (avgHR < expectedHR - 8) effortVerdict = 'easier_than_expected';

    const hrvMed = median(baselines.hrv);
    let hrvVsNorm: 'above' | 'below' | 'normal' | null = null;
    if (runHrv != null && hrvMed != null) {
      if (runHrv > hrvMed * 1.05) hrvVsNorm = 'above';
      else if (runHrv < hrvMed * 0.95) hrvVsNorm = 'below';
      else hrvVsNorm = 'normal';
    }

    const explanation = buildRunExplanation({
      effortVerdict,
      avgHR,
      expectedHR,
      hrvVsNorm,
      paceMinsPerKm,
    });

    return {
      runName: act.name ?? 'Run',
      runDate,
      distanceKm,
      paceMinsPerKm,
      avgHR,
      expectedHR,
      effortVerdict,
      explanation,
      bodyStateAtRun: {
        readinessScore: null, // not backfilled for MVP
        sleepMinutes: runSleepMinutes,
        hrvVsNorm,
      },
    };
  } catch {
    return null;
  }
}

// ─── Sleep Baseline Tier ──────────────────────────────────────────────────────

const TIER_THRESHOLDS: { tier: SleepBaselineTier; min: number; max: number }[] = [
  { tier: 'low',        min: 0,  max: 49  },
  { tier: 'developing', min: 50, max: 64  },
  { tier: 'good',       min: 65, max: 79  },
  { tier: 'optimal',    min: 80, max: 100 },
];

const TIER_NEXT_THRESHOLD: Record<SleepBaselineTier, number | null> = {
  low:        50,
  developing: 65,
  good:       80,
  optimal:    null,
};

const ADVANCEMENT_TIP_KEYS: Record<SleepBaselineTier, string | null> = {
  low:        'sleep_baseline.tip_low_to_developing',
  developing: 'sleep_baseline.tip_developing_to_good',
  good:       'sleep_baseline.tip_good_to_optimal',
  optimal:    null,
};

function classifyTier(score: number): SleepBaselineTier {
  for (const { tier, min, max } of TIER_THRESHOLDS) {
    if (score >= min && score <= max) return tier;
  }
  return 'low';
}

export function computeSleepBaselineTier(baselines: FocusBaselines): SleepBaselineState {
  const scores = baselines.sleepScore;
  const daysInBaseline = scores.length;

  if (daysInBaseline === 0) {
    return {
      tier: 'low',
      averageScore: 0,
      daysInBaseline: 0,
      nextTierThreshold: 50,
      pointsToNextTier: 50,
      advancementTipKey: 'sleep_baseline.tip_low_to_developing',
    };
  }

  const averageScore = Math.round(
    scores.reduce((sum, s) => sum + s, 0) / scores.length
  );
  const tier = classifyTier(averageScore);
  const nextTierThreshold = TIER_NEXT_THRESHOLD[tier];
  const pointsToNextTier =
    nextTierThreshold != null ? Math.max(0, nextTierThreshold - averageScore) : null;
  const advancementTipKey = ADVANCEMENT_TIP_KEYS[tier];

  return {
    tier,
    averageScore,
    daysInBaseline,
    nextTierThreshold,
    pointsToNextTier,
    advancementTipKey,
  };
}
