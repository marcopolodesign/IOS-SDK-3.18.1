/**
 * useSleepDebt — hook for sleep debt state with caching.
 */

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../services/SupabaseService';
import {
  computeSleepDebt,
  getCachedSleepDebt,
  cacheSleepDebt,
  clearSleepDebtCache,
  setSleepTarget,
} from '../services/SleepDebtService';
import type { SleepDebtState } from '../types/sleepDebt.types';

const EMPTY_STATE: SleepDebtState = {
  totalDebtMin: 0,
  averageSleepMin: 0,
  category: 'none',
  dailyDeficits: [],
  targetMin: 480,
  daysWithData: 0,
  isReady: false,
  recoverySuggestionKey: null,
};

export function useSleepDebt() {
  const [sleepDebt, setSleepDebt] = useState<SleepDebtState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (skipCache = false) => {
    setLoading(true);
    try {
      if (!skipCache) {
        const cached = await getCachedSleepDebt();
        if (cached && cached.isReady) {
          setSleepDebt(cached);
          setLoading(false);
          return;
        }
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const state = await computeSleepDebt(user.id);
      setSleepDebt(state);
      await cacheSleepDebt(state);
    } catch (e) {
      console.warn('[useSleepDebt] load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  const updateTarget = useCallback(async (minutes: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await setSleepTarget(user.id, minutes);
      await clearSleepDebtCache();
      await load(true);
    } catch (e) {
      console.warn('[useSleepDebt] updateTarget error:', e);
    }
  }, [load]);

  return { sleepDebt, loading, refresh, updateTarget };
}
