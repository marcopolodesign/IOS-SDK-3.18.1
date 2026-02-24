import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Button, TouchableOpacity } from 'react-native';
import { Stack } from 'expo-router';
import { SleepHypnogram, SleepSegment } from '../src/components/home/SleepHypnogram';
import { GradientInfoCard } from '../src/components/common/GradientInfoCard';
import { SleepScoreIcon } from '../src/assets/icons';
import { spacing, fontSize, fontFamily } from '../src/theme/colors';
import UnifiedSmartRingService from '../src/services/UnifiedSmartRingService';
import JstyleService from '../src/services/JstyleService';
import { Alert } from 'react-native';

type SleepDataLite = {
  score: number;
  bedTime: Date;
  wakeTime: Date;
  timeAsleep: string;
  segments: SleepSegment[];
  totals: { deep: number; light: number; rem: number; awake: number };
};
type BatteryLite = { battery: number } | null;
type HRLite = { heartRate: number; samples: number[] } | null;
type HRVLite = { sdnn: number; heartRate?: number; stress?: number; timestamp?: number } | null;

// Map SDK quality to hypnogram stages
const mapSleepType = (type: number): SleepSegment['stage'] => {
  switch (type) {
    case 1: return 'deep';
    case 2: return 'core';
    case 3: return 'rem';
    default: return 'awake';
  }
};

function parseStart(str?: string): number | undefined {
  if (!str) return;
  const [d, t] = str.split(' ');
  if (!d || !t) return;
  const [y, m, day] = d.split('.').map(Number);
  const [hh, mm, ss] = t.split(':').map(Number);
  if ([y, m, day, hh, mm, ss].some(n => Number.isNaN(n))) return;
  return new Date(y, (m ?? 1) - 1, day, hh, mm, ss).getTime();
}

function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function deriveFromRaw(rawRecords: any[]): SleepDataLite | null {
  if (!rawRecords || rawRecords.length === 0) return null;

  // Normalize records
  const normalizedAll = rawRecords.map(r => {
    const start = r.startTimestamp || parseStart(r.startTime_SleepData);
    const unit = Number(r.sleepUnitLength) || 1;
    const arr: number[] = r.arraySleepQuality || [];
    const durationMin = Number(r.totalSleepTime) || arr.length * unit;
    return { start, unit, arr, durationMin };
  }).filter(r => typeof r.start === 'number' && r.start > 0);

  if (normalizedAll.length === 0) return null;

  // Build longest continuous block (max 60m gap between records)
  const sorted = [...normalizedAll].sort((a, b) => a.start! - b.start!);
  const MAX_GAP_MS = 60 * 60 * 1000;
  const blocks: { start: number; end: number; records: typeof normalizedAll }[] = [];
  let block: { start: number; end: number; records: typeof normalizedAll } | null = null;

  for (const rec of sorted) {
    const recStart = rec.start!;
    const recEnd = rec.start! + rec.durationMin * 60000;
    if (!block) {
      block = { start: recStart, end: recEnd, records: [rec] };
      continue;
    }
    if (recStart - block.end <= MAX_GAP_MS) {
      block.end = Math.max(block.end, recEnd);
      block.records.push(rec);
    } else {
      blocks.push(block);
      block = { start: recStart, end: recEnd, records: [rec] };
    }
  }
  if (block) blocks.push(block);

  if (blocks.length === 0) return null;
  // Choose the most recent block (latest end time)
  const chosen = blocks.reduce((acc, b) => (b.end > acc.end ? b : acc), blocks[0]);

  const earliestStart = chosen.start;
  const latestEnd = chosen.end;
  const totalMinutes = Math.max(0, Math.round((latestEnd - earliestStart) / 60000));
  const timeline: number[] = new Array(totalMinutes).fill(0); // 0 awake, 1 core, 2 rem, 3 deep

  for (const rec of chosen.records) {
    const startOffset = Math.round((rec.start! - earliestStart) / 60000);
    const unit = Math.max(1, rec.unit);
    rec.arr.forEach((val: number, idx: number) => {
      const stage = mapSleepType(Number(val));
      const stageVal = stage === 'deep' ? 3 : stage === 'rem' ? 2 : stage === 'core' ? 1 : 0;
      for (let k = 0; k < unit; k++) {
        const pos = startOffset + idx * unit + k;
        if (pos >= 0 && pos < timeline.length) timeline[pos] = stageVal;
      }
    });
  }

  // Totals and segments from timeline (continuous, gaps already awake)
  let deep = 0, light = 0, rem = 0, awake = 0;
  const segments: SleepSegment[] = [];
  for (let i = 0; i < timeline.length; i++) {
    const val = timeline[i];
    const stage: SleepSegment['stage'] = val === 3 ? 'deep' : val === 2 ? 'rem' : val === 1 ? 'core' : 'awake';
    switch (stage) {
      case 'deep': deep++; break;
      case 'core': light++; break;
      case 'rem': rem++; break;
      default: awake++; break;
    }
    const startMs = earliestStart + i * 60000;
    const endMs = startMs + 60000;
    if (segments.length && segments[segments.length - 1].stage === stage) {
      segments[segments.length - 1].endTime = new Date(endMs);
    } else {
      segments.push({ stage, startTime: new Date(startMs), endTime: new Date(endMs) });
    }
  }

  const bed = new Date(earliestStart);
  const wake = new Date(latestEnd);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const timeAsleep = `${hours}h ${minutes}m`;
  const score = totalMinutes > 0 ? Math.min(100, Math.round((deep + light) / totalMinutes * 100)) : 0;

  return {
    score,
    bedTime: bed,
    wakeTime: wake,
    timeAsleep,
    segments,
    totals: { deep, light, rem, awake },
  };
}

export default function TestingScreen() {
  const isFetchingRef = useRef(false);
  const [sleep, setSleep] = useState<SleepDataLite | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawDump, setRawDump] = useState<string | null>(null);
  const [battery, setBattery] = useState<BatteryLite>(null);
  const [batteryStatus, setBatteryStatus] = useState<string>('');
  const [heartRate, setHeartRate] = useState<HRLite>(null);
  const [heartStatus, setHeartStatus] = useState<string>('');
  const [hrv, setHRV] = useState<HRVLite>(null);
  const [hrvStatus, setHRVStatus] = useState<string>('');

  const fetchSleep = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      // Auto-reconnect if needed
      await UnifiedSmartRingService.autoReconnect();

      // Raw call to Jstyle for logging
      const rawResult = await JstyleService.getSleepData();
      setRawDump(JSON.stringify(rawResult, null, 2));

      // Derive everything purely from raw records to avoid zeros
      const derived = deriveFromRaw(rawResult.data || rawResult.records || []);
      if (!derived) {
        setSleep(null);
        setError('No sleep records in raw payload');
      } else {
        setSleep(derived);
      }

      // Battery
      try {
        const batt = await UnifiedSmartRingService.getBattery();
        setBattery({ battery: batt.battery });
        setBatteryStatus(`Battery OK: ${batt.battery}%`);
      } catch (bErr) {
        setBattery(null);
        setBatteryStatus(`Battery error: ${String(bErr)}`);
      }

      // Heart rate (continuous, like demo)
      try {
        const hrRaw = await JstyleService.getContinuousHeartRate();
        console.log('RAW_HEART', hrRaw);
        const samples: number[] = [];
        for (const rec of hrRaw.records || []) {
          const arr: number[] = rec.arrayDynamicHR || [];
          arr.forEach(v => { if (v > 0) samples.push(v); });
        }
        if (samples.length > 0) {
          const latest = samples[samples.length - 1];
          setHeartRate({ heartRate: latest, samples });
          setHeartStatus(`HR OK: ${latest} bpm`);
        } else {
          setHeartRate(null);
          setHeartStatus('Heart error: no samples');
        }
      } catch (hrErr) {
        setHeartRate(null);
        setHeartStatus(`Heart error: ${String(hrErr)}`);
        console.log('RAW_HEART_ERROR', hrErr);
      }

      // HRV (demo-style)
      try {
        const hrvNorm = await JstyleService.getHRVDataNormalized();
        console.log('RAW_HRV', hrvNorm);
        const cleaned = hrvNorm.filter(h => (h.sdnn ?? 0) > 0);
        if (cleaned.length > 0) {
          const latest = cleaned[cleaned.length - 1];
          setHRV({ sdnn: latest.sdnn || 0, heartRate: latest.heartRate, stress: latest.stress, timestamp: latest.timestamp });
          const avg = Math.round(cleaned.reduce((s, x) => s + (x.sdnn || 0), 0) / cleaned.length);
          setHRVStatus(`HRV OK: latest ${Math.round(latest.sdnn || 0)} ms · avg ${avg} ms`);
        } else {
          setHRV(null);
          setHRVStatus('HRV error: no samples');
        }
      } catch (hrvErr) {
        setHRV(null);
        setHRVStatus(`HRV error: ${String(hrvErr)}`);
        console.log('RAW_HRV_ERROR', hrvErr);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to fetch sleep');
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchSleep();
  }, [fetchSleep]);

  // Re-fetch when connection becomes available, but only if not already fetching
  useEffect(() => {
    const unsubscribe = UnifiedSmartRingService.onConnectionStateChanged((state) => {
      if (state === 'connected' && !isFetchingRef.current) {
        fetchSleep();
      }
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [fetchSleep]);

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Sleep Test' }} />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Sleep Test Screen</Text>
        <Button title="Refresh Sleep" onPress={fetchSleep} />
        {battery && (
          <Text style={styles.batteryText}>Battery: {battery.battery}%</Text>
        )}
        {!battery && batteryStatus !== '' && (
          <Text style={styles.batteryText}>{batteryStatus}</Text>
        )}
        {heartRate && (
          <View style={styles.hrBox}>
            <Text style={styles.hrTitle}>Heart Rate</Text>
            <Text style={styles.hrValue}>{heartRate.heartRate} bpm</Text>
            <Text style={styles.hrSub}>Samples: {heartRate.samples.length}</Text>
          </View>
        )}
        {!heartRate && heartStatus !== '' && (
          <Text style={styles.batteryText}>{heartStatus}</Text>
        )}
        {hrv && (
          <Text style={styles.batteryText}>HRV (SDNN): {Math.round(hrv.sdnn || 0)} ms</Text>
        )}
        {!hrv && hrvStatus !== '' && (
          <Text style={styles.batteryText}>{hrvStatus}</Text>
        )}
        {loading && (
          <View style={styles.loader}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.loaderText}>Fetching...</Text>
          </View>
        )}
        {error && <Text style={styles.error}>{error}</Text>}
        {sleep && (
          <>
            <GradientInfoCard
              icon={<SleepScoreIcon />}
              title="Sleep Score"
              headerValue={sleep.score}
              headerSubtitle={sleep.timeAsleep}
              showArrow={false}
              gradientStops={[
                { offset: 0, color: '#7100C2', opacity: 1 },
                { offset: 0.55, color: '#7100C2', opacity: 0.2 },
              ]}
              gradientCenter={{ x: 0.51, y: -0.86 }}
              gradientRadii={{ rx: '80%', ry: '300%' }}
            >
              <View style={styles.sleepTimeline}>
                <Text style={styles.timeText}>Bed: {sleep.bedTime.toLocaleTimeString()}</Text>
                <Text style={styles.timeText}>Wake: {sleep.wakeTime.toLocaleTimeString()}</Text>
              </View>
              <View style={styles.sleepTimeline}>
                <Text style={styles.timeText}>Deep {formatMinutes(sleep.totals.deep)}</Text>
                <Text style={styles.timeText}>Light {formatMinutes(sleep.totals.light)}</Text>
                <Text style={styles.timeText}>REM {formatMinutes(sleep.totals.rem)}</Text>
                <Text style={styles.timeText}>Awake {formatMinutes(sleep.totals.awake)}</Text>
              </View>
            </GradientInfoCard>

            {sleep.segments.length > 0 && (
              <GradientInfoCard
                icon={<SleepScoreIcon />}
                title="Sleep Stages"
                showArrow={false}
                gradientStops={[
                  { offset: 0, color: '#7100C2', opacity: 1 },
                  { offset: 0.55, color: '#7100C2', opacity: 0.2 },
                ]}
                gradientCenter={{ x: 0.51, y: -0.86 }}
                gradientRadii={{ rx: '80%', ry: '300%' }}
              >
                <SleepHypnogram
                  segments={sleep.segments}
                  bedTime={sleep.segments[0].startTime}
                  wakeTime={sleep.segments[sleep.segments.length - 1].endTime}
                />
              </GradientInfoCard>
            )}
          </>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: '#0B0B14',
  },
  title: {
    color: '#fff',
    fontSize: fontSize.lg,
    fontFamily: fontFamily.demiBold,
  },
  loader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  loaderText: {
    color: '#fff',
  },
  error: {
    color: '#f88',
  },
  sleepTimeline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  timeText: {
    color: '#fff',
    fontSize: fontSize.sm,
  },
  chartSection: {
    marginTop: spacing.md,
  },
  batteryText: {
    color: '#fff',
    marginTop: spacing.xs,
  },
  hrBox: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: spacing.sm,
    borderRadius: 8,
  },
  hrTitle: {
    color: '#fff',
    fontSize: fontSize.sm,
  },
  hrValue: {
    color: '#fff',
    fontSize: fontSize.lg,
    fontFamily: fontFamily.demiBold,
  },
  hrSub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: fontSize.xs,
  },
});
