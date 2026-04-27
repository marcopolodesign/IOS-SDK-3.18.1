import type { DaySleepData, DayHRTrendsData } from '../../hooks/useMetricHistory';
import {
  deriveLatencyMin,
  deriveSleepOnset,
  deriveTimeInBedMin,
  deriveEfficiency,
  toNightDecimalHour,
  toDecimalHour,
  formatClockHour,
  formatMinutes,
} from '../../utils/sleepDerivations';

export type RangeMode = 'daily' | 'weekly' | 'monthly';
export type ChartType = 'bar' | 'clockTime' | 'line';
export type DomainKey = 'sleep' | 'recovery' | 'activity' | 'running' | 'hr';

export interface MetricDefinition {
  key: string;
  labelKey: string;
  chartType: ChartType;
  color: string;
  extract: (day: any) => number | null;
  aggregator: 'mean' | 'sum' | 'medianClockTime';
  minValue?: number;
  maxValue?: number;
  /** For clockTime charts: [min, max] decimal-hour range for chart Y axis. */
  clockRange?: [number, number];
  formatValue: (v: number) => string;
}

export interface TrendsDomain {
  key: DomainKey;
  titleKey: string;
  gradientColor: string;
  gradientColor2?: string;
  metrics: MetricDefinition[];
}

// ─── Score color ──────────────────────────────────────────────────────────────

export function scoreColor(v: number): string {
  if (v >= 80) return '#6B8EFF';
  if (v >= 60) return '#FFB84D';
  return '#FF6B6B';
}

// ─── Sleep domain ─────────────────────────────────────────────────────────────

const SLEEP_METRICS: MetricDefinition[] = [
  {
    key: 'bedTime',
    labelKey: 'trends_detail.metric.bedTime',
    chartType: 'line',
    color: '#B16BFF',
    aggregator: 'medianClockTime',
    extract: (d: DaySleepData) => toNightDecimalHour(d.bedTime),
    formatValue: (v) => formatClockHour(v),
  },
  {
    key: 'deepSleep',
    labelKey: 'trends_detail.metric.deepSleep',
    chartType: 'bar',
    color: '#6B8EFF',
    aggregator: 'mean',
    extract: (d: DaySleepData) => d.deepMin > 0 ? d.deepMin : null,
    formatValue: formatMinutes,
  },
  {
    key: 'latency',
    labelKey: 'trends_detail.metric.latency',
    chartType: 'line',
    color: '#FFB84D',
    aggregator: 'mean',
    extract: (d: DaySleepData) => {
      const lat = deriveLatencyMin(d.bedTime, d.segments);
      return lat > 0 ? lat : null;
    },
    formatValue: (v) => `${Math.round(v)} min`,
  },
  {
    key: 'sleepScore',
    labelKey: 'trends_detail.metric.sleepScore',
    chartType: 'line',
    color: '#6B8EFF',
    aggregator: 'mean',
    extract: (d: DaySleepData) => d.score > 0 ? d.score : null,
    formatValue: (v) => String(Math.round(v)),
  },
  {
    key: 'efficiency',
    labelKey: 'trends_detail.metric.efficiency',
    chartType: 'line',
    color: '#6BFFF5',
    aggregator: 'mean',
    extract: (d: DaySleepData) => {
      const e = deriveEfficiency(d.deepMin, d.lightMin, d.remMin, d.awakeMin);
      return e > 0 ? e : null;
    },
    formatValue: (v) => `${Math.round(v)}%`,
  },
  {
    key: 'timeInBed',
    labelKey: 'trends_detail.metric.timeInBed',
    chartType: 'bar',
    color: '#6B8EFF',
    aggregator: 'mean',
    extract: (d: DaySleepData) => {
      const t = deriveTimeInBedMin(d.deepMin, d.lightMin, d.remMin, d.awakeMin);
      return t > 0 ? t : null;
    },
    formatValue: formatMinutes,
  },
  {
    key: 'sleepOnset',
    labelKey: 'trends_detail.metric.sleepOnset',
    chartType: 'line',
    color: '#8AAAFF',
    aggregator: 'medianClockTime',
    extract: (d: DaySleepData) => {
      const onset = deriveSleepOnset(d.bedTime, d.segments);
      return toNightDecimalHour(onset);
    },
    formatValue: (v) => formatClockHour(v),
  },
  {
    key: 'wakeTime',
    labelKey: 'trends_detail.metric.wakeTime',
    chartType: 'line',
    color: '#FFD166',
    aggregator: 'medianClockTime',
    extract: (d: DaySleepData) => toDecimalHour(d.wakeTime),
    formatValue: (v) => formatClockHour(v % 24),
  },
  {
    key: 'totalSleep',
    labelKey: 'trends_detail.metric.totalSleep',
    chartType: 'bar',
    color: '#6B8EFF',
    aggregator: 'mean',
    extract: (d: DaySleepData) => d.timeAsleepMinutes > 0 ? d.timeAsleepMinutes : null,
    formatValue: formatMinutes,
  },
];

export const SLEEP_DOMAIN: TrendsDomain = {
  key: 'sleep',
  titleKey: 'trends_detail.domain.sleep',
  gradientColor: '#3B2A7A',
  gradientColor2: '#1A0A4A',
  metrics: SLEEP_METRICS,
};

// Phases 2-4: RECOVERY_DOMAIN, ACTIVITY_DOMAIN, RUNNING_DOMAIN
// Each will define its own MetricDefinition[] with the matching extract function.
// Placeholder stubs:
export const RECOVERY_DOMAIN: TrendsDomain = {
  key: 'recovery',
  titleKey: 'trends_detail.domain.recovery',
  gradientColor: '#1A3A6B',
  metrics: [],
};

export const ACTIVITY_DOMAIN: TrendsDomain = {
  key: 'activity',
  titleKey: 'trends_detail.domain.activity',
  gradientColor: '#6B3A0A',
  metrics: [],
};

export const RUNNING_DOMAIN: TrendsDomain = {
  key: 'running',
  titleKey: 'trends_detail.domain.running',
  gradientColor: '#7C2800',
  metrics: [],
};

// ─── HR domain ────────────────────────────────────────────────────────────────

const HR_METRICS: MetricDefinition[] = [
  {
    key: 'restingHR',
    labelKey: 'trends_detail.metric.restingHR',
    chartType: 'line',
    color: '#FF6B6B',
    aggregator: 'mean',
    extract: (d: DayHRTrendsData) => d.restingHR > 0 ? d.restingHR : null,
    minValue: 30,
    maxValue: 120,
    formatValue: (v) => `${Math.round(v)} bpm`,
  },
  {
    key: 'avgHR',
    labelKey: 'trends_detail.metric.avgHR',
    chartType: 'bar',
    color: '#FF9999',
    aggregator: 'mean',
    extract: (d: DayHRTrendsData) => d.avgHR > 0 ? d.avgHR : null,
    minValue: 30,
    maxValue: 150,
    formatValue: (v) => `${Math.round(v)} bpm`,
  },
  {
    key: 'sdnn',
    labelKey: 'trends_detail.metric.sdnn',
    chartType: 'bar',
    color: '#6B8EFF',
    aggregator: 'mean',
    extract: (d: DayHRTrendsData) => d.sdnn != null && d.sdnn > 0 ? d.sdnn : null,
    minValue: 0,
    maxValue: 120,
    formatValue: (v) => `${Math.round(v)} ms`,
  },
];

export const HR_DOMAIN: TrendsDomain = {
  key: 'hr',
  titleKey: 'trends_detail.domain.hr',
  gradientColor: '#7B0000',
  gradientColor2: '#3A0000',
  metrics: HR_METRICS,
};
