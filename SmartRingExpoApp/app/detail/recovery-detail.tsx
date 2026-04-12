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
import { ReadinessTrendChart } from '../../src/components/detail/ReadinessTrendChart';
import { useMetricHistory, buildDayNavigatorLabels } from '../../src/hooks/useMetricHistory';
import type { DaySleepData, DayHRData, DayHRVData, DayActivityData } from '../../src/hooks/useMetricHistory';
import { useHomeDataContext } from '../../src/context/HomeDataContext';
import type { StrainDayBreakdown } from '../../src/hooks/useHomeData';
import { spacing, fontSize, fontFamily } from '../../src/theme/colors';

const DAY_ENTRIES = buildDayNavigatorLabels(30);

// ─── Readiness formula (mirrors useHomeData.ts) ────────────────────────────────

interface DayReadiness {
  score: number;
  sleepScore: number;
  restingHRScore: number;
  strainScore: number; // inverse of activity (used inside readiness formula only)
  restingHR: number;
  sleepLabel: string;
  hrLabel: string;
}

function computeReadiness(
  sleep: DaySleepData | undefined,
  hr: DayHRData | undefined,
  activity: DayActivityData | undefined,
  _hrv: DayHRVData | undefined,
): DayReadiness {
  const sleepScore = sleep?.score ?? 0;
  // Priority: ring overnight HR (overridden in getHR for today) → daily_summaries hr_min → sleep detail
  const restingHR = hr?.restingHR || (activity?.hrMin ?? 0) || sleep?.restingHR || 0;

  // Resting HR score: 90bpm = 0, 40bpm = 100
  const restingHRScore = restingHR > 0
    ? Math.max(0, Math.min(100, Math.round(((90 - restingHR) / 50) * 100)))
    : 50;

  // Steps-based activity load (inverse — high activity yesterday means less fresh today)
  const steps = activity?.steps ?? 0;
  const activityScore = Math.min(100, Math.round((steps / 10000) * 100));
  const strainScore = Math.max(0, 100 - activityScore);

  const score = sleepScore > 0 || restingHR > 0
    ? Math.max(0, Math.min(100, Math.round(
        sleepScore * 0.50 +
        restingHRScore * 0.30 +
        strainScore * 0.20
      )))
    : 0;

  const sleepLabel = sleepScore >= 80 ? 'Excellent' : sleepScore >= 60 ? 'Fair' : sleepScore > 0 ? 'Poor' : '--';
  const hrLabel = restingHR > 0 ? (restingHR < 55 ? 'Excellent' : restingHR < 65 ? 'Good' : restingHR < 75 ? 'Fair' : 'Elevated') : '--';

  return { score, sleepScore, restingHRScore, strainScore, restingHR, sleepLabel, hrLabel };
}

function readinessColor(score: number): string {
  if (score >= 80) return '#4ADE80';
  if (score >= 60) return '#FBBF24';
  if (score > 0) return '#EF4444';
  return 'rgba(255,255,255,0.4)';
}

function readinessLabel(score: number): string {
  if (score >= 80) return 'Optimal';
  if (score >= 60) return 'Fair';
  if (score > 0) return 'Poor';
  return 'No data';
}

// ─── Contribution bar ─────────────────────────────────────────────────────────

function ContributionBar({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <View style={cStyles.contribRow}>
      <Text style={cStyles.contribLabel}>{label}</Text>
      <View style={cStyles.contribBarWrap}>
        <View style={[cStyles.contribBarFill, { width: `${Math.round(pct)}%`, backgroundColor: color }]} />
      </View>
      <Text style={[cStyles.contribValue, { color }]}>{value}</Text>
    </View>
  );
}

const cStyles = StyleSheet.create({
  contribRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 16 },
  contribLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontFamily: fontFamily.regular, width: 90 },
  contribBarWrap: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' },
  contribBarFill: { height: '100%', borderRadius: 3 },
  contribValue: { fontSize: 12, fontFamily: fontFamily.demiBold, width: 32, textAlign: 'right' },
});

// ─── Strain accumulation explainer ────────────────────────────────────────────

function loadColor(load: number): string {
  if (load >= 75) return '#EF4444';
  if (load >= 50) return '#FF6B35';
  if (load >= 25) return '#FBBF24';
  if (load > 0) return '#4ADE80';
  return 'rgba(255,255,255,0.12)';
}

function StrainAccumulationCard({
  strain,
  breakdown,
}: {
  strain: number;
  breakdown: StrainDayBreakdown[];
}) {
  // Build a concise WHY sentence referencing the biggest contributing day(s).
  const whySentence = useMemo(() => {
    if (breakdown.length === 0) return 'Not enough history yet — strain will start accumulating as you sync more days.';

    const contributions = breakdown.map(d => ({ day: d, share: d.load * d.weight }));
    const totalContribution = contributions.reduce((s, c) => s + c.share, 0) || 1;
    // Top-contributing day by (load × weight)
    const top = [...contributions].sort((a, b) => b.share - a.share)[0];
    const topPct = Math.round((top.share / totalContribution) * 100);
    const topLabel = top.day.label.toLowerCase();

    const todayWorkouts = breakdown[0]?.stravaWorkouts ?? [];
    const workoutNames = todayWorkouts.map(w => w.name).slice(0, 2);

    if (strain >= 75) {
      return `Strain is high — ${topLabel} contributed ~${topPct}% of today's load${workoutNames.length ? ` (${workoutNames.join(', ')})` : ''}. Prioritize recovery.`;
    }
    if (strain >= 50) {
      return `Solid cumulative load — ${topLabel} is the biggest driver (~${topPct}%). Training is echoing forward as designed.`;
    }
    if (strain >= 25) {
      return `Moderate strain — ${topLabel} still weighs in at ~${topPct}% thanks to EWMA decay. Good window for quality workouts.`;
    }
    return `Low cumulative load — ${topLabel} is your biggest recent day (~${topPct}%). Body is fresh and ready to push.`;
  }, [strain, breakdown]);

  return (
    <View style={sStyles.card}>
      {/* Header */}
      <View style={sStyles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={sStyles.title}>Strain Accumulation</Text>
          <Text style={sStyles.subtitle}>7-day EWMA · recent days weigh more</Text>
        </View>
        <Text style={[sStyles.bigNumber, { color: loadColor(strain) }]}>{strain}</Text>
      </View>

      {/* Weight bars — each day's bar height = load, opacity = weight share */}
      <View style={sStyles.barsRow}>
        {[...breakdown].reverse().map((day) => {
          const h = Math.max(4, (day.load / 100) * 60);
          const opacity = 0.3 + day.weight * 1.4; // spreads opacity across weights
          return (
            <View key={day.dateKey} style={sStyles.barCol}>
              <View style={sStyles.barTrack}>
                <View
                  style={[
                    sStyles.barFill,
                    {
                      height: h,
                      backgroundColor: loadColor(day.load),
                      opacity: Math.min(1, opacity),
                    },
                  ]}
                />
              </View>
              <Text style={sStyles.barWeight}>{Math.round(day.weight * 100)}%</Text>
            </View>
          );
        })}
      </View>

      {/* Per-day rows */}
      <View style={sStyles.rowsContainer}>
        {breakdown.map((day) => {
          const workoutCount = day.stravaWorkouts.length;
          const topWorkout = day.stravaWorkouts[0];
          return (
            <View key={day.dateKey} style={sStyles.dayRow}>
              <View style={sStyles.dayLeft}>
                <Text style={sStyles.dayLabel}>{day.label}</Text>
                <Text style={sStyles.dayWeightChip}>{Math.round(day.weight * 100)}%</Text>
              </View>
              <View style={sStyles.dayMiddle}>
                {workoutCount > 0 ? (
                  <Text style={sStyles.dayWorkout} numberOfLines={1}>
                    {topWorkout.name}
                    {workoutCount > 1 && ` +${workoutCount - 1}`}
                  </Text>
                ) : (
                  <Text style={sStyles.dayMeta} numberOfLines={1}>
                    {day.activeCalories > 0 ? `${day.activeCalories} kcal` : 'No activity data'}
                  </Text>
                )}
                {day.stravaSufferSum > 0 && (
                  <Text style={sStyles.daySuffer}>suffer {day.stravaSufferSum}</Text>
                )}
              </View>
              <Text style={[sStyles.dayLoad, { color: loadColor(day.load) }]}>{day.load}</Text>
            </View>
          );
        })}
      </View>

      {/* WHY sentence */}
      <Text style={sStyles.whyText}>{whySentence}</Text>

      {/* Formula note */}
      <Text style={sStyles.formulaText}>
        Each day's load (0–100) blends active calories and Strava suffer scores. Today weighs
        ~35%, yesterday ~23%, 2 days ago ~15% — a hard workout echoes forward for ~5 days.
      </Text>
    </View>
  );
}

const sStyles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    color: '#FFFFFF',
    fontSize: fontSize.md,
    fontFamily: fontFamily.demiBold,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontFamily: fontFamily.regular,
    marginTop: 2,
  },
  bigNumber: {
    fontSize: 42,
    fontFamily: fontFamily.regular,
    lineHeight: 46,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    gap: 4,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  barTrack: {
    width: '100%',
    height: 60,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 4,
  },
  barWeight: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 9,
    fontFamily: fontFamily.regular,
  },
  rowsContainer: {
    marginTop: spacing.sm,
    gap: 6,
    paddingVertical: spacing.xs,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  dayLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: 110,
  },
  dayLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontFamily: fontFamily.demiBold,
  },
  dayWeightChip: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontFamily: fontFamily.regular,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  dayMiddle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dayWorkout: {
    flex: 1,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontFamily: fontFamily.regular,
  },
  dayMeta: {
    flex: 1,
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontFamily: fontFamily.regular,
  },
  daySuffer: {
    color: '#FF6B35',
    fontSize: 10,
    fontFamily: fontFamily.demiBold,
    backgroundColor: 'rgba(255,107,53,0.12)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  dayLoad: {
    fontSize: 14,
    fontFamily: fontFamily.demiBold,
    width: 32,
    textAlign: 'right',
  },
  whyText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  formulaText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    fontFamily: fontFamily.regular,
    lineHeight: 16,
    marginTop: 8,
    fontStyle: 'italic',
  },
});

// ─── Insight ───────────────────────────────────────────────────────────────────

function recoveryInsight(r: DayReadiness): string {
  if (r.score === 0) return 'Sync your ring to see your readiness score.';
  if (r.score >= 80) return `Readiness ${r.score} — your body is primed for performance. Sleep quality was ${r.sleepLabel.toLowerCase()} and resting HR of ${r.restingHR}bpm signals solid recovery. Great day to push hard.`;
  if (r.score >= 60) return `Readiness ${r.score} — moderate recovery. Consider training at 70–80% intensity. Focus on quality sleep tonight to rebuild.`;
  return `Readiness ${r.score} — your body is asking for rest. Resting HR (${r.restingHR > 0 ? `${r.restingHR}bpm` : 'unknown'}) and sleep score (${r.sleepScore || 'N/A'}) indicate limited recovery. Prioritize sleep and low-intensity movement today.`;
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function RecoveryDetailScreen() {
  const insets = useSafeAreaInsets();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const homeData = useHomeDataContext();

  // Progressive: 7 days instant, extend to 30 silently in background
  const { data: sleepData, isLoading: sleepLoading } = useMetricHistory<DaySleepData>('sleep', { initialDays: 7, fullDays: 30 });
  const { data: hrData, isLoading: hrLoading } = useMetricHistory<DayHRData>('heartRate', { initialDays: 7, fullDays: 30 });
  const { data: hrvData, isLoading: hrvLoading } = useMetricHistory<DayHRVData>('hrv', { initialDays: 7, fullDays: 30 });
  const { data: activityData, isLoading: actLoading } = useMetricHistory<DayActivityData>('activity', { initialDays: 7, fullDays: 30 });

  const isLoading = sleepLoading || hrLoading || hrvLoading || actLoading;

  const todayKey = DAY_ENTRIES[0]?.dateKey;

  // Build context-based today entries as fallback when Supabase is empty
  const todaySleepFallback: DaySleepData | undefined = !sleepData.get(todayKey) && homeData.lastNightSleep?.score > 0
    ? { date: todayKey, score: homeData.lastNightSleep.score, timeAsleep: homeData.lastNightSleep.timeAsleep,
        timeAsleepMinutes: homeData.lastNightSleep.timeAsleepMinutes, bedTime: homeData.lastNightSleep.bedTime ?? null,
        wakeTime: homeData.lastNightSleep.wakeTime ?? null, deepMin: 0, lightMin: 0, remMin: 0, awakeMin: 0,
        segments: [], restingHR: homeData.lastNightSleep.restingHR ?? 0 }
    : undefined;

  const todayHRFallback: DayHRData | undefined = !hrData.get(todayKey)
    ? (() => {
        // Tier 1: from hrChartData
        const pts = homeData.hrChartData.filter(p => p.heartRate > 0);
        const vals = pts.map(p => p.heartRate);
        if (vals.length > 0) {
          return {
            date: todayKey,
            hourlyPoints: pts.map(p => ({ hour: Math.floor(p.timeMinutes / 60) % 24, heartRate: p.heartRate })),
            restingHR: Math.min(...vals), peakHR: Math.max(...vals),
            avgHR: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
          };
        }
        // Tier 2: from ring's overnight restingHR in lastNightSleep
        const sleepRHR = homeData.lastNightSleep?.restingHR;
        if (sleepRHR && sleepRHR > 0) {
          return { date: todayKey, hourlyPoints: [], restingHR: sleepRHR, peakHR: 0, avgHR: 0 };
        }
        return undefined;
      })()
    : undefined;

  const todayActivityFallback: DayActivityData | undefined = !activityData.get(todayKey) && homeData.activity.steps > 0
    ? { date: todayKey, steps: homeData.activity.steps, distanceM: homeData.activity.distance,
        calories: homeData.activity.calories, sleepTotalMin: null, hrAvg: null, hrMin: null }
    : undefined;

  // Helper to get data for a day, using context fallback for today
  const getSleep = (key: string) => sleepData.get(key) ?? (key === todayKey ? todaySleepFallback : undefined);
  const getHR = (key: string) => {
    const hr = hrData.get(key) ?? (key === todayKey ? todayHRFallback : undefined);
    if (!hr) return undefined;
    // For today, always prefer the ring's overnight restingHR over the
    // daytime-minimum from heart_rate_readings (which can be 80-110bpm during activity).
    if (key === todayKey) {
      const overnightRHR = homeData.lastNightSleep?.restingHR;
      if (overnightRHR && overnightRHR > 0) return { ...hr, restingHR: overnightRHR };
    }
    return hr;
  };
  const getActivity = (key: string) => activityData.get(key) ?? (key === todayKey ? todayActivityFallback : undefined);
  const getHRV = (key: string) => hrvData.get(key);

  // Compute readiness for all 30 days (for trend chart)
  const allScores = useMemo(() =>
    DAY_ENTRIES.map(d => ({
      dateKey: d.dateKey,
      score: computeReadiness(getSleep(d.dateKey), getHR(d.dateKey), getActivity(d.dateKey), getHRV(d.dateKey)).score,
    })),
    [sleepData, hrData, activityData, hrvData, homeData]
  );

  const selectedDateKey = DAY_ENTRIES[selectedIndex]?.dateKey;
  const readiness = useMemo(() => computeReadiness(
    getSleep(selectedDateKey ?? ''),
    getHR(selectedDateKey ?? ''),
    getActivity(selectedDateKey ?? ''),
    getHRV(selectedDateKey ?? ''),
  ), [selectedDateKey, sleepData, hrData, activityData, hrvData, homeData]);

  const hasData = readiness.score > 0;
  const color = readinessColor(readiness.score);
  const label = readinessLabel(readiness.score);

  return (
    <View style={styles.container}>
      {/* Gradient zone: header + trend chart — starts from the very top of the screen */}
      <View style={styles.gradientZone}>
        <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
          <Defs>
            <RadialGradient id="recoveryGrad" cx="51%" cy="-86%" rx="80%" ry="300%">
              <Stop offset="0%" stopColor="#10B981" stopOpacity={0.75} />
              <Stop offset="55%" stopColor="#10B981" stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="recoveryGrad2" cx="85%" cy="15%" rx="45%" ry="60%">
              <Stop offset="0%" stopColor="#065F46" stopOpacity={0.55} />
              <Stop offset="100%" stopColor="#065F46" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100" height="100" fill="url(#recoveryGrad)" />
          <Rect x="0" y="0" width="100" height="100" fill="url(#recoveryGrad2)" />
        </Svg>

        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <BackArrow />
          </TouchableOpacity>
          <Text style={styles.title}>Recovery</Text>
          <View style={styles.headerRight} />
        </View>

        <ReadinessTrendChart
          dayEntries={DAY_ENTRIES}
          scores={allScores}
          selectedIndex={selectedIndex}
          onSelectDay={setSelectedIndex}
        />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={styles.centered}><ActivityIndicator color="rgba(255,255,255,0.6)" /></View>
        ) : !hasData ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No recovery data for this day</Text>
            <Text style={styles.emptySubtext}>Sync your ring to record readiness automatically</Text>
          </View>
        ) : (
          <>
            {/* Headline score */}
            <View style={styles.headlineOuter}>
              <View style={styles.headlineRow}>
                <Text style={[styles.headlineScore, { color }]}>{readiness.score}</Text>
                <Text style={styles.headlineLabel}>Readiness Score</Text>
              </View>
              <View style={styles.badgeRow}>
                <View style={[styles.badge, { backgroundColor: `${color}22`, borderColor: `${color}55` }]}>
                  <Text style={[styles.badgeText, { color }]}>{label}</Text>
                </View>
              </View>
            </View>

            {/* Score Breakdown */}
            <View style={styles.contribContainer}>
              <Text style={styles.contribTitle}>Score Breakdown</Text>
              <ContributionBar
                label="Sleep Quality"
                value={`${readiness.sleepScore || '--'}`}
                pct={readiness.sleepScore}
                color="#8B5CF6"
              />
              <ContributionBar
                label="Resting HR"
                value={`${readiness.restingHRScore}`}
                pct={readiness.restingHRScore}
                color="#3B82F6"
              />
              <ContributionBar
                label="Activity Load"
                value={`${readiness.strainScore}`}
                pct={readiness.strainScore}
                color="#4ADE80"
              />
            </View>

            {/* Strain Accumulation (today only — shows live EWMA breakdown) */}
            {selectedIndex === 0 && homeData.strainBreakdown.length > 0 && (
              <StrainAccumulationCard
                strain={homeData.strain}
                breakdown={homeData.strainBreakdown}
              />
            )}

            {/* Stats */}
            <View style={styles.statsContainer}>
              <DetailStatRow
                title="Readiness"
                value={`${readiness.score}`}
                unit="/100"
                accent={color}
              />
              <DetailStatRow
                title="Sleep Score"
                value={readiness.sleepScore > 0 ? `${readiness.sleepScore}` : '--'}
                unit="/100"
                accent="#8B5CF6"
                badge={readiness.sleepScore > 0 ? { label: readiness.sleepLabel, color: readiness.sleepScore >= 80 ? '#4ADE80' : readiness.sleepScore >= 60 ? '#FBBF24' : '#EF4444' } : undefined}
              />
              <DetailStatRow
                title="Resting HR"
                value={readiness.restingHR > 0 ? `${readiness.restingHR}` : '--'}
                unit="bpm"
                accent="#3B82F6"
                badge={readiness.restingHR > 0 ? { label: readiness.hrLabel, color: readiness.restingHR < 65 ? '#4ADE80' : readiness.restingHR < 75 ? '#FBBF24' : '#EF4444' } : undefined}
              />
              {getHRV(selectedDateKey ?? '') && (
                <DetailStatRow
                  title="HRV (SDNN)"
                  value={`${getHRV(selectedDateKey ?? '')?.sdnn ?? '--'}`}
                  unit="ms"
                  accent="#A78BFA"
                />
              )}
              {selectedIndex === 0 && homeData.strain > 0 && (
                <DetailStatRow
                  title="Strain (7d EWMA)"
                  value={`${homeData.strain}`}
                  unit="/100"
                  accent="#FF6B35"
                />
              )}
              <DetailStatRow
                title="Recommended"
                value={readiness.score >= 80 ? 'High Intensity' : readiness.score >= 60 ? 'Moderate' : 'Rest / Recover'}
              />
            </View>

            <View style={styles.insightBlock}>
              <Text style={styles.insightText}>{recoveryInsight(readiness)}</Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  gradientZone: { overflow: 'hidden' },
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
  centered: { flex: 1, alignItems: 'center', paddingTop: 80 },
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
  contribContainer: { marginHorizontal: spacing.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 16, paddingVertical: spacing.sm, marginBottom: spacing.md },
  contribTitle: { color: 'rgba(255,255,255,0.45)', fontSize: 11, fontFamily: fontFamily.regular, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: 16, marginBottom: 8 },
  statsContainer: { marginHorizontal: spacing.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 16, overflow: 'hidden', marginBottom: spacing.md },
  insightBlock: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
  },
  insightText: { color: 'rgba(255,255,255,0.75)', fontSize: fontSize.sm, fontFamily: fontFamily.regular, lineHeight: 22 },
});
