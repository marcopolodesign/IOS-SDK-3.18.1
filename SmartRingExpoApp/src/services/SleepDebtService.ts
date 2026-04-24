/**
 * SleepDebtService — pure calculation service for sleep debt.
 * Pattern follows ReadinessService: no React, no BLE.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './SupabaseService';
import type {
  SleepDebtCategory,
  DailyDeficit,
  SleepDebtState,
  NightlyPoint,
  TonightRecommendation,
} from '../types/sleepDebt.types';

const CACHE_KEY = 'sleep_debt_cache_v3';
const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const DEFAULT_TARGET = 480;
const MIN_NIGHTS = 3;
const RECOVERY_NIGHTS = 3;
const EXTRA_CAP = 90;       // never recommend > +1h30 above target
const NIGHT_CEILING = 600;  // hard cap at 10h

interface CachedSleepDebt {
  state: SleepDebtState;
  cachedAt: number;
}

// ─── Sleep target ──────────────────────────────────────────────────────────────

export async function getSleepTarget(userId: string): Promise<number> {
  try {
    const { data } = await (supabase
      .from('profiles') as any)
      .select('sleep_target_min')
      .eq('id', userId)
      .single();
    return data?.sleep_target_min ?? DEFAULT_TARGET;
  } catch {
    return DEFAULT_TARGET;
  }
}

export async function setSleepTarget(userId: string, minutes: number): Promise<void> {
  await (supabase
    .from('profiles') as any)
    .update({ sleep_target_min: minutes })
    .eq('id', userId);
}

// ─── Category + gradient logic ─────────────────────────────────────────────────

export function categorizeDebt(totalMin: number): SleepDebtCategory {
  if (totalMin < 30) return 'none';
  if (totalMin <= 120) return 'low';
  if (totalMin <= 300) return 'moderate';
  return 'high';
}

export function gradientForCategory(category: SleepDebtCategory): [string, string] {
  switch (category) {
    case 'none':     return ['#10B981', '#047857'];
    case 'low':      return ['#FFD24D', '#D97706'];
    case 'moderate': return ['#FB923C', '#C2410C'];
    case 'high':     return ['#EF4444', '#991B1B'];
  }
}

export function getRecoverySuggestionKey(category: SleepDebtCategory): string | null {
  switch (category) {
    case 'none':     return null;
    case 'low':      return 'sleep_debt.recovery_low';
    case 'moderate': return 'sleep_debt.recovery_moderate';
    case 'high':     return 'sleep_debt.recovery_high';
  }
}

// ─── Tonight recommendation ────────────────────────────────────────────────────

export function computeTonightRecommendation({
  targetMin,
  totalDebtMin,
}: { targetMin: number; totalDebtMin: number }): TonightRecommendation {
  const extraPerNight = Math.min(EXTRA_CAP, Math.round(totalDebtMin / RECOVERY_NIGHTS));
  const recommendedMin = Math.min(NIGHT_CEILING, targetMin + extraPerNight);

  let rationaleKey: string;
  if (totalDebtMin < 30)       rationaleKey = 'sleep_debt.rec_rationale_none';
  else if (extraPerNight < 20) rationaleKey = 'sleep_debt.rec_rationale_maintain';
  else if (extraPerNight <= 45) rationaleKey = 'sleep_debt.rec_rationale_moderate';
  else                          rationaleKey = 'sleep_debt.rec_rationale_aggressive';

  return { recommendedMin, extraPerNight, rationaleKey };
}

// ─── Main computation ──────────────────────────────────────────────────────────

export async function computeSleepDebt(userId: string): Promise<SleepDebtState> {
  const targetMin = await getSleepTarget(userId);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoff = thirtyDaysAgo.toISOString().slice(0, 10);

  const { data: rows } = await (supabase
    .from('daily_summaries') as any)
    .select('date, sleep_total_min, nap_total_min')
    .eq('user_id', userId)
    .gte('date', cutoff)
    .order('date', { ascending: true })
    .limit(30);

  const validRows: Array<{ date: string; sleep_total_min: number; nap_total_min: number | null }> =
    (rows ?? []).filter(
      (r: any) => r.sleep_total_min != null && r.sleep_total_min > 0
    );

  // Compute NightlyPoint for each valid row with trailing 7-day running debt
  // Pass 1: compute running debt at each point (needed to derive recommendedMin for the next point)
  const runningDebts: number[] = validRows.map((r, i, arr) => {
    const windowStart = Math.max(0, i - 6);
    return arr.slice(windowStart, i + 1).reduce((sum, wr) => {
      const a = wr.sleep_total_min + (wr.nap_total_min || 0);
      return sum + Math.max(0, targetMin - a);
    }, 0);
  });

  // Pass 2: build full NightlyPoint using prior-night running debt for recommendedMin
  const last30: NightlyPoint[] = validRows.map((r, i) => {
    const actualMin = r.sleep_total_min + (r.nap_total_min || 0);
    const deficitMin = Math.max(0, targetMin - actualMin);
    const runningDebtMin = runningDebts[i];
    const priorDebt = i > 0 ? runningDebts[i - 1] : 0;
    const recommendedMin = computeTonightRecommendation({ targetMin, totalDebtMin: priorDebt }).recommendedMin;
    return { date: r.date, actualMin, targetMin, deficitMin, runningDebtMin, recommendedMin };
  });

  const last7 = last30.slice(-7);

  if (last7.length < MIN_NIGHTS) {
    return {
      totalDebtMin: 0,
      averageSleepMin: 0,
      category: 'none',
      dailyDeficits: [],
      targetMin,
      daysWithData: last7.length,
      isReady: false,
      recoverySuggestionKey: null,
      last30,
      last7,
      tonight: computeTonightRecommendation({ targetMin, totalDebtMin: 0 }),
    };
  }

  const dailyDeficits: DailyDeficit[] = last7.map(p => ({
    date: p.date,
    actualMin: p.actualMin,
    targetMin: p.targetMin,
    deficitMin: p.deficitMin,
  }));

  const totalDebtMin = dailyDeficits.reduce((s, d) => s + d.deficitMin, 0);
  const totalSleep = dailyDeficits.reduce((s, d) => s + d.actualMin, 0);
  const averageSleepMin = Math.round(totalSleep / dailyDeficits.length);
  const category = categorizeDebt(totalDebtMin);
  const tonight = computeTonightRecommendation({ targetMin, totalDebtMin });

  return {
    totalDebtMin,
    averageSleepMin,
    category,
    dailyDeficits,
    targetMin,
    daysWithData: dailyDeficits.length,
    isReady: true,
    recoverySuggestionKey: getRecoverySuggestionKey(category),
    last30,
    last7,
    tonight,
  };
}

// ─── Cache helpers ─────────────────────────────────────────────────────────────

export async function getCachedSleepDebt(): Promise<SleepDebtState | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw) as CachedSleepDebt;
    if (Date.now() - cache.cachedAt > CACHE_TTL_MS) return null;
    return cache.state;
  } catch {
    return null;
  }
}

export async function cacheSleepDebt(state: SleepDebtState): Promise<void> {
  try {
    const payload: CachedSleepDebt = { state, cachedAt: Date.now() };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {}
}

export async function clearSleepDebtCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
  } catch {}
}
