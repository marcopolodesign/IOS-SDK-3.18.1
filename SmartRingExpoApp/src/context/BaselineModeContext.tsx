import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useHomeDataContext } from './HomeDataContext';
import {
  computeBaselineState,
  loadBaselineCompletedAt,
  persistBaselineCompletion,
} from '../services/BaselineModeService';
import { loadBaselines } from '../services/ReadinessService';
import type { BaselineModeState } from '../types/baseline.types';
import type { FocusBaselines } from '../types/focus.types';

const METRIC_BASELINES_KEY = 'home_metric_baselines_v1';

interface BaselineModeContextValue extends BaselineModeState {
  /** Fired once when baseline transitions from incomplete → complete */
  justCompleted: boolean;
  /** Dismiss the completion celebration */
  dismissCompletion: () => void;
}

const EMPTY_STATE: BaselineModeState = {
  isInBaselineMode: true,
  overallProgress: 0,
  metrics: {
    sleep: { current: 0, required: 3, ready: false },
    heartRate: { current: 0, required: 3, ready: false },
    hrv: { current: 0, required: 3, ready: false },
    temperature: { current: 0, required: 3, ready: false },
    spo2: { current: 0, required: 1, ready: false },
    activity: { current: 0, required: 1, ready: false },
  },
  daysWithData: 0,
  baselineCompletedAt: null,
  canShowScores: false,
};

const BaselineModeContext = createContext<BaselineModeContextValue | null>(null);

async function loadMetricBaselinesFromStorage() {
  try {
    const raw = await AsyncStorage.getItem(METRIC_BASELINES_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as {
      sleepMinutes?: number[];
      restingHR?: number[];
      hrvSdnn?: number[];
      temperature?: number[];
      spo2?: number[];
      steps?: number[];
    };
  } catch {
    return null;
  }
}

function statesAreEqual(a: BaselineModeState, b: BaselineModeState): boolean {
  return (
    a.isInBaselineMode === b.isInBaselineMode &&
    a.overallProgress === b.overallProgress &&
    a.daysWithData === b.daysWithData &&
    a.canShowScores === b.canShowScores &&
    a.baselineCompletedAt === b.baselineCompletedAt
  );
}

export function BaselineModeProvider({ children }: { children: ReactNode }) {
  const homeData = useHomeDataContext();
  const [state, setState] = useState<BaselineModeState>(EMPTY_STATE);
  const [justCompleted, setJustCompleted] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const completedAtRef = useRef<string | null>(null);
  const prevWasBaselineRef = useRef(true);
  const stateRef = useRef(EMPTY_STATE);

  // Load persisted completion state on mount
  useEffect(() => {
    loadBaselineCompletedAt().then((completedAt) => {
      completedAtRef.current = completedAt;
      setInitialized(true);
    });
  }, []);

  // Recompute baseline state whenever meaningful home data changes
  // Removed isLoading/isSyncing — they don't affect baseline computation
  useEffect(() => {
    if (!initialized) return;
    let cancelled = false;

    const recompute = async () => {
      // Load both sources in parallel
      const [focusBaselines, metricBaselines] = await Promise.all([
        loadBaselines().catch((): FocusBaselines | null => null),
        loadMetricBaselinesFromStorage(),
      ]);

      if (cancelled) return;

      const newState = computeBaselineState(
        focusBaselines,
        metricBaselines ? {
          sleepMinutes: metricBaselines.sleepMinutes ?? [],
          restingHR: metricBaselines.restingHR ?? [],
          hrvSdnn: metricBaselines.hrvSdnn ?? [],
          temperature: metricBaselines.temperature ?? [],
          spo2: metricBaselines.spo2 ?? [],
          steps: metricBaselines.steps ?? [],
        } : null,
        completedAtRef.current,
      );

      // Detect transition: was in baseline → now complete
      if (prevWasBaselineRef.current && newState.canShowScores && !completedAtRef.current) {
        const isExistingUser = (focusBaselines?.daysLogged ?? 0) >= 5;

        const completedAt = await persistBaselineCompletion();
        if (cancelled) return;

        completedAtRef.current = completedAt;
        // Create new object instead of mutating
        const completedState = { ...newState, baselineCompletedAt: completedAt, isInBaselineMode: false };

        if (!isExistingUser) {
          setJustCompleted(true);
        }

        prevWasBaselineRef.current = false;
        stateRef.current = completedState;
        setState(completedState);
        return;
      }

      prevWasBaselineRef.current = newState.isInBaselineMode;

      // Only update state if something actually changed
      if (!statesAreEqual(stateRef.current, newState)) {
        stateRef.current = newState;
        setState(newState);
      }
    };

    recompute();

    return () => { cancelled = true; };
  }, [initialized, homeData.sleepScore, homeData.hrvSdnn]);

  const dismissCompletion = useCallback(() => {
    setJustCompleted(false);
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo<BaselineModeContextValue>(() => ({
    ...state,
    justCompleted,
    dismissCompletion,
  }), [state, justCompleted, dismissCompletion]);

  return (
    <BaselineModeContext.Provider value={value}>
      {children}
    </BaselineModeContext.Provider>
  );
}

export function useBaselineMode(): BaselineModeContextValue {
  const context = useContext(BaselineModeContext);
  if (!context) {
    throw new Error('useBaselineMode must be used within a BaselineModeProvider');
  }
  return context;
}

export default BaselineModeContext;
