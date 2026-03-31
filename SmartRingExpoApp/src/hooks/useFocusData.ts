/**
 * useFocusData -- data orchestration for the Focus/Readiness screen.
 * Reads from Supabase only (no BLE). Shows empty state when no data synced yet.
 */

import { useState, useCallback, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/SupabaseService';
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
} from '../types/focus.types';

const CACHE_KEY = 'focus_state_cache_v5';
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

  const load = useCallback(async (skipCache = false) => {
    console.log(`[FocusData] load() called, skipCache=${skipCache}`);
    setIsLoading(true);
    setError(null);

    try {
      // 1. Try cache for instant render
      if (!skipCache) {
        try {
          const raw = await AsyncStorage.getItem(CACHE_KEY);
          if (raw) {
            const cache = JSON.parse(raw) as CachedFocusState;
            if (isCacheValid(cache) && cache.readiness != null && cache.illness != null) {
              console.log(`[FocusData] Cache HIT, valid=true, cachedAt=${new Date(cache.cachedAt).toISOString()}`);
              setReadiness(cache.readiness);
              setIllness(cache.illness);
              setLastRun(cache.lastRun);
              // Baselines are not in the cache payload — load them separately so
              // ReadinessCard can show confidence dots without waiting for a full refresh.
              loadBaselines().then(setBaselines).catch(() => {});
              setIsLoading(false);
              return;
            } else {
              console.log(`[FocusData] Cache invalid/empty, fetching fresh (cachedAt=${new Date(cache.cachedAt).toISOString()}, readiness=${cache.readiness != null})`);
            }
          } else {
            console.log('[FocusData] Cache MISS or expired, fetching fresh (no cache found)');
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
      console.log(`[FocusData] Auth user=${user?.id ?? null} (null = not signed in)`);
      setBaselines(earlyBaselines);
      if (!user) {
        setIsLoading(false);
        return;
      }
      const userId = user.id;

      // 3. Bootstrap baselines from history on first ever load
      let storedBaselines = earlyBaselines;
      if (storedBaselines.daysLogged === 0 && storedBaselines.updatedAt === null) {
        console.log('[FocusData] Bootstrap needed (daysLogged=0), fetching 14-day history...');
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

      // Log per-query errors
      const logQueryError = (name: string, r: PromiseSettledResult<{ data: unknown; error: { message: string } | null }>) => {
        if (r.status === 'rejected') console.log(`[FocusData] ${name} query error:`, r.reason);
        else if (r.value.error) console.log(`[FocusData] ${name} error:`, r.value.error.message);
      };
      logQueryError('hrv_readings', hrvResult);
      logQueryError('sleep_sessions', sleepResult);
      logQueryError('temperature_readings', tempResult);
      logQueryError('heart_rate_readings', hrResult);

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
            console.log(`[FocusData] restingHR from home_data_cache: ${restingHR}`);
          }
        }
      } catch {}

      if (restingHR == null) {
        // Fallback to Supabase minimum HR if home_data_cache unavailable
        restingHR =
          hrResult.status === 'fulfilled'
            ? (hrResult.value.data?.[0]?.heart_rate ?? null)
            : null;
        console.log(`[FocusData] restingHR fallback from Supabase: ${restingHR}`);
      }

      console.log(`[FocusData] Supabase results → hrv=${hrv}, sleepScore=${sleepScore}, sleepMin=${sleepMinutes}, restingHR=${restingHR}, temps=${temps.length} readings`);
      console.log(`[FocusData] Baselines → hrv=[${storedBaselines.hrv.join(',')}] restingHR=[${storedBaselines.restingHR.join(',')}] daysLogged=${storedBaselines.daysLogged}`);

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

      const computedIllness = computeIllnessWatch({
        temperature,
        restingHR,
        hrv,
        respiratoryRate: null, // not available from ring for MVP
        baselines: updatedBaselines,
      });

      console.log(`[FocusData] computeReadiness score=${computedReadiness.score}, illness status=${computedIllness.status}, lastRun=${computedLastRun?.runDate ?? null}`);
      console.log(`[FocusData] Components → hrv=${computedReadiness.components.hrv} sleep=${computedReadiness.components.sleep} restingHR=${computedReadiness.components.restingHR} trainingLoad=${computedReadiness.components.trainingLoad}`);

      setReadiness(computedReadiness);
      setIllness(computedIllness);
      setLastRun(computedLastRun);

      // 7. Save cache
      const cachePayload: CachedFocusState = {
        readiness: computedReadiness,
        illness: computedIllness,
        lastRun: computedLastRun,
        cachedAt: Date.now(),
      };
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cachePayload));
      console.log('[FocusData] Cache saved');
    } catch (e) {
      console.log('[FocusData] ERROR:', e instanceof Error ? e.message : e);
      setError(e instanceof Error ? e.message : 'Failed to load focus data');
    } finally {
      setIsLoading(false);
      console.log('[FocusData] load() complete → isLoading=false');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
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
