/**
 * useSleepBaseline — hook for sleep baseline tier state with caching.
 */

import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/SupabaseService';
import { supabaseService } from '../services/SupabaseService';
import { reportError } from '../utils/sentry';
import { loadBaselines, bootstrapBaselinesFromSupabase, computeSleepBaselineTier } from '../services/ReadinessService';
import type { SleepBaselineState } from '../types/sleepBaseline.types';

const CACHE_KEY = 'sleep_baseline_tier_v2';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

interface CachedBaseline {
  state: SleepBaselineState;
  cachedAt: number;
}

async function getCache(): Promise<SleepBaselineState | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: CachedBaseline = JSON.parse(raw);
    if (Date.now() - parsed.cachedAt > CACHE_TTL_MS) return null;
    return parsed.state;
  } catch {
    return null;
  }
}

async function setCache(state: SleepBaselineState): Promise<void> {
  try {
    const entry: CachedBaseline = { state, cachedAt: Date.now() };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {}
}

const EMPTY_STATE: SleepBaselineState = {
  tier: 'low',
  averageScore: 0,
  daysInBaseline: 0,
  nextTierThreshold: 50,
  pointsToNextTier: 50,
  advancementTipKey: 'sleep_baseline.tip_low_to_developing',
};

export function useSleepBaseline() {
  const [baseline, setBaseline] = useState<SleepBaselineState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (skipCache = false) => {
    setLoading(true);
    try {
      if (!skipCache) {
        const cached = await getCache();
        if (cached) {
          setBaseline(cached);
          setLoading(false);
          return;
        }
      }

      let baselines = await loadBaselines();

      // Bootstrap from Supabase if no sleep data on device yet
      if (baselines.sleepScore.length === 0) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          baselines = await bootstrapBaselinesFromSupabase(user.id);
        }
      }

      const state = computeSleepBaselineTier(baselines);
      setBaseline(state);
      await setCache(state);

      // Persist tier to Supabase (fire-and-forget)
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user && state.daysInBaseline >= 1) {
          supabaseService
            .updateSleepBaselineTier(user.id, state.tier, state.averageScore)
            .catch((e) => { console.warn('[useSleepBaseline] supabase sync error:', e); reportError(e, { op: 'sleepBaseline.supabaseSync' }, 'warning'); });
        }
      });
    } catch (e) {
      console.warn('[useSleepBaseline] load error:', e);
      reportError(e, { op: 'sleepBaseline.compute' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  return { baseline, loading, refresh };
}
