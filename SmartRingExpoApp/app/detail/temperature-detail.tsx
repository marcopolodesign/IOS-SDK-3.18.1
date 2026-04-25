import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  interpolateColor,
  Extrapolation,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop, Path, Line, Circle, Text as SvgText } from 'react-native-svg';
import { TrendBarChart } from '../../src/components/detail/TrendBarChart';
import { monotoneCubicPath } from '../../src/utils/chartMath';
import { DetailPageHeader } from '../../src/components/detail/DetailPageHeader';
import { DetailStatRow } from '../../src/components/detail/DetailStatRow';
import { MetricsGrid } from '../../src/components/detail/MetricsGrid';
import { useMetricHistory, buildDayNavigatorLabels } from '../../src/hooks/useMetricHistory';
import type { DayTemperatureData } from '../../src/hooks/useMetricHistory';
import { spacing, fontSize, fontFamily } from '../../src/theme/colors';

const COLLAPSE_END = 80;
const DAY_ENTRIES = buildDayNavigatorLabels(30);
const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_W = SCREEN_WIDTH - spacing.md * 2 - spacing.sm * 2;
const CHART_H = 175;
const PAD_LEFT = 34;
const PAD_V = 16;

// Kept as fallback for users with <3 days of personal history
const NORMAL_LOW = 36.1;
const NORMAL_HIGH = 37.2;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeBaseline(
  data: Map<string, DayTemperatureData>,
  excludeDateKey?: string,
): number | null {
  const avgs = Array.from(data.entries())
    .filter(([k]) => k !== excludeDateKey)
    .map(([, d]) => d.avg)
    .filter(v => v > 0);
  if (avgs.length < 3) return null;
  return Math.round((avgs.reduce((a, b) => a + b, 0) / avgs.length) * 10) / 10;
}

function tempStatus(avg: number, baseline: number | null): { label: string; color: string } {
  if (baseline !== null) {
    const delta = avg - baseline;
    if (delta > 0.3) return { label: 'Elevated', color: '#EF4444' };
    if (delta < -0.3) return { label: 'Low', color: '#60A5FA' };
    return { label: 'Normal', color: '#4ADE80' };
  }
  if (avg > NORMAL_HIGH) return { label: 'Elevated', color: '#EF4444' };
  if (avg < NORMAL_LOW) return { label: 'Low', color: '#60A5FA' };
  return { label: 'Normal', color: '#4ADE80' };
}

function tempColor(value: number, baseline: number | null): string {
  if (value <= 0) return 'rgba(255,255,255,0.4)';
  return tempStatus(value, baseline).color;
}

function tempInsight(d: DayTemperatureData | undefined, baseline: number | null): string {
  if (!d || d.readings.length === 0) return 'Sync your ring to see temperature insights.';
  const dev = baseline !== null ? Math.round((d.avg - baseline) * 10) / 10 : null;
  if (d.avg > NORMAL_HIGH) {
    return `Temperature of ${d.avg.toFixed(1)}°C is above normal range.${dev != null ? ` +${dev}°C from your 30-day baseline.` : ''} This can indicate elevated inflammation or early illness.`;
  }
  if (d.avg < NORMAL_LOW) {
    return `Temperature of ${d.avg.toFixed(1)}°C is below normal range.${dev != null ? ` ${dev}°C from baseline.` : ''} Low body temp can indicate poor circulation or high parasympathetic activity.`;
  }
  return `Body temperature of ${d.avg.toFixed(1)}°C is within normal range.${dev != null ? ` ${dev > 0 ? '+' : ''}${dev}°C from your ${baseline?.toFixed(1)}°C 30-day baseline.` : ''} No notable deviations.`;
}

// ─── Intra-day temperature chart ───────────────────────────────────────────────

function TempLineChart({
  readings,
  baseline,
}: {
  readings: DayTemperatureData['readings'];
  baseline: number | null;
}) {
  const vals = readings.map(r => r.value).filter(v => v > 0);
  if (vals.length === 0) return null;

  const readingMin = Math.min(...vals);
  const readingMax = Math.max(...vals);
  const domainMin = baseline != null
    ? Math.min(baseline - 0.5, readingMin - 0.2)
    : readingMin - 0.3;
  const domainMax = baseline != null
    ? Math.max(baseline + 0.5, readingMax + 0.2)
    : readingMax + 0.3;
  const range = Math.max(0.1, domainMax - domainMin);

  const midnight = new Date(readings[0].recordedAt as any);
  midnight.setHours(0, 0, 0, 0);
  const dayMs = 24 * 60 * 60 * 1000;
  const chartBodyW = CHART_W - PAD_LEFT - 8;

  const xFor = (ts: Date | string) =>
    PAD_LEFT + ((new Date(ts as any).getTime() - midnight.getTime()) / dayMs) * chartBodyW;
  const yFor = (v: number) =>
    PAD_V + ((domainMax - v) / range) * (CHART_H - PAD_V * 2);

  const validPts = readings
    .filter(r => r.value > 0)
    .map(r => ({ x: xFor(r.recordedAt), y: yFor(r.value), v: r.value }));

  const linePath = validPts.length >= 2
    ? monotoneCubicPath(validPts.map(p => ({ x: p.x, y: p.y })))
    : '';

  const firstX = validPts[0]?.x ?? PAD_LEFT;
  const lastX = validPts[validPts.length - 1]?.x ?? CHART_W;
  const areaBottom = yFor(domainMin);
  const areaPath = linePath.length > 0
    ? `${linePath} L ${lastX} ${areaBottom} L ${firstX} ${areaBottom} Z`
    : '';

  const fracs = [0.25, 0.5, 0.75];

  const dotColor = (v: number) => {
    if (baseline != null) {
      const d = v - baseline;
      if (d > 0.3) return '#EF4444';
      if (d < -0.3) return '#60A5FA';
      return '#4ADE80';
    }
    if (v > NORMAL_HIGH) return '#EF4444';
    if (v < NORMAL_LOW) return '#60A5FA';
    return '#4ADE80';
  };

  const baselineY = baseline != null ? yFor(baseline) : null;
  const bandTopY = baseline != null ? yFor(baseline + 0.3) : null;
  const bandBotY = baseline != null ? yFor(baseline - 0.3) : null;

  return (
    <Svg width="100%" height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`}>
      <Defs>
        <LinearGradient id="tempAreaGrad" gradientUnits="userSpaceOnUse"
          x1="0" y1={PAD_V} x2="0" y2={areaBottom}>
          <Stop offset="0%" stopColor="#FB923C" stopOpacity={0.45} />
          <Stop offset="100%" stopColor="#0A0A0F" stopOpacity={0} />
        </LinearGradient>
      </Defs>

      {/* Y-axis labels */}
      {fracs.map((frac, i) => (
        <SvgText key={i}
          x={2} y={PAD_V + frac * (CHART_H - PAD_V * 2) + 3}
          textAnchor="start" fontSize={9} fill="rgba(255,255,255,0.3)"
          fontFamily={fontFamily.regular}
        >
          {(domainMax - frac * range).toFixed(1)}
        </SvgText>
      ))}

      {/* Horizontal guide lines */}
      {fracs.map((frac, i) => (
        <Line key={i}
          x1={PAD_LEFT} x2={CHART_W}
          y1={PAD_V + frac * (CHART_H - PAD_V * 2)}
          y2={PAD_V + frac * (CHART_H - PAD_V * 2)}
          stroke="rgba(255,255,255,0.08)" strokeWidth={1} strokeDasharray="3,4"
        />
      ))}

      {/* Personal baseline band + dashed line */}
      {baseline != null && baselineY != null && bandTopY != null && bandBotY != null && (
        <>
          <Rect
            x={PAD_LEFT} y={bandTopY}
            width={chartBodyW} height={bandBotY - bandTopY}
            fill="rgba(255,255,255,0.04)"
          />
          <Line
            x1={PAD_LEFT} x2={PAD_LEFT + chartBodyW}
            y1={baselineY} y2={baselineY}
            stroke="rgba(255,255,255,0.35)" strokeWidth={1} strokeDasharray="4,3"
          />
          <SvgText
            x={PAD_LEFT + 2} y={baselineY - 4}
            fontSize={8} fill="rgba(255,255,255,0.4)"
            fontFamily={fontFamily.regular}
          >
            {`Baseline ${baseline.toFixed(1)}°`}
          </SvgText>
        </>
      )}

      {/* Area fill + line */}
      {areaPath.length > 0 && <Path d={areaPath} fill="url(#tempAreaGrad)" />}
      {linePath.length > 0 && (
        <Path d={linePath} stroke="rgba(251,146,60,0.9)" strokeWidth={2} fill="none"
          strokeLinecap="round" strokeLinejoin="round" />
      )}

      {/* Dots colored by deviation from baseline */}
      {validPts.map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={3.5} fill={dotColor(p.v)} />
      ))}

      {/* X-axis hour labels */}
      {[0, 6, 12, 18, 24].map(h => {
        const label = h === 0 || h === 24 ? '12AM' : h === 6 ? '6AM' : h === 12 ? '12PM' : '6PM';
        return (
          <SvgText key={h}
            x={PAD_LEFT + (h / 24) * chartBodyW} y={CHART_H - 2}
            textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.4)"
            fontFamily={fontFamily.regular}
          >
            {label}
          </SvgText>
        );
      })}
    </Svg>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function TemperatureDetailScreen() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { data, isLoading } = useMetricHistory<DayTemperatureData>(
    'temperature',
    { initialDays: 7, fullDays: 30 },
  );

  const selectedDateKey = DAY_ENTRIES[selectedIndex]?.dateKey;
  const dayData = selectedDateKey ? data.get(selectedDateKey) : undefined;

  const baseline = computeBaseline(data, selectedDateKey);
  const deviation = dayData && baseline !== null
    ? Math.round((dayData.avg - baseline) * 10) / 10
    : null;

  const { label: statusLabel, color: statusColor } = dayData && dayData.avg > 0
    ? tempStatus(dayData.avg, baseline)
    : { label: '--', color: 'rgba(255,255,255,0.4)' };

  const tempValues = useMemo(
    () => DAY_ENTRIES.map(d => {
      const avg = data.get(d.dateKey)?.avg ?? 0;
      return { dateKey: d.dateKey, value: avg > 0 ? Math.round(avg * 10) / 10 : 0 };
    }),
    [data],
  );

  // Derive chart bounds from actual data so bars fill the space meaningfully.
  // Temperature varies in a narrow range (~0.3–0.8°C), so a fixed 35–38.5 scale
  // makes all bars look tiny and identical.
  const { chartMinVal, chartMaxVal } = useMemo(() => {
    const nonZero = tempValues.map(v => v.value).filter(v => v > 0);
    if (nonZero.length === 0) return { chartMinVal: 35.5, chartMaxVal: 38.0 };
    const lo = Math.min(...nonZero) - 0.2;
    const hi = Math.max(...nonZero) + 0.3;
    // Enforce a minimum 0.8°C visual span so bars aren't all equal height
    if (hi - lo < 0.8) {
      const mid = (lo + hi) / 2;
      return { chartMinVal: Math.round((mid - 0.4) * 10) / 10, chartMaxVal: Math.round((mid + 0.4) * 10) / 10 };
    }
    return { chartMinVal: Math.round(lo * 10) / 10, chartMaxVal: Math.round(hi * 10) / 10 };
  }, [tempValues]);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => { scrollY.value = event.contentOffset.y; },
  });

  const numberAnimStyle = useAnimatedStyle(() => ({
    fontSize: interpolate(scrollY.value, [0, COLLAPSE_END], [72, 36], Extrapolation.CLAMP),
    lineHeight: interpolate(scrollY.value, [0, COLLAPSE_END], [72, 36], Extrapolation.CLAMP),
    color: interpolateColor(scrollY.value, [0, COLLAPSE_END], [statusColor, '#FFFFFF']),
  }));

  const labelAnimStyle = useAnimatedStyle(() => ({
    fontSize: interpolate(scrollY.value, [0, COLLAPSE_END], [18, 13], Extrapolation.CLAMP),
    lineHeight: interpolate(scrollY.value, [0, COLLAPSE_END], [18, 13], Extrapolation.CLAMP),
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

  const hasData = !!dayData && dayData.avg > 0;
  const displayTemp = dayData
    ? (dayData.current > 0 ? dayData.current : dayData.avg)
    : 0;

  return (
    <View style={styles.container}>
      {/* Full-screen gradient background */}
      <Svg style={styles.gradientBg} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <RadialGradient id="tempGrad" cx="51%" cy="-20%" rx="90%" ry="220%">
            <Stop offset="0%" stopColor="#FF8C42" stopOpacity={1} />
            <Stop offset="70%" stopColor="#FF8C42" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="tempGrad2" cx="85%" cy="10%" rx="60%" ry="80%">
            <Stop offset="0%" stopColor="#C25A1A" stopOpacity={0.75} />
            <Stop offset="100%" stopColor="#C25A1A" stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id="tempFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="40%" stopColor="#0A0A0F" stopOpacity={0} />
            <Stop offset="100%" stopColor="#0A0A0F" stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill="url(#tempGrad)" />
        <Rect x="0" y="0" width="100" height="100" fill="url(#tempGrad2)" />
        <Rect x="0" y="0" width="100" height="100" fill="url(#tempFade)" />
      </Svg>

      {/* Gradient zone: header + trend chart */}
      <View style={styles.gradientZone}>
        <DetailPageHeader title="Body Temperature" />

        <TrendBarChart
          dayEntries={DAY_ENTRIES}
          values={tempValues}
          selectedIndex={selectedIndex}
          onSelectDay={setSelectedIndex}
          colorFn={(v) => tempColor(v, baseline)}
          minValue={chartMinVal}
          maxValue={chartMaxVal}
          guideLines={baseline != null ? [baseline] : undefined}
          barWidth={32}
          colWidth={42}
        />
      </View>

      {/* Headline — outside ScrollView, animates on scroll */}
      {hasData && (
        <Reanimated.View style={[styles.headlineSection, headlineHeightStyle]}>
          <View style={styles.headlineLeft}>
            <View style={styles.headlineRow}>
              <Reanimated.Text style={[styles.headlineScore, numberAnimStyle]}>
                {displayTemp > 0 ? displayTemp.toFixed(1) : '--'}
              </Reanimated.Text>
              <View style={styles.labelColumn}>
                <Reanimated.Text style={[styles.headlineLabel, labelAnimStyle]}>
                  °C Today
                </Reanimated.Text>
                <Reanimated.View style={[styles.badgeRow, badgeExpandedStyle]}>
                  <View style={[styles.badge, { backgroundColor: `${statusColor}22`, borderColor: `${statusColor}55` }]}>
                    <Text style={[styles.badgeText, { color: statusColor }]}>{statusLabel}</Text>
                  </View>
                </Reanimated.View>
              </View>
            </View>
          </View>
          <View style={styles.chipRight}>
            <Reanimated.View style={[styles.chip, chipSlideStyle, { backgroundColor: `${statusColor}22`, borderColor: `${statusColor}55` }]}>
              <Text style={[styles.chipText, { color: statusColor }]}>{statusLabel}</Text>
            </Reanimated.View>
          </View>
        </Reanimated.View>
      )}

      <Reanimated.ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="rgba(255,255,255,0.6)" />
            <Text style={styles.loadingText}>Loading history…</Text>
          </View>
        ) : !hasData ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No temperature data for this day</Text>
            <Text style={styles.emptySubtext}>Sync your ring to record body temperature automatically</Text>
          </View>
        ) : (
          <>
            {/* Insight */}
            <View style={styles.insightBlock}>
              <Text style={styles.insightText}>{tempInsight(dayData, baseline)}</Text>
            </View>

            {/* Intra-day chart */}
            {dayData!.readings.length > 0 && (
              <View style={styles.chartContainer}>
                <TempLineChart readings={dayData!.readings} baseline={baseline} />
              </View>
            )}

            {/* Metrics grid */}
            <MetricsGrid metrics={[
              { label: 'Current', value: dayData!.current > 0 ? dayData!.current.toFixed(1) : '--', unit: '°C', accent: statusColor },
              { label: 'Average', value: dayData!.avg > 0 ? dayData!.avg.toFixed(1) : '--', unit: '°C' },
              { label: 'Minimum', value: dayData!.min > 0 ? dayData!.min.toFixed(1) : '--', unit: '°C', accent: '#60A5FA' },
              { label: 'Maximum', value: dayData!.max > 0 ? dayData!.max.toFixed(1) : '--', unit: '°C', accent: dayData!.max > NORMAL_HIGH ? '#EF4444' : undefined },
            ]} />

            {/* Stats rows */}
            <View style={styles.statsContainer}>
              {baseline !== null && (
                <DetailStatRow title="30-Day Baseline" value={`${baseline.toFixed(1)}`} unit="°C" />
              )}
              {deviation !== null && (
                <DetailStatRow
                  title="Deviation"
                  value={`${deviation > 0 ? '+' : ''}${deviation}`}
                  unit="°C"
                  accent={Math.abs(deviation) > 0.5 ? '#EF4444' : Math.abs(deviation) > 0.3 ? '#FBBF24' : undefined}
                />
              )}
              <DetailStatRow title="Readings" value={`${dayData!.readings.length}`} unit="recorded" />
              <DetailStatRow title="Status" value={statusLabel} badge={{ label: statusLabel, color: statusColor }} />
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
  gradientZone: {},
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 60 },
  loadingContainer: { flex: 1, alignItems: 'center', paddingTop: 80, gap: spacing.md },
  loadingText: { color: 'rgba(255,255,255,0.4)', fontSize: fontSize.sm, fontFamily: fontFamily.regular },
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
  headlineRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  labelColumn: { flexDirection: 'column', alignItems: 'flex-start' },
  headlineScore: { fontSize: 72, fontFamily: fontFamily.regular },
  headlineLabel: { color: '#FFFFFF', fontSize: 18, fontFamily: fontFamily.demiBold },
  badgeRow: { flexDirection: 'row', alignSelf: 'flex-start', marginTop: 4 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontFamily: fontFamily.demiBold, textTransform: 'uppercase' },
  chipRight: { overflow: 'hidden' },
  chip: { paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, borderWidth: 1, alignSelf: 'flex-start' },
  chipText: { fontSize: 10, fontFamily: fontFamily.demiBold, textTransform: 'uppercase' },
  chartContainer: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: 8,
    overflow: 'hidden',
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  statsContainer: { marginHorizontal: spacing.md, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, overflow: 'hidden', marginVertical: spacing.sm },
  insightBlock: { marginHorizontal: spacing.md, marginBottom: spacing.lg, paddingHorizontal: spacing.xs },
  insightText: { color: 'rgba(255,255,255,0.75)', fontSize: 16, fontFamily: fontFamily.regular, lineHeight: 24 },
});
