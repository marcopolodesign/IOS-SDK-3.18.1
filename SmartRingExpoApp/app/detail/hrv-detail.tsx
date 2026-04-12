import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DetailStatRow } from '../../src/components/detail/DetailStatRow';
import { BackArrow } from '../../src/components/detail/BackArrow';
import { HRVTrendChart } from '../../src/components/detail/HRVTrendChart';
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
  const today = new Date().toISOString().split('T')[0];
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
  const insets = useSafeAreaInsets();
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

  return (
    <View style={styles.container}>
      {/* Gradient zone: header + trend chart */}
      <View style={styles.gradientZone}>
        <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
          <Defs>
            <RadialGradient id="hrvGrad" cx="51%" cy="-86%" rx="80%" ry="300%">
              <Stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.85} />
              <Stop offset="55%" stopColor="#8B5CF6" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100" height="100" fill="url(#hrvGrad)" />
        </Svg>

        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <BackArrow />
          </TouchableOpacity>
          <Text style={styles.title}>HRV & Stress</Text>
          <View style={styles.headerRight} />
        </View>

        <HRVTrendChart
          dayEntries={DAY_ENTRIES}
          values={allValues}
          selectedIndex={selectedIndex}
          onSelectDay={setSelectedIndex}
        />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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
            {/* Headline */}
            <View style={styles.headlineRow}>
              <View style={styles.headlineStat}>
                <Text style={[styles.headlineValue, { color }]}>{dayData.sdnn ?? '--'}</Text>
                <Text style={styles.headlineUnit}>ms SDNN</Text>
              </View>
              <View style={styles.headlineDivider} />
              <View style={styles.headlineStat}>
                <Text style={[styles.headlineRecovery, { color }]}>{dayData.recoveryLabel}</Text>
                <Text style={styles.headlineUnit}>RECOVERY</Text>
              </View>
            </View>

            {/* Stats */}
            <View style={styles.statsContainer}>
              <DetailStatRow title="SDNN" value={dayData.sdnn !== null ? `${dayData.sdnn}` : '--'} unit="ms" accent="#8B5CF6" />
              <DetailStatRow title="RMSSD" value={dayData.rmssd !== null ? `${dayData.rmssd}` : '--'} unit="ms" />
              <DetailStatRow title="pNN50" value={dayData.pnn50 !== null ? `${dayData.pnn50}` : '--'} unit="%" />
              <DetailStatRow
                title="Stress Level"
                value={dayData.stressLabel}
                badge={dayData.stressLabel === 'Low' ? { label: 'Low', color: '#4ADE80' }
                  : dayData.stressLabel === 'Moderate' ? { label: 'Moderate', color: '#FBBF24' }
                  : { label: 'High', color: '#EF4444' }}
              />
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

            {/* Insight */}
            <View style={styles.insightBlock}>
              <Text style={styles.insightText}>{hrvInsight(dayData)}</Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  gradientZone: { overflow: 'hidden', paddingBottom: spacing.md },
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
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 60 },
  loadingContainer: { alignItems: 'center', paddingTop: 80, gap: spacing.sm },
  loadingText: { color: 'rgba(255,255,255,0.5)', fontSize: fontSize.sm, fontFamily: fontFamily.regular },
  emptyContainer: { alignItems: 'center', paddingTop: 80, gap: spacing.xs },
  emptyText: { color: 'rgba(255,255,255,0.5)', fontSize: fontSize.sm, fontFamily: fontFamily.regular },
  emptySubtext: { color: 'rgba(255,255,255,0.3)', fontSize: fontSize.xs, fontFamily: fontFamily.regular },
  headlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  headlineStat: { flex: 1, alignItems: 'center', gap: 6 },
  headlineValue: { fontSize: 44, fontFamily: fontFamily.regular },
  headlineRecovery: { fontSize: 28, fontFamily: fontFamily.regular },
  headlineUnit: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontFamily: fontFamily.regular,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  headlineDivider: { width: 1, height: 48, backgroundColor: 'rgba(255,255,255,0.1)' },
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
