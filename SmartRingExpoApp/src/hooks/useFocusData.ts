/**
 * useFocusData -- data orchestration for the Focus/Readiness screen.
 * Reads from Supabase only (no BLE). Shows empty state when no data synced yet.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { reportError } from '../utils/sentry';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/SupabaseService';
import { stravaService } from '../services/StravaService';
import {
  loadBaselines,
  saveBaselines,
  updateBaselines,
  bootstrapBaselinesFromSupabase,
  computeReadiness,
  computeIllnessWatch,
  computeLastRunContext,
} from '../services/ReadinessService';
import type {
  FocusState,
  ReadinessScore,
  IllnessWatch,
  LastRunContext,
  FocusBaselines,
  IllnessStatus,
} from '../types/focus.types';
import type { IllnessScore } from '../types/supabase.types';

const CACHE_KEY = 'focus_state_cache_v6';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

interface CachedFocusState {
  readiness: ReadinessScore | null;
  illness: IllnessWatch | null;
  lastRun: LastRunContext | null;
  cachedAt: number;
}

function isCacheValid(cache: CachedFocusState): boolean {
  return Date.now() - cache.cachedAt < CACHE_TTL_MS;
}

function mapServerScoreToIllnessWatch(row: IllnessScore): IllnessWatch {
  const status = row.status as IllnessStatus;
  return {
    status,
    score: row.score,
    stale: row.stale,
    computedAt: row.created_at,
    signals: {
      restingHRElevated: row.sub_nocturnal_hr > 0,
      hrvSuppressed: row.sub_hrv > 0,
      spo2Low: row.sub_spo2 > 0,
      tempDeviation: row.sub_temperature > 0,
      sleepFragmented: row.sub_sleep > 0,
    },
    details: {
      hrDelta:
        row.nocturnal_hr != null && row.baseline_nocturnal_hr != null
          ? `${row.nocturnal_hr > row.baseline_nocturnal_hr ? '+' : ''}${Math.round(row.nocturnal_hr - row.baseline_nocturnal_hr)} bpm`
          : null,
      hrvDelta:
        row.hrv_sdnn != null && row.baseline_hrv_sdnn != null && row.baseline_hrv_sdnn > 0
          ? `${Math.round(((row.hrv_sdnn - row.baseline_hrv_sdnn) / row.baseline_hrv_sdnn) * 100)}%`
          : null,
      spo2Delta: row.spo2_min_val != null ? `Min ${row.spo2_min_val}%` : null,
      tempDelta:
        row.temperature_avg != null && row.baseline_temperature != null
          ? `${(row.temperature_avg - row.baseline_temperature) >= 0 ? '+' : ''}${(row.temperature_avg - row.baseline_temperature).toFixed(1)}°C`
          : null,
      sleepDelta: row.sleep_awake_min != null ? `${row.sleep_awake_min} min awake` : null,
    },
    summary:
      status === 'CLEAR'
        ? 'All signals within your normal range.'
        : status === 'WATCH'
          ? 'Some signals are deviating from your baseline. Keep an eye on how you feel.'
          : 'Multiple signals suggest your body is under strain. Consider resting today.',
  };
}

/** Returns a date range [start, end] ISO strings for "today" */
function todayRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function useFocusData(): FocusState {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<ReadinessScore | null>(null);
  const [illness, setIllness] = useState<IllnessWatch | null>(null);
  const [lastRun, setLastRun] = useState<LastRunContext | null>(null);
  const [baselines, setBaselines] = useState<FocusBaselines | null>(null);
  const bgRefreshInFlight = useRef(false);
  const hasDataRef = useRef(false);

  const load = useCallback(async (skipCache = false) => {
    if (!hasDataRef.current) setIsLoading(true);
    setError(null);

    try {
      // 1. Try cache for instant render
      if (!skipCache) {
        try {
          const raw = await AsyncStorage.getItem(CACHE_KEY);
          if (raw) {
            const cache = JSON.parse(raw) as CachedFocusState;
            if (isCacheValid(cache) && cache.readiness != null && cache.illness != null) {
              setReadiness(cache.readiness);
              setIllness(cache.illness);
              setLastRun(cache.lastRun);
              hasDataRef.current = true;
              // Baselines are not in the cache payload — load them separately so
              // ReadinessCard can show confidence dots without waiting for a full refresh.
              loadBaselines().then(setBaselines).catch(e => reportError(e, { op: 'focusData.loadBaselines' }, 'warning'));
              setIsLoading(false);
              // If restingHR component is missing, check if home_data_cache now has it.
              // Race condition: useFocusData may have run before useHomeData wrote the cache.
              if (cache.readiness.components?.restingHR == null && !bgRefreshInFlight.current) {
                bgRefreshInFlight.current = true;
                AsyncStorage.getItem('home_data_cache').then(raw => {
                  if (!raw) return;
                  try {
                    const home = JSON.parse(raw) as { lastNightSleep?: { restingHR?: number } };
                    if ((home?.lastNightSleep?.restingHR ?? 0) > 0) {
                      load(true);
                    }
                  } catch {}
                }).catch(e => reportError(e, { op: 'focusData.backgroundRefresh' })).finally(() => { bgRefreshInFlight.current = false; });
              }
              return;
            } else {
            }
          } else {
          }
        } catch {}
      }

      // 2. Get auth user + load baselines in parallel
      // Use getSession() (reads AsyncStorage, no network call) so we always get
      // the userId even when getUser()'s server round-trip is slow/failing.
      const [earlyBaselines, { data: { session } }] = await Promise.all([
        loadBaselines(),
        supabase.auth.getSession(),
      ]);
      const user = session?.user ?? null;
      setBaselines(earlyBaselines);
      if (!user) {
        setIsLoading(false);
        return;
      }
      const userId = user.id;

      // 3. Bootstrap baselines from history on first ever load
      let storedBaselines = earlyBaselines;
      if (storedBaselines.daysLogged === 0 && storedBaselines.updatedAt === null) {
        storedBaselines = await bootstrapBaselinesFromSupabase(userId);
        setBaselines(storedBaselines);
      }

      // 4. Fetch today's metrics from Supabase using recorded_at / start_time
      const { start: todayStart, end: todayEnd } = todayRange();
      // Sleep sessions start the night before (e.g. 9-11pm) — look back to 6pm yesterday
      const sleepLookbackStart = new Date(
        new Date(todayStart).getTime() - 6 * 60 * 60 * 1000
      ).toISOString();

      const [hrvResult, sleepResult, tempResult, hrResult, homeRaw] =
        await Promise.allSettled([
          supabase
            .from('hrv_readings')
            .select('sdnn')
            .eq('user_id', userId)
            .gte('recorded_at', todayStart)
            .lt('recorded_at', todayEnd)
            .order('recorded_at', { ascending: false })
            .limit(1),
          supabase
            .from('sleep_sessions')
            .select('sleep_score, deep_min, light_min, rem_min, awake_min')
            .eq('user_id', userId)
            .eq('session_type', 'night')
            .gte('start_time', sleepLookbackStart)
            .lt('start_time', todayEnd)
            .order('start_time', { ascending: false })
            .limit(1),
          supabase
            .from('temperature_readings')
            .select('temperature_c')
            .eq('user_id', userId)
            .gte('recorded_at', todayStart)
            .lt('recorded_at', todayEnd),
          supabase
            .from('heart_rate_readings')
            .select('heart_rate')
            .eq('user_id', userId)
            .gte('recorded_at', sleepLookbackStart)
            .lt('recorded_at', todayEnd)
            .order('heart_rate', { ascending: true })
            .limit(1),
          AsyncStorage.getItem('home_data_cache'),
        ]);


      const hrv =
        hrvResult.status === 'fulfilled'
          ? (hrvResult.value.data?.[0]?.sdnn ?? null)
          : null;

      const sleepRow =
        sleepResult.status === 'fulfilled' ? sleepResult.value.data?.[0] : null;
      const sleepScore = sleepRow?.sleep_score ?? null;
      // Compute total sleep minutes from stage minutes
      const sleepMinutes =
        sleepRow != null
          ? (sleepRow.deep_min ?? 0) +
            (sleepRow.light_min ?? 0) +
            (sleepRow.rem_min ?? 0)
          : null;

      const temps =
        tempResult.status === 'fulfilled' ? tempResult.value.data ?? [] : [];
      const temperature =
        temps.length > 0
          ? temps.reduce(
              (s: number, r: { temperature_c: number }) => s + r.temperature_c,
              0
            ) / temps.length
          : null;

      // Resting HR: prefer ring-computed value from home_data_cache (most accurate
      // — ring uses overnight window). Supabase heart_rate_readings can include
      // daytime readings whose minimum is higher than true resting HR.
      let restingHR: number | null = null;
      try {
        const raw = homeRaw.status === 'fulfilled' ? homeRaw.value : null;
        if (raw) {
          const homeCache = JSON.parse(raw) as { lastNightSleep?: { restingHR?: number } };
          const cached = homeCache?.lastNightSleep?.restingHR;
          if (cached && cached > 0) {
            restingHR = cached;
          }
        }
      } catch {}

      if (restingHR == null) {
        // Fallback to Supabase minimum HR if home_data_cache unavailable
        restingHR =
          hrResult.status === 'fulfilled'
            ? (hrResult.value.data?.[0]?.heart_rate ?? null)
            : null;
      }
      // 5. Update baselines if new day
      const updatedBaselines = updateBaselines(storedBaselines, {
        hrv,
        sleepScore,
        sleepMinutes,
        restingHR,
        temperature,
      });
      if (updatedBaselines !== storedBaselines) {
        setBaselines(updatedBaselines);
        await saveBaselines(updatedBaselines);
      }

      // 6. Parallel computation
      const [computedReadiness, computedLastRun] = await Promise.all([
        computeReadiness({
          userId,
          hrv,
          sleepScore,
          sleepMinutes,
          restingHR,
          baselines: updatedBaselines,
        }),
        computeLastRunContext(userId, updatedBaselines),
      ]);

      // Illness: prefer server-computed score from illness_scores table (pg_cron)
      let computedIllness: IllnessWatch;
      const { data: serverScore } = await supabase
        .from('illness_scores')
        .select('*')
        .eq('user_id', userId)
        .order('score_date', { ascending: false })
        .limit(1)
        .single();

      if (serverScore) {
        computedIllness = mapServerScoreToIllnessWatch(serverScore);
      } else {
        // Fallback: client-side computation before first cron run
        computedIllness = computeIllnessWatch({
          temperature,
          restingHR,
          hrv,
          baselines: updatedBaselines,
        });
        computedIllness.score = 0;
      }
      setReadiness(computedReadiness);
      setIllness(computedIllness);
      setLastRun(computedLastRun);
      hasDataRef.current = true;

      // 7. Save cache
      const cachePayload: CachedFocusState = {
        readiness: computedReadiness,
        illness: computedIllness,
        lastRun: computedLastRun,
        cachedAt: Date.now(),
      };
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cachePayload));
    } catch (e) {
      reportError(e, { op: 'focusData.fetch' });
      setError(e instanceof Error ? e.message : 'Failed to load focus data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      // Background: sync latest Strava activities then reload silently.
      // hasDataRef prevents the reload from showing a spinner when data is already visible.
      stravaService.backgroundSync(3)
        .catch(e => { reportError(e, { op: 'focusData.isConnected' }, 'warning'); return null; })
        .then(() => load(true));
    }, [load])
  );

  // Bust cache when new Strava activities are synced
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled || !user) return;

      channel = supabase
        .channel('strava-activities-focus')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'strava_activities',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            AsyncStorage.removeItem(CACHE_KEY).then(() => load(true));
          }
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [load]);

  const refresh = useCallback(() => {
    load(true);
  }, [load]);

  return { readiness, illness, lastRun, isLoading, error, baselines, refresh };
}
