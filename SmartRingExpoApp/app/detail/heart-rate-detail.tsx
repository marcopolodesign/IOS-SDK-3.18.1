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
import Svg, { Defs, RadialGradient, Rect, Stop, Path, Line, Circle, Text as SvgText } from 'react-native-svg';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DetailStatRow } from '../../src/components/detail/DetailStatRow';
import { BackArrow } from '../../src/components/detail/BackArrow';
import { HRTrendChart } from '../../src/components/detail/HRTrendChart';
import { useMetricHistory, buildDayNavigatorLabels } from '../../src/hooks/useMetricHistory';
import type { DayHRData } from '../../src/hooks/useMetricHistory';
import { useHomeDataContext } from '../../src/context/HomeDataContext';
import { spacing, fontSize, fontFamily } from '../../src/theme/colors';

const DAY_ENTRIES = buildDayNavigatorLabels(30);
const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_W = SCREEN_WIDTH - spacing.md * 2;
const CHART_H = 180;
const PAD_H = 8;
const PAD_V = 16;

function hrQualityLabel(restingHR: number): string {
  if (restingHR <= 0) return 'No data';
  if (restingHR <= 55) return 'Excellent';
  if (restingHR <= 65) return 'Good';
  if (restingHR <= 75) return 'Fair';
  return 'Elevated';
}

function hrColor(restingHR: number): string {
  if (restingHR <= 55) return '#4ADE80';
  if (restingHR <= 65) return '#FBBF24';
  if (restingHR <= 75) return '#FF8C00';
  return '#EF4444';
}

function hrInsight(data: DayHRData | undefined): string {
  if (!data) return 'Sync your ring to see heart rate insights.';
  if (data.peakHR > 140) return `High intensity detected — peak HR reached ${data.peakHR} bpm. Prioritise recovery today.`;
  if (data.restingHR > 0 && data.restingHR < 55) return `Excellent resting HR of ${data.restingHR} bpm — strong cardiovascular fitness and solid recovery.`;
  if (data.restingHR > 0 && data.restingHR < 65) return `Good resting HR of ${data.restingHR} bpm. Your heart is recovering well.`;
  if (data.restingHR > 75) return `Elevated resting HR of ${data.restingHR} bpm — could indicate stress, dehydration, or incomplete recovery.`;
  return `Your HR stayed in a healthy range. Resting HR of ${data.restingHR} bpm is a solid indicator of recovery.`;
}

function buildTodayHRFromContext(
  hrChartData: Array<{ timeMinutes: number; heartRate: number }>,
): DayHRData | null {
  if (!hrChartData || hrChartData.length === 0) return null;
  const pts = hrChartData.filter(p => p.heartRate > 0);
  if (pts.length === 0) return null;
  const vals = pts.map(p => p.heartRate);
  const today = new Date().toISOString().split('T')[0];
  return {
    date: today,
    hourlyPoints: pts.map(p => ({ hour: Math.floor(p.timeMinutes / 60) % 24, heartRate: p.heartRate })),
    restingHR: Math.min(...vals),
    peakHR: Math.max(...vals),
    avgHR: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
  };
}

// ─── Monotone cubic path helper ───────────────────────────────────────────────
function monotoneCubicPath(pts: Array<{ x: number; y: number }>): string {
  if (pts.length < 2) return '';
  const n = pts.length;
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    d.push((pts[i + 1].y - pts[i].y) / (pts[i + 1].x - pts[i].x));
  }
  const m: number[] = new Array(n).fill(0);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  }
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const alpha = m[i] / d[i];
    const beta = m[i + 1] / d[i];
    const r = alpha * alpha + beta * beta;
    if (r > 9) {
      const t = 3 / Math.sqrt(r);
      m[i] = t * alpha * d[i];
      m[i + 1] = t * beta * d[i];
    }
  }
  let path = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const dx = (pts[i + 1].x - pts[i].x) / 3;
    path += ` C ${pts[i].x + dx} ${pts[i].y + m[i] * dx} ${pts[i + 1].x - dx} ${pts[i + 1].y - m[i + 1] * dx} ${pts[i + 1].x} ${pts[i + 1].y}`;
  }
  return path;
}

// ─── Hourly HR line chart ─────────────────────────────────────────────────────
function HourlyHRLine({ points, restingHR, peakHR }: { points: DayHRData['hourlyPoints']; restingHR: number; peakHR: number }) {
  // Aggregate multiple readings per hour → one avg point per hour, then sort ascending.
  // Raw hrChartData has per-minute readings; duplicate x values cause NaN in cubic spline.
  const hourMap = new Map<number, number[]>();
  points.forEach(p => {
    if (p.heartRate <= 0) return;
    if (!hourMap.has(p.hour)) hourMap.set(p.hour, []);
    hourMap.get(p.hour)!.push(p.heartRate);
  });
  const sorted = Array.from(hourMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([hour, hrs]) => ({ hour, heartRate: Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) }));

  if (sorted.length < 2) return null;

  const minY = Math.max(30, restingHR - 10);
  const maxY = peakHR + 10;
  const range = Math.max(1, maxY - minY);

  const toX = (hour: number) => PAD_H + (hour / 23) * (CHART_W - PAD_H * 2);
  const toY = (hr: number) => PAD_V + (1 - (hr - minY) / range) * (CHART_H - PAD_V * 2);

  // Build line path
  const linePts = sorted.map(p => ({ x: toX(p.hour), y: toY(p.heartRate) }));
  const linePath = monotoneCubicPath(linePts);

  // Area fill: close down to baseline
  const firstX = toX(sorted[0].hour);
  const lastX = toX(sorted[sorted.length - 1].hour);
  const baselineY = toY(minY);
  const areaPath = `${linePath} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z`;

  // Grid HR values
  const gridValues = [
    Math.round(minY + range * 0.75),
    Math.round(minY + range * 0.5),
    Math.round(minY + range * 0.25),
  ];

  return (
    <Svg width={CHART_W} height={CHART_H}>
      {/* Grid lines */}
      {[0.25, 0.5, 0.75].map((frac, i) => {
        const lineY = PAD_V + frac * (CHART_H - PAD_V * 2);
        return (
          <Line
            key={i}
            x1={PAD_H} x2={CHART_W - PAD_H}
            y1={lineY} y2={lineY}
            stroke="rgba(255,255,255,0.08)" strokeWidth={1} strokeDasharray="3,4"
          />
        );
      })}

      {/* Area fill */}
      <Path d={areaPath} fill="rgba(171,13,13,0.18)" />

      {/* Line */}
      <Path
        d={linePath}
        stroke="rgba(255,255,255,0.85)"
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Data point dots */}
      {sorted.map(p => (
        <Circle
          key={p.hour}
          cx={toX(p.hour)}
          cy={toY(p.heartRate)}
          r={3}
          fill="#FF6B6B"
        />
      ))}

      {/* Hour axis labels */}
      {[0, 6, 12, 18, 23].map(h => (
        <SvgText
          key={h}
          x={toX(h)}
          y={CHART_H - 2}
          textAnchor="middle"
          fontSize={9}
          fill="rgba(255,255,255,0.4)"
          fontFamily={fontFamily.regular}
        >
          {h === 0 ? '12AM' : h === 12 ? '12PM' : h === 23 ? '11PM' : `${h > 12 ? h - 12 : h}${h >= 12 ? 'PM' : 'AM'}`}
        </SvgText>
      ))}
    </Svg>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────────
export default function HeartRateDetailScreen() {
  const insets = useSafeAreaInsets();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { data, isLoading } = useMetricHistory<DayHRData>('heartRate', { initialDays: 7, fullDays: 30 });
  const homeData = useHomeDataContext();

  const selectedDateKey = DAY_ENTRIES[selectedIndex]?.dateKey;
  const todayKey = DAY_ENTRIES[0]?.dateKey;

  // For today: always prefer live ring data (hrChartData) since it's more current than
  // Supabase heart_rate_readings which only syncs periodically. Merge both sources so
  // the peakHR shown matches the home card (which also reads from ring directly).
  const todayLive = selectedIndex === 0 && homeData.hrChartData.length > 0
    ? buildTodayHRFromContext(homeData.hrChartData)
    : null;

  const dayData = (() => {
    if (selectedIndex !== 0 || !selectedDateKey) {
      return selectedDateKey ? data.get(selectedDateKey) : undefined;
    }
    const supabaseToday = data.get(todayKey);
    if (todayLive) {
      return {
        ...todayLive,
        // Take the highest peak seen across ring (live) and Supabase (historical today)
        peakHR: Math.max(todayLive.peakHR, supabaseToday?.peakHR ?? 0),
        // Ring restingHR is more reliable (overnight window logic applied in useHomeData)
        restingHR: todayLive.restingHR || supabaseToday?.restingHR || 0,
        avgHR: todayLive.avgHR || supabaseToday?.avgHR || 0,
      };
    }
    return supabaseToday;
  })();

  // Build HR values for trend chart (resting HR per day)
  const hrValues = useMemo(() =>
    DAY_ENTRIES.map(d => ({
      dateKey: d.dateKey,
      restingHR: d.dateKey === todayKey && todayFallback
        ? todayFallback.restingHR
        : (data.get(d.dateKey)?.restingHR ?? 0),
    })),
    [data, todayFallback]
  );

  const hasData = !!dayData && (dayData.restingHR > 0 || dayData.hourlyPoints.length > 0);
  const color = hrColor(dayData?.restingHR ?? 0);
  const label = hrQualityLabel(dayData?.restingHR ?? 0);

  return (
    <View style={styles.container}>
      {/* Gradient zone: header + trend chart */}
      <View style={styles.gradientZone}>
        <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
          <Defs>
            <RadialGradient id="hrGrad" cx="51%" cy="-86%" rx="80%" ry="300%">
              <Stop offset="0%" stopColor="#AB0D0D" stopOpacity={0.85} />
              <Stop offset="55%" stopColor="#AB0D0D" stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="hrGrad2" cx="85%" cy="15%" rx="45%" ry="60%">
              <Stop offset="0%" stopColor="#7B0000" stopOpacity={0.55} />
              <Stop offset="100%" stopColor="#7B0000" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100" height="100" fill="url(#hrGrad)" />
          <Rect x="0" y="0" width="100" height="100" fill="url(#hrGrad2)" />
        </Svg>

        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <BackArrow />
          </TouchableOpacity>
          <Text style={styles.title}>Heart Rate</Text>
          <View style={styles.headerRight} />
        </View>

        <HRTrendChart
          dayEntries={DAY_ENTRIES}
          hrValues={hrValues}
          selectedIndex={selectedIndex}
          onSelectDay={setSelectedIndex}
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
        ) : !hasData ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No heart rate data for this day</Text>
            <Text style={styles.emptySubtext}>Sync your ring to record heart rate automatically</Text>
          </View>
        ) : (
          <>
            {/* Headline */}
            <View style={styles.headlineOuter}>
              <View style={styles.headlineRow}>
                <Text style={[styles.headlineScore, { color }]}>{dayData!.restingHR || '--'}</Text>
                <Text style={styles.headlineLabel}>Resting BPM</Text>
              </View>
              <View style={styles.badgeRow}>
                <View style={[styles.badge, { backgroundColor: `${color}22`, borderColor: `${color}55` }]}>
                  <Text style={[styles.badgeText, { color }]}>{label}</Text>
                </View>
              </View>
            </View>

            {/* Line chart */}
            {dayData!.hourlyPoints.length >= 2 && (
              <View style={styles.chartContainer}>
                <HourlyHRLine
                  points={dayData!.hourlyPoints}
                  restingHR={dayData!.restingHR}
                  peakHR={dayData!.peakHR}
                />
              </View>
            )}

            {/* Stats */}
            <View style={styles.statsContainer}>
              <DetailStatRow title="Resting HR" value={`${dayData!.restingHR || '--'}`} unit="bpm" accent="#4ADE80" />
              <DetailStatRow title="Average HR" value={`${dayData!.avgHR || '--'}`} unit="bpm" />
              <DetailStatRow title="Peak HR" value={`${dayData!.peakHR || '--'}`} unit="bpm" accent="#FF6B6B" />
              <DetailStatRow title="Hours tracked" value={`${dayData!.hourlyPoints.length}`} />
            </View>

            {/* Insight */}
            <View style={styles.insightBlock}>
              <Text style={styles.insightText}>{hrInsight(dayData)}</Text>
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
  title: { color: '#FFFFFF', fontSize: fontSize.lg, fontFamily: fontFamily.demiBold },
  headerRight: { width: 40 },
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
  chartContainer: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    overflow: 'hidden',
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
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
    borderColor: 'rgba(171,13,13,0.4)',
  },
  insightText: { color: 'rgba(255,255,255,0.75)', fontSize: fontSize.sm, fontFamily: fontFamily.regular, lineHeight: 22 },
});
