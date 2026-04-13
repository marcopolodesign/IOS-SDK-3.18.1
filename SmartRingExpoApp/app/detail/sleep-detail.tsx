import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { DetailStatRow } from '../../src/components/detail/DetailStatRow';
import { DetailPageHeader } from '../../src/components/detail/DetailPageHeader';
import { MetricsGrid } from '../../src/components/detail/MetricsGrid';
import { TrendBarChart } from '../../src/components/detail/TrendBarChart';
import { SleepHypnogram } from '../../src/components/home/SleepHypnogram';
import { useMetricHistory, buildDayNavigatorLabels } from '../../src/hooks/useMetricHistory';
import type { DaySleepData } from '../../src/hooks/useMetricHistory';
import { useHomeDataContext } from '../../src/context/HomeDataContext';
import { spacing, fontSize, fontFamily } from '../../src/theme/colors';

const DAY_ENTRIES = buildDayNavigatorLabels(30);

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
  const d0 = new Date();
  const today = `${d0.getFullYear()}-${String(d0.getMonth() + 1).padStart(2, '0')}-${String(d0.getDate()).padStart(2, '0')}`;
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

// ─── Recommended sleep stage ranges (from customSleepAnalysis.ts THRESHOLDS) ──
const STAGE_RANGES: Record<string, { min: number; max: number }> = {
  deep:  { min: 13, max: 23 },
  rem:   { min: 20, max: 25 },
  light: { min: 50, max: 65 },
  awake: { min: 0,  max: 5 },
};

function SleepStageBar({
  label,
  minutes,
  totalMinutes,
  color,
  stage,
}: {
  label: string;
  minutes: number;
  totalMinutes: number;
  color: string;
  stage: keyof typeof STAGE_RANGES;
}) {
  const pct = totalMinutes > 0 ? (minutes / totalMinutes) * 100 : 0;
  const range = STAGE_RANGES[stage];
  const fillW = Math.min(100, pct);
  const inRange = pct >= range.min && pct <= range.max;
  const targetLabel = range.max === 0 ? `< ${range.max + 5}%` : `${range.min}–${range.max}%`;

  return (
    <View style={stageStyles.row}>
      <View style={stageStyles.header}>
        <View style={[stageStyles.dot, { backgroundColor: color }]} />
        <Text style={stageStyles.label}>{label}</Text>
        <Text style={stageStyles.value}>{minutes} min</Text>
        <View style={stageStyles.pctGroup}>
          <Text style={[stageStyles.pct, { color: inRange ? '#4ADE80' : 'rgba(255,255,255,0.4)' }]}>{Math.round(pct)}%</Text>
          <Text style={stageStyles.target}>target {targetLabel}</Text>
        </View>
      </View>
      <View style={stageStyles.track}>
        <View style={[stageStyles.fill, { width: `${fillW}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const stageStyles = StyleSheet.create({
  row: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    flex: 1,
    color: 'rgba(255,255,255,0.7)',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
  },
  value: {
    color: '#FFFFFF',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.demiBold,
  },
  pctGroup: {
    alignItems: 'flex-end',
    gap: 1,
  },
  pct: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.demiBold,
    textAlign: 'right',
  },
  target: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 9,
    fontFamily: fontFamily.regular,
    textAlign: 'right',
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    borderRadius: 3,
  },
});

export default function SleepDetailScreen() {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Progressive: show last 7 days immediately, extend to 30 silently in background
  const { data, isLoading } = useMetricHistory<DaySleepData>('sleep', { initialDays: 7, fullDays: 30 });
  const homeData = useHomeDataContext();

  const selectedDateKey = DAY_ENTRIES[selectedIndex]?.dateKey;
  // For today, always prefer live ring data — it's fresher than a cached Supabase sync,
  // keeping bedTime/wakeTime in sync with the overview card.
  const todayLive = selectedIndex === 0 && homeData.lastNightSleep.score > 0
    ? buildTodaySleepFromContext(homeData.lastNightSleep)
    : null;
  const dayData = todayLive ?? (selectedDateKey ? data.get(selectedDateKey) : undefined);

  const allScores = useMemo(() =>
    DAY_ENTRIES.map(d => ({
      dateKey: d.dateKey,
      score: (d.dateKey === DAY_ENTRIES[0]?.dateKey && todayLive)
        ? todayLive.score
        : (data.get(d.dateKey)?.score ?? 0),
    })),
    [data, todayLive]
  );

  // Debug logging
  console.log('[SleepDetail] selectedIndex=', selectedIndex, 'selectedDateKey=', selectedDateKey);
  console.log('[SleepDetail] data map keys=', Array.from(data.keys()));
  console.log('[SleepDetail] isLoading=', isLoading, 'dayData=', dayData ? `score=${dayData.score} total=${dayData.timeAsleepMinutes}min` : null);
  if (selectedIndex !== 0) {
    console.log('[SleepDetail] RAW data.get(selectedDateKey)=', data.get(selectedDateKey));
  }

  const efficiency = dayData && dayData.timeAsleepMinutes > 0
    ? Math.round(((dayData.deepMin + dayData.lightMin + dayData.remMin) / dayData.timeAsleepMinutes) * 100)
    : null;

  const scoreColor = sleepScoreColor(dayData?.score ?? 0);

  return (
    <View style={styles.container}>
      {/* Gradient zone: header + trend chart — starts from the very top of the screen */}
      <View style={styles.gradientZone}>
        {/* Purple radial gradient backdrop */}
        <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
          <Defs>
            <RadialGradient
              id="sleepGrad"
              cx="51%"
              cy="-86%"
              rx="80%"
              ry="300%"
            >
              <Stop offset="0%" stopColor="#7100C2" stopOpacity={0.85} />
              <Stop offset="55%" stopColor="#7100C2" stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="sleepGrad2" cx="15%" cy="20%" rx="50%" ry="65%">
              <Stop offset="0%" stopColor="#3B0764" stopOpacity={0.6} />
              <Stop offset="100%" stopColor="#3B0764" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100" height="100" fill="url(#sleepGrad)" />
          <Rect x="0" y="0" width="100" height="100" fill="url(#sleepGrad2)" />
        </Svg>

        <DetailPageHeader title="Sleep" marginBottom={spacing.md} />

        <TrendBarChart
          dayEntries={DAY_ENTRIES}
          values={allScores.map(s => ({ dateKey: s.dateKey, value: s.score }))}
          selectedIndex={selectedIndex}
          onSelectDay={setSelectedIndex}
          colorFn={sleepScoreColor}
          maxValue={100}
          guideLines={[25, 50, 75]}
        />
      </View>

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
            <View style={styles.headlineOuter}>
              <View style={styles.headlineRow}>
                <Text style={[styles.headlineScore, { color: scoreColor }]}>{dayData.score}</Text>
                <Text style={styles.headlineLabel}>Sleep Score</Text>
              </View>
              <View style={styles.badgeRow}>
                <View style={[styles.badge, { backgroundColor: `${scoreColor}22`, borderColor: `${scoreColor}55` }]}>
                  <Text style={[styles.badgeText, { color: scoreColor }]}>
                    {dayData.score >= 80 ? 'Excellent' : dayData.score >= 60 ? 'Fair' : 'Poor'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Hypnogram (unified with naps for today) */}
            {dayData.segments.length > 0 && dayData.bedTime && dayData.wakeTime && (() => {
              // For today, use pre-built unified sessions from data layer
              const allSessions = selectedIndex === 0 ? homeData.unifiedSleepSessions : [];
              const hasNaps = allSessions.length > 1;
              return (
                <View style={styles.hypnogramWrapper}>
                  <SleepHypnogram
                    segments={dayData.segments as any}
                    bedTime={dayData.bedTime}
                    wakeTime={dayData.wakeTime}
                    sessions={hasNaps ? allSessions : undefined}
                  />
                </View>
              );
            })()}

            {/* Sleep stages with range bars */}
            <View style={styles.statsContainer}>
              <DetailStatRow title="Total Sleep" value={dayData.timeAsleep} />
              <SleepStageBar label="Deep" minutes={dayData.deepMin} totalMinutes={dayData.timeAsleepMinutes} color="#7C6CC0" stage="deep" />
              <SleepStageBar label="REM" minutes={dayData.remMin} totalMinutes={dayData.timeAsleepMinutes} color="#60A5FA" stage="rem" />
              <SleepStageBar label="Light" minutes={dayData.lightMin} totalMinutes={dayData.timeAsleepMinutes} color="#93C5FD" stage="light" />
              <SleepStageBar label="Awake" minutes={dayData.awakeMin} totalMinutes={dayData.timeAsleepMinutes} color="#F87171" stage="awake" />
            </View>

            {/* Metrics grid */}
            <MetricsGrid metrics={[
              { label: 'Sleep Efficiency', value: efficiency !== null ? `${efficiency}%` : '--' },
              { label: 'Bed Time', value: formatTime(dayData.bedTime) },
              { label: 'Wake Time', value: formatTime(dayData.wakeTime) },
              { label: 'Resting HR', value: dayData.restingHR > 0 ? `${dayData.restingHR}` : '--', unit: dayData.restingHR > 0 ? 'bpm' : undefined },
            ]} />

            {/* Nap Stats (today only) */}
            {selectedIndex === 0 && homeData.todayNaps.length > 0 && (
              <View style={styles.statsContainer}>
                <DetailStatRow title="Naps" value={`${homeData.todayNaps.length}`} />
                <DetailStatRow title="Total Nap Time" value={`${homeData.totalNapMinutesToday} min`} />
                {homeData.todayNaps.map((nap, i) => (
                  <DetailStatRow
                    key={nap.id}
                    title={`Nap ${homeData.todayNaps.length > 1 ? i + 1 : ''}`}
                    value={`${formatTime(new Date(nap.startTime))} – ${formatTime(new Date(nap.endTime))}`}
                  />
                ))}
              </View>
            )}

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
  gradientZone: {
    overflow: 'hidden',
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 60 },
  loadingContainer: { flex: 1, alignItems: 'center', paddingTop: 80, gap: spacing.md },
  loadingText: { color: 'rgba(255,255,255,0.4)', fontSize: fontSize.sm, fontFamily: fontFamily.regular },
  emptyContainer: { flex: 1, alignItems: 'center', paddingTop: 80, gap: spacing.sm },
  emptyText: { color: 'rgba(255,255,255,0.7)', fontSize: fontSize.md, fontFamily: fontFamily.demiBold },
  emptySubtext: { color: 'rgba(255,255,255,0.4)', fontSize: fontSize.sm, fontFamily: fontFamily.regular, textAlign: 'center', paddingHorizontal: spacing.xl },
  headlineOuter: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  headlineRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  headlineScore: { fontSize: 72, fontFamily: fontFamily.regular, lineHeight: 0 },
  headlineLabel: { color: '#FFFFFF', fontSize: 24, fontFamily: fontFamily.demiBold, marginBottom: 12 },
  badgeRow: { flexDirection: 'row', alignSelf: 'flex-start' },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 12, fontFamily: fontFamily.demiBold, textTransform: 'uppercase' },
  hypnogramWrapper: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: 8,
    overflow: 'hidden',
  },
  statsContainer: {
    marginHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  insightBlock: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(113,0,194,0.3)',
  },
  insightText: { color: 'rgba(255,255,255,0.75)', fontSize: fontSize.sm, fontFamily: fontFamily.regular, lineHeight: 22 },
});
