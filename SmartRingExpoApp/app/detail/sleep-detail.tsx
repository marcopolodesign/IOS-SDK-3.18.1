import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DayNavigator } from '../../src/components/detail/DayNavigator';
import { DetailStatRow } from '../../src/components/detail/DetailStatRow';
import { SleepHypnogram } from '../../src/components/home/SleepHypnogram';
import { useMetricHistory, buildDayNavigatorLabels } from '../../src/hooks/useMetricHistory';
import type { DaySleepData } from '../../src/hooks/useMetricHistory';
import { useHomeDataContext } from '../../src/context/HomeDataContext';
import { spacing, fontSize, fontFamily } from '../../src/theme/colors';

const DAY_ENTRIES = buildDayNavigatorLabels(7);

function sleepScoreColor(score: number): string {
  if (score >= 80) return '#4ADE80';
  if (score >= 60) return '#FFD700';
  return '#FF6B6B';
}

function sleepInsight(data: DaySleepData | undefined): string {
  if (!data) return 'Sync your ring to see sleep insights.';
  const deepPct = data.timeAsleepMinutes > 0
    ? Math.round((data.deepMin / data.timeAsleepMinutes) * 100)
    : 0;
  if (data.score >= 80) return `Excellent sleep! Deep sleep was ${deepPct}% of your night — great for physical recovery.`;
  if (data.score >= 60) return `Moderate sleep quality. Increasing deep sleep (currently ${deepPct}%) can improve recovery.`;
  return `Sleep quality was low. Aim for a consistent bedtime and limit screens before bed.`;
}

function formatTime(date: Date | null): string {
  if (!date) return '--';
  const h = date.getHours();
  const m = date.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m} ${ampm}`;
}

function buildTodaySleepFromContext(sleep: ReturnType<typeof useHomeDataContext>['lastNightSleep']): DaySleepData | null {
  if (!sleep || sleep.score === 0) return null;
  const today = new Date().toISOString().split('T')[0];
  // Compute stage minutes from segments
  let deepMin = 0, lightMin = 0, remMin = 0, awakeMin = 0;
  for (const seg of sleep.segments ?? []) {
    const durMin = Math.round((seg.endTime.getTime() - seg.startTime.getTime()) / 60000);
    if (seg.stage === 'deep') deepMin += durMin;
    else if (seg.stage === 'core') lightMin += durMin;
    else if (seg.stage === 'rem') remMin += durMin;
    else awakeMin += durMin;
  }
  return {
    date: today,
    score: sleep.score,
    timeAsleep: sleep.timeAsleep,
    timeAsleepMinutes: sleep.timeAsleepMinutes,
    bedTime: sleep.bedTime ?? null,
    wakeTime: sleep.wakeTime ?? null,
    deepMin,
    lightMin,
    remMin,
    awakeMin,
    segments: (sleep.segments ?? []) as any,
    restingHR: sleep.restingHR ?? 0,
  };
}

export default function SleepDetailScreen() {
  const insets = useSafeAreaInsets();
  const [selectedIndex, setSelectedIndex] = useState(0);

  const { data, isLoading } = useMetricHistory<DaySleepData>('sleep');
  const homeData = useHomeDataContext();

  const selectedDateKey = DAY_ENTRIES[selectedIndex]?.dateKey;
  const todayKey = DAY_ENTRIES[0]?.dateKey;
  const todayFallback = selectedIndex === 0 && !data.get(todayKey)
    ? buildTodaySleepFromContext(homeData.lastNightSleep)
    : null;
  const dayData = todayFallback ?? (selectedDateKey ? data.get(selectedDateKey) : undefined);

  const efficiency = dayData && dayData.timeAsleepMinutes > 0
    ? Math.round(((dayData.deepMin + dayData.lightMin + dayData.remMin) / dayData.timeAsleepMinutes) * 100)
    : null;

  const scoreColor = sleepScoreColor(dayData?.score ?? 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.backArrow}>{'‹'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Sleep</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Day Navigator */}
      <DayNavigator
        days={DAY_ENTRIES.map(d => d.label)}
        selectedIndex={selectedIndex}
        onSelectDay={setSelectedIndex}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="rgba(255,255,255,0.6)" />
            <Text style={styles.loadingText}>Loading history…</Text>
          </View>
        ) : !dayData ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No sleep data for this day</Text>
            <Text style={styles.emptySubtext}>Sync your ring to record sleep automatically</Text>
          </View>
        ) : (
          <>
            {/* Headline score */}
            <View style={styles.headlineRow}>
              <Text style={[styles.headlineScore, { color: scoreColor }]}>{dayData.score}</Text>
              <View style={styles.headlineRight}>
                <Text style={styles.headlineLabel}>SLEEP SCORE</Text>
                <View style={[styles.badge, { backgroundColor: `${scoreColor}22`, borderColor: `${scoreColor}55` }]}>
                  <Text style={[styles.badgeText, { color: scoreColor }]}>
                    {dayData.score >= 80 ? 'Excellent' : dayData.score >= 60 ? 'Fair' : 'Poor'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Hypnogram */}
            {dayData.segments.length > 0 && dayData.bedTime && dayData.wakeTime && (
              <View style={styles.hypnogramWrapper}>
                <SleepHypnogram
                  segments={dayData.segments as any}
                  bedTime={dayData.bedTime}
                  wakeTime={dayData.wakeTime}
                />
              </View>
            )}

            {/* Stats */}
            <View style={styles.statsContainer}>
              <DetailStatRow title="Total Sleep" value={dayData.timeAsleep} />
              <DetailStatRow title="Deep Sleep" value={`${dayData.deepMin} min`} accent="#5C4DB1" />
              <DetailStatRow title="REM Sleep" value={`${dayData.remMin} min`} accent="#81D4FA" />
              <DetailStatRow title="Light Sleep" value={`${dayData.lightMin} min`} accent="#42A5F5" />
              <DetailStatRow title="Awake" value={`${dayData.awakeMin} min`} accent="#FF6B6B" />
              {efficiency !== null && (
                <DetailStatRow title="Sleep Efficiency" value={`${efficiency}%`} />
              )}
              <DetailStatRow title="Bed Time" value={formatTime(dayData.bedTime)} />
              <DetailStatRow title="Wake Time" value={formatTime(dayData.wakeTime)} />
              {dayData.restingHR > 0 && (
                <DetailStatRow title="Resting HR" value={`${dayData.restingHR}`} unit="bpm" />
              )}
            </View>

            {/* Insight */}
            <View style={styles.insightBlock}>
              <Text style={styles.insightText}>{sleepInsight(dayData)}</Text>
            </View>
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
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 60 },
  loadingContainer: { flex: 1, alignItems: 'center', paddingTop: 80, gap: spacing.md },
  loadingText: { color: 'rgba(255,255,255,0.4)', fontSize: fontSize.sm, fontFamily: fontFamily.regular },
  emptyContainer: { flex: 1, alignItems: 'center', paddingTop: 80, gap: spacing.sm },
  emptyText: { color: 'rgba(255,255,255,0.7)', fontSize: fontSize.md, fontFamily: fontFamily.demiBold },
  emptySubtext: { color: 'rgba(255,255,255,0.4)', fontSize: fontSize.sm, fontFamily: fontFamily.regular, textAlign: 'center', paddingHorizontal: spacing.xl },
  headlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  headlineScore: { fontSize: 72, fontFamily: fontFamily.regular, lineHeight: 80 },
  headlineRight: { gap: spacing.xs },
  headlineLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 11, fontFamily: fontFamily.regular, textTransform: 'uppercase', letterSpacing: 1 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 12, fontFamily: fontFamily.demiBold },
  hypnogramWrapper: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  statsContainer: {
    marginHorizontal: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  insightBlock: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.md,
    backgroundColor: 'rgba(113,0,194,0.15)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(113,0,194,0.3)',
  },
  insightText: { color: 'rgba(255,255,255,0.75)', fontSize: fontSize.sm, fontFamily: fontFamily.regular, lineHeight: 22 },
});
