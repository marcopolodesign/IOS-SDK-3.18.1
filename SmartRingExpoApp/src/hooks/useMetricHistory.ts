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
import i18next from 'i18next';
import { supabase } from '../services/SupabaseService';
import { reportError } from '../utils/sentry';
import UnifiedSmartRingService from '../services/UnifiedSmartRingService';
import { calculateSleepScore } from '../utils/ringData/sleep';

// ─── Types ────────────────────────────────────────────────────────────────────

export type MetricType =
  | 'sleep'
  | 'heartRate'
  | 'hrv'
  | 'spo2'
  | 'temperature'
  | 'activity'
  | 'readiness';

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
  respiratoryRate: number;
  hrSamples: Array<{ timeMs: number; heartRate: number }>;
  tempSamples: Array<{ timeMs: number; temperature: number }>;
}

export interface DayHRData {
  date: string;
  hourlyPoints: Array<{ hour: number; heartRate: number }>;
  minutePoints: Array<{ timeMinutes: number; heartRate: number }>;
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
  hrMin: number | null;
}

export interface DayReadinessData {
  date: string;
  score: number;
  sleepScore: number;
  restingHRScore: number;
  strainScore: number;
  restingHR: number | null;
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
  // Use LOCAL date components so dateKeys match the user's clock and getHours() values.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

  // If stored as { rawQualityRecords: [...] } (DataSyncService format)
  if (Array.isArray(detailJson.rawQualityRecords)) {
    const totalMin = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
    return buildSegmentsFromRawQuality(detailJson.rawQualityRecords, startTime.getTime(), totalMin);
  }

  return [];
}

// ─── Sleep history ────────────────────────────────────────────────────────────

async function fetchSleepHistory(userId: string, days = 30): Promise<Map<string, DaySleepData>> {
  // Extend by 1 day so we catch sessions that started the night before the window
  const since = nDaysAgo(days + 1);
  const { data, error } = await supabase
    .from('sleep_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('session_type', 'night')
    .gte('start_time', since.toISOString())
    .order('start_time', { ascending: false });
  if (error || !data || data.length === 0) return new Map();

  const map = new Map<string, DaySleepData>();
  for (const row of data) {
    // Key by end_time (wake-up date) so a sleep that starts at 11 PM Apr 3
    // and ends at 7 AM Apr 4 is shown under Apr 4 — the day the user woke up.
    const dateKey = toDateStr(row.end_time ?? row.start_time);
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

    const rawScore = row.sleep_score;
    const calculatedScore = !rawScore
      ? calculateSleepScore({
          totalSleepMinutes: deepMin + lightMin + remMin,
          deepMinutes: deepMin,
          lightMinutes: lightMin,
          remMinutes: remMin,
          awakeMinutes: awakeMin,
          totalNapMinutes: 0,
          fallAsleepDuration: 0,
          segments: [], napSegments: [], timestamp: 0, dayIndex: 0,
        }).score
      : rawScore;

    map.set(dateKey, {
      date: dateKey,
      score: calculatedScore,
      timeAsleep: totalMin > 0 ? `${hours}h ${minutes}m` : '--',
      timeAsleepMinutes: totalMin,
      bedTime: startTime,
      wakeTime: endTime,
      deepMin,
      lightMin,
      remMin,
      awakeMin,
      segments,
      restingHR: row.resting_hr || row.detail_json?.restingHR || 0,
      respiratoryRate: row.detail_json?.respiratoryRate || 0,
      hrSamples: [],
      tempSamples: [],
    });
  }

  // Batch-fetch HR and temperature samples across all session windows (avoids N+1)
  if (data.length > 0) {
    const earliest = new Date(Math.min(...data.map(r => new Date(r.start_time).getTime())));
    const latest   = new Date(Math.max(...data.map(r => new Date(r.end_time).getTime())));

    const [hrResp, tempResp] = await Promise.all([
      supabase.from('heart_rate_readings')
        .select('heart_rate, recorded_at')
        .eq('user_id', userId)
        .gte('recorded_at', earliest.toISOString())
        .lte('recorded_at', latest.toISOString())
        .order('recorded_at', { ascending: true }),
      supabase.from('temperature_readings')
        .select('temperature_c, recorded_at')
        .eq('user_id', userId)
        .gte('recorded_at', earliest.toISOString())
        .lte('recorded_at', latest.toISOString())
        .order('recorded_at', { ascending: true }),
    ]);

    const allHR   = (hrResp.data ?? []).map(r => ({ timeMs: new Date(r.recorded_at).getTime(), heartRate: r.heart_rate }));
    const allTemp = (tempResp.data ?? []).map(r => ({ timeMs: new Date(r.recorded_at).getTime(), temperature: r.temperature_c }));

    for (const [, day] of map) {
      if (!day.bedTime || !day.wakeTime) continue;
      const startMs = day.bedTime.getTime();
      const endMs   = day.wakeTime.getTime();
      day.hrSamples   = allHR.filter(s => s.timeMs >= startMs && s.timeMs <= endMs && s.heartRate > 0);
      day.tempSamples = allTemp.filter(s => s.timeMs >= startMs && s.timeMs <= endMs && s.temperature > 0);
    }
  }

  return map;
}

// ─── Heart rate history ───────────────────────────────────────────────────────

async function fetchHRHistory(userId: string, days: number = 7): Promise<Map<string, DayHRData>> {
  const since = nDaysAgo(days);
  const { data, error } = await supabase
    .from('heart_rate_readings')
    .select('heart_rate, recorded_at')
    .eq('user_id', userId)
    .gte('recorded_at', since.toISOString())
    .order('recorded_at', { ascending: true });

  if (error || !data || data.length === 0) return new Map();

  // Group by date
  const byDate = new Map<string, Array<{ hour: number; minute: number; heartRate: number; val: number }>>();
  for (const row of data) {
    const d = new Date(row.recorded_at);
    const dateKey = toDateStr(d);
    if (!byDate.has(dateKey)) byDate.set(dateKey, []);
    byDate.get(dateKey)!.push({ hour: d.getHours(), minute: d.getMinutes(), heartRate: row.heart_rate, val: row.heart_rate });
  }

  const map = new Map<string, DayHRData>();
  for (const [dateKey, pts] of byDate.entries()) {
    const vals = pts.map(p => p.val).filter(v => v > 0);
    // Prefer overnight readings (midnight–8am local) for restingHR — daytime minimums
    // include active-movement data (80–110 bpm) and inflate the resting HR estimate.
    const overnightVals = pts.filter(p => p.hour < 8).map(p => p.val).filter(v => v > 0);
    const restingHR = overnightVals.length > 0 ? Math.min(...overnightVals) : (vals.length > 0 ? Math.min(...vals) : 0);
    map.set(dateKey, {
      date: dateKey,
      hourlyPoints: pts.map(p => ({ hour: p.hour, heartRate: p.heartRate })),
      minutePoints: pts.map(p => ({ timeMinutes: p.hour * 60 + p.minute, heartRate: p.heartRate })),
      restingHR,
      peakHR: vals.length > 0 ? Math.max(...vals) : 0,
      avgHR: vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0,
    });
  }
  return map;
}

// ─── HRV history ─────────────────────────────────────────────────────────────

async function fetchHRVHistory(userId: string, days: number = 7): Promise<Map<string, DayHRVData>> {
  const since = nDaysAgo(days);
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

async function fetchSpO2History(userId: string, days = 7): Promise<Map<string, DaySpO2Data>> {
  const since = nDaysAgo(days);
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

async function fetchActivityHistory(userId: string, days: number = 7): Promise<Map<string, DayActivityData>> {
  const since = nDaysAgo(days);
  const { data, error } = await supabase
    .from('daily_summaries')
    .select('date, total_steps, total_distance_m, total_calories, sleep_total_min, hr_avg, hr_min')
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
      hrMin: row.hr_min,
    });
  }
  return map;
}

// ─── Readiness history (from daily_summaries) ────────────────────────────────

async function fetchReadinessHistory(userId: string, days: number = 30): Promise<Map<string, DayReadinessData>> {
  const since = nDaysAgo(days);
  const { data, error } = await supabase
    .from('daily_summaries')
    .select('date, readiness_score, readiness_sleep_score, readiness_hr_score, readiness_strain_score, readiness_resting_hr')
    .eq('user_id', userId)
    .gte('date', toDateStr(since))
    .not('readiness_score', 'is', null)
    .order('date', { ascending: false });

  if (error || !data || data.length === 0) return new Map();

  const map = new Map<string, DayReadinessData>();
  for (const row of data) {
    map.set(row.date, {
      date: row.date,
      score: row.readiness_score ?? 0,
      sleepScore: row.readiness_sleep_score ?? 0,
      restingHRScore: row.readiness_hr_score ?? 50,
      strainScore: row.readiness_strain_score ?? 0,
      restingHR: row.readiness_resting_hr ?? null,
    });
  }
  return map;
}

// ─── Ring SDK fallback helpers ────────────────────────────────────────────────
// Used when Supabase returns 0 rows (first launch before any sync).

function buildSegmentsFromRawQuality(
  rawQualityRecords: any[] | undefined,
  startTimeMs: number | undefined,
  totalMin: number
): DaySleepData['segments'] {
  const STAGE_MAP: Record<number, string> = { 1: 'deep', 2: 'core', 3: 'rem' };
  if (!rawQualityRecords?.length) return [];
  const segments: DaySleepData['segments'] = [];
  for (const rec of rawQualityRecords) {
    const unitMs = (rec.sleepUnitLength || 1) * 60 * 1000;
    let cursor: number = rec.startTimestamp ?? startTimeMs ?? Date.now() - totalMin * 60000;
    for (const q of (rec.arraySleepQuality || [])) {
      segments.push({
        stage: STAGE_MAP[q] || 'awake',
        startTime: new Date(cursor),
        endTime: new Date(cursor + unitMs),
      });
      cursor += unitMs;
    }
  }
  return segments;
}

async function fetchSleepFromRing(): Promise<Map<string, DaySleepData>> {
  const map = new Map<string, DaySleepData>();
  try {
    for (let i = 0; i < 7; i++) {
      const sleep = await UnifiedSmartRingService.getSleepByDay(i);
      if (!sleep || (sleep.deep === 0 && sleep.light === 0)) continue;
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateKey = toDateStr(d);
      const totalMin = sleep.deep + sleep.light + (sleep.rem || 0);
      const hours = Math.floor(totalMin / 60);
      const mins = totalMin % 60;
      const segments = buildSegmentsFromRawQuality(sleep.rawQualityRecords, sleep.startTime, totalMin);
      const { score } = calculateSleepScore({
        totalSleepMinutes: totalMin,
        deepMinutes: sleep.deep,
        lightMinutes: sleep.light,
        remMinutes: sleep.rem || 0,
        awakeMinutes: sleep.awake || 0,
        totalNapMinutes: 0,
        fallAsleepDuration: 0,
        segments: [], napSegments: [], timestamp: 0, dayIndex: i,
      });
      map.set(dateKey, {
        date: dateKey,
        score,
        timeAsleep: totalMin > 0 ? `${hours}h ${mins}m` : '--',
        timeAsleepMinutes: totalMin,
        bedTime: sleep.startTime ? new Date(sleep.startTime) : null,
        wakeTime: sleep.endTime ? new Date(sleep.endTime) : null,
        deepMin: sleep.deep,
        lightMin: sleep.light,
        remMin: sleep.rem || 0,
        awakeMin: sleep.awake || 0,
        segments,
        restingHR: 0,
        respiratoryRate: 0,
        hrSamples: [],
        tempSamples: [],
      });
    }
  } catch (e) {
    reportError(e, { op: 'metricHistory.ringFallback', metric: 'sleep' }, 'warning');
  }
  return map;
}

async function fetchHRFromRing(): Promise<Map<string, DayHRData>> {
  const map = new Map<string, DayHRData>();
  try {
    const result = await UnifiedSmartRingService.getScheduledHeartRateRaw([0, 1, 2, 3, 4, 5, 6]);
    const byDate = new Map<string, Array<{ hour: number; timeMinutes: number; heartRate: number }>>();
    for (const r of result) {
      const ts = (r as any).timestamp;
      const dateKey = ts ? toDateStr(new Date(ts)) : toDateStr(new Date());
      if (!byDate.has(dateKey)) byDate.set(dateKey, []);
      const tm: number = r.timeMinutes ?? ((r as any).hour ?? 0) * 60;
      byDate.get(dateKey)!.push({ hour: Math.floor(tm / 60), timeMinutes: tm, heartRate: r.heartRate });
    }
    for (const [dateKey, pts] of byDate) {
      const vals = pts.map(p => p.heartRate).filter(v => v > 0);
      const overnightVals = pts.filter(p => p.hour < 8).map(p => p.heartRate).filter(v => v > 0);
      const restingHR = overnightVals.length ? Math.min(...overnightVals) : (vals.length ? Math.min(...vals) : 0);
      map.set(dateKey, {
        date: dateKey,
        hourlyPoints: pts.map(p => ({ hour: p.hour, heartRate: p.heartRate })),
        minutePoints: pts.map(p => ({ timeMinutes: p.timeMinutes, heartRate: p.heartRate })),
        restingHR,
        peakHR: vals.length ? Math.max(...vals) : 0,
        avgHR: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0,
      });
    }
  } catch (e) {
    reportError(e, { op: 'metricHistory.ringFallback', metric: 'hr' }, 'warning');
  }
  return map;
}

async function fetchHRVFromRing(): Promise<Map<string, DayHRVData>> {
  const map = new Map<string, DayHRVData>();
  try {
    const records = await UnifiedSmartRingService.getHRVDataNormalizedArray();
    for (const r of records) {
      if (!r.timestamp) continue;
      const dateKey = toDateStr(new Date(r.timestamp));
      if (map.has(dateKey)) continue;
      const sdnn = (r as any).sdnn ?? null;
      map.set(dateKey, {
        date: dateKey,
        sdnn,
        rmssd: null, pnn50: null, lf: null, hf: null, lfHfRatio: null,
        heartRate: r.heartRate ?? null,
        stressLabel: stressLabel(sdnn),
        recoveryLabel: recoveryLabel(sdnn),
      });
    }
  } catch (e) {
    reportError(e, { op: 'metricHistory.ringFallback', metric: 'hrv' }, 'warning');
  }
  return map;
}

async function fetchSpO2FromRing(): Promise<Map<string, DaySpO2Data>> {
  const map = new Map<string, DaySpO2Data>();
  try {
    const records = await UnifiedSmartRingService.getSpO2DataNormalizedArray();
    const byDate = new Map<string, Array<{ value: number; recordedAt: Date }>>();
    for (const r of records) {
      const dateKey = toDateStr(new Date(r.timestamp));
      if (!byDate.has(dateKey)) byDate.set(dateKey, []);
      byDate.get(dateKey)!.push({ value: r.spo2, recordedAt: new Date(r.timestamp) });
    }
    for (const [dateKey, readings] of byDate) {
      const vals = readings.map(r => r.value).filter(v => v > 0);
      map.set(dateKey, {
        date: dateKey,
        readings,
        avg: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0,
        min: vals.length ? Math.min(...vals) : 0,
        max: vals.length ? Math.max(...vals) : 0,
        timeBelowNormal: readings.filter(r => r.value < 95 && r.value > 0).length,
      });
    }
  } catch (e) {
    reportError(e, { op: 'metricHistory.ringFallback', metric: 'spo2' }, 'warning');
  }
  return map;
}

async function fetchTemperatureFromRing(): Promise<Map<string, DayTemperatureData>> {
  const map = new Map<string, DayTemperatureData>();
  try {
    const records = await UnifiedSmartRingService.getTemperatureDataNormalizedArray();
    const byDate = new Map<string, Array<{ value: number; recordedAt: Date }>>();
    for (const r of records) {
      const dateKey = toDateStr(new Date(r.timestamp));
      if (!byDate.has(dateKey)) byDate.set(dateKey, []);
      byDate.get(dateKey)!.push({ value: r.temperature, recordedAt: new Date(r.timestamp) });
    }
    for (const [dateKey, readings] of byDate) {
      const vals = readings.map(r => r.value).filter(v => v > 0);
      map.set(dateKey, {
        date: dateKey,
        readings,
        avg: vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : 0,
        min: vals.length ? Math.min(...vals) : 0,
        max: vals.length ? Math.max(...vals) : 0,
        current: readings.length ? readings[readings.length - 1].value : 0,
      });
    }
  } catch (e) {
    reportError(e, { op: 'metricHistory.ringFallback', metric: 'temperature' }, 'warning');
  }
  return map;
}

async function fetchActivityFromRing(): Promise<Map<string, DayActivityData>> {
  const map = new Map<string, DayActivityData>();
  try {
    // Use full history (SDK stores ~7 days of daily totals)
    const history = await UnifiedSmartRingService.getAllDailyStepsHistory();
    for (const entry of history) {
      if (entry.steps > 0) {
        map.set(entry.dateKey, {
          date: entry.dateKey,
          steps: entry.steps,
          distanceM: entry.distanceM,
          calories: entry.calories,
          sleepTotalMin: null,
          hrAvg: null,
          hrMin: null,
        });
      }
    }
    // If history was empty, fall back to today-only via getSteps()
    if (map.size === 0) {
      const steps = await UnifiedSmartRingService.getSteps();
      const dateKey = toDateStr(new Date());
      if (steps.steps > 0) {
        map.set(dateKey, {
          date: dateKey,
          steps: steps.steps,
          distanceM: (steps as any).distance || 0,
          calories: steps.calories || 0,
          sleepTotalMin: null,
          hrAvg: null,
          hrMin: null,
        });
      }
    }
  } catch (e) {
    reportError(e, { op: 'metricHistory.ringFallback', metric: 'activity' }, 'warning');
  }
  return map;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMetricHistory<T>(
  type: MetricType,
  options?: { initialDays?: number; fullDays?: number }
): MetricHistoryState<T> {
  const initialDays = options?.initialDays ?? 7;
  const fullDays = options?.fullDays ?? initialDays;
  const cacheRef = useRef<Map<string, T> | null>(null);
  // Tracks whether cacheRef already holds the full extended dataset
  const cacheIsCompleteRef = useRef(false);
  const [data, setData] = useState<Map<string, T>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Cache hit
      if (cacheRef.current) {
        setData(cacheRef.current);
        setIsLoading(false);
        // If cache is partial (previous phase 1 only), extend silently in background
        if (!cacheIsCompleteRef.current && (type === 'sleep' || type === 'hrv') && fullDays > initialDays) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user && !cancelled) {
            const full = type === 'sleep'
              ? await fetchSleepHistory(user.id, fullDays)
              : await fetchHRVHistory(user.id, fullDays);
            if (!cancelled && full.size > 0) {
              cacheRef.current = full as Map<string, T>;
              cacheIsCompleteRef.current = true;
              setData(full as Map<string, T>);
            } else {
              cacheIsCompleteRef.current = true;
            }
          }
        }
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // ── Two-phase progressive load (sleep + HRV) ─────────────────────────
        if ((type === 'sleep' || type === 'hrv') && fullDays > initialDays) {
          // Phase 1: fast query (initialDays) → show UI immediately
          let phase1 = type === 'sleep'
            ? await fetchSleepHistory(user.id, initialDays)
            : await fetchHRVHistory(user.id, initialDays);
          if (phase1.size === 0) {
            phase1 = type === 'sleep' ? await fetchSleepFromRing() : await fetchHRVFromRing();
          }
          if (!cancelled) {
            cacheRef.current = phase1 as Map<string, T>;
            setData(phase1 as Map<string, T>);
            setIsLoading(false);
          }
          // Phase 2: extend silently — older bars fill in as user scrolls left
          if (!cancelled) {
            const phase2 = type === 'sleep'
              ? await fetchSleepHistory(user.id, fullDays)
              : await fetchHRVHistory(user.id, fullDays);
            if (!cancelled && phase2.size > 0) {
              cacheRef.current = phase2 as Map<string, T>;
              setData(phase2 as Map<string, T>);
            }
            cacheIsCompleteRef.current = true;
          }
          return;
        }

        let result: Map<string, any>;
        switch (type) {
          case 'sleep':
            result = await fetchSleepHistory(user.id, initialDays);
            if (result.size === 0) result = await fetchSleepFromRing();
            break;
          case 'heartRate':
            result = await fetchHRHistory(user.id, fullDays);
            if (result.size === 0) result = await fetchHRFromRing();
            break;
          case 'hrv':
            result = await fetchHRVHistory(user.id);
            if (result.size === 0) result = await fetchHRVFromRing();
            break;
          case 'spo2':
            result = await fetchSpO2History(user.id, fullDays);
            if (result.size === 0) result = await fetchSpO2FromRing();
            break;
          case 'temperature':
            result = await fetchTemperatureHistory(user.id);
            if (result.size === 0) result = await fetchTemperatureFromRing();
            break;
          case 'activity': {
            result = await fetchActivityHistory(user.id, fullDays);
            // Fall back to ring if Supabase has no rows, or all rows have 0 steps
            // (daily_summaries rows are created during sync but activity columns may be 0
            // if step sync hadn't run yet for those days).
            const hasRealData = Array.from((result as Map<string, DayActivityData>).values()).some(d => d.steps > 0);
            if (!hasRealData) result = await fetchActivityFromRing();
            break;
          }
          case 'readiness':
            result = await fetchReadinessHistory(user.id, fullDays);
            break;
          default:
            result = new Map();
        }

        if (!cancelled) {
          cacheRef.current = result as Map<string, T>;
          cacheIsCompleteRef.current = true;
          setData(result as Map<string, T>);
          setIsLoading(false);
        }
      } catch (e) {
        reportError(e, { op: 'metricHistory.loadAll' });
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
    if (i === 0) label = i18next.t('health.today');
    else if (i === 1) label = i18next.t('health.yesterday');
    else label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    result.push({ label, dateKey });
  }
  return result;
}
