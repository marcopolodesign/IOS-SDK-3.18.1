/**
 * SleepDebtService — pure calculation service for 7-day sleep debt.
 * Pattern follows ReadinessService: no React, no BLE.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './SupabaseService';
import type { SleepDebtCategory, DailyDeficit, SleepDebtState } from '../types/sleepDebt.types';

const CACHE_KEY = 'sleep_debt_cache_v1';
const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const DEFAULT_TARGET = 480;
const MIN_NIGHTS = 3;

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

// ─── Category logic ────────────────────────────────────────────────────────────

export function categorizeDebt(totalMin: number): SleepDebtCategory {
  if (totalMin < 30) return 'none';
  if (totalMin <= 120) return 'low';
  if (totalMin <= 300) return 'moderate';
  return 'high';
}

export function getRecoverySuggestionKey(category: SleepDebtCategory): string | null {
  switch (category) {
    case 'none':
      return null;
    case 'low':
      return 'sleep_debt.recovery_low';
    case 'moderate':
      return 'sleep_debt.recovery_moderate';
    case 'high':
      return 'sleep_debt.recovery_high';
  }
}

// ─── Main computation ──────────────────────────────────────────────────────────

export async function computeSleepDebt(userId: string): Promise<SleepDebtState> {
  const targetMin = await getSleepTarget(userId);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const cutoff = sevenDaysAgo.toISOString().slice(0, 10);

  const { data: rows } = await (supabase
    .from('daily_summaries') as any)
    .select('date, sleep_total_min, nap_total_min')
    .eq('user_id', userId)
    .gte('date', cutoff)
    .order('date', { ascending: false })
    .limit(7);

  const validRows = (rows ?? []).filter(
    (r: any) => r.sleep_total_min != null && r.sleep_total_min > 0
  );

  if (validRows.length < MIN_NIGHTS) {
    return {
      totalDebtMin: 0,
      averageSleepMin: 0,
      category: 'none',
      dailyDeficits: [],
      targetMin,
      daysWithData: validRows.length,
      isReady: false,
      recoverySuggestionKey: null,
    };
  }

  // Naps reduce debt (Ultrahuman-style): add nap minutes to actual sleep
  const dailyDeficits: DailyDeficit[] = validRows.map((r: any) => {
    const actualMin = r.sleep_total_min + (r.nap_total_min || 0);
    return {
      date: r.date,
      actualMin,
      targetMin,
      deficitMin: Math.max(0, targetMin - actualMin),
    };
  });

  const totalDebtMin = dailyDeficits.reduce((s, d) => s + d.deficitMin, 0);
  const totalSleep = dailyDeficits.reduce((s, d) => s + d.actualMin, 0);
  const averageSleepMin = Math.round(totalSleep / dailyDeficits.length);
  const category = categorizeDebt(totalDebtMin);

  return {
    totalDebtMin,
    averageSleepMin,
    category,
    dailyDeficits,
    targetMin,
    daysWithData: dailyDeficits.length,
    isReady: true,
    recoverySuggestionKey: getRecoverySuggestionKey(category),
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
