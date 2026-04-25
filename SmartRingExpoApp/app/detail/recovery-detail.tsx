import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  interpolateColor,
  Extrapolation,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, LinearGradient, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { InfoButton } from '../../src/components/common/InfoButton';

const COLLAPSE_END = 80;
import { DetailStatRow } from '../../src/components/detail/DetailStatRow';
import { DetailPageHeader } from '../../src/components/detail/DetailPageHeader';
import { MetricsGrid } from '../../src/components/detail/MetricsGrid';
import { TrendBarChart } from '../../src/components/detail/TrendBarChart';
import { useMetricHistory, buildDayNavigatorLabels } from '../../src/hooks/useMetricHistory';
import type { DaySleepData, DayHRData, DayHRVData } from '../../src/hooks/useMetricHistory';
import { useHomeDataContext } from '../../src/context/HomeDataContext';
import { useFocusDataContext } from '../../src/context/FocusDataContext';
import { useDayMetrics } from '../../src/hooks/useDayMetrics';
import type { DayMetrics } from '../../src/types/focus.types';
import type { StrainDayBreakdown } from '../../src/hooks/useHomeData';
import { spacing, fontSize, fontFamily } from '../../src/theme/colors';

const DAY_ENTRIES = buildDayNavigatorLabels(30);
// Oldest→newest date keys for the 14-day trend charts in the explainer sheet
const CHART_DAYS = DAY_ENTRIES.slice(0, 14).map(d => d.dateKey).reverse();

// ─── Display type — flattened from DayMetrics for rendering ───────────────────

interface DayReadiness {
  score: number;
  sleepScore: number;        // 0-100 component score (ReadinessService formula)
  restingHRScore: number;    // 0-100 component score (baseline-relative)
  hrvScore: number;          // 0-100 component score
  restingHR: number;         // raw bpm (0 = unavailable)
  respiratoryRate: number;   // raw /min (0 = unavailable)
  sleepLabel: string;
  hrLabel: string;
}

function sleepQualityLabel(score: number): string {
  return score >= 80 ? 'Excellent' : score >= 60 ? 'Fair' : score > 0 ? 'Poor' : '--';
}

function restingHRLabel(rhr: number): string {
  return rhr > 0 ? (rhr < 55 ? 'Excellent' : rhr < 65 ? 'Good' : rhr < 75 ? 'Fair' : 'Elevated') : '--';
}

/** Map DayMetrics (single source of truth) → flat display type for this screen's render logic. */
function toDisplayReadiness(m: DayMetrics | null): DayReadiness {
  const rhr = m?.restingHR.raw ?? 0;
  const sleepComp = m?.readiness?.components.sleep ?? 0;
  const hrComp = m?.readiness?.components.restingHR ?? 0;
  const hrvComp = m?.readiness?.components.hrv ?? 0;
  return {
    score: m?.readiness?.score ?? 0,
    sleepScore: Math.round(sleepComp ?? 0),
    restingHRScore: Math.round(hrComp ?? 0),
    hrvScore: Math.round(hrvComp ?? 0),
    restingHR: rhr,
    respiratoryRate: m?.respiratoryRate.raw ?? 0,
    sleepLabel: sleepQualityLabel(Math.round(sleepComp ?? 0)),
    hrLabel: restingHRLabel(rhr),
  };
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

function ContributionBar({ label, value, pct }: { label: string; value: string; pct: number }) {
  return (
    <View style={cStyles.contribRow}>
      <Text style={cStyles.contribLabel}>{label}</Text>
      <View style={cStyles.contribBarWrap}>
        <View style={[cStyles.contribBarFill, { width: `${Math.round(pct)}%` }]} />
      </View>
      <Text style={cStyles.contribValue}>{value}</Text>
    </View>
  );
}

const cStyles = StyleSheet.create({
  contribRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 16 },
  contribLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontFamily: fontFamily.regular, width: 90 },
  contribBarWrap: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' },
  contribBarFill: { height: '100%', borderRadius: 3, backgroundColor: '#FFFFFF' },
  contribValue: { color: '#FFFFFF', fontSize: 12, fontFamily: fontFamily.demiBold, minWidth: 52, textAlign: 'right', flexShrink: 0 },
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
    fontSize: fontSize.lg,
    fontFamily: fontFamily.regular,
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

// ─── Score explainer bottom sheet ─────────────────────────────────────────────

interface ExplainerComponentProps {
  label: string;
  weightLabel: string;   // e.g. "35%"
  maxPts: number;        // e.g. 35
  subscore: number;      // 0-100 component score
  rawValue: string;      // e.g. "52 ms  ·  norm 49 ms"
  formula?: string;
}

function ExplainerComponent({ label, weightLabel, maxPts, subscore, rawValue, formula }: ExplainerComponentProps) {
  const earnedPts = Math.round(subscore * (maxPts / 100));
  return (
    <View style={eStyles.component}>
      {/* Label row */}
      <View style={eStyles.componentHeader}>
        <Text style={eStyles.componentLabel}>{label}</Text>
        <View style={eStyles.componentWeightRow}>
          <Text style={eStyles.componentWeight}>{weightLabel}</Text>
          <Text style={eStyles.componentWeightSuffix}> of total</Text>
        </View>
      </View>

      {/* Raw value */}
      <Text style={eStyles.componentRaw}>{rawValue}</Text>

      {/* Progress bar */}
      <View style={eStyles.componentBar}>
        <View style={[eStyles.componentBarFill, { width: `${Math.max(2, Math.round(subscore))}%` }]} />
      </View>

      {/* Points row */}
      <View style={eStyles.componentPtsRow}>
        <Text>
          <Text style={eStyles.componentPtsEarned}>{earnedPts}</Text>
          <Text style={eStyles.componentPtsDivider}> / {maxPts} pts</Text>
        </Text>
        <Text style={eStyles.componentSubscore}>{subscore}/100</Text>
      </View>

      {formula && <Text style={eStyles.componentFormula}>{formula}</Text>}
    </View>
  );
}

// ─── Mini bar chart for explainer sheet (monochrome, 14-day, dashed baseline) ─────

interface MiniBarChartProps {
  /** Ordered oldest→newest, up to 14 entries */
  values: number[];
  /** Baseline median to draw as dashed line (0 = don't draw) */
  baseline?: number;
  /** Maximum value for the y-axis scale */
  maxValue: number;
  /** When true, lower values are better (e.g. resting HR) — bar fills from bottom,
   *  and baseline line logic stays identical */
  invertY?: boolean;
}

function MiniBarChart({ values, baseline, maxValue, invertY = false }: MiniBarChartProps) {
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = screenWidth - spacing.lg * 2; // matches sheet paddingHorizontal
  const chartH = 48;
  const barGap = 3;
  const n = Math.min(values.length, 14);
  const barW = Math.floor((chartWidth - barGap * (n - 1)) / n);

  // Baseline y-position (0 at top, chartH at bottom)
  const baselineY = baseline != null && baseline > 0
    ? chartH - Math.round(Math.min(baseline, maxValue) / maxValue * chartH)
    : null;

  return (
    <Svg width={chartWidth} height={chartH} style={mcStyles.chart}>
      {values.slice(-n).map((v, i) => {
        const clampedV = Math.min(v, maxValue);
        const barH = Math.max(2, Math.round((clampedV / maxValue) * chartH));
        const x = i * (barW + barGap);
        const opacity = 0.3 + (i / Math.max(n - 1, 1)) * 0.7; // fade oldest → newest
        const y = invertY ? 0 : chartH - barH;
        return (
          <Rect
            key={i}
            x={x}
            y={y}
            width={barW}
            height={barH}
            rx={2}
            fill={`rgba(255,255,255,${opacity.toFixed(2)})`}
          />
        );
      })}
      {baselineY != null && (
        <Line
          x1={0}
          y1={baselineY}
          x2={chartWidth}
          y2={baselineY}
          stroke="rgba(255,255,255,0.45)"
          strokeWidth={1}
          strokeDasharray="4,3"
        />
      )}
    </Svg>
  );
}

const mcStyles = StyleSheet.create({
  chart: { marginTop: spacing.md },
  chartCaption: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    fontFamily: fontFamily.regular,
    fontStyle: 'italic',
    marginTop: 5,
    marginBottom: spacing.sm,
  },
});

// ─── Score explainer bottom sheet ─────────────────────────────────────────────

function ScoreExplainerSheetContent({
  readiness,
  dayMetrics,
  sleepData,
  hrData,
  hrvData,
}: {
  readiness: DayReadiness;
  dayMetrics: DayMetrics | null;
  sleepData: Map<string, DaySleepData>;
  hrData: Map<string, DayHRData>;
  hrvData: Map<string, DayHRVData>;
}) {
  const components = dayMetrics?.readiness?.components;
  const sleepMinutes = dayMetrics?.sleepMinutes.raw ?? 0;
  const trainingLoad = components?.trainingLoad;

  const hrvRaw = dayMetrics?.hrv.raw;
  const hrvBaseline = dayMetrics?.hrv.baselineMedian;
  const hrvDevLabel = dayMetrics?.hrv.deviationLabel;
  const hrvRawStr = hrvRaw != null
    ? `${Math.round(hrvRaw)} ms${hrvBaseline ? `  ·  norm ${Math.round(hrvBaseline)} ms` : ''}${hrvDevLabel ? `  (${hrvDevLabel})` : ''}`
    : hrvBaseline ? `No data  ·  norm ${Math.round(hrvBaseline)} ms` : 'No data';

  const rhrBaseline = dayMetrics?.restingHR.baselineMedian;
  const rhrDevLabel = dayMetrics?.restingHR.deviationLabel;
  const rhrRawStr = readiness.restingHR > 0
    ? `${readiness.restingHR} bpm${rhrBaseline ? `  ·  norm ${Math.round(rhrBaseline)} bpm` : ''}${rhrDevLabel ? `  (${rhrDevLabel})` : ''}`
    : rhrBaseline ? `No data  ·  norm ${Math.round(rhrBaseline)} bpm` : 'No data';

  const sleepRawStr = sleepMinutes > 0
    ? `Score ${readiness.sleepScore}/100  ·  ${(sleepMinutes / 60).toFixed(1)}h sleep`
    : `Score ${readiness.sleepScore > 0 ? readiness.sleepScore : '--'}/100`;

  const totalEarned = readiness.score;
  const totalAvail = trainingLoad != null ? 100 : 80;

  const hrvHistory = CHART_DAYS.map(k => Math.round(hrvData.get(k)?.sdnn ?? 0));
  const sleepHistory = CHART_DAYS.map(k => Math.round(sleepData.get(k)?.score ?? 0));
  const rhrHistory = CHART_DAYS.map(k => Math.round(hrData.get(k)?.restingHR ?? 0));

  return (
    <BottomSheetScrollView contentContainerStyle={eStyles.sheetContent} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <Text style={eStyles.sheetTitle}>How this score was calculated</Text>
      <Text style={eStyles.sheetSubtitle}>Baseline-relative · calibrated to your personal trends, not fixed population thresholds</Text>

      <ExplainerComponent
        label="HRV"
        weightLabel="35%"
        maxPts={35}
        subscore={readiness.hrvScore}
        rawValue={hrvRawStr}
        formula="50 + (sdnn − baseline) / baseline × 75"
      />
      {hrvHistory.some(v => v > 0) && (
        <>
          <MiniBarChart values={hrvHistory} baseline={hrvBaseline ?? undefined} maxValue={120} />
          <Text style={mcStyles.chartCaption}>14-day HRV trend · dashed line = your personal baseline</Text>
        </>
      )}

      <ExplainerComponent
        label="Sleep Quality"
        weightLabel="25%"
        maxPts={25}
        subscore={readiness.sleepScore}
        rawValue={sleepRawStr}
      />
      {sleepHistory.some(v => v > 0) && (
        <>
          <MiniBarChart values={sleepHistory} maxValue={100} />
          <Text style={mcStyles.chartCaption}>14-day sleep score trend</Text>
        </>
      )}

      <ExplainerComponent
        label="Resting HR"
        weightLabel="20%"
        maxPts={20}
        subscore={readiness.restingHRScore}
        rawValue={rhrRawStr}
        formula="50 − (hr − baseline) / baseline × 100  ·  lower than norm = higher score"
      />
      {rhrHistory.some(v => v > 0) && (
        <>
          <MiniBarChart values={rhrHistory} baseline={rhrBaseline ?? undefined} maxValue={120} invertY />
          <Text style={mcStyles.chartCaption}>14-day resting HR trend · dashed line = your personal baseline</Text>
        </>
      )}

      {trainingLoad != null && (
        <ExplainerComponent
          label="Training Load"
          weightLabel="20%"
          maxPts={20}
          subscore={trainingLoad}
          rawValue="7-day acute vs 28-day chronic ratio (Strava)"
        />
      )}

      {/* Total */}
      <View style={eStyles.totalBlock}>
        <Text style={eStyles.totalCaption}>WEIGHTED TOTAL</Text>
        <View style={eStyles.totalValueRow}>
          <Text style={eStyles.totalScore}>{totalEarned}</Text>
          <Text style={eStyles.totalAvail}> / {totalAvail} pts</Text>
        </View>
      </View>

      {/* Footnote */}
      <Text style={eStyles.sheetFootnote}>
        Scores compare today's readings to your rolling 14-day personal median — the same metric you scored 80 yesterday might score 60 today if your baseline shifted. Strain Accumulation is a separate 7-day Strava EWMA; it informs context but isn't an input here.
      </Text>
    </BottomSheetScrollView>
  );
}

const eStyles = StyleSheet.create({
  // Sheet layout
  sheetContent: { paddingHorizontal: spacing.lg, paddingBottom: 48, paddingTop: spacing.lg },
  sheetTitle: { color: '#FFFFFF', fontSize: 22, fontFamily: fontFamily.demiBold, marginBottom: spacing.sm },
  sheetSubtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 15, fontFamily: fontFamily.regular, lineHeight: 22, marginBottom: spacing.xl },

  // Per-component tile
  component: {
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  componentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 },
  componentWeightRow: { flexDirection: 'row', alignItems: 'baseline' },
  componentWeightSuffix: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontFamily: fontFamily.regular },
  componentLabel: { color: 'rgba(255,255,255,0.45)', fontSize: fontSize.xxl, fontFamily: fontFamily.demiBold },
  componentWeight: { color: '#FFFFFF', fontSize: fontSize.xxl, fontFamily: fontFamily.demiBold },
  componentRaw: { color: 'rgba(255,255,255,0.75)', fontSize: 16, fontFamily: fontFamily.regular, marginBottom: spacing.md },
  componentBar: { height: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden', marginBottom: spacing.sm },
  componentBarFill: { height: '100%', borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.35)' },
  componentPtsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  componentPtsEarned: { color: '#FFFFFF', fontSize: fontSize.xl, fontFamily: fontFamily.demiBold },
  componentPtsDivider: { color: 'rgba(255,255,255,0.4)', fontSize: fontSize.md, fontFamily: fontFamily.regular },
  componentSubscore: { color: 'rgba(255,255,255,0.35)', fontSize: 13, fontFamily: fontFamily.regular },
  componentFormula: { color: 'rgba(255,255,255,0.3)', fontSize: 12, fontFamily: fontFamily.regular, fontStyle: 'italic', marginTop: spacing.sm, lineHeight: 18 },

  // Total
  totalBlock: { paddingTop: spacing.xl, paddingBottom: spacing.md },
  totalCaption: { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontFamily: fontFamily.regular, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm },
  totalValueRow: { flexDirection: 'row', alignItems: 'baseline' },
  totalScore: { color: '#FFFFFF', fontSize: fontSize.xxxl, fontFamily: fontFamily.demiBold },
  totalAvail: { color: 'rgba(255,255,255,0.4)', fontSize: fontSize.xl, fontFamily: fontFamily.regular },

  // Footnote
  sheetFootnote: { color: 'rgba(255,255,255,0.3)', fontSize: 13, fontFamily: fontFamily.regular, lineHeight: 20, fontStyle: 'italic' },
});

// ─── Insight ───────────────────────────────────────────────────────────────────

function recoveryInsight(r: DayReadiness): string {
  if (r.score === 0) return 'Sync your ring to see your readiness score.';
  const hrNote = r.restingHR > 0 ? ` Resting HR ${r.restingHR}bpm.` : '';
  if (r.score >= 80) return `Readiness ${r.score} — your body is primed for performance. Sleep quality was ${r.sleepLabel.toLowerCase()}.${hrNote} Great day to push hard.`;
  if (r.score >= 60) return `Readiness ${r.score} — moderate recovery. Consider training at 70–80% intensity. Focus on quality sleep tonight to rebuild.`;
  return `Readiness ${r.score} — your body is asking for rest.${hrNote} Sleep score (${r.sleepScore || 'N/A'}) indicates limited recovery. Prioritize sleep and low-intensity movement today.`;
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function RecoveryDetailScreen() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const homeData = useHomeDataContext();
  const explainerRef = useRef<BottomSheetModal>(null);

  const openExplainer = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    explainerRef.current?.present();
  }, []);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.65} pressBehavior="close" />
    ),
    [],
  );
  useFocusDataContext(); // ensure FocusDataProvider is present and baselines are loaded

  // Progressive: 7 days instant, extend to 30 silently in background
  const { data: sleepData, isLoading: sleepLoading } = useMetricHistory<DaySleepData>('sleep', { initialDays: 7, fullDays: 30 });
  const { data: hrData, isLoading: hrLoading } = useMetricHistory<DayHRData>('heartRate', { initialDays: 7, fullDays: 30 });
  const { data: hrvData, isLoading: hrvLoading } = useMetricHistory<DayHRVData>('hrv', { initialDays: 7, fullDays: 30 });

  const isLoading = sleepLoading || hrLoading || hrvLoading;

  const todayKey = DAY_ENTRIES[0]?.dateKey;

  // Single source of truth: all per-day metric resolution goes through this hook,
  // which uses ReadinessService (baseline-relative formula) and matches the Coach tab.
  const { resolve: resolveDay } = useDayMetrics({ sleepData, hrData, hrvData, todayKey });

  // Trend chart: compute baseline-relative readiness for all 30 days.
  const allScores = useMemo(() =>
    DAY_ENTRIES.map(d => ({
      dateKey: d.dateKey,
      score: resolveDay(d.dateKey)?.readiness?.score ?? 0,
    })),
    // resolveDay identity is stable when its dependencies (baselines, homeData, sleepData, hrData, hrvData) change
    [resolveDay]
  );

  const selectedDateKey = DAY_ENTRIES[selectedIndex]?.dateKey;

  // Selected day: DayMetrics from the single source of truth
  const dayMetrics: DayMetrics | null = useMemo(
    () => resolveDay(selectedDateKey ?? ''),
    [selectedDateKey, resolveDay]
  );

  // Flatten DayMetrics → display type for rendering
  const readiness: DayReadiness = useMemo(
    () => toDisplayReadiness(dayMetrics),
    [dayMetrics]
  );

  // HRV sdnn for the additional stats row (taken directly from DayMetrics)
  const selectedHrvSdnn = dayMetrics?.hrv.raw ?? null;

  const hasData = readiness.score > 0;
  const color = readinessColor(readiness.score);
  const label = readinessLabel(readiness.score);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({ onScroll: (e) => { scrollY.value = e.contentOffset.y; } });
  const numberAnimStyle = useAnimatedStyle(() => ({
    fontSize: interpolate(scrollY.value, [0, COLLAPSE_END], [88, 40], Extrapolation.CLAMP),
    lineHeight: interpolate(scrollY.value, [0, COLLAPSE_END], [88, 40], Extrapolation.CLAMP),
    color: interpolateColor(scrollY.value, [0, COLLAPSE_END], [color, '#FFFFFF']),
  }));
  const labelAnimStyle = useAnimatedStyle(() => ({
    fontSize: interpolate(scrollY.value, [0, COLLAPSE_END], [24, 14], Extrapolation.CLAMP),
    lineHeight: interpolate(scrollY.value, [0, COLLAPSE_END], [24, 14], Extrapolation.CLAMP),
  }));
  const badgeExpandedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, COLLAPSE_END * 0.4], [1, 0], Extrapolation.CLAMP),
    height: interpolate(scrollY.value, [0, COLLAPSE_END * 0.5], [22, 0], Extrapolation.CLAMP),
    overflow: 'hidden',
  }));
  const chipSlideStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(scrollY.value, [0, COLLAPSE_END], [30, 0], Extrapolation.CLAMP) }],
    opacity: interpolate(scrollY.value, [0, COLLAPSE_END], [0, 1], Extrapolation.CLAMP),
  }));
  const headlineHeightStyle = useAnimatedStyle(() => ({
    height: interpolate(scrollY.value, [0, COLLAPSE_END], [100, 44], Extrapolation.CLAMP),
  }));

  return (
    <View style={styles.container}>
      {/* Full-screen gradient background */}
      <Svg style={styles.gradientBg} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <RadialGradient id="recoveryGrad" cx="51%" cy="-20%" rx="90%" ry="220%">
            <Stop offset="0%" stopColor="#10B981" stopOpacity={1} />
            <Stop offset="70%" stopColor="#10B981" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="recoveryGrad2" cx="85%" cy="10%" rx="60%" ry="80%">
            <Stop offset="0%" stopColor="#065F46" stopOpacity={0.75} />
            <Stop offset="100%" stopColor="#065F46" stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id="recoveryFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="40%" stopColor="#0A0A0F" stopOpacity={0} />
            <Stop offset="100%" stopColor="#0A0A0F" stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill="url(#recoveryGrad)" />
        <Rect x="0" y="0" width="100" height="100" fill="url(#recoveryGrad2)" />
        <Rect x="0" y="0" width="100" height="100" fill="url(#recoveryFade)" />
      </Svg>

      {/* Gradient zone: header + trend chart */}
      <View style={styles.gradientZone}>

        <DetailPageHeader
          title="Recovery"
          marginBottom={spacing.md}
          rightElement={
            <TouchableOpacity onPress={openExplainer} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Svg width={22} height={22} viewBox="0 0 20 20">
                <Circle cx={10} cy={10} r={9} stroke="rgba(255,255,255,0.55)" strokeWidth={1.5} fill="none" />
                <Circle cx={10} cy={6.5} r={1.2} fill="rgba(255,255,255,0.55)" />
                <SvgText x={10} y={15.5} fontSize={8} fontWeight="700" fill="rgba(255,255,255,0.55)" textAnchor="middle">i</SvgText>
              </Svg>
            </TouchableOpacity>
          }
        />

        <TrendBarChart
          dayEntries={DAY_ENTRIES}
          values={allScores.map(s => ({ dateKey: s.dateKey, value: s.score }))}
          selectedIndex={selectedIndex}
          onSelectDay={setSelectedIndex}
          colorFn={readinessColor}
          maxValue={100}
          guideLines={[25, 50, 75]}
        />
      </View>

      {hasData && (
        <Reanimated.View style={[styles.headlineSection, headlineHeightStyle]}>
          <View style={styles.headlineLeft}>
            <View style={styles.headlineRow}>
              <Reanimated.Text style={[styles.headlineScore, numberAnimStyle]}>
                {readiness.score}
              </Reanimated.Text>
              <View style={styles.labelColumn}>
                <Reanimated.Text style={[styles.headlineLabel, labelAnimStyle]}>
                  Readiness Score
                </Reanimated.Text>
                <Reanimated.View style={[styles.badgeRow, badgeExpandedStyle]}>
                  <View style={[styles.badge, { backgroundColor: `${color}22`, borderColor: `${color}55` }]}>
                    <Text style={[styles.badgeText, { color }]}>{label}</Text>
                  </View>
                </Reanimated.View>
              </View>
            </View>
          </View>
          <View style={styles.chipRight}>
            <Reanimated.View style={[styles.chip, chipSlideStyle, { backgroundColor: `${color}22`, borderColor: `${color}55` }]}>
              <Text style={[styles.chipText, { color }]}>{label}</Text>
            </Reanimated.View>
          </View>
        </Reanimated.View>
      )}

      <Reanimated.ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} onScroll={scrollHandler}>
        {isLoading ? (
          <View style={styles.centered}><ActivityIndicator color="rgba(255,255,255,0.6)" /></View>
        ) : !hasData ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No recovery data for this day</Text>
            <Text style={styles.emptySubtext}>Sync your ring to record readiness automatically</Text>
          </View>
        ) : (
          <>

            {/* Insight */}
            <View style={styles.insightBlock}>
              <Text style={styles.insightText}>{recoveryInsight(readiness)}</Text>
            </View>

            {/* Score Breakdown */}
            <View style={styles.contribContainer}>
              <View style={styles.contribTitleRow}>
                <Text style={styles.contribTitle}>Score Breakdown</Text>
                <InfoButton metricKey="score_breakdown" />
              </View>
              <ContributionBar
                label="HRV"
                value={dayMetrics?.hrv.raw != null ? `${Math.round(dayMetrics.hrv.raw)} ms` : '--'}
                pct={readiness.hrvScore}
              />
              <ContributionBar
                label="Sleep"
                value={readiness.sleepScore > 0 ? `${readiness.sleepScore}/100` : '--'}
                pct={readiness.sleepScore}
              />
              <ContributionBar
                label="Resting HR"
                value={readiness.restingHR > 0 ? `${readiness.restingHR} bpm` : '--'}
                pct={readiness.restingHRScore}
              />
            </View>

            {/* Strain Accumulation (today only — shows live EWMA breakdown) */}
            {selectedIndex === 0 && homeData.strainBreakdown.length > 0 && (
              <StrainAccumulationCard
                strain={homeData.strain}
                breakdown={homeData.strainBreakdown}
              />
            )}

            {/* Metrics grid */}
            <MetricsGrid metrics={[
              { label: 'Readiness', value: `${readiness.score}`, unit: '/100' },
              { label: 'Sleep Score', value: readiness.sleepScore > 0 ? `${readiness.sleepScore}` : '--', unit: readiness.sleepScore > 0 ? '/100' : undefined },
              { label: 'Resting HR', value: readiness.restingHR > 0 ? `${readiness.restingHR}` : '--', unit: readiness.restingHR > 0 ? 'bpm' : undefined },
              { label: 'Resp Rate', value: readiness.respiratoryRate > 0 ? `${readiness.respiratoryRate}` : '--', unit: readiness.respiratoryRate > 0 ? '/min' : undefined },
              { label: 'Recommended', value: readiness.score >= 80 ? 'High Intensity' : readiness.score >= 60 ? 'Moderate' : 'Rest' },
            ]} />

            {/* Additional stats */}
            {(selectedHrvSdnn != null || (selectedIndex === 0 && homeData.strain > 0)) && (
              <View style={styles.statsContainer}>
                {selectedHrvSdnn != null && (
                  <DetailStatRow
                    title="HRV (SDNN)"
                    value={`${selectedHrvSdnn}`}
                    unit="ms"
                  />
                )}
                {selectedIndex === 0 && homeData.strain > 0 && (
                  <DetailStatRow
                    title="Strain (7d EWMA)"
                    value={`${homeData.strain}`}
                    unit="/100"
                  />
                )}
              </View>
            )}

          </>
        )}
      </Reanimated.ScrollView>

      <BottomSheetModal
        ref={explainerRef}
        enableDynamicSizing
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.sheetBackground}
        handleComponent={null}
        maxDynamicContentSize={680}
      >
        <ScoreExplainerSheetContent
          readiness={readiness}
          dayMetrics={dayMetrics}
          sleepData={sleepData}
          hrData={hrData}
          hrvData={hrvData}
        />
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  gradientBg: { position: 'absolute', top: 0, left: 0, right: 0, height: 480 },
  gradientZone: {},
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 60 },
  centered: { flex: 1, alignItems: 'center', paddingTop: 80 },
  emptyContainer: { flex: 1, alignItems: 'center', paddingTop: 80, gap: spacing.sm },
  emptyText: { color: 'rgba(255,255,255,0.7)', fontSize: fontSize.md, fontFamily: fontFamily.demiBold },
  emptySubtext: { color: 'rgba(255,255,255,0.4)', fontSize: fontSize.sm, fontFamily: fontFamily.regular, textAlign: 'center', paddingHorizontal: spacing.xl },
  headlineSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    overflow: 'hidden',
  },
  headlineLeft: { flexDirection: 'column', alignItems: 'flex-start' },
  headlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  labelColumn: { flexDirection: 'column', alignItems: 'flex-start' },
  headlineScore: { fontSize: 88, fontFamily: fontFamily.regular },
  headlineLabel: { color: '#FFFFFF', fontSize: 24, fontFamily: fontFamily.demiBold },
  badgeRow: { flexDirection: 'row', alignSelf: 'flex-start', marginTop: 4 },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 12, fontFamily: fontFamily.demiBold, textTransform: 'uppercase' },
  chipRight: { overflow: 'hidden' },
  chip: { paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, borderWidth: 1, alignSelf: 'flex-start' },
  chipText: { fontSize: 10, fontFamily: fontFamily.demiBold, textTransform: 'uppercase' },
  contribContainer: { marginHorizontal: spacing.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 16, paddingVertical: spacing.sm, marginBottom: spacing.md },
  contribTitleRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: spacing.sm },
  contribTitle: { flex: 1, color: '#FFFFFF', fontSize: fontSize.lg, fontFamily: fontFamily.regular },
  sheetBackground: { backgroundColor: '#111', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  statsContainer: { marginHorizontal: spacing.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 16, overflow: 'hidden', marginBottom: spacing.md },
  insightBlock: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xs,
  },
  insightText: { color: 'rgba(255,255,255,0.75)', fontSize: 16, fontFamily: fontFamily.regular, lineHeight: 24 },
});
