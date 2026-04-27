import { useMemo } from 'react';
import { useMetricHistory, type DaySleepData } from './useMetricHistory';
import type { TrendsDomain, RangeMode, MetricDefinition } from '../screens/trendsDetail/domains';

export interface TrendBucket {
  dateKey: string;
  label: string;
}

export type TrendSeries = Array<{ bucketKey: string; value: number | null }>;

// ─── Date helpers ─────────────────────────────────────────────────────────────

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getMondayKey(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  return localDateStr(d);
}

// ─── Bucket builders ──────────────────────────────────────────────────────────

function buildDailyBuckets(): TrendBucket[] {
  const today = new Date();
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    let label: string;
    if (i === 0) label = 'Today';
    else if (i === 1) label = 'Yest';
    else label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return { dateKey: localDateStr(d), label };
  });
}

function buildWeeklyBuckets(): TrendBucket[] {
  const today = new Date();
  const curMon = getMondayKey(localDateStr(today));
  return Array.from({ length: 8 }, (_, w) => {
    const d = new Date(curMon + 'T12:00:00');
    d.setDate(d.getDate() - w * 7);
    return {
      dateKey: localDateStr(d),
      label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    };
  });
}

function buildMonthlyBuckets(): TrendBucket[] {
  const today = new Date();
  return Array.from({ length: 6 }, (_, m) => {
    const d = new Date(today.getFullYear(), today.getMonth() - m, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
    return { dateKey: key, label };
  });
}

// ─── Aggregation ──────────────────────────────────────────────────────────────

function medianOf(vals: number[]): number {
  const s = [...vals].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function aggregateSeries(
  days: Map<string, any>,
  buckets: TrendBucket[],
  metric: MetricDefinition,
  rangeMode: RangeMode,
): TrendSeries {
  if (rangeMode === 'daily') {
    return buckets.map(b => {
      const day = days.get(b.dateKey);
      return { bucketKey: b.dateKey, value: day ? metric.extract(day) : null };
    });
  }

  // Group raw values by bucket
  const groups = new Map<string, number[]>();
  for (const [dateKey, day] of days) {
    const bk = rangeMode === 'weekly' ? getMondayKey(dateKey) : dateKey.slice(0, 7);
    const val = metric.extract(day);
    if (val === null || val === undefined) continue;
    if (!groups.has(bk)) groups.set(bk, []);
    groups.get(bk)!.push(val);
  }

  return buckets.map(b => ({
    bucketKey: b.dateKey,
    value: (() => {
      const vals = groups.get(b.dateKey);
      if (!vals || vals.length === 0) return null;
      if (metric.aggregator === 'sum') return vals.reduce((s, v) => s + v, 0);
      if (metric.aggregator === 'medianClockTime') return medianOf(vals);
      return Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
    })(),
  }));
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTrendsData(domain: TrendsDomain | null, rangeMode: RangeMode) {
  // Always call hooks at top level (React rules). Phase 2-4 will add more hooks here.
  const sleepHistory = useMetricHistory<DaySleepData>('sleep', { initialDays: 14, fullDays: 180 });

  const buckets = useMemo<TrendBucket[]>(() => {
    if (rangeMode === 'daily') return buildDailyBuckets();
    if (rangeMode === 'weekly') return buildWeeklyBuckets();
    return buildMonthlyBuckets();
  }, [rangeMode]);

  const rawData = useMemo<Map<string, any>>(() => {
    if (domain?.key === 'sleep') return sleepHistory.data;
    return new Map();
  }, [domain?.key, sleepHistory.data]);

  const series = useMemo<Map<string, TrendSeries>>(() => {
    const result = new Map<string, TrendSeries>();
    if (!domain) return result;
    for (const metric of domain.metrics) {
      result.set(metric.key, aggregateSeries(rawData, buckets, metric, rangeMode));
    }
    return result;
  }, [domain, rawData, buckets, rangeMode]);

  const isLoading = domain?.key === 'sleep' ? sleepHistory.isLoading : false;

  return { series, buckets, isLoading };
}
