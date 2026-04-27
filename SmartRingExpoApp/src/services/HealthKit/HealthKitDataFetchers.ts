/**
 * HealthKitDataFetchers — read heart rate, steps, SpO2, HRV from Apple Health
 * Uses @kingstinct/react-native-healthkit v13 API (filter.date pattern)
 */

import {
  getMostRecentQuantitySample,
  queryQuantitySamples,
} from '@kingstinct/react-native-healthkit';
import { reportError } from '../../utils/sentry';

// Code=5 = authorization not determined, Code=6 = device locked / data protected.
// Both are expected OS states; suppress Sentry noise for them.
function isExpectedHealthKitError(error: unknown): boolean {
  return /com\.apple\.healthkit.*Code=[56]\b/i.test((error as any)?.message ?? '');
}

export interface HKStepsResult {
  steps: number;
  samples: any[];
  source: string;
}

export interface HKHeartRateResult {
  heartRate: number;
  timestamp: number;
}

export interface HKHRVResult {
  sdnn: number;
  timestamp: number;
}

export interface HKSpO2Result {
  spo2: number;
  timestamp: number;
}

export interface HKActiveCaloriesResult {
  calories: number;
  source: string;
}

export interface HKDistanceResult {
  distanceM: number;
  source: string;
}

/** Returns midnight of the current local day */
function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

class HealthKitDataFetchers {
  async fetchHeartRateData(): Promise<HKHeartRateResult | null> {
    try {
      const sample = await getMostRecentQuantitySample('HKQuantityTypeIdentifierHeartRate');
      if (!sample) return null;
      return {
        heartRate: Math.round(Number(sample.quantity)),
        timestamp: new Date(sample.startDate).getTime(),
      };
    } catch (error) {
      if (!isExpectedHealthKitError(error)) reportError(error, { op: 'healthKit.fetchHeartRateData' }, 'warning');
      return null;
    }
  }

  async fetchStepsData(): Promise<HKStepsResult> {
    try {
      const now = new Date();
      const todayQuery = await queryQuantitySamples(
        'HKQuantityTypeIdentifierStepCount',
        {
          limit: 0, // 0 = unlimited
          filter: {
            date: { startDate: startOfToday(), endDate: now },
          },
        }
      );

      const allSamples = Array.isArray(todayQuery) ? todayQuery : [];
      const mapped = allSamples
        .map((s: any) => ({
          ...s,
          _start: new Date(s.startDate).getTime(),
          _end: new Date(s.endDate).getTime(),
          quantity: Number(s.quantity) || 0,
          _sourceName: s?.device?.name || s?.sourceRevision?.source?.name || 'unknown',
        }))
        .filter((s) => s.quantity > 0);

      const deduped = this.deduplicateStepSamples(mapped);
      const total = deduped.reduce((sum, s) => sum + (s.quantity || 0), 0);

      return { steps: total, samples: deduped, source: 'appleHealth' };
    } catch (error) {
      if (!isExpectedHealthKitError(error)) reportError(error, { op: 'healthKit.fetchStepsData' }, 'warning');
      try {
        const recent = await getMostRecentQuantitySample('HKQuantityTypeIdentifierStepCount');
        if (recent) {
          return { steps: Number(recent.quantity) || 0, samples: [recent], source: 'fallback' };
        }
      } catch (innerError) {
        if (!isExpectedHealthKitError(innerError)) reportError(innerError, { op: 'healthKit.fetchStepsData.fallback' }, 'warning');
      }
      return { steps: 0, samples: [], source: 'error' };
    }
  }

  async fetchHRVData(): Promise<HKHRVResult | null> {
    try {
      const sample = await getMostRecentQuantitySample('HKQuantityTypeIdentifierHeartRateVariabilitySDNN');
      if (!sample) return null;
      return {
        sdnn: Number(sample.quantity) * 1000, // seconds → ms
        timestamp: new Date(sample.startDate).getTime(),
      };
    } catch (error) {
      if (!isExpectedHealthKitError(error)) reportError(error, { op: 'healthKit.fetchHRVData' }, 'warning');
      return null;
    }
  }

  async fetchSpO2Data(): Promise<HKSpO2Result | null> {
    try {
      const sample = await getMostRecentQuantitySample('HKQuantityTypeIdentifierOxygenSaturation');
      if (!sample) return null;
      return {
        spo2: Math.round(Number(sample.quantity) * 100),
        timestamp: new Date(sample.startDate).getTime(),
      };
    } catch (error) {
      if (!isExpectedHealthKitError(error)) reportError(error, { op: 'healthKit.fetchSpO2Data' }, 'warning');
      return null;
    }
  }

  async fetchActiveCaloriesData(): Promise<HKActiveCaloriesResult> {
    try {
      const now = new Date();
      const samples = await queryQuantitySamples(
        'HKQuantityTypeIdentifierActiveEnergyBurned',
        {
          limit: 0,
          filter: {
            date: { startDate: startOfToday(), endDate: now },
          },
        }
      );

      const total = (Array.isArray(samples) ? samples : [])
        .reduce((sum, s: any) => sum + (Number(s.quantity) || 0), 0);

      return { calories: Math.round(total), source: 'appleHealth' };
    } catch (error) {
      if (!isExpectedHealthKitError(error)) reportError(error, { op: 'healthKit.fetchActiveCaloriesData' }, 'warning');
      return { calories: 0, source: 'error' };
    }
  }

  async fetchDistanceData(): Promise<HKDistanceResult> {
    try {
      const now = new Date();
      const samples = await queryQuantitySamples(
        'HKQuantityTypeIdentifierDistanceWalkingRunning',
        {
          limit: 0,
          filter: {
            date: { startDate: startOfToday(), endDate: now },
          },
        }
      );

      const totalM = (Array.isArray(samples) ? samples : [])
        .reduce((sum, s: any) => sum + (Number(s.quantity) || 0), 0);

      return { distanceM: Math.round(totalM), source: 'appleHealth' };
    } catch (error) {
      if (!isExpectedHealthKitError(error)) reportError(error, { op: 'healthKit.fetchDistanceData' }, 'warning');
      return { distanceM: 0, source: 'error' };
    }
  }

  // ── Step deduplication (Apple Watch > iPhone > other) ────────────────
  private deduplicateStepSamples(samples: any[]): any[] {
    if (!samples.length) return [];

    const bySource: Record<string, any[]> = {};
    for (const s of samples) {
      const name = s._sourceName || 'unknown';
      (bySource[name] ??= []).push(s);
    }

    const preferred = ['Apple Watch', 'Watch', 'AppleWatch'];
    const fallback = ['iPhone', 'iPhone Health'];

    let selected: any[] = [];
    for (const src of preferred) {
      if (bySource[src]) { selected = bySource[src]; break; }
    }
    if (!selected.length) {
      for (const src of fallback) {
        if (bySource[src]) { selected = bySource[src]; break; }
      }
    }
    if (!selected.length) {
      const first = Object.keys(bySource)[0];
      if (first) selected = bySource[first];
    }

    return this.removeOverlappingIntervals(selected);
  }

  private removeOverlappingIntervals(samples: any[]): any[] {
    if (!samples.length) return [];
    const sorted = [...samples].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    const result: any[] = [];
    let lastEnd = -Infinity;

    for (const current of sorted) {
      const cStart = new Date(current.startDate).getTime();
      const cEnd = new Date(current.endDate).getTime();
      if (cStart >= lastEnd) {
        result.push(current);
        lastEnd = cEnd;
      }
    }

    return result;
  }
}

export default HealthKitDataFetchers;
