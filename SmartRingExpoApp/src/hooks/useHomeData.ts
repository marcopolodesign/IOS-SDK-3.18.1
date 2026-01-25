import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SleepSegment, SleepStage } from '../components/home/SleepStagesChart';
import { getSleep, calculateSleepScore, type SleepInfo } from '../utils/ringData/sleep';
import UnifiedSmartRingService from '../services/UnifiedSmartRingService';
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
      activity: data.activity,
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
 * Helper to retry an async operation with delay
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 2,
  delayMs: number = 1500,
  operationName: string = 'operation'
): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`😴 [useHomeData] Retrying ${operationName} (attempt ${attempt + 1})...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
      return await operation();
    } catch (error) {
      lastError = error;
      console.log(`😴 [useHomeData] ${operationName} failed (attempt ${attempt + 1}):`, error);
    }
  }
  throw lastError;
}

/**
 * Map SDK sleep type to component SleepStage
 * SDK: 0=None, 1=Awake, 2=Light, 3=Deep, 4=REM, 5=Unweared
 * Component: 'awake', 'rem', 'core', 'deep'
 */
function mapSleepType(type: number): SleepStage {
  switch (type) {
    case 1: return 'awake';
    case 2: return 'core';  // Light sleep = Core in UI
    case 3: return 'deep';
    case 4: return 'rem';
    default: return 'core'; // Default to light/core
  }
}

/**
 * Fetch real sleep data from the ring and transform to component format
 * Includes retry logic for when SDK isn't fully ready
 */
async function fetchRealSleepData(retryCount: number = 0): Promise<SleepData | null> {
  const MAX_RETRIES = 2;
  const RETRY_DELAY = 2000;

  try {
    console.log(`😴 [useHomeData] Fetching real sleep data from ring... (attempt ${retryCount + 1})`);

    // Check if ring is connected
    const connectionStatus = await UnifiedSmartRingService.isConnected();
    if (!connectionStatus.connected) {
      console.log('😴 [useHomeData] Ring not connected, cannot fetch sleep data');
      return null;
    }

    // Get sleep data for today (dayIndex 0 = last night's sleep)
    const sleepInfo: SleepInfo = await getSleep(0);

    if (!sleepInfo || sleepInfo.totalSleepMinutes === 0) {
      console.log('😴 [useHomeData] No sleep data available from ring');
      return null;
    }

    console.log('😴 [useHomeData] Raw sleep data:', {
      total: sleepInfo.totalSleepMinutes,
      deep: sleepInfo.deepMinutes,
      light: sleepInfo.lightMinutes,
      rem: sleepInfo.remMinutes,
      awake: sleepInfo.awakeMinutes,
      segments: sleepInfo.segments?.length || 0,
    });

    // Calculate sleep score
    const scoreResult = calculateSleepScore(sleepInfo);

    // Transform segments to component format
    const segments: SleepSegment[] = (sleepInfo.segments || [])
      .filter(s => s.type >= 1 && s.type <= 4) // Only valid sleep types
      .map(s => ({
        stage: mapSleepType(s.type),
        startTime: new Date(s.startTime),
        endTime: new Date(s.endTime),
      }));

    // Calculate times
    const hours = Math.floor(sleepInfo.totalSleepMinutes / 60);
    const minutes = sleepInfo.totalSleepMinutes % 60;

    // Determine bed time and wake time
    const bedTime = sleepInfo.bedTime
      ? new Date(sleepInfo.bedTime)
      : (segments[0]?.startTime || new Date());
    const wakeTime = sleepInfo.wakeTime
      ? new Date(sleepInfo.wakeTime)
      : (segments[segments.length - 1]?.endTime || new Date());

    // Calculate resting HR (would need separate fetch, use placeholder for now)
    // TODO: Fetch actual resting HR from ring during sleep
    const restingHR = 55; // Placeholder - ideally fetch from ring's sleep HR data

    const sleepData: SleepData = {
      score: scoreResult.score,
      timeAsleep: `${hours}h ${minutes}m`,
      timeAsleepMinutes: sleepInfo.totalSleepMinutes,
      restingHR,
      respiratoryRate: 14, // Placeholder - ring may not support this
      segments,
      bedTime,
      wakeTime,
    };

    console.log('😴 [useHomeData] Transformed sleep data:', {
      score: sleepData.score,
      timeAsleep: sleepData.timeAsleep,
      segments: sleepData.segments.length,
      bedTime: sleepData.bedTime.toLocaleTimeString(),
      wakeTime: sleepData.wakeTime.toLocaleTimeString(),
    });

    return sleepData;
  } catch (error) {
    // Retry if SDK might not be ready yet
    if (retryCount < MAX_RETRIES) {
      console.log(`😴 [useHomeData] Sleep fetch attempt ${retryCount + 1} failed, retrying...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return fetchRealSleepData(retryCount + 1);
    }

    // Only log error after all retries exhausted
    console.log('😴 [useHomeData] Could not fetch sleep data after retries');
    return null;
  }
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
    const fetchStartTime = Date.now();
    console.log('⏱️ [useHomeData] fetchData() STARTED at', new Date().toLocaleTimeString(), '| forceRefresh:', forceRefresh);
    // #region agent log - Hypothesis B: fetchData entry with source tracking
    const callStack = new Error().stack || '';
    const isFromPullToRefresh = callStack.includes('OverviewTab') || callStack.includes('onRefresh');
    const isFromInitialConnection = callStack.includes('useEffect') || callStack.includes('onConnectionStateChanged');
    fetch('http://127.0.0.1:7244/ingest/2c24bd97-750e-43e0-a3f7-87f9cbe31856',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useHomeData.ts:419',message:'fetchData called',data:{forceRefresh,isFromPullToRefresh,isFromInitialConnection,timeSinceLastFetch:Date.now()-lastFetchTime.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    // Debounce rapid fetches (unless forcing refresh after connection)
    const now = Date.now();
    if (!forceRefresh && now - lastFetchTime.current < MIN_FETCH_INTERVAL) {
      console.log('😴 [useHomeData] Skipping fetch - too soon since last fetch');
      // #region agent log - Hypothesis C: Fetch skipped due to debounce
      fetch('http://127.0.0.1:7244/ingest/2c24bd97-750e-43e0-a3f7-87f9cbe31856',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useHomeData.ts:427',message:'Fetch skipped - debounced',data:{timeSinceLastFetch:now-lastFetchTime.current,minInterval:MIN_FETCH_INTERVAL},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      return;
    }
    lastFetchTime.current = now;

    // Get user's display name from user_metadata
    const { data: { user } } = await supabase.auth.getUser();
    const userName = user?.user_metadata?.display_name || '';
    console.log('⏱️ [useHomeData] Auth check done +' + (Date.now() - fetchStartTime) + 'ms');

    // Check if ring is connected first
    const connectionStatus = await UnifiedSmartRingService.isConnected();
    console.log('⏱️ [useHomeData] Connection check done +' + (Date.now() - fetchStartTime) + 'ms | connected:', connectionStatus.connected);

    if (!connectionStatus.connected) {
      console.log('😴 [useHomeData] Ring not connected - preserving cached data');
      // DON'T overwrite cached data with zeros
      // Keep isSyncing TRUE if we haven't loaded real data yet (still waiting for auto-reconnect)
      const keepSyncing = !hasLoadedRealData.current;
      setData(prev => {
        // Avoid unnecessary updates if nothing changed
        if (prev.userName === userName && prev.isLoading === false && prev.isSyncing === keepSyncing) {
          return prev;
        }
        return {
          ...prev,
          userName,
          isLoading: false,
          isSyncing: keepSyncing, // Keep syncing true while waiting for initial connection
          isRingConnected: false,
          error: null,
        };
      });
      return;
    }

    setData(prev => ({ ...prev, isLoading: prev.isLoading, isSyncing: true, error: null, isRingConnected: true }));

    try {
      console.log('⏱️ [useHomeData] Starting SDK data fetches +' + (Date.now() - fetchStartTime) + 'ms');

      // Fetch real sleep data from ring
      const sleepStartTime = Date.now();
      const sleepData = await fetchRealSleepData();
      console.log('⏱️ [useHomeData] Sleep fetch done +' + (Date.now() - fetchStartTime) + 'ms (took ' + (Date.now() - sleepStartTime) + 'ms)');

      if (!sleepData) {
        console.log('😴 [useHomeData] No sleep data available from ring');
      } else {
        hasLoadedRealData.current = true;
      }

      // Fetch real activity data from ring
      let activity: ActivityData = {
        score: 0,
        steps: 0,
        calories: 0,
        activeMinutes: 0,
        workouts: [],
      };

      try {
        const stepsStartTime = Date.now();
        const stepsData = await withRetry(
          () => UnifiedSmartRingService.getSteps(),
          2,
          1500,
          'steps fetch'
        );
        console.log('⏱️ [useHomeData] Steps fetch done +' + (Date.now() - fetchStartTime) + 'ms (took ' + (Date.now() - stepsStartTime) + 'ms)');
        activity = {
          score: Math.min(100, Math.round((stepsData.steps / 10000) * 100)), // Score based on 10k step goal
          steps: stepsData.steps,
          calories: stepsData.calories,
          activeMinutes: Math.round(stepsData.time / 60), // Convert seconds to minutes
          workouts: [],
        };
      } catch (e) {
        console.log('😴 [useHomeData] Could not fetch steps after retries:', e);
      }

      const sleep = sleepData || {
        score: 0,
        timeAsleep: '0h 0m',
        timeAsleepMinutes: 0,
        restingHR: 0,
        respiratoryRate: 0,
        segments: [],
        bedTime: new Date(),
        wakeTime: new Date(),
      };

      const { insight, type } = generateInsight(sleep.score, activity.score);
      const overallScore = calculateOverallScore(sleep.score, activity.score);

      // Strain is inverse of readiness (high activity = high strain = lower recovery)
      const strain = Math.min(100, Math.round(activity.score * 1.1));
      const readiness = Math.max(0, 100 - strain);

      // Get real battery from ring
      let ringBattery = 0;
      try {
        const batteryStartTime = Date.now();
        const batteryData = await withRetry(
          () => UnifiedSmartRingService.getBattery(),
          2,
          1500,
          'battery fetch'
        );
        console.log('⏱️ [useHomeData] Battery fetch done +' + (Date.now() - fetchStartTime) + 'ms (took ' + (Date.now() - batteryStartTime) + 'ms)');
        ringBattery = batteryData.battery;
      } catch (e) {
        console.log('😴 [useHomeData] Could not fetch battery after retries:', e);
      }

      const newData: HomeData = {
        overallScore,
        strain,
        readiness,
        sleepScore: sleep.score,
        lastNightSleep: sleep,
        activity,
        ringBattery,
        streakDays: 0, // TODO: Track actual streak from persistent storage
        insight,
        insightType: type,
        isLoading: false,
        isSyncing: false,
        error: null,
        userName,
        isRingConnected: true,
      };

      setData(newData);

      // Cache data for instant loading on next app open
      saveToCache(newData);

      console.log('⏱️ [useHomeData] fetchData() COMPLETED in ' + (Date.now() - fetchStartTime) + 'ms total');
    } catch (error) {
      console.error('Error fetching home data:', error);
      setData(prev => ({
        ...prev,
        isLoading: false,
        isSyncing: false,
        error: 'Failed to load health data',
        isRingConnected: connectionStatus.connected,
      }));
    }
  }, []);

  // Initial fetch - wait for SDK to detect iOS-maintained connections
  // CRITICAL: Don't check connection immediately - iOS maintains BLE connections but SDK needs
  // ~1.5-2s to detect them. Checking too early causes false negatives and unnecessary auto-reconnect.
  useEffect(() => {
    const mountTime = Date.now();
    let checkTimeout: ReturnType<typeof setTimeout> | null = null;
    console.log('🚀 [useHomeData] HOOK MOUNTED at', new Date().toLocaleTimeString());

    // Wait 1.8s before first connection check to give SDK time to detect iOS-maintained connections
    // This matches the timing that makes pull-to-refresh work instantly (SDK is stable by then)
    checkTimeout = setTimeout(async () => {
      const status = await UnifiedSmartRingService.isConnected();
      const elapsed = Date.now() - mountTime;
      console.log('🚀 [useHomeData] Connection check at +' + elapsed + 'ms | connected:', status.connected);

      if (status.connected && !hasLoadedRealData.current) {
        console.log('🚀 [useHomeData] Connection detected - fetching data immediately');
        // SDK is stable, fetch immediately (same as pull-to-refresh)
        fetchData(true);
      } else if (!status.connected) {
        console.log('🚀 [useHomeData] Not connected after SDK stabilization - waiting for auto-reconnect');
        // Not connected - TabLayout's auto-reconnect will handle connection
        // When it succeeds, the connection event listener will trigger fetch
      }
    }, 1800); // 1.8s matches SDK detection timing

    return () => {
      if (checkTimeout) {
        clearTimeout(checkTimeout);
      }
    };
  }, [fetchData]);

  // Listen for ring connection state changes
  // Re-fetch with real data when ring connects, clear data when disconnected
  useEffect(() => {
    let connectionEventTime: number | null = null;
    let lastConnectionEventTime = 0;
    let pendingFetchTimeout: ReturnType<typeof setTimeout> | null = null;

    const unsubscribe = UnifiedSmartRingService.onConnectionStateChanged((state) => {
      const now = Date.now();
      connectionEventTime = now;
      console.log('📡 [useHomeData] Connection state changed:', state, 'at', new Date().toLocaleTimeString());

      if (state === 'connected') {
        // Debounce: ignore connection events within 3 seconds of the last one
        // The native SDK sometimes fires multiple 'connected' events rapidly
        if (now - lastConnectionEventTime < 3000) {
          console.log('📡 [useHomeData] Ignoring duplicate connection event (debounced)');
          return;
        }
        lastConnectionEventTime = now;

        // Clear any pending fetch
        if (pendingFetchTimeout) {
          clearTimeout(pendingFetchTimeout);
        }

        // When ring becomes connected, fetch real data with SHORT delay
        // Connection event fires AFTER SDK has stabilized (unlike mount where SDK needs time)
        console.log('📡 [useHomeData] Ring connected! Scheduling fetch in 800ms...');
        hasLoadedRealData.current = false;
        // Reduced delay (800ms) - connection event means SDK is already stable
        // This is much faster than the 2500ms we had before
        pendingFetchTimeout = setTimeout(() => {
          console.log('📡 [useHomeData] Executing fetch +' + (Date.now() - connectionEventTime!) + 'ms from connection event');
          fetchData(true); // Force refresh
        }, 800);
      } else if (state === 'disconnected') {
        // Clear any pending fetch timeout
        if (pendingFetchTimeout) {
          clearTimeout(pendingFetchTimeout);
          pendingFetchTimeout = null;
        }
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
      if (pendingFetchTimeout) {
        clearTimeout(pendingFetchTimeout);
      }
    };
  }, [fetchData]);

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


