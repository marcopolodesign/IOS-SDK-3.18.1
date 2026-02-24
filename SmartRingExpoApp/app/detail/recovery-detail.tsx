import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import Svg, { Circle, Path, G, Line, Text as SvgText, Rect } from 'react-native-svg';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DayNavigator } from '../../src/components/detail/DayNavigator';
import { DetailStatRow } from '../../src/components/detail/DetailStatRow';
import { useMetricHistory, buildDayNavigatorLabels } from '../../src/hooks/useMetricHistory';
import type { DaySleepData, DayHRData, DayHRVData, DayActivityData } from '../../src/hooks/useMetricHistory';
import { useHomeDataContext } from '../../src/context/HomeDataContext';
import { spacing, fontSize, fontFamily } from '../../src/theme/colors';

const DAY_ENTRIES = buildDayNavigatorLabels(7);
const SCREEN_WIDTH = Dimensions.get('window').width;

// ─── Readiness formula (mirrors useHomeData.ts) ────────────────────────────────

interface DayReadiness {
  score: number;
  sleepScore: number;
  restingHRScore: number;
  strainScore: number; // inverse of activity
  restingHR: number;
  sleepLabel: string;
  hrLabel: string;
}

function computeReadiness(
  sleep: DaySleepData | undefined,
  hr: DayHRData | undefined,
  activity: DayActivityData | undefined,
  hrv: DayHRVData | undefined
): DayReadiness {
  const sleepScore = sleep?.score ?? 0;
  const restingHR = hr?.restingHR ?? 0;

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

// ─── Semi-circular readiness gauge ────────────────────────────────────────────

const GAUGE_W = SCREEN_WIDTH - spacing.md * 2 - 32;
const GAUGE_H = GAUGE_W / 2 + 40;
const GCX = GAUGE_W / 2;
const GCY = GAUGE_H - 30;
const GR = GAUGE_W / 2 - 28;
const G_STROKE = 18;

function polarXY(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function semiArcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const s = polarXY(cx, cy, r, startDeg);
  const e = polarXY(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

function ReadinessGauge({ score }: { score: number }) {
  const color = score >= 80 ? '#4ADE80' : score >= 60 ? '#FBBF24' : score > 0 ? '#EF4444' : 'rgba(255,255,255,0.15)';
  const fillEnd = -180 + (score / 100) * 180; // -180° to 0°

  const label = score >= 80 ? 'Optimal' : score >= 60 ? 'Fair' : score > 0 ? 'Poor' : 'No data';

  return (
    <Svg width={GAUGE_W} height={GAUGE_H}>
      {/* Track */}
      <Path d={semiArcPath(GCX, GCY, GR, -180, 0)} stroke="rgba(255,255,255,0.08)" strokeWidth={G_STROKE} fill="none" strokeLinecap="round" />

      {/* Fill */}
      {score > 0 && (
        <Path d={semiArcPath(GCX, GCY, GR, -180, fillEnd)} stroke={color} strokeWidth={G_STROKE} fill="none" strokeLinecap="round" />
      )}

      {/* Score text */}
      <SvgText x={GCX} y={GCY - 16} textAnchor="middle" fill="#FFFFFF" fontSize={52} fontWeight="300">
        {score > 0 ? score : '--'}
      </SvgText>
      <SvgText x={GCX} y={GCY + 8} textAnchor="middle" fill={color} fontSize={14}>
        {label}
      </SvgText>
      <SvgText x={GCX} y={GCY + 26} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize={11}>
        READINESS SCORE
      </SvgText>
    </Svg>
  );
}

// ─── 7-day readiness trend bars ────────────────────────────────────────────────

const TREND_W = SCREEN_WIDTH - spacing.md * 2 - 32;
const TREND_H = 80;
const T_PAD = 10;

function ReadinessTrendBars({
  scores,
  dayEntries,
  selectedIndex,
}: {
  scores: Array<{ dateKey: string; score: number }>;
  dayEntries: Array<{ label: string; dateKey: string }>;
  selectedIndex: number;
}) {
  const reversed = [...dayEntries].reverse();
  const barW = (TREND_W - T_PAD * 2) / reversed.length - 3;
  const selI = reversed.length - 1 - selectedIndex;

  return (
    <Svg width={TREND_W} height={TREND_H}>
      {reversed.map((d, i) => {
        const entry = scores.find(s => s.dateKey === d.dateKey);
        const v = entry?.score ?? 0;
        const barH = Math.max(4, (v / 100) * (TREND_H - T_PAD * 2));
        const x = T_PAD + i * ((TREND_W - T_PAD * 2) / reversed.length);
        const y = TREND_H - T_PAD - barH;
        const isSel = i === selI;
        const color = v >= 80 ? '#4ADE80' : v >= 60 ? '#FBBF24' : v > 0 ? '#EF4444' : 'rgba(255,255,255,0.08)';
        return (
          <Rect key={d.dateKey} x={x + 1.5} y={y} width={barW} height={barH} fill={isSel ? color : `${color}66`} rx={3} />
        );
      })}
    </Svg>
  );
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

  // Load all four metric types simultaneously (each is cached independently)
  const { data: sleepData, isLoading: sleepLoading } = useMetricHistory<DaySleepData>('sleep');
  const { data: hrData, isLoading: hrLoading } = useMetricHistory<DayHRData>('heartRate');
  const { data: hrvData, isLoading: hrvLoading } = useMetricHistory<DayHRVData>('hrv');
  const { data: activityData, isLoading: actLoading } = useMetricHistory<DayActivityData>('activity');

  const isLoading = sleepLoading || hrLoading || hrvLoading || actLoading;

  const todayKey = DAY_ENTRIES[0]?.dateKey;

  // Build context-based today entries as fallback when Supabase is empty
  const todaySleepFallback: DaySleepData | undefined = !sleepData.get(todayKey) && homeData.lastNightSleep?.score > 0
    ? { date: todayKey, score: homeData.lastNightSleep.score, timeAsleep: homeData.lastNightSleep.timeAsleep,
        timeAsleepMinutes: homeData.lastNightSleep.timeAsleepMinutes, bedTime: homeData.lastNightSleep.bedTime ?? null,
        wakeTime: homeData.lastNightSleep.wakeTime ?? null, deepMin: 0, lightMin: 0, remMin: 0, awakeMin: 0,
        segments: [], restingHR: homeData.lastNightSleep.restingHR ?? 0 }
    : undefined;

  const todayHRFallback: DayHRData | undefined = !hrData.get(todayKey) && homeData.hrChartData.length > 0
    ? (() => {
        const pts = homeData.hrChartData.filter(p => p.heartRate > 0);
        const vals = pts.map(p => p.heartRate);
        if (vals.length === 0) return undefined;
        return {
          date: todayKey,
          hourlyPoints: pts.map(p => ({ hour: Math.floor(p.timeMinutes / 60) % 24, heartRate: p.heartRate })),
          restingHR: Math.min(...vals), peakHR: Math.max(...vals),
          avgHR: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
        };
      })()
    : undefined;

  const todayActivityFallback: DayActivityData | undefined = !activityData.get(todayKey) && homeData.activity.steps > 0
    ? { date: todayKey, steps: homeData.activity.steps, distanceM: homeData.activity.distance,
        calories: homeData.activity.calories, sleepTotalMin: null, hrAvg: null }
    : undefined;

  // Helper to get data for a day, using context fallback for today
  const getSleep = (key: string) => sleepData.get(key) ?? (key === todayKey ? todaySleepFallback : undefined);
  const getHR = (key: string) => hrData.get(key) ?? (key === todayKey ? todayHRFallback : undefined);
  const getActivity = (key: string) => activityData.get(key) ?? (key === todayKey ? todayActivityFallback : undefined);
  const getHRV = (key: string) => hrvData.get(key);

  // Compute readiness for all 7 days
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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.backArrow}>{'‹'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Recovery</Text>
        <View style={styles.headerRight} />
      </View>

      <DayNavigator
        days={DAY_ENTRIES.map(d => d.label)}
        selectedIndex={selectedIndex}
        onSelectDay={setSelectedIndex}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={styles.centered}><ActivityIndicator color="rgba(255,255,255,0.6)" /></View>
        ) : (
          <>
            {/* Gauge */}
            <View style={styles.gaugeContainer}>
              <ReadinessGauge score={readiness.score} />
            </View>

            {/* 7-day trend */}
            <View style={styles.trendContainer}>
              <Text style={styles.trendTitle}>7-Day Readiness</Text>
              <ReadinessTrendBars scores={allScores} dayEntries={DAY_ENTRIES} selectedIndex={selectedIndex} />
            </View>

            {/* Contributions */}
            {hasData && (
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
            )}

            {/* Stats */}
            <View style={styles.statsContainer}>
              <DetailStatRow
                title="Readiness"
                value={readiness.score > 0 ? `${readiness.score}` : '--'}
                unit="/100"
                accent={readiness.score >= 80 ? '#4ADE80' : readiness.score >= 60 ? '#FBBF24' : '#EF4444'}
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
                badge={readiness.restingHR > 0 ? { label: readiness.hrLabel, color: readiness.restingHR < 55 ? '#4ADE80' : readiness.restingHR < 65 ? '#4ADE80' : readiness.restingHR < 75 ? '#FBBF24' : '#EF4444' } : undefined}
              />
              {getHRV(selectedDateKey ?? '') && (
                <DetailStatRow
                  title="HRV (SDNN)"
                  value={`${getHRV(selectedDateKey ?? '')?.sdnn ?? '--'}`}
                  unit="ms"
                  accent="#A78BFA"
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  backBtn: { padding: spacing.xs },
  backArrow: { color: '#FFFFFF', fontSize: 28, fontFamily: fontFamily.regular },
  title: { color: '#FFFFFF', fontSize: fontSize.lg, fontFamily: fontFamily.demiBold },
  headerRight: { width: 40 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 60 },
  centered: { flex: 1, alignItems: 'center', paddingTop: 80 },
  gaugeContainer: { alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  trendContainer: { marginHorizontal: spacing.md, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 16, marginBottom: spacing.sm },
  trendTitle: { color: 'rgba(255,255,255,0.45)', fontSize: 11, fontFamily: fontFamily.regular, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  contribContainer: { marginHorizontal: spacing.md, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, paddingVertical: spacing.sm, marginBottom: spacing.sm },
  contribTitle: { color: 'rgba(255,255,255,0.45)', fontSize: 11, fontFamily: fontFamily.regular, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: 16, marginBottom: 8 },
  statsContainer: { marginHorizontal: spacing.md, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, overflow: 'hidden', marginVertical: spacing.sm },
  insightBlock: { marginHorizontal: spacing.lg, marginBottom: spacing.lg, padding: spacing.md, backgroundColor: 'rgba(74,222,128,0.1)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(74,222,128,0.25)' },
  insightText: { color: 'rgba(255,255,255,0.75)', fontSize: fontSize.sm, fontFamily: fontFamily.regular, lineHeight: 22 },
});
