import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  PanResponder,
} from 'react-native';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  interpolateColor,
  Extrapolation,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, LinearGradient, Rect, Stop, Line, Circle, Path, Text as SvgText } from 'react-native-svg';
import { TrendBarChart } from '../../src/components/detail/TrendBarChart';
import { DetailPageHeader } from '../../src/components/detail/DetailPageHeader';
import { DetailStatRow } from '../../src/components/detail/DetailStatRow';
import { MetricsGrid } from '../../src/components/detail/MetricsGrid';
import { useMetricHistory, buildDayNavigatorLabels } from '../../src/hooks/useMetricHistory';
import type { DaySpO2Data } from '../../src/hooks/useMetricHistory';
import { monotoneCubicPath } from '../../src/utils/chartMath';
import { spacing, fontSize, fontFamily } from '../../src/theme/colors';

const COLLAPSE_END = 80;
const DAY_ENTRIES = buildDayNavigatorLabels(30);
const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_W = SCREEN_WIDTH - spacing.md * 2 - spacing.sm * 2;
const CHART_H = 175;
const PAD_LEFT = 34;
const PAD_RIGHT = 8;
const PAD_V = 16;
const TOOLTIP_W = 100;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function spo2Color(v: number): string {
  if (v <= 0) return 'rgba(255,255,255,0.4)';
  if (v >= 95) return '#4ADE80';
  if (v >= 90) return '#FBBF24';
  return '#EF4444';
}

function spo2Status(avg: number): { label: string; color: string } {
  if (avg >= 95) return { label: 'Normal', color: '#4ADE80' };
  if (avg >= 90) return { label: 'Caution', color: '#FBBF24' };
  return { label: 'Alert', color: '#EF4444' };
}

function spo2Insight(d: DaySpO2Data | undefined): string {
  if (!d || d.readings.length === 0) return 'Sync your ring to see blood oxygen insights.';
  if (d.avg >= 97) return `Excellent SpO₂ of ${d.avg}% — blood oxygen is optimal. Cellular energy delivery is unrestricted.`;
  if (d.avg >= 95) return `Normal SpO₂ of ${d.avg}%.${d.timeBelowNormal > 0 ? ` ${d.timeBelowNormal} readings dipped below 95% — monitor during sleep.` : ' All readings within normal range.'}`;
  if (d.avg >= 90) return `Below-normal SpO₂ of ${d.avg}%. ${d.timeBelowNormal} readings fell below 95%. Consider consulting a physician if this persists.`;
  return `Low SpO₂ of ${d.avg}% — please consult a medical professional. Values below 90% may indicate a health concern.`;
}

function formatTime(ts: Date | string): string {
  const d = new Date(ts as any);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const suf = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m} ${suf}`;
}

// ─── Intra-day line chart ─────────────────────────────────────────────────────

function SpO2LineChart({ readings }: { readings: DaySpO2Data['readings'] }) {
  const [tooltip, setTooltip] = useState<{
    svgX: number;
    value: number;
    time: Date | string;
  } | null>(null);
  const layoutWidthRef = useRef(0);
  const handleTouchRef = useRef<(x: number) => void>(() => {});

  const sorted = useMemo(
    () => readings.filter(r => r.value > 0).sort(
      (a, b) => new Date(a.recordedAt as any).getTime() - new Date(b.recordedAt as any).getTime()
    ),
    [readings]
  );

  const vals = sorted.map(r => r.value);
  if (vals.length === 0) return null;

  const readingMin = Math.min(...vals);
  const readingMax = Math.max(...vals);
  const domainMin = Math.max(85, readingMin - 2);
  const domainMax = Math.min(100, readingMax + 1);
  const range = Math.max(1, domainMax - domainMin);

  const midnight = new Date(sorted[0].recordedAt as any);
  midnight.setHours(0, 0, 0, 0);
  const dayMs = 24 * 60 * 60 * 1000;
  const chartBodyW = CHART_W - PAD_LEFT - PAD_RIGHT;

  const toX = (ts: Date | string) =>
    PAD_LEFT + ((new Date(ts as any).getTime() - midnight.getTime()) / dayMs) * chartBodyW;
  const toY = (v: number) =>
    PAD_V + ((domainMax - v) / range) * (CHART_H - PAD_V * 2);

  const pts = useMemo(
    () => sorted.map(r => ({ x: toX(r.recordedAt), y: toY(r.value), r })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sorted]
  );

  const linePath = useMemo(
    () => pts.length >= 2 ? monotoneCubicPath(pts.map(p => ({ x: p.x, y: p.y }))) : '',
    [pts]
  );

  const threshold95Y = domainMin <= 95 && domainMax >= 95 ? toY(95) : null;

  const fracs = [0.25, 0.5, 0.75];

  handleTouchRef.current = (touchPx: number) => {
    if (!layoutWidthRef.current || pts.length === 0) return;
    const svgX = Math.max(PAD_LEFT, Math.min(CHART_W - PAD_RIGHT, touchPx * (CHART_W / layoutWidthRef.current)));
    let nearest = pts[0];
    let nearestDist = Infinity;
    for (const p of pts) {
      const dist = Math.abs(p.x - svgX);
      if (dist < nearestDist) { nearestDist = dist; nearest = p; }
    }
    setTooltip({ svgX: nearest.x, value: nearest.r.value, time: nearest.r.recordedAt });
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder:        () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder:         () => true,
      onMoveShouldSetPanResponderCapture:  () => true,
      onPanResponderGrant:     e => handleTouchRef.current(e.nativeEvent.locationX),
      onPanResponderMove:      e => handleTouchRef.current(e.nativeEvent.locationX),
      onPanResponderRelease:   () => setTooltip(null),
      onPanResponderTerminate: () => setTooltip(null),
    })
  ).current;

  const tooltipLeft = tooltip
    ? Math.max(0, Math.min(CHART_W - TOOLTIP_W, tooltip.svgX - TOOLTIP_W / 2))
    : 0;

  return (
    <View
      style={styles.chartWrapper}
      onLayout={e => { layoutWidthRef.current = e.nativeEvent.layout.width; }}
      {...pan.panHandlers}
    >
      {tooltip && (
        <View style={[styles.tooltip, { left: tooltipLeft }]}>
          <Text style={[styles.tooltipValue, { color: spo2Color(tooltip.value) }]}>
            {tooltip.value}%
          </Text>
          <Text style={styles.tooltipTime}>{formatTime(tooltip.time)}</Text>
        </View>
      )}
      <Svg width="100%" height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`}>
        {/* Y-axis labels */}
        {fracs.map((frac, i) => (
          <SvgText key={i}
            x={2} y={PAD_V + frac * (CHART_H - PAD_V * 2) + 3}
            textAnchor="start" fontSize={9} fill="rgba(255,255,255,0.3)"
            fontFamily={fontFamily.regular}
          >
            {`${Math.round(domainMax - frac * range)}%`}
          </SvgText>
        ))}

        {/* Horizontal guide lines */}
        {fracs.map((frac, i) => (
          <Line key={i}
            x1={PAD_LEFT} x2={CHART_W - PAD_RIGHT}
            y1={PAD_V + frac * (CHART_H - PAD_V * 2)}
            y2={PAD_V + frac * (CHART_H - PAD_V * 2)}
            stroke="rgba(255,255,255,0.07)" strokeWidth={1} strokeDasharray="3,4"
          />
        ))}

        {/* 95% normal threshold */}
        {threshold95Y != null && (
          <>
            <Line
              x1={PAD_LEFT} x2={PAD_LEFT + chartBodyW}
              y1={threshold95Y} y2={threshold95Y}
              stroke="rgba(74,222,128,0.35)" strokeWidth={1} strokeDasharray="4,3"
            />
            <SvgText
              x={PAD_LEFT + 2} y={threshold95Y - 4}
              fontSize={8} fill="rgba(74,222,128,0.5)"
              fontFamily={fontFamily.regular}
            >
              95% Normal
            </SvgText>
          </>
        )}

        {/* White line */}
        {linePath.length > 0 && (
          <Path
            d={linePath}
            stroke="rgba(255,255,255,0.9)"
            strokeWidth={1.5}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* White dots at each reading */}
        {pts.map((p, i) => (
          <Circle
            key={i}
            cx={p.x} cy={p.y}
            r={2.5}
            fill="#FFFFFF"
            stroke="rgba(10,10,15,0.6)"
            strokeWidth={1}
          />
        ))}

        {/* Scrub indicator */}
        {tooltip && (
          <>
            <Line
              x1={tooltip.svgX} y1={PAD_V} x2={tooltip.svgX} y2={CHART_H - PAD_V}
              stroke="rgba(255,255,255,0.35)" strokeWidth={1}
            />
            <Circle
              cx={tooltip.svgX}
              cy={toY(tooltip.value)}
              r={5} fill="#FFFFFF"
              stroke={spo2Color(tooltip.value)}
              strokeWidth={2}
            />
          </>
        )}

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
    </View>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function SpO2DetailScreen() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { data, isLoading } = useMetricHistory<DaySpO2Data>(
    'spo2',
    { initialDays: 7, fullDays: 30 },
  );

  const selectedDateKey = DAY_ENTRIES[selectedIndex]?.dateKey;
  const dayData = selectedDateKey ? data.get(selectedDateKey) : undefined;

  const { label: statusLabel, color: statusColor } = dayData && dayData.avg > 0
    ? spo2Status(dayData.avg)
    : { label: '--', color: 'rgba(255,255,255,0.4)' };

  const spo2Values = useMemo(
    () => DAY_ENTRIES.map(d => ({
      dateKey: d.dateKey,
      value: data.get(d.dateKey)?.avg ?? 0,
    })),
    [data],
  );

  const { chartMinVal, chartMaxVal } = useMemo(() => {
    const nonZero = spo2Values.map(v => v.value).filter(v => v > 0);
    if (nonZero.length === 0) return { chartMinVal: 90, chartMaxVal: 100 };
    const lo = Math.max(80, Math.min(...nonZero) - 1);
    const hi = Math.min(100, Math.max(...nonZero) + 1);
    if (hi - lo < 4) {
      const mid = (lo + hi) / 2;
      return { chartMinVal: Math.round(mid - 2), chartMaxVal: Math.min(100, Math.round(mid + 2)) };
    }
    return { chartMinVal: lo, chartMaxVal: hi };
  }, [spo2Values]);

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

  return (
    <View style={styles.container}>
      {/* Full-screen gradient background */}
      <Svg style={styles.gradientBg} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <RadialGradient id="spo2Grad" cx="51%" cy="-20%" rx="90%" ry="220%">
            <Stop offset="0%" stopColor="#3B82F6" stopOpacity={1} />
            <Stop offset="70%" stopColor="#3B82F6" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="spo2Grad2" cx="85%" cy="10%" rx="60%" ry="80%">
            <Stop offset="0%" stopColor="#1D4ED8" stopOpacity={0.75} />
            <Stop offset="100%" stopColor="#1D4ED8" stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id="spo2Fade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="40%" stopColor="#0A0A0F" stopOpacity={0} />
            <Stop offset="100%" stopColor="#0A0A0F" stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill="url(#spo2Grad)" />
        <Rect x="0" y="0" width="100" height="100" fill="url(#spo2Grad2)" />
        <Rect x="0" y="0" width="100" height="100" fill="url(#spo2Fade)" />
      </Svg>

      {/* Gradient zone */}
      <View style={styles.gradientZone}>
        <DetailPageHeader title="Blood Oxygen" />

        <TrendBarChart
          dayEntries={DAY_ENTRIES}
          values={spo2Values}
          selectedIndex={selectedIndex}
          onSelectDay={setSelectedIndex}
          colorFn={spo2Color}
          minValue={chartMinVal}
          maxValue={chartMaxVal}
          guideLines={chartMinVal <= 95 && chartMaxVal >= 95 ? [95] : undefined}
          barWidth={32}
          colWidth={42}
        />
      </View>

      {/* Headline */}
      {hasData && (
        <Reanimated.View style={[styles.headlineSection, headlineHeightStyle]}>
          <View style={styles.headlineLeft}>
            <View style={styles.headlineRow}>
              <Reanimated.Text style={[styles.headlineScore, numberAnimStyle]}>
                {dayData!.avg || '--'}
              </Reanimated.Text>
              <View style={styles.labelColumn}>
                <Reanimated.Text style={[styles.headlineLabel, labelAnimStyle]}>
                  % SpO₂
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
        scrollEventThrottle={16}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="rgba(255,255,255,0.6)" />
            <Text style={styles.loadingText}>Loading history…</Text>
          </View>
        ) : !hasData ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No SpO₂ data for this day</Text>
            <Text style={styles.emptySubtext}>Sync your ring to record blood oxygen automatically</Text>
          </View>
        ) : (
          <>
            {/* Insight */}
            <View style={styles.insightBlock}>
              <Text style={styles.insightText}>{spo2Insight(dayData)}</Text>
            </View>

            {/* Intra-day line chart */}
            {dayData!.readings.length > 0 && (
              <View style={styles.chartContainer}>
                <SpO2LineChart readings={dayData!.readings} />
              </View>
            )}

            {/* Legend */}
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#4ADE80' }]} />
                <Text style={styles.legendText}>Normal ≥95%</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#FBBF24' }]} />
                <Text style={styles.legendText}>Caution 90–94%</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
                <Text style={styles.legendText}>Low &lt;90%</Text>
              </View>
            </View>

            {/* Metrics grid */}
            <MetricsGrid metrics={[
              { label: 'Avg SpO₂', value: dayData!.avg ? `${dayData!.avg}` : '--', unit: '%', accent: statusColor },
              { label: 'Minimum', value: dayData!.min ? `${dayData!.min}` : '--', unit: '%', accent: dayData!.min < 90 ? '#EF4444' : dayData!.min < 95 ? '#FBBF24' : undefined },
              { label: 'Maximum', value: dayData!.max ? `${dayData!.max}` : '--', unit: '%' },
              { label: 'Readings', value: `${dayData!.readings.length}` },
            ]} />

            {/* Stats rows */}
            <View style={styles.statsContainer}>
              <DetailStatRow
                title="Time Below 95%"
                value={`${dayData!.timeBelowNormal}`}
                unit="readings"
                accent={dayData!.timeBelowNormal > 5 ? '#EF4444' : dayData!.timeBelowNormal > 0 ? '#FBBF24' : undefined}
              />
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
  chartWrapper: { position: 'relative' },
  chartContainer: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: 8,
    overflow: 'hidden',
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  tooltip: {
    position: 'absolute',
    top: 4,
    width: TOOLTIP_W,
    backgroundColor: 'rgba(20,20,30,0.92)',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 8,
    alignItems: 'center',
    zIndex: 10,
    gap: 2,
  },
  tooltipValue: { fontSize: 15, fontFamily: fontFamily.demiBold },
  tooltipTime: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontFamily: fontFamily.regular },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md, paddingVertical: spacing.xs, paddingBottom: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: 'rgba(255,255,255,0.45)', fontSize: 10, fontFamily: fontFamily.regular },
  statsContainer: { marginHorizontal: spacing.md, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, overflow: 'hidden', marginVertical: spacing.sm },
  insightBlock: { marginHorizontal: spacing.md, marginBottom: spacing.lg, paddingHorizontal: spacing.xs },
  insightText: { color: 'rgba(255,255,255,0.75)', fontSize: 16, fontFamily: fontFamily.regular, lineHeight: 24 },
});
