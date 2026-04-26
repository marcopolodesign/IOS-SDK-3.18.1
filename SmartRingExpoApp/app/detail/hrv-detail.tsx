import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  interpolateColor,
  Extrapolation,
  FadeIn,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

const COLLAPSE_END = 80;
import { DetailStatRow } from '../../src/components/detail/DetailStatRow';
import { DetailPageHeader } from '../../src/components/detail/DetailPageHeader';
import { MetricsGrid } from '../../src/components/detail/MetricsGrid';
import { TrendBarChart } from '../../src/components/detail/TrendBarChart';
import { useMetricHistory, buildDayNavigatorLabels } from '../../src/hooks/useMetricHistory';
import type { DayHRVData } from '../../src/hooks/useMetricHistory';
import { useHomeDataContext } from '../../src/context/HomeDataContext';
import { spacing, fontSize, fontFamily } from '../../src/theme/colors';

const DAY_ENTRIES = buildDayNavigatorLabels(30);

function sdnnColor(sdnn: number | null): string {
  if (!sdnn) return 'rgba(255,255,255,0.4)';
  if (sdnn >= 50) return '#4ADE80';
  if (sdnn >= 30) return '#FBBF24';
  return '#EF4444';
}

function hrvInsight(d: DayHRVData | undefined): string {
  if (!d || d.sdnn === null) return 'Sync your ring to see HRV insights.';
  if (d.sdnn >= 50) return `Strong HRV of ${d.sdnn}ms — your nervous system is well-recovered. A great day to push hard in training.`;
  if (d.sdnn >= 30) return `Moderate HRV of ${d.sdnn}ms. Focus on quality sleep and manage stress. Opt for lighter activity today.`;
  return `Low HRV of ${d.sdnn}ms indicates elevated stress or poor recovery. Prioritize rest, hydration, and breathwork.`;
}

function buildTodayHRVFromContext(hrvSdnn: number): DayHRVData | null {
  if (!hrvSdnn || hrvSdnn === 0) return null;
  const d0 = new Date();
  const today = `${d0.getFullYear()}-${String(d0.getMonth() + 1).padStart(2, '0')}-${String(d0.getDate()).padStart(2, '0')}`;
  const sdnn = Math.round(hrvSdnn);
  return {
    date: today,
    sdnn,
    rmssd: null,
    pnn50: null,
    lf: null,
    hf: null,
    lfHfRatio: null,
    heartRate: null,
    stressLabel: sdnn >= 50 ? 'Low' : sdnn >= 30 ? 'Moderate' : 'High',
    recoveryLabel: sdnn >= 50 ? 'Optimal' : sdnn >= 30 ? 'Fair' : 'Poor',
  };
}

export default function HRVDetailScreen() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { data, isLoading } = useMetricHistory<DayHRVData>('hrv', { initialDays: 7, fullDays: 30 });
  const homeData = useHomeDataContext();

  const selectedDateKey = DAY_ENTRIES[selectedIndex]?.dateKey;
  const todayKey = DAY_ENTRIES[0]?.dateKey;
  const todayFallback = selectedIndex === 0 && !data.get(todayKey)
    ? buildTodayHRVFromContext(homeData.hrvSdnn)
    : null;
  const dayData = todayFallback ?? (selectedDateKey ? data.get(selectedDateKey) : undefined);

  const allValues = useMemo(() =>
    DAY_ENTRIES.map(d => ({
      dateKey: d.dateKey,
      sdnn: (d.dateKey === todayKey && todayFallback)
        ? (todayFallback.sdnn ?? 0)
        : (data.get(d.dateKey)?.sdnn ?? 0),
    })),
    [data, todayFallback]
  );

  const color = sdnnColor(dayData?.sdnn ?? null);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({ onScroll: (e) => { scrollY.value = e.contentOffset.y; } });
  const numberAnimStyle = useAnimatedStyle(() => ({
    fontSize: interpolate(scrollY.value, [0, COLLAPSE_END], [44, 28], Extrapolation.CLAMP),
    lineHeight: interpolate(scrollY.value, [0, COLLAPSE_END], [44, 28], Extrapolation.CLAMP),
    color: interpolateColor(scrollY.value, [0, COLLAPSE_END], [color, '#FFFFFF']),
  }));
  const chipSlideStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(scrollY.value, [0, COLLAPSE_END], [30, 0], Extrapolation.CLAMP) }],
    opacity: interpolate(scrollY.value, [0, COLLAPSE_END], [0, 1], Extrapolation.CLAMP),
  }));
  const headlineHeightStyle = useAnimatedStyle(() => ({
    height: interpolate(scrollY.value, [0, COLLAPSE_END], [80, 44], Extrapolation.CLAMP),
  }));

  return (
    <View style={styles.container}>
      {/* Full-screen gradient background */}
      <Reanimated.View entering={FadeIn.duration(600)} style={styles.gradientBg} pointerEvents="none">
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <RadialGradient id="hrvGrad" cx="51%" cy="-20%" rx="90%" ry="220%">
            <Stop offset="0%" stopColor="#8B5CF6" stopOpacity={1} />
            <Stop offset="70%" stopColor="#8B5CF6" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="hrvGrad2" cx="85%" cy="10%" rx="60%" ry="80%">
            <Stop offset="0%" stopColor="#5B21B6" stopOpacity={0.75} />
            <Stop offset="100%" stopColor="#5B21B6" stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id="hrvFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="40%" stopColor="#0A0A0F" stopOpacity={0} />
            <Stop offset="100%" stopColor="#0A0A0F" stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill="url(#hrvGrad)" />
        <Rect x="0" y="0" width="100" height="100" fill="url(#hrvGrad2)" />
        <Rect x="0" y="0" width="100" height="100" fill="url(#hrvFade)" />
        </Svg>
      </Reanimated.View>

      {/* Gradient zone: header + trend chart */}
      <View style={styles.gradientZone}>
        <DetailPageHeader title="HRV & Stress" marginBottom={spacing.md} />

        <TrendBarChart
          dayEntries={DAY_ENTRIES}
          values={allValues.map(v => ({ dateKey: v.dateKey, value: v.sdnn }))}
          selectedIndex={selectedIndex}
          onSelectDay={setSelectedIndex}
          colorFn={sdnnColor}
          maxValue={80}
          roundedBars={false}
          showValueLabels={false}
          colWidth={32}
          barWidth={22}
          chartHeight={100}
          padV={8}
        />
      </View>

        {!isLoading && dayData && (
        <Reanimated.View style={[styles.headlineSection, headlineHeightStyle]}>
          <View style={styles.headlineLeft}>
            <View style={styles.headlineRow}>
              <Reanimated.Text style={[styles.headlineValue, numberAnimStyle]}>
                {dayData.sdnn ?? '--'}
              </Reanimated.Text>
              <Text style={styles.headlineUnit}>ms SDNN</Text>
            </View>
          </View>
          <View style={styles.chipRight}>
            <Reanimated.View style={[styles.chip, chipSlideStyle, { backgroundColor: `${color}22`, borderColor: `${color}55` }]}>
              <Text style={[styles.chipText, { color }]}>{dayData.recoveryLabel}</Text>
            </Reanimated.View>
          </View>
        </Reanimated.View>
      )}

      <Reanimated.ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} onScroll={scrollHandler}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="rgba(255,255,255,0.6)" />
            <Text style={styles.loadingText}>Loading history…</Text>
          </View>
        ) : !dayData ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No HRV data for this day</Text>
            <Text style={styles.emptySubtext}>Sync your ring to record HRV automatically</Text>
          </View>
        ) : (
          <>

            {/* Metrics grid */}
            <MetricsGrid metrics={[
              { label: 'SDNN', value: dayData.sdnn !== null ? `${dayData.sdnn}` : '--', unit: dayData.sdnn !== null ? 'ms' : undefined },
              { label: 'RMSSD', value: dayData.rmssd !== null ? `${dayData.rmssd}` : '--', unit: dayData.rmssd !== null ? 'ms' : undefined },
              { label: 'pNN50', value: dayData.pnn50 !== null ? `${dayData.pnn50}` : '--', unit: dayData.pnn50 !== null ? '%' : undefined },
              { label: 'Stress Level', value: dayData.stressLabel, accent: dayData.stressLabel === 'Low' ? '#4ADE80' : dayData.stressLabel === 'Moderate' ? '#FBBF24' : '#EF4444' },
            ]} />

            {/* Additional stats */}
            {(dayData.lfHfRatio !== null || dayData.heartRate !== null) && (
              <View style={styles.statsContainer}>
                <DetailStatRow
                  title="Recovery"
                  value={dayData.recoveryLabel}
                  badge={dayData.recoveryLabel === 'Optimal' ? { label: 'Optimal', color: '#4ADE80' }
                    : dayData.recoveryLabel === 'Fair' ? { label: 'Fair', color: '#FBBF24' }
                    : { label: 'Poor', color: '#EF4444' }}
                />
                {dayData.lfHfRatio !== null && (
                  <DetailStatRow title="LF/HF Ratio" value={dayData.lfHfRatio.toFixed(2)} />
                )}
                {dayData.heartRate !== null && (
                  <DetailStatRow title="Heart Rate" value={`${dayData.heartRate}`} unit="bpm" />
                )}
              </View>
            )}

            {/* Insight */}
            <View style={styles.insightBlock}>
              <Text style={styles.insightText}>{hrvInsight(dayData)}</Text>
            </View>
          </>
        )}
      </Reanimated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  gradientBg: { position: 'absolute', top: 0, left: 0, right: 0, height: 480 },
  gradientZone: { paddingBottom: spacing.md },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 60 },
  loadingContainer: { alignItems: 'center', paddingTop: 80, gap: spacing.sm },
  loadingText: { color: 'rgba(255,255,255,0.5)', fontSize: fontSize.sm, fontFamily: fontFamily.regular },
  emptyContainer: { alignItems: 'center', paddingTop: 80, gap: spacing.xs },
  emptyText: { color: 'rgba(255,255,255,0.5)', fontSize: fontSize.sm, fontFamily: fontFamily.regular },
  emptySubtext: { color: 'rgba(255,255,255,0.3)', fontSize: fontSize.xs, fontFamily: fontFamily.regular },
  headlineSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    overflow: 'hidden',
  },
  headlineLeft: { flexDirection: 'column', alignItems: 'flex-start' },
  headlineRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  headlineValue: { fontSize: 44, fontFamily: fontFamily.regular },
  headlineUnit: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontFamily: fontFamily.regular,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  chipRight: { overflow: 'hidden' },
  chip: { paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, borderWidth: 1, alignSelf: 'flex-start' },
  chipText: { fontSize: 10, fontFamily: fontFamily.demiBold, textTransform: 'uppercase' },
  statsContainer: {
    marginHorizontal: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    overflow: 'hidden',
    marginVertical: spacing.sm,
  },
  insightBlock: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.md,
    backgroundColor: 'rgba(139,92,246,0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.3)',
  },
  insightText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    lineHeight: 22,
  },
});
