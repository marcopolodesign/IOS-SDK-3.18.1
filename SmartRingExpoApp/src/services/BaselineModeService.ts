/**
 * BaselineModeService — pure functions + persistence for baseline mode.
 * Determines whether the user has enough data for meaningful scores.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './SupabaseService';
import { reportError } from '../utils/sentry';
import type { BaselineModeState, BaselineMetrics, MetricBaselineProgress } from '../types/baseline.types';
import type { FocusBaselines } from '../types/focus.types';

const BASELINE_COMPLETED_KEY = 'baseline_completed_at_v1';

// Minimum days per metric category before scores are meaningful
const THRESHOLDS = {
  sleep: 3,
  heartRate: 3,
  hrv: 3,
  temperature: 3,
  spo2: 1,
  activity: 1,
} as const;

// The gating metrics that must all be met before composite scores show
const GATING_METRICS: (keyof typeof THRESHOLDS)[] = ['sleep', 'heartRate', 'hrv'];

function makeProgress(current: number, required: number): MetricBaselineProgress {
  return { current: Math.min(current, required), required, ready: current >= required };
}

/**
 * Compute baseline state from existing baselines data.
 * Uses FocusBaselines (from ReadinessService) and MetricBaselines (from useHomeData)
 * to derive per-metric readiness.
 */
export function computeBaselineState(
  focusBaselines: FocusBaselines | null,
  metricBaselines: { sleepMinutes: number[]; restingHR: number[]; hrvSdnn: number[]; temperature: number[]; spo2: number[]; steps: number[] } | null,
  cachedCompletedAt: string | null,
): BaselineModeState {
  // If baseline was already completed, always return non-baseline state
  if (cachedCompletedAt) {
    return {
      isInBaselineMode: false,
      overallProgress: 1,
      metrics: {
        sleep: makeProgress(THRESHOLDS.sleep, THRESHOLDS.sleep),
        heartRate: makeProgress(THRESHOLDS.heartRate, THRESHOLDS.heartRate),
        hrv: makeProgress(THRESHOLDS.hrv, THRESHOLDS.hrv),
        temperature: makeProgress(THRESHOLDS.temperature, THRESHOLDS.temperature),
        spo2: makeProgress(THRESHOLDS.spo2, THRESHOLDS.spo2),
        activity: makeProgress(THRESHOLDS.activity, THRESHOLDS.activity),
      },
      daysWithData: Math.max(focusBaselines?.daysLogged ?? 0, THRESHOLDS.sleep),
      baselineCompletedAt: cachedCompletedAt,
      canShowScores: true,
    };
  }

  // Compute per-metric days from both baseline sources
  const sleepDays = metricBaselines?.sleepMinutes?.length ?? focusBaselines?.sleepScore?.length ?? 0;
  const hrDays = metricBaselines?.restingHR?.length ?? focusBaselines?.restingHR?.length ?? 0;
  const hrvDays = metricBaselines?.hrvSdnn?.length ?? focusBaselines?.hrv?.length ?? 0;
  const tempDays = metricBaselines?.temperature?.length ?? focusBaselines?.temperature?.length ?? 0;
  const spo2Days = metricBaselines?.spo2?.length ?? 0;
  const activityDays = metricBaselines?.steps?.length ?? 0;
  const daysWithData = focusBaselines?.daysLogged ?? Math.max(sleepDays, hrDays, hrvDays);

  const metrics: BaselineMetrics = {
    sleep: makeProgress(sleepDays, THRESHOLDS.sleep),
    heartRate: makeProgress(hrDays, THRESHOLDS.heartRate),
    hrv: makeProgress(hrvDays, THRESHOLDS.hrv),
    temperature: makeProgress(tempDays, THRESHOLDS.temperature),
    spo2: makeProgress(spo2Days, THRESHOLDS.spo2),
    activity: makeProgress(activityDays, THRESHOLDS.activity),
  };

  // Overall progress = average of gating metrics only
  const gatingProgress = GATING_METRICS.reduce((sum, key) => {
    return sum + Math.min(metrics[key].current / metrics[key].required, 1);
  }, 0) / GATING_METRICS.length;

  const canShowScores = GATING_METRICS.every((key) => metrics[key].ready);

  return {
    isInBaselineMode: !canShowScores,
    overallProgress: Math.round(gatingProgress * 100) / 100,
    metrics,
    daysWithData,
    baselineCompletedAt: null,
    canShowScores,
  };
}

// ─── Persistence ────────────────────────────────────────────────────────────

export async function loadBaselineCompletedAt(): Promise<string | null> {
  try {
    const local = await AsyncStorage.getItem(BASELINE_COMPLETED_KEY);
    if (local) return local;

    // Fallback: check Supabase user_profiles
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await (supabase as any)
      .from('profiles')
      .select('baseline_completed_at')
      .eq('id', user.id)
      .single();

    const completedAt = (data as any)?.baseline_completed_at as string | null;
    if (completedAt) {
      // Cache locally for next time
      await AsyncStorage.setItem(BASELINE_COMPLETED_KEY, completedAt);
    }
    return completedAt;
  } catch {
    return null;
  }
}

export async function persistBaselineCompletion(): Promise<string> {
  const now = new Date().toISOString();

  // Save to AsyncStorage (critical path)
  try {
    await AsyncStorage.setItem(BASELINE_COMPLETED_KEY, now);
  } catch (err) {
    console.warn('[BaselineMode] Failed to persist to AsyncStorage:', err);
    reportError(err, { op: 'baselineMode.persistLocal' }, 'warning');
  }

  // Save to Supabase (best-effort)
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await (supabase as any)
        .from('profiles')
        .upsert(
          { id: user.id, baseline_completed_at: now },
          { onConflict: 'id' }
        );
    }
  } catch (err) {
    console.warn('[BaselineMode] Failed to persist to Supabase:', err);
    reportError(err, { op: 'baselineMode.persistSupabase' }, 'warning');
  }

  return now;
}

export async function clearBaselineCompletion(): Promise<void> {
  await AsyncStorage.removeItem(BASELINE_COMPLETED_KEY);
}
