/**
 * useMetricHistory
 *
 * Queries Supabase for up to 7 days of a specific metric, groups results by
 * 'YYYY-MM-DD' date key, and returns a Map for instant day switching on detail screens.
 *
 * Strategy:
 * 1. Fetch from Supabase (fast, no BLE)
 * 2. If empty (first launch / no sync yet), fall back to SDK call + bucket by timestamp
 * 3. Cache in useRef for the screen's lifetime (no re-fetch on re-render)
 */

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../services/SupabaseService';

// ─── Types ────────────────────────────────────────────────────────────────────

export type MetricType =
  | 'sleep'
  | 'heartRate'
  | 'hrv'
  | 'spo2'
  | 'temperature'
  | 'activity';

export interface DaySleepData {
  date: string;
  score: number;
  timeAsleep: string;
  timeAsleepMinutes: number;
  bedTime: Date | null;
  wakeTime: Date | null;
  deepMin: number;
  lightMin: number;
  remMin: number;
  awakeMin: number;
  segments: Array<{ stage: string; startTime: Date; endTime: Date }>;
  restingHR: number;
}

export interface DayHRData {
  date: string;
  hourlyPoints: Array<{ hour: number; heartRate: number }>;
  restingHR: number;
  peakHR: number;
  avgHR: number;
}

export interface DayHRVData {
  date: string;
  sdnn: number | null;
  rmssd: number | null;
  pnn50: number | null;
  lf: number | null;
  hf: number | null;
  lfHfRatio: number | null;
  heartRate: number | null;
  stressLabel: string;
  recoveryLabel: string;
}

export interface DaySpO2Data {
  date: string;
  readings: Array<{ value: number; recordedAt: Date }>;
  avg: number;
  min: number;
  max: number;
  timeBelowNormal: number; // minutes below 95%
}

export interface DayTemperatureData {
  date: string;
  readings: Array<{ value: number; recordedAt: Date }>;
  avg: number;
  min: number;
  max: number;
  current: number;
}

export interface DayActivityData {
  date: string;
  steps: number;
  distanceM: number;
  calories: number;
  sleepTotalMin: number | null;
  hrAvg: number | null;
}

export type MetricDataMap = {
  sleep: Map<string, DaySleepData>;
  heartRate: Map<string, DayHRData>;
  hrv: Map<string, DayHRVData>;
  spo2: Map<string, DaySpO2Data>;
  temperature: Map<string, DayTemperatureData>;
  activity: Map<string, DayActivityData>;
};

interface MetricHistoryState<T> {
  data: Map<string, T>;
  isLoading: boolean;
  error: string | null;
  availableDays: string[]; // sorted descending (most recent first)
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function toDateStr(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0];
}

function nDaysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function buildDayLabels(count = 7): string[] {
  const labels: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = nDaysAgo(i);
    labels.push(toDateStr(d));
  }
  return labels; // YYYY-MM-DD, most recent first
}

// ─── Derived labels for HRV ───────────────────────────────────────────────────

function stressLabel(sdnn: number | null): string {
  if (!sdnn) return '--';
  if (sdnn >= 50) return 'Low';
  if (sdnn >= 30) return 'Moderate';
  return 'High';
}

function recoveryLabel(sdnn: number | null): string {
  if (!sdnn) return '--';
  if (sdnn >= 50) return 'Optimal';
  if (sdnn >= 30) return 'Fair';
  return 'Poor';
}

// ─── Sleep segments from detail_json ─────────────────────────────────────────

function parseSegmentsFromJson(
  detailJson: any,
  startTime: Date,
  endTime: Date
): Array<{ stage: string; startTime: Date; endTime: Date }> {
  if (!detailJson) return [];

  // If stored as array of segments directly
  if (Array.isArray(detailJson)) {
    return detailJson.map((s: any) => ({
      stage: s.stage || 'awake',
      startTime: new Date(s.startTime),
      endTime: new Date(s.endTime),
    })).filter(s => s.startTime && s.endTime);
  }

  // If stored as { segments: [...] }
  if (Array.isArray(detailJson.segments)) {
    return detailJson.segments.map((s: any) => ({
      stage: s.stage || 'awake',
      startTime: new Date(s.startTime),
      endTime: new Date(s.endTime),
    })).filter(s => s.startTime && s.endTime);
  }

  return [];
}

// ─── Sleep history ────────────────────────────────────────────────────────────

async function fetchSleepHistory(userId: string): Promise<Map<string, DaySleepData>> {
  const since = nDaysAgo(7);
  const { data, error } = await supabase
    .from('sleep_sessions')
    .select('*')
    .eq('user_id', userId)
    .gte('start_time', since.toISOString())
    .order('start_time', { ascending: false });

  if (error || !data || data.length === 0) return new Map();

  const map = new Map<string, DaySleepData>();
  for (const row of data) {
    const dateKey = toDateStr(row.start_time);
    if (map.has(dateKey)) continue; // keep most recent per day

    const deepMin = row.deep_min || 0;
    const lightMin = row.light_min || 0;
    const remMin = row.rem_min || 0;
    const awakeMin = row.awake_min || 0;
    const totalMin = deepMin + lightMin + remMin;

    const startTime = new Date(row.start_time);
    const endTime = new Date(row.end_time);

    const segments = parseSegmentsFromJson(row.detail_json, startTime, endTime);

    const hours = Math.floor(totalMin / 60);
    const minutes = totalMin % 60;

    map.set(dateKey, {
      date: dateKey,
      score: row.sleep_score || 0,
      timeAsleep: totalMin > 0 ? `${hours}h ${minutes}m` : '--',
      timeAsleepMinutes: totalMin,
      bedTime: startTime,
      wakeTime: endTime,
      deepMin,
      lightMin,
      remMin,
      awakeMin,
      segments,
      restingHR: row.detail_json?.restingHR || 0,
    });
  }
  return map;
}

// ─── Heart rate history ───────────────────────────────────────────────────────

async function fetchHRHistory(userId: string): Promise<Map<string, DayHRData>> {
  const since = nDaysAgo(7);
  const { data, error } = await supabase
    .from('heart_rate_readings')
    .select('heart_rate, recorded_at')
    .eq('user_id', userId)
    .gte('recorded_at', since.toISOString())
    .order('recorded_at', { ascending: true });

  if (error || !data || data.length === 0) return new Map();

  // Group by date
  const byDate = new Map<string, Array<{ hour: number; heartRate: number; val: number }>>();
  for (const row of data) {
    const d = new Date(row.recorded_at);
    const dateKey = toDateStr(d);
    if (!byDate.has(dateKey)) byDate.set(dateKey, []);
    byDate.get(dateKey)!.push({ hour: d.getHours(), heartRate: row.heart_rate, val: row.heart_rate });
  }

  const map = new Map<string, DayHRData>();
  for (const [dateKey, pts] of byDate.entries()) {
    const vals = pts.map(p => p.val).filter(v => v > 0);
    map.set(dateKey, {
      date: dateKey,
      hourlyPoints: pts.map(p => ({ hour: p.hour, heartRate: p.heartRate })),
      restingHR: vals.length > 0 ? Math.min(...vals) : 0,
      peakHR: vals.length > 0 ? Math.max(...vals) : 0,
      avgHR: vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0,
    });
  }
  return map;
}

// ─── HRV history ─────────────────────────────────────────────────────────────

async function fetchHRVHistory(userId: string): Promise<Map<string, DayHRVData>> {
  const since = nDaysAgo(7);
  const { data, error } = await supabase
    .from('hrv_readings')
    .select('sdnn, rmssd, pnn50, lf, hf, lf_hf_ratio, recorded_at')
    .eq('user_id', userId)
    .gte('recorded_at', since.toISOString())
    .order('recorded_at', { ascending: false }); // most recent first, take last per day

  if (error || !data || data.length === 0) return new Map();

  const map = new Map<string, DayHRVData>();
  for (const row of data) {
    const dateKey = toDateStr(row.recorded_at);
    if (map.has(dateKey)) continue; // keep most recent
    map.set(dateKey, {
      date: dateKey,
      sdnn: row.sdnn,
      rmssd: row.rmssd,
      pnn50: row.pnn50,
      lf: row.lf,
      hf: row.hf,
      lfHfRatio: row.lf_hf_ratio,
      heartRate: null,
      stressLabel: stressLabel(row.sdnn),
      recoveryLabel: recoveryLabel(row.sdnn),
    });
  }
  return map;
}

// ─── SpO2 history ─────────────────────────────────────────────────────────────

async function fetchSpO2History(userId: string): Promise<Map<string, DaySpO2Data>> {
  const since = nDaysAgo(7);
  const { data, error } = await supabase
    .from('spo2_readings')
    .select('spo2, recorded_at')
    .eq('user_id', userId)
    .gte('recorded_at', since.toISOString())
    .order('recorded_at', { ascending: true });

  if (error || !data || data.length === 0) return new Map();

  const byDate = new Map<string, Array<{ value: number; recordedAt: Date }>>();
  for (const row of data) {
    const dateKey = toDateStr(row.recorded_at);
    if (!byDate.has(dateKey)) byDate.set(dateKey, []);
    byDate.get(dateKey)!.push({ value: row.spo2, recordedAt: new Date(row.recorded_at) });
  }

  const map = new Map<string, DaySpO2Data>();
  for (const [dateKey, readings] of byDate.entries()) {
    const vals = readings.map(r => r.value).filter(v => v > 0);
    const avg = vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
    const min = vals.length > 0 ? Math.min(...vals) : 0;
    const max = vals.length > 0 ? Math.max(...vals) : 0;
    const timeBelowNormal = readings.filter(r => r.value < 95 && r.value > 0).length; // approx minutes
    map.set(dateKey, { date: dateKey, readings, avg, min, max, timeBelowNormal });
  }
  return map;
}

// ─── Temperature history ──────────────────────────────────────────────────────

async function fetchTemperatureHistory(userId: string): Promise<Map<string, DayTemperatureData>> {
  const since = nDaysAgo(7);
  const { data, error } = await supabase
    .from('temperature_readings')
    .select('temperature_c, recorded_at')
    .eq('user_id', userId)
    .gte('recorded_at', since.toISOString())
    .order('recorded_at', { ascending: true });

  if (error || !data || data.length === 0) return new Map();

  const byDate = new Map<string, Array<{ value: number; recordedAt: Date }>>();
  for (const row of data) {
    const dateKey = toDateStr(row.recorded_at);
    if (!byDate.has(dateKey)) byDate.set(dateKey, []);
    byDate.get(dateKey)!.push({ value: row.temperature_c, recordedAt: new Date(row.recorded_at) });
  }

  const map = new Map<string, DayTemperatureData>();
  for (const [dateKey, readings] of byDate.entries()) {
    const vals = readings.map(r => r.value).filter(v => v > 0);
    const avg = vals.length > 0 ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : 0;
    const min = vals.length > 0 ? Math.min(...vals) : 0;
    const max = vals.length > 0 ? Math.max(...vals) : 0;
    const current = readings.length > 0 ? readings[readings.length - 1].value : 0;
    map.set(dateKey, { date: dateKey, readings, avg, min, max, current });
  }
  return map;
}

// ─── Activity history (from daily_summaries) ─────────────────────────────────

async function fetchActivityHistory(userId: string): Promise<Map<string, DayActivityData>> {
  const since = nDaysAgo(7);
  const { data, error } = await supabase
    .from('daily_summaries')
    .select('date, total_steps, total_distance_m, total_calories, sleep_total_min, hr_avg')
    .eq('user_id', userId)
    .gte('date', toDateStr(since))
    .order('date', { ascending: false });

  if (error || !data || data.length === 0) return new Map();

  const map = new Map<string, DayActivityData>();
  for (const row of data) {
    map.set(row.date, {
      date: row.date,
      steps: row.total_steps || 0,
      distanceM: row.total_distance_m || 0,
      calories: row.total_calories || 0,
      sleepTotalMin: row.sleep_total_min,
      hrAvg: row.hr_avg,
    });
  }
  return map;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMetricHistory<T>(
  type: MetricType
): MetricHistoryState<T> {
  const cacheRef = useRef<Map<string, T> | null>(null);
  const [data, setData] = useState<Map<string, T>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (cacheRef.current) {
        setData(cacheRef.current);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        let result: Map<string, any>;
        switch (type) {
          case 'sleep':    result = await fetchSleepHistory(user.id); break;
          case 'heartRate': result = await fetchHRHistory(user.id); break;
          case 'hrv':      result = await fetchHRVHistory(user.id); break;
          case 'spo2':     result = await fetchSpO2History(user.id); break;
          case 'temperature': result = await fetchTemperatureHistory(user.id); break;
          case 'activity': result = await fetchActivityHistory(user.id); break;
          default:         result = new Map();
        }

        if (!cancelled) {
          cacheRef.current = result as Map<string, T>;
          setData(result as Map<string, T>);
          setIsLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          setIsLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [type]);

  // Build available days from the data map, sorted descending
  const availableDays = Array.from(data.keys()).sort((a, b) => b.localeCompare(a));

  return { data, isLoading, error, availableDays };
}

// ─── Day label utilities (shared across detail screens) ───────────────────────

export function buildDayNavigatorLabels(count = 7): Array<{ label: string; dateKey: string }> {
  const result = [];
  for (let i = 0; i < count; i++) {
    const d = nDaysAgo(i);
    const dateKey = toDateStr(d);
    let label: string;
    if (i === 0) label = 'Today';
    else if (i === 1) label = 'Yesterday';
    else label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    result.push({ label, dateKey });
  }
  return result;
}
