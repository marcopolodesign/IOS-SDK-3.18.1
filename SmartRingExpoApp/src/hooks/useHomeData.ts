import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SleepSegment, SleepStage } from '../components/home/SleepStagesChart';
import UnifiedSmartRingService from '../services/UnifiedSmartRingService';
import JstyleService from '../services/JstyleService';
import { supabase } from '../services/SupabaseService';

const CACHE_KEY = 'home_data_cache';

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

/**
 * Build SleepData from raw JstyleService.getSleepData() records.
 * Smarter than buildSleepSegments: handles multi-record gaps (up to 60min),
 * builds a continuous 1-min timeline, and chooses the most recent sleep block.
 * Ported from testing.tsx (the cheatsheet).
 */
function deriveFromRaw(rawRecords: any[]): SleepData | null {
  if (!rawRecords || rawRecords.length === 0) return null;

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
    restingHR: 0, // patched in after HR fetch
    respiratoryRate: 0,
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

  const fetchData = useCallback(async (forceRefresh = false) => {
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

      // Build final state
      if (finalSleepData && restingHR > 0) finalSleepData.restingHR = restingHR;

      const sleep: SleepData = finalSleepData || {
        score: 0, timeAsleep: '0h 0m', timeAsleepMinutes: 0,
        restingHR, respiratoryRate: 0, segments: [], bedTime: new Date(), wakeTime: new Date(),
      };

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
        };

        console.log('📊 [useHomeData] setData →', { sleepScore: newData.sleepScore, overallScore: newData.overallScore, steps: newData.activity.steps, battery: ringBattery, hrPts: finalHrChartData.length });
        saveToCache(newData);
        return newData;
      });
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
  }, []);

  // Initial fetch — call autoReconnect() immediately (same pattern as testing.tsx)
  useEffect(() => {
    console.log('🚀 [useHomeData] HOOK MOUNTED at', new Date().toLocaleTimeString());
    fetchData(true);
  }, [fetchData]);

  // Listen for ring connection state changes
  // ONLY update UI state - mount effect handles initial data fetch
  useEffect(() => {
    const unsubscribe = UnifiedSmartRingService.onConnectionStateChanged((state) => {
      console.log('📡 [useHomeData] Connection state changed:', state, 'at', new Date().toLocaleTimeString());

      if (state === 'connected') {
        // IMPORTANT: Don't auto-fetch here - mount effect already handles connection + fetch
        // This listener only updates connection status for UI display
        // If user manually reconnects, they'll pull-to-refresh to get fresh data
        console.log('📡 [useHomeData] Connected - UI will update. Mount/PTR handles data fetching.');

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
        }
      } else if (state === 'disconnected') {
        // When ring disconnects, clear data and mark as disconnected
        console.log('😴 [useHomeData] Ring disconnected - clearing data');
        hasLoadedRealData.current = false;
        supabase.auth.getUser().then(({ data: { user } }) => {
          setData({
            ...getEmptyData(),
            userName: user?.user_metadata?.display_name || '',
            isLoading: false,
            isSyncing: false,
            isRingConnected: false,
          });
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Listen for app state changes (foreground/background)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      // App came to foreground from background
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('😴 [useHomeData] App came to foreground - syncing data');
        // Reset the real data flag so we try to fetch fresh data
        hasLoadedRealData.current = false;
        fetchData(true); // Force refresh
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [fetchData]);

  return {
    ...data,
    refresh: async () => { await fetchData(true); }, // Always force refresh on manual refresh
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
