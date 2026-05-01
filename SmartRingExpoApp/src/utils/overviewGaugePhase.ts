import { SLEEP_THRESHOLD_MG, MAX_CAFFEINE_MG } from './caffeinePk';
import type { MetricKey } from '../data/metricExplanations';

export type GaugePhaseKey = 'wind_down' | 'sleep' | 'caffeine' | 'strain' | 'readiness';

export interface GaugePhase {
  key: GaugePhaseKey;
  score: number;
  labelKey: string;
  metricKey: MetricKey;
  /** Override the number shown in the gauge center (arc fill still uses score). */
  displayValue?: number;
  /** Override the unit suffix shown after the center number (default "%"). */
  displayUnit?: string;
  /** Extra data for phases that need non-gauge UI (e.g. wind-down countdown) */
  meta?: {
    targetBedtimeMs: number;
    minsUntilBed: number;
  };
}

export interface GaugeContext {
  now: Date;
  wakeTime: Date | null;
  lastNightBedTime: Date | null;
  sleepScore: number;
  readiness: number;
  strain: number;
  caffeineCurrentMg: number;
  sleepDebtTotalMin: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Derive tonight's target bedtime from last night's actual bedtime (same clock time).
// Falls back to 23:00 if no valid date is available.
export function deriveTargetBedtime(lastNightBedTime: Date | null): Date {
  const target = new Date();
  if (lastNightBedTime instanceof Date && !Number.isNaN(lastNightBedTime.getTime())) {
    target.setHours(lastNightBedTime.getHours(), lastNightBedTime.getMinutes(), 0, 0);
  } else {
    target.setHours(23, 0, 0, 0);
  }
  // If the derived time is more than 6 h in the past it's a post-midnight bedtime
  // and we want tonight's occurrence — project one day forward.
  if (target.getTime() < Date.now() - 6 * 60 * 60 * 1000) {
    target.setDate(target.getDate() + 1);
  }
  return target;
}

export function resolveGaugePhase(ctx: GaugeContext): GaugePhase {
  const {
    now,
    wakeTime,
    lastNightBedTime,
    sleepScore,
    readiness,
    strain,
    caffeineCurrentMg,
    sleepDebtTotalMin,
  } = ctx;

  const targetBedtime = deriveTargetBedtime(lastNightBedTime);
  const minsUntilBed = (targetBedtime.getTime() - now.getTime()) / 60_000;
  const minsPastTarget = -minsUntilBed;

  const windDownMeta = { targetBedtimeMs: targetBedtime.getTime(), minsUntilBed };

  // Whether the ring has confirmed the user already woke up today.
  // When true, suppress wind_down so they see the sleep/readiness phase instead.
  const hasWokenToday =
    wakeTime instanceof Date &&
    !Number.isNaN(wakeTime.getTime()) &&
    wakeTime.toDateString() === now.toDateString() &&
    now.getTime() >= wakeTime.getTime();

  // Phase 1: Wind-down — 120 min before target bedtime, stays until 6h past it
  // Suppressed once the ring confirms wakeup (handles post-midnight sleepers who
  // would otherwise see wind_down past their actual wake time).
  if (!hasWokenToday && minsUntilBed <= 120 && minsUntilBed >= -360) {
    return {
      key: 'wind_down',
      score: 0, // unused — WindDownHero renders instead of the gauge
      labelKey: 'overview.wind_down',
      metricKey: 'wind_down',
      meta: windDownMeta,
    };
  }

  // Phase 2: Just woke up — within 2 h of today's wake time
  if (wakeTime instanceof Date && !Number.isNaN(wakeTime.getTime())) {
    const msAwake = now.getTime() - wakeTime.getTime();
    const isTodayWake = wakeTime.toDateString() === now.toDateString();
    if (isTodayWake && msAwake >= 0 && msAwake < 2 * 60 * 60 * 1000) {
      return {
        key: 'sleep',
        score: clamp(Math.round(sleepScore), 0, 100),
        labelKey: 'overview.sleep_score',
        metricKey: 'sleep_score',
      };
    }
  }

  // Phase 3: Caffeine still clearing above sleep threshold
  if (caffeineCurrentMg >= SLEEP_THRESHOLD_MG) {
    const clearancePct = clamp(
      Math.round(100 - (caffeineCurrentMg / MAX_CAFFEINE_MG) * 100),
      0,
      100,
    );
    return {
      key: 'caffeine',
      score: clearancePct,
      labelKey: 'overview.caffeine_clearance',
      metricKey: 'caffeine_clearance',
      displayValue: Math.round(caffeineCurrentMg),
      displayUnit: '/400mg',
    };
  }

  // Phase 4: High strain day
  if (strain >= 60) {
    return {
      key: 'strain',
      score: clamp(Math.round(strain), 0, 100),
      labelKey: 'overview.strain',
      metricKey: 'metric_insight_strain',
    };
  }

  // Phase 5: Evening default (20:00+) — sleep debt more actionable than readiness at night
  if (now.getHours() >= 20) {
    return {
      key: 'wind_down',
      score: 0,
      labelKey: 'overview.wind_down',
      metricKey: 'wind_down',
      meta: windDownMeta,
    };
  }

  // Phase 6: Default — readiness
  return {
    key: 'readiness',
    score: clamp(Math.round(readiness), 0, 100),
    labelKey: 'overview.readiness',
    metricKey: 'metric_insight_readiness',
  };
}
