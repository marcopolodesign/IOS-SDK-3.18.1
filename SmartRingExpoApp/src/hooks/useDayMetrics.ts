/**
 * useDayMetrics — app-wide hook for per-day metric resolution.
 *
 * Single source of truth for readiness score, resting HR, HRV, sleep score,
 * respiratory rate, and all other ring metrics for any given date.
 *
 * - Today: raw values from homeData (ring BLE), ReadinessScore from FocusDataContext
 *   (includes training load, matches Coach tab exactly).
 * - Past days: raw values from Supabase via useMetricHistory data maps,
 *   ReadinessScore computed synchronously via ReadinessService (no training load).
 *
 * Usage in a screen:
 *   const { resolve } = useDayMetrics({ sleepData, hrData, hrvData, todayKey });
 *   const metrics = resolve(selectedDateKey); // DayMetrics | null
 */

import { useCallback } from 'react';
import { useFocusDataContext } from '../context/FocusDataContext';
import { useHomeDataContext } from '../context/HomeDataContext';
import { buildDayMetrics } from '../services/ReadinessService';
import type { DayMetrics } from '../types/focus.types';
import type { DaySleepData, DayHRData, DayHRVData } from './useMetricHistory';

export interface DayMetricsInput {
  /** Sleep sessions map (dateKey → DaySleepData) from useMetricHistory */
  sleepData: Map<string, DaySleepData>;
  /** Heart rate map (dateKey → DayHRData) from useMetricHistory */
  hrData: Map<string, DayHRData>;
  /** HRV map (dateKey → DayHRVData) from useMetricHistory */
  hrvData: Map<string, DayHRVData>;
  /** Today's dateKey (YYYY-MM-DD) for isToday detection */
  todayKey: string;
}

export function useDayMetrics({ sleepData, hrData, hrvData, todayKey }: DayMetricsInput): {
  resolve: (dateKey: string) => DayMetrics | null;
} {
  const focusData = useFocusDataContext();
  const homeData = useHomeDataContext();

  const resolve = useCallback((dateKey: string): DayMetrics | null => {
    const baselines = focusData.baselines;
    // Baselines load from AsyncStorage (~instant after first focus). Return null until ready.
    if (!baselines) return null;

    const isToday = dateKey === todayKey;

    if (isToday) {
      // Today: use ring-computed raw values from homeData + pre-computed ReadinessScore
      // from FocusDataContext (which includes training load and matches the Coach tab).
      const overnightRHR = homeData.lastNightSleep?.restingHR ?? 0;
      const respRate = homeData.lastNightSleep?.respiratoryRate ?? 0;

      return buildDayMetrics({
        dateKey,
        isToday: true,
        raw: {
          restingHR: overnightRHR > 0 && overnightRHR <= 90 ? overnightRHR : null,
          hrv: homeData.hrvSdnn > 0 ? homeData.hrvSdnn : null,
          sleepScore: homeData.lastNightSleep?.score > 0 ? homeData.lastNightSleep.score : null,
          sleepMinutes: homeData.lastNightSleep?.timeAsleepMinutes > 0 ? homeData.lastNightSleep.timeAsleepMinutes : null,
          respiratoryRate: respRate > 0 ? respRate : null,
          temperature: null,
          spo2Min: null,
        },
        // FocusDataContext readiness includes training load — use as-is for today.
        readiness: focusData.readiness,
        baselines,
      });
    }

    // Past day: resolve from Supabase data passed in via useMetricHistory maps.
    const sleepRow = sleepData.get(dateKey);
    const hrRow = hrData.get(dateKey);
    const hrvRow = hrvData.get(dateKey);

    // Resting HR: prefer sleep_sessions.resting_hr (ring overnight), fall back to
    // heart_rate_readings minimum (but cap at 90 — daytime readings can be 80-110+).
    const restingHR = (() => {
      const sleepRHR = sleepRow?.restingHR ?? 0;
      if (sleepRHR > 0 && sleepRHR <= 90) return sleepRHR;
      const hrRHR = hrRow?.restingHR ?? 0;
      if (hrRHR > 0 && hrRHR <= 90) return hrRHR;
      return null;
    })();

    return buildDayMetrics({
      dateKey,
      isToday: false,
      raw: {
        restingHR,
        hrv: (hrvRow?.sdnn && hrvRow.sdnn > 0) ? hrvRow.sdnn : null,
        sleepScore: sleepRow?.score ?? null,
        sleepMinutes: sleepRow?.timeAsleepMinutes ?? null,
        respiratoryRate: (sleepRow?.respiratoryRate && sleepRow.respiratoryRate > 0) ? sleepRow.respiratoryRate : null,
        temperature: null,
        spo2Min: null,
      },
      readiness: null, // computed synchronously without training load
      baselines,
    });
  }, [focusData.baselines, focusData.readiness, homeData, sleepData, hrData, hrvData, todayKey]);

  return { resolve };
}
