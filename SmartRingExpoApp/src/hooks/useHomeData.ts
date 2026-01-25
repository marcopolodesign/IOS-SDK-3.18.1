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

const hoursSinceMidnight = () => {
  const now = new Date();
  return now.getHours() + now.getMinutes() / 60;
};

const estimateBMRPerHour = () => {
  // Mifflin-St Jeor (male assumption for now)
  const { weightKg, heightCm, age } = PROFILE;
  const bmrPerDay = 10 * weightKg + 6.25 * heightCm - 5 * age + 5; // kcal/day
  return bmrPerDay / 24;
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
    const fetchStartTime = Date.now();
    console.log('⏱️ [useHomeData] fetchData() STARTED at', new Date().toLocaleTimeString(), '| forceRefresh:', forceRefresh);

    // Prevent concurrent fetches - only allow one fetch at a time
    if (isFetchingData.current) {
      console.log('😴 [useHomeData] Skipping fetch - already fetching data');
      return;
    }

    // Debounce rapid fetches (unless forcing refresh after connection)
    const now = Date.now();
    if (!forceRefresh && now - lastFetchTime.current < MIN_FETCH_INTERVAL) {
      console.log('😴 [useHomeData] Skipping fetch - too soon since last fetch');
      return;
    }
    lastFetchTime.current = now;
    isFetchingData.current = true;

    // Get user's display name from user_metadata
    const { data: { user } } = await supabase.auth.getUser();
    const userName = user?.user_metadata?.display_name || '';
    console.log('⏱️ [useHomeData] Auth check done +' + (Date.now() - fetchStartTime) + 'ms');

    // Check if ring is connected first
    let connectionStatus = await UnifiedSmartRingService.isConnected();
    console.log('⏱️ [useHomeData] Connection check done +' + (Date.now() - fetchStartTime) + 'ms | connected:', connectionStatus.connected);

    if (!connectionStatus.connected) {
      // For pull-to-refresh (forceRefresh=true), attempt reconnection first
      if (forceRefresh) {
        console.log('🔄 [useHomeData] PTR: Ring not connected - attempting auto-reconnect...');
        setData(prev => ({ ...prev, isSyncing: true, error: null }));

        try {
          const reconnectResult = await UnifiedSmartRingService.autoReconnect();

          if (reconnectResult.success) {
            console.log('🔄 [useHomeData] PTR: Auto-reconnect succeeded, proceeding to fetch data...');
            // TRUST the auto-reconnect success - don't re-check isConnected() as it may
            // return stale state due to SDK timing. The connection event already fired,
            // proving the connection is real. Proceed directly to fetching data.
            await new Promise(resolve => setTimeout(resolve, 500));
            connectionStatus = {
              connected: true,
              state: 'connected',
              deviceName: reconnectResult.deviceName || null,
              deviceMac: reconnectResult.deviceId || null,
            }; // Trust the reconnect success
          } else {
            // Reconnect failed - might be because iOS already has connection but SDK doesn't know yet
            console.log('🔄 [useHomeData] PTR: Auto-reconnect failed:', reconnectResult.message);

            // Wait 1s and check again - SDK might just be syncing with iOS
            console.log('🔄 [useHomeData] Waiting 1s for SDK to sync with iOS BLE state...');
            await new Promise(resolve => setTimeout(resolve, 1000));

            const recheckStatus = await UnifiedSmartRingService.isConnected();
            if (recheckStatus.connected) {
              console.log('🔄 [useHomeData] SDK synced! Connection detected on recheck.');
              connectionStatus = recheckStatus;
              // Continue to fetch data below
            } else {
              // Still not connected after recheck
              console.log('🔄 [useHomeData] Still not connected after recheck');
              setData(prev => ({
                ...prev,
                userName,
                isLoading: false,
                isSyncing: false,
                isRingConnected: false,
                error: 'Ring not connected. Tap the ring to wake it and pull to refresh again.',
              }));
              return;
            }
          }
        } catch (reconnectError) {
          console.log('🔄 [useHomeData] PTR: Auto-reconnect error:', reconnectError);

          // Wait and recheck - might be iOS sync issue
          console.log('🔄 [useHomeData] Rechecking connection after error...');
          await new Promise(resolve => setTimeout(resolve, 1000));

          const recheckStatus = await UnifiedSmartRingService.isConnected();
          if (recheckStatus.connected) {
            console.log('🔄 [useHomeData] Connection detected on recheck after error!');
            connectionStatus = recheckStatus;
            // Continue to fetch data below
          } else {
            setData(prev => ({
              ...prev,
              userName,
              isLoading: false,
              isSyncing: false,
              isRingConnected: false,
              error: 'Failed to connect to ring.',
            }));
            return;
          }
        }
      } else {
        // Initial load (non-PTR) - OK to show cached data while waiting for connection
        console.log('😴 [useHomeData] Ring not connected - preserving cached data for initial load');
        const keepSyncing = !hasLoadedRealData.current;
        setData(prev => {
          if (prev.userName === userName && prev.isLoading === false && prev.isSyncing === keepSyncing) {
            return prev;
          }
          return {
            ...prev,
            userName,
            isLoading: false,
            isSyncing: keepSyncing,
            isRingConnected: false,
            error: null,
          };
        });
        return;
      }
    }

    setData(prev => ({ ...prev, isLoading: prev.isLoading, isSyncing: true, error: null, isRingConnected: true }));

    try {
      console.log('⏱️ [useHomeData] Starting SDK data fetches (in parallel) +' + (Date.now() - fetchStartTime) + 'ms');

      // Fetch all data in parallel for faster loading
      const parallelStartTime = Date.now();
      const [sleepResult, stepsResult, batteryResult] = await Promise.allSettled([
        fetchRealSleepData(),
        withRetry(() => UnifiedSmartRingService.getSteps(), 2, 1500, 'steps fetch'),
        withRetry(() => UnifiedSmartRingService.getBattery(), 2, 1500, 'battery fetch'),
      ]);
      console.log('⏱️ [useHomeData] All parallel fetches done +' + (Date.now() - fetchStartTime) + 'ms (took ' + (Date.now() - parallelStartTime) + 'ms total)');

      // Extract sleep data
      const sleepData = sleepResult.status === 'fulfilled' ? sleepResult.value : null;
      if (!sleepData) {
        console.log('😴 [useHomeData] No sleep data available from ring');
      } else {
        hasLoadedRealData.current = true;
      }

      // Extract activity data
      let activity: ActivityData = sanitizeActivity();

      if (stepsResult.status === 'fulfilled') {
        const stepsData = stepsResult.value;
        activity = sanitizeActivity({
          score: Math.min(100, Math.round((stepsData.steps / 10000) * 100)), // Score based on 10k step goal
          steps: stepsData.steps,
          calories: stepsData.calories,
          activeMinutes: stepsData.time ? stepsData.time / 60 : 0, // seconds -> minutes
          distance: (stepsData as any)?.distance ?? 0,
          workouts: [],
        });
      } else {
        console.log('😴 [useHomeData] Could not fetch steps after retries:', stepsResult.reason);
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

      // Extract battery data
      let ringBattery = 0;
      if (batteryResult.status === 'fulfilled') {
        ringBattery = batteryResult.value.battery;
      } else {
        console.log('😴 [useHomeData] Could not fetch battery after retries:', batteryResult.reason);
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
    } finally {
      // Reset fetching flag so subsequent fetches can proceed
      isFetchingData.current = false;
    }
  }, []);

  // Initial fetch - wait for SDK to detect iOS-maintained connections
  // CRITICAL: iOS maintains BLE connections in background, but SDK needs 1.5-2s to sync
  // If we check too early, SDK says "not connected" even though iOS has the connection
  // Then autoReconnect() tries to connect to an already-connected device → timeout
  useEffect(() => {
    const mountTime = Date.now();
    let checkTimeout: ReturnType<typeof setTimeout> | null = null;
    console.log('🚀 [useHomeData] HOOK MOUNTED at', new Date().toLocaleTimeString());

    // Wait 2s before first connection check to give SDK time to sync with iOS BLE state
    // This prevents "connection timeout" errors when iOS already has the connection
    checkTimeout = setTimeout(async () => {
      const status = await UnifiedSmartRingService.isConnected();
      const elapsed = Date.now() - mountTime;
      console.log('🚀 [useHomeData] Connection check at +' + elapsed + 'ms | connected:', status.connected);

      if (status.connected && !hasLoadedRealData.current) {
        console.log('🚀 [useHomeData] Connection detected - fetching data immediately');
        // SDK detected iOS connection, fetch data
        fetchData(true);
      } else if (!status.connected) {
        console.log('🚀 [useHomeData] Not connected after 2s wait - attempting reconnect');
        // SDK still doesn't see connection after 2s, safe to reconnect
        fetchData(true); // fetchData with forceRefresh=true will auto-reconnect if needed
      }
    }, 2000); // 2000ms gives SDK enough time to detect iOS-maintained connections

    return () => {
      if (checkTimeout) {
        clearTimeout(checkTimeout);
      }
    };
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

        // Just update the connection flag so UI shows "connected" state
        setData(prev => ({
          ...prev,
          isRingConnected: true,
          error: null,
        }));
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
