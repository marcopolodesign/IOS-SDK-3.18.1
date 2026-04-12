import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Rect } from 'react-native-svg';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackArrow } from '../../src/components/detail/BackArrow';
import { useMetricHistory, buildDayNavigatorLabels } from '../../src/hooks/useMetricHistory';
import type {
  DaySleepData,
  DayHRData,
  DayHRVData,
  DaySpO2Data,
  DayTemperatureData,
  DayActivityData,
} from '../../src/hooks/useMetricHistory';
import { useBaselineMode } from '../../src/context/BaselineModeContext';
import { useHomeDataContext } from '../../src/context/HomeDataContext';
import { spacing, fontSize, fontFamily } from '../../src/theme/colors';

const DAY_ENTRIES = buildDayNavigatorLabels(7);
const SCREEN_WIDTH = Dimensions.get('window').width;
const TREND_W = SCREEN_WIDTH - spacing.md * 2 - 32;
const TREND_H = 48;
const T_PAD = 6;

// ─── Mini trend bars ──────────────────────────────────────────────────────────

function MiniTrendBars({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  const barW = (TREND_W - T_PAD * 2) / values.length - 2;

  return (
    <Svg width={TREND_W} height={TREND_H}>
      {values.map((v, i) => {
        const barH = Math.max(3, (v / max) * (TREND_H - T_PAD * 2));
        const x = T_PAD + i * ((TREND_W - T_PAD * 2) / values.length);
        const y = TREND_H - T_PAD - barH;
        return (
          <Rect
            key={i}
            x={x + 1}
            y={y}
            width={barW}
            height={barH}
            fill={v > 0 ? 'rgba(107,142,255,0.6)' : 'rgba(255,255,255,0.08)'}
            rx={2}
          />
        );
      })}
    </Svg>
  );
}

// ─── Metric card ──────────────────────────────────────────────────────────────

function MetricCard({
  accentColor,
  label,
  currentValue,
  unit,
  avgValue,
  avgLabel,
  progress,
  required,
  trendValues,
  isReady,
}: {
  accentColor: string;
  label: string;
  currentValue: string;
  unit?: string;
  avgValue?: string;
  avgLabel: string;
  progress: number;
  required: number;
  trendValues: number[];
  isReady: boolean;
}) {
  return (
    <LinearGradient
      colors={[`${accentColor}26`, `${accentColor}08`]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.metricCard}
    >
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
      <View style={styles.cardInner}>
        {/* Header row */}
        <View style={styles.cardHeader}>
          <Text style={styles.metricLabel}>{label}</Text>
          {isReady ? (
            <View style={[styles.readyBadge, { backgroundColor: `${accentColor}22`, borderColor: `${accentColor}55` }]}>
              <Text style={[styles.readyBadgeText, { color: accentColor }]}>Ready</Text>
            </View>
          ) : (
            <Text style={styles.progressText}>{progress}/{required} nights</Text>
          )}
        </View>

        {/* Values row */}
        <View style={styles.valuesRow}>
          <View>
            <Text style={styles.valueLabel}>Current</Text>
            <View style={styles.valueRow}>
              <Text style={styles.valueText}>{currentValue}</Text>
              {unit && <Text style={styles.unitText}> {unit}</Text>}
            </View>
          </View>
          {avgValue !== undefined && (
            <View style={styles.avgBlock}>
              <Text style={styles.valueLabel}>{avgLabel}</Text>
              <View style={styles.valueRow}>
                <Text style={[styles.valueText, { color: accentColor }]}>{avgValue}</Text>
                {unit && <Text style={styles.unitText}> {unit}</Text>}
              </View>
            </View>
          )}
        </View>

        {/* 7-day trend */}
        {trendValues.some(v => v > 0) && (
          <View style={styles.trendContainer}>
            <Text style={styles.trendLabel}>7-Day Trend</Text>
            <MiniTrendBars values={trendValues} />
          </View>
        )}
      </View>
    </LinearGradient>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function avg(nums: number[]): number {
  const valid = nums.filter(n => n > 0);
  if (valid.length === 0) return 0;
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
}

function fmtAvg(n: number): string {
  return n > 0 ? `${n}` : '--';
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function BaselineDetailScreen() {
  const insets = useSafeAreaInsets();
  const baseline = useBaselineMode();
  const homeData = useHomeDataContext();

  const { data: sleepData, isLoading: sleepLoading } = useMetricHistory<DaySleepData>('sleep');
  const { data: hrData, isLoading: hrLoading } = useMetricHistory<DayHRData>('heartRate');
  const { data: hrvData, isLoading: hrvLoading } = useMetricHistory<DayHRVData>('hrv');
  const { data: spo2Data, isLoading: spo2Loading } = useMetricHistory<DaySpO2Data>('spo2');
  const { data: tempData, isLoading: tempLoading } = useMetricHistory<DayTemperatureData>('temperature');
  const { data: actData, isLoading: actLoading } = useMetricHistory<DayActivityData>('activity');

  const isLoading = sleepLoading || hrLoading || hrvLoading || spo2Loading || tempLoading || actLoading;

  // Build ordered day keys (oldest → newest for trend bars left→right)
  const dayKeys = useMemo(() => [...DAY_ENTRIES].reverse().map(d => d.dateKey), []);

  const sleepScores = useMemo(() => dayKeys.map(k => sleepData.get(k)?.score ?? 0), [dayKeys, sleepData]);
  const hrValues = useMemo(() => dayKeys.map(k => hrData.get(k)?.restingHR ?? 0), [dayKeys, hrData]);
  const hrvValues = useMemo(() => dayKeys.map(k => hrvData.get(k)?.sdnn ?? 0), [dayKeys, hrvData]);
  const spo2Values = useMemo(() => dayKeys.map(k => spo2Data.get(k)?.avg ?? 0), [dayKeys, spo2Data]);
  const tempValues = useMemo(() => dayKeys.map(k => tempData.get(k)?.avg ?? 0), [dayKeys, tempData]);
  const stepsValues = useMemo(() => dayKeys.map(k => actData.get(k)?.steps ?? 0), [dayKeys, actData]);

  const avgSleep = avg(sleepScores);
  const avgHR = avg(hrValues);
  const avgHRV = avg(hrvValues);
  const avgSpO2 = avg(spo2Values);
  const avgSteps = avg(stepsValues);
  const validTemps = tempValues.filter(v => v > 0);
  const avgTemp = validTemps.length > 0 ? (validTemps.reduce((a, b) => a + b, 0) / validTemps.length).toFixed(1) : '--';

  // Most recent available day (newest → oldest)
  const recentDayKeys = useMemo(() => [...dayKeys].reverse(), [dayKeys]);

  const currentSleep = homeData.sleepScore > 0 ? `${homeData.sleepScore}` : '--';
  const currentHR = homeData.lastNightSleep?.restingHR > 0 ? `${homeData.lastNightSleep.restingHR}` : '--';

  // HRV: prefer live ring value, fall back to most recent Supabase entry
  const recentHRVEntry = recentDayKeys.find(k => (hrvData.get(k)?.sdnn ?? 0) > 0);
  const recentHRV = recentHRVEntry ? hrvData.get(recentHRVEntry)!.sdnn! : 0;
  const currentHRV = homeData.hrvSdnn > 0
    ? `${Math.round(homeData.hrvSdnn)}`
    : recentHRV > 0 ? `${Math.round(recentHRV)}` : '--';

  const currentSpO2 = homeData.todayVitals?.lastSpo2 ? `${homeData.todayVitals.lastSpo2}` : '--';
  const currentTemp = homeData.todayVitals?.temperatureC ? `${homeData.todayVitals.temperatureC.toFixed(1)}` : '--';

  // Activity: prefer live ring value, fall back to most recent daily_summaries entry
  const recentActEntry = recentDayKeys.find(k => (actData.get(k)?.steps ?? 0) > 0);
  const recentSteps = recentActEntry ? actData.get(recentActEntry)!.steps : 0;
  const currentSteps = homeData.activity?.steps > 0
    ? `${homeData.activity.steps.toLocaleString()}`
    : recentSteps > 0 ? `${recentSteps.toLocaleString()}` : '--';

  const m = baseline.metrics;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <BackArrow />
        </TouchableOpacity>
        <Text style={styles.title}>Your Baseline</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Overall progress bar */}
      <View style={styles.overallBar}>
        <View style={styles.overallTrack}>
          <View style={[styles.overallFill, { width: `${Math.round(baseline.overallProgress * 100)}%` }]} />
        </View>
        <Text style={styles.overallPct}>{Math.round(baseline.overallProgress * 100)}% complete</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator color="rgba(255,255,255,0.6)" />
          </View>
        ) : (
          <>
            <MetricCard
              accentColor="#6B8EFF"
              label="Sleep"
              currentValue={currentSleep}
              unit="/100"
              avgValue={fmtAvg(avgSleep)}
              avgLabel="7-day avg"
              progress={m.sleep.current}
              required={m.sleep.required}
              trendValues={sleepScores}
              isReady={m.sleep.ready}
            />
            <MetricCard
              accentColor="#FF6B6B"
              label="Heart Rate"
              currentValue={currentHR}
              unit="bpm"
              avgValue={fmtAvg(avgHR)}
              avgLabel="Resting avg"
              progress={m.heartRate.current}
              required={m.heartRate.required}
              trendValues={hrValues}
              isReady={m.heartRate.ready}
            />
            <MetricCard
              accentColor="#C4FF6B"
              label="HRV"
              currentValue={currentHRV}
              unit="ms"
              avgValue={fmtAvg(avgHRV)}
              avgLabel="SDNN avg"
              progress={m.hrv.current}
              required={m.hrv.required}
              trendValues={hrvValues}
              isReady={m.hrv.ready}
            />
            <MetricCard
              accentColor="#6BFFF5"
              label="Temperature"
              currentValue={currentTemp}
              unit="°C"
              avgValue={avgTemp}
              avgLabel="7-day avg"
              progress={m.temperature.current}
              required={m.temperature.required}
              trendValues={tempValues.map(v => v > 0 ? Math.round((v - 35) * 10) : 0)}
              isReady={m.temperature.ready}
            />
            <MetricCard
              accentColor="#B16BFF"
              label="Blood Oxygen"
              currentValue={currentSpO2}
              unit="%"
              avgValue={fmtAvg(avgSpO2)}
              avgLabel="SpO₂ avg"
              progress={m.spo2.current}
              required={m.spo2.required}
              trendValues={spo2Values.map(v => v > 0 ? v - 90 : 0)}
              isReady={m.spo2.ready}
            />
            <MetricCard
              accentColor="#FFB84D"
              label="Activity"
              currentValue={currentSteps}
              unit="steps"
              avgValue={avgSteps > 0 ? avgSteps.toLocaleString() : '--'}
              avgLabel="Daily avg"
              progress={m.activity.current}
              required={m.activity.required}
              trendValues={stepsValues.map(v => v > 0 ? Math.round(v / 100) : 0)}
              isReady={m.activity.ready}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backBtn: { padding: spacing.xs },
  backArrow: { color: '#FFFFFF', fontSize: 28, fontFamily: fontFamily.regular },
  title: { color: '#FFFFFF', fontSize: fontSize.lg, fontFamily: fontFamily.demiBold },
  headerRight: { width: 40 },
  overallBar: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: 6,
  },
  overallTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  overallFill: {
    height: '100%',
    backgroundColor: '#6B8EFF',
    borderRadius: 2,
  },
  overallPct: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.md, paddingBottom: 60, gap: spacing.sm },
  centered: { flex: 1, alignItems: 'center', paddingTop: 80 },
  metricCard: {
    borderRadius: 16,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  accentBar: {
    width: 3,
  },
  cardInner: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontFamily: fontFamily.regular,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  readyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  readyBadgeText: {
    fontSize: 11,
    fontFamily: fontFamily.demiBold,
  },
  progressText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
  },
  valuesRow: {
    flexDirection: 'row',
    gap: spacing.xl,
  },
  avgBlock: {},
  valueLabel: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    marginBottom: 2,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  valueText: {
    color: '#FFFFFF',
    fontSize: fontSize.lg,
    fontFamily: fontFamily.demiBold,
  },
  unitText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
  },
  trendContainer: {
    gap: 6,
  },
  trendLabel: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});
