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
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop, Path, Line, Circle, Text as SvgText } from 'react-native-svg';
import { TrendBarChart } from '../../src/components/detail/TrendBarChart';
import { monotoneCubicPath } from '../../src/utils/chartMath';
import { DetailPageHeader } from '../../src/components/detail/DetailPageHeader';
import { MetricsGrid } from '../../src/components/detail/MetricsGrid';
import { LiveHeartRateCard } from '../../src/components/home/LiveHeartRateCard';
import { useMetricHistory, buildDayNavigatorLabels } from '../../src/hooks/useMetricHistory';
import type { DayHRData } from '../../src/hooks/useMetricHistory';
import { useHomeDataContext } from '../../src/context/HomeDataContext';
import { spacing, fontSize, fontFamily } from '../../src/theme/colors';

const COLLAPSE_END = 80;

const DAY_ENTRIES = buildDayNavigatorLabels(30);
const SCREEN_WIDTH = Dimensions.get('window').width;
// CHART_W accounts for chartContainer marginHorizontal (md) + paddingHorizontal (sm) both sides
const CHART_W = SCREEN_WIDTH - spacing.md * 2 - spacing.sm * 2;
const CHART_H = 234;
const PAD_LEFT = 34;
const PAD_V = 16;
const TOOLTIP_W = 88;


function hrQualityLabel(restingHR: number): string {
  if (restingHR <= 0) return 'No data';
  if (restingHR <= 55) return 'Excellent';
  if (restingHR <= 65) return 'Good';
  if (restingHR <= 75) return 'Fair';
  return 'Elevated';
}

function hrColor(restingHR: number): string {
  if (restingHR <= 0) return '#222233';
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

function formatHourCompact(hour: number): string {
  if (hour === 0) return '12AM';
  if (hour === 12) return '12PM';
  return hour > 12 ? `${hour - 12}PM` : `${hour}AM`;
}

function formatTimeFromMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayH}:${String(m).padStart(2, '0')} ${suffix}`;
}

function buildTodayHRFromContext(
  hrChartData: Array<{ timeMinutes: number; heartRate: number }>,
): DayHRData | null {
  if (!hrChartData || hrChartData.length === 0) return null;
  const pts = hrChartData.filter(p => p.heartRate > 0);
  if (pts.length === 0) return null;
  const vals = pts.map(p => p.heartRate);
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return {
    date: today,
    hourlyPoints: pts.map(p => ({ hour: Math.floor(p.timeMinutes / 60) % 24, heartRate: p.heartRate })),
    minutePoints: pts,
    restingHR: Math.min(...vals),
    peakHR: Math.max(...vals),
    avgHR: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
  };
}

// ─── Fit-to-screen continuous HR line chart with drag-to-scrub ────────────────
function ContinuousHRLine({
  points, restingHR, peakHR, isToday,
}: {
  points: DayHRData['minutePoints']; restingHR: number; peakHR: number; isToday?: boolean;
}) {
  const [tooltip, setTooltip] = useState<{ svgX: number; heartRate: number; timeMinutes: number } | null>(null);
  const layoutWidthRef = useRef(0);
  const handleTouchRef = useRef<(x: number) => void>(() => {});

  const maxMinute = useMemo(() => {
    if (!isToday) return 1440;
    const now = new Date();
    return Math.max(60, now.getHours() * 60 + now.getMinutes());
  }, [isToday]);

  const filtered = useMemo(() => {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    return points
      .filter(p => p.heartRate > 0 && (!isToday || p.timeMinutes <= nowMin))
      .sort((a, b) => a.timeMinutes - b.timeMinutes);
  }, [points, isToday]);

  const minY = Math.max(30, restingHR - 10);
  const range = Math.max(1, peakHR + 10 - minY);
  const chartBodyW = CHART_W - PAD_LEFT;

  const toX = (tm: number) => PAD_LEFT + (tm / maxMinute) * chartBodyW;
  const toY = (hr: number) => PAD_V + (1 - (hr - minY) / range) * (CHART_H - PAD_V * 2);

  const { linePath, linePts, peakSample, troughSample } = useMemo(() => {
    if (filtered.length < 2) return { linePath: '', linePts: [], peakSample: null, troughSample: null };
    const innerToX = (tm: number) => PAD_LEFT + (tm / maxMinute) * chartBodyW;
    const innerToY = (hr: number) => PAD_V + (1 - (hr - minY) / range) * (CHART_H - PAD_V * 2);
    const pts = filtered.map(p => ({ x: innerToX(p.timeMinutes), y: innerToY(p.heartRate) }));
    const path = monotoneCubicPath(pts);
    const peak = filtered.reduce((a, b) => b.heartRate > a.heartRate ? b : a, filtered[0]);
    const trough = filtered.reduce((a, b) => b.heartRate < a.heartRate ? b : a, filtered[0]);
    return { linePath: path, linePts: pts, peakSample: peak, troughSample: trough };
  }, [filtered, minY, range, maxMinute, chartBodyW]);

  // Mutated on every render so PanResponder always sees current state
  handleTouchRef.current = (touchPx: number) => {
    if (!layoutWidthRef.current || filtered.length === 0) return;
    const svgX = Math.max(PAD_LEFT, Math.min(CHART_W, touchPx * (CHART_W / layoutWidthRef.current)));
    let nearest = filtered[0];
    let nearestDist = Infinity;
    for (const p of filtered) {
      const dist = Math.abs(toX(p.timeMinutes) - svgX);
      if (dist < nearestDist) { nearestDist = dist; nearest = p; }
    }
    setTooltip({ svgX: toX(nearest.timeMinutes), heartRate: nearest.heartRate, timeMinutes: nearest.timeMinutes });
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder:        () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder:         () => true,
      onMoveShouldSetPanResponderCapture:  () => true,
      onPanResponderGrant:     e => handleTouchRef.current(e.nativeEvent.locationX),
      onPanResponderMove:      e => handleTouchRef.current(e.nativeEvent.locationX),
      onPanResponderRelease:   ()  => setTooltip(null),
      onPanResponderTerminate: ()  => setTooltip(null),
    })
  ).current;

  if (filtered.length < 2 || !linePath || !peakSample || !troughSample) return null;

  const firstX = linePts[0].x;
  const lastX = linePts[linePts.length - 1].x;
  const baselineY = toY(minY);
  const areaPath = `${linePath} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z`;

  const peakX = toX(peakSample.timeMinutes);
  const peakYPos = toY(peakSample.heartRate);
  const troughX = toX(troughSample.timeMinutes);
  const troughYPos = toY(troughSample.heartRate);
  const peakLabelY = Math.max(PAD_V + 10, peakYPos - 8);
  const troughLabelY = Math.min(CHART_H - PAD_V - 2, troughYPos + 14);

  const tooltipLeft = tooltip
    ? Math.max(0, Math.min(CHART_W - TOOLTIP_W, tooltip.svgX - TOOLTIP_W / 2))
    : 0;

  // Only show hour ticks up to maxMinute
  const maxHour = Math.ceil(maxMinute / 60);
  const hourTicks = [0, 3, 6, 9, 12, 15, 18, 21, 24].filter(h => h <= maxHour);

  return (
    <View
      style={chartStyles.chartWrapper}
      onLayout={e => { layoutWidthRef.current = e.nativeEvent.layout.width; }}
      {...pan.panHandlers}
    >
      {tooltip && (
        <View style={[chartStyles.tooltip, { left: tooltipLeft }]}>
          <Text style={chartStyles.tooltipValue}>{tooltip.heartRate} bpm</Text>
          <Text style={chartStyles.tooltipTime}>{formatTimeFromMinutes(tooltip.timeMinutes)}</Text>
        </View>
      )}

      <Svg width="100%" height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`}>
        <Defs>
          <LinearGradient id="hrAreaGrad" gradientUnits="userSpaceOnUse" x1="0" y1={PAD_V} x2="0" y2={baselineY}>
            <Stop offset="0%" stopColor="#AB0D0D" stopOpacity={0.5} />
            <Stop offset="100%" stopColor="#0A0A0F" stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {/* Y-axis labels */}
        {[0.25, 0.5, 0.75].map((frac, i) => (
          <SvgText key={i} x={2} y={PAD_V + frac * (CHART_H - PAD_V * 2) + 3}
            textAnchor="start" fontSize={9} fill="rgba(255,255,255,0.3)"
            fontFamily={fontFamily.regular}
          >
            {Math.round(minY + (1 - frac) * range)}
          </SvgText>
        ))}

        {/* Horizontal guide lines */}
        {[0.25, 0.5, 0.75].map((frac, i) => (
          <Line key={i}
            x1={PAD_LEFT} x2={CHART_W}
            y1={PAD_V + frac * (CHART_H - PAD_V * 2)}
            y2={PAD_V + frac * (CHART_H - PAD_V * 2)}
            stroke="rgba(255,255,255,0.08)" strokeWidth={1} strokeDasharray="3,4"
          />
        ))}

        <Path d={areaPath} fill="url(#hrAreaGrad)" />
        <Path d={linePath} stroke="rgba(255,255,255,0.85)" strokeWidth={1.2} fill="none" />

        {/* Peak marker */}
        <Circle cx={peakX} cy={peakYPos} r={4} fill="#FF6B6B" />
        <SvgText x={peakX} y={peakLabelY} textAnchor="middle" fontSize={9} fill="#FF9999" fontFamily={fontFamily.demiBold}>
          {peakSample.heartRate}
        </SvgText>

        {/* Trough marker */}
        {troughSample.timeMinutes !== peakSample.timeMinutes && (
          <>
            <Circle cx={troughX} cy={troughYPos} r={4} fill="rgba(255,255,255,0.7)" />
            <SvgText x={troughX} y={troughLabelY} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.6)" fontFamily={fontFamily.demiBold}>
              {troughSample.heartRate}
            </SvgText>
          </>
        )}

        {/* Drag cursor */}
        {tooltip && (
          <>
            <Line
              x1={tooltip.svgX} y1={PAD_V} x2={tooltip.svgX} y2={CHART_H - PAD_V}
              stroke="rgba(255,255,255,0.5)" strokeWidth={1}
            />
            <Circle cx={tooltip.svgX} cy={toY(tooltip.heartRate)} r={5} fill="#FFFFFF" />
          </>
        )}

        {/* X-axis hour ticks */}
        {hourTicks.map(h => (
          <SvgText key={h} x={toX(h * 60)} y={CHART_H - 2}
            textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.4)"
            fontFamily={fontFamily.regular}
          >
            {formatHourCompact(h === 24 ? 0 : h)}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

const chartStyles = StyleSheet.create({
  chartWrapper: {
    position: 'relative',
  },
  tooltip: {
    position: 'absolute',
    top: 4,
    width: TOOLTIP_W,
    backgroundColor: 'rgba(10,10,20,0.92)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: 'center',
    zIndex: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  tooltipValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: fontFamily.demiBold,
  },
  tooltipTime: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontFamily: fontFamily.regular,
    marginTop: 1,
  },
});

// ─── Screen ────────────────────────────────────────────────────────────────────
export default function HeartRateDetailScreen() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { data, isLoading } = useMetricHistory<DayHRData>('heartRate', { initialDays: 7, fullDays: 30 });
  const homeData = useHomeDataContext();

  const selectedDateKey = DAY_ENTRIES[selectedIndex]?.dateKey;
  const todayKey = DAY_ENTRIES[0]?.dateKey;

  // Live ring data for today — computed independently of selectedIndex so the
  // trend bar for today doesn't jump when navigating to a different day.
  const todayLiveData = homeData.hrDataIsToday && homeData.hrChartData.length > 0
    ? buildTodayHRFromContext(homeData.hrChartData)
    : null;

  // Only overlay live data in the detail section when today is actually selected.
  const todayLive = selectedIndex === 0 ? todayLiveData : null;

  const dayData = (() => {
    if (selectedIndex !== 0 || !selectedDateKey) {
      return selectedDateKey ? data.get(selectedDateKey) : undefined;
    }
    const supabaseToday = data.get(todayKey);
    if (todayLive) {
      return {
        ...todayLive,
        // Trust live data for peakHR — Supabase may contain readings from overnight UTC
        // that cross local midnight and incorrectly inflate today's peak.
        peakHR: todayLive.peakHR,
        restingHR: todayLive.restingHR || supabaseToday?.restingHR || 0,
        avgHR: todayLive.avgHR || supabaseToday?.avgHR || 0,
      };
    }
    return supabaseToday;
  })();

  const hrValues = useMemo(() =>
    DAY_ENTRIES.map(d => ({
      dateKey: d.dateKey,
      value: d.dateKey === todayKey && todayLiveData
        ? todayLiveData.restingHR
        : (data.get(d.dateKey)?.restingHR ?? 0),
    })),
    [data, todayLiveData]
  );

  const hasData = !!dayData && (dayData.restingHR > 0 || (dayData.minutePoints?.length ?? dayData.hourlyPoints.length) > 0);
  const color = hrColor(dayData?.restingHR ?? 0);
  const label = hrQualityLabel(dayData?.restingHR ?? 0);

  // Scroll-linked collapse animation
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => { scrollY.value = event.contentOffset.y; },
  });

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

        <DetailPageHeader title="Heart Rate" />

        <TrendBarChart
          dayEntries={DAY_ENTRIES}
          values={hrValues}
          selectedIndex={selectedIndex}
          onSelectDay={setSelectedIndex}
          colorFn={hrColor}
          maxValue={120}
          guideLines={[30, 60, 90]}
        />
      </View>

      {/* Headline — outside ScrollView, animates on scroll */}
      {hasData && (
        <Reanimated.View style={[styles.headlineSection, headlineHeightStyle]}>
          <View style={styles.headlineLeft}>
            <View style={styles.headlineRow}>
              <Reanimated.Text style={[styles.headlineScore, numberAnimStyle]}>
                {dayData!.restingHR || '--'}
              </Reanimated.Text>
              <View style={styles.labelColumn}>
                <Reanimated.Text style={[styles.headlineLabel, labelAnimStyle]}>
                  Resting BPM
                </Reanimated.Text>
                <Reanimated.View style={[styles.badgeRow, badgeExpandedStyle]}>
                  <View style={[styles.badge, { backgroundColor: `${color}22`, borderColor: `${color}55` }]}>
                    <Text style={[styles.badgeText, { color }]}>{label}</Text>
                  </View>
                </Reanimated.View>
              </View>
            </View>
          </View>
          {/* Chip slides up from below on scroll (overflow hidden clips it) */}
          <View style={styles.chipRight}>
            <Reanimated.View style={[styles.chip, chipSlideStyle, { backgroundColor: `${color}22`, borderColor: `${color}55` }]}>
              <Text style={[styles.chipText, { color }]}>{label}</Text>
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
            <Text style={styles.emptyText}>No heart rate data for this day</Text>
            <Text style={styles.emptySubtext}>Sync your ring to record heart rate automatically</Text>
          </View>
        ) : (
          <>
            {/* Insight */}
            <View style={styles.insightBlock}>
              <Text style={styles.insightText}>{hrInsight(dayData)}</Text>
            </View>

            {/* Line chart */}
            {(dayData!.minutePoints?.length ?? dayData!.hourlyPoints.length) >= 2 && (
              <View style={styles.chartContainer}>
                <ContinuousHRLine
                  points={dayData!.minutePoints ?? dayData!.hourlyPoints.map(p => ({ timeMinutes: p.hour * 60, heartRate: p.heartRate }))}
                  restingHR={dayData!.restingHR}
                  peakHR={dayData!.peakHR}
                  isToday={selectedIndex === 0}
                />
              </View>
            )}

            {/* Metrics grid */}
            <MetricsGrid metrics={[
              { label: 'Resting HR', value: `${dayData!.restingHR || '--'}`, unit: 'bpm' },
              { label: 'Average HR', value: `${dayData!.avgHR || '--'}`, unit: 'bpm' },
              { label: 'Peak HR', value: `${dayData!.peakHR || '--'}`, unit: 'bpm' },
              { label: 'Readings', value: `${dayData!.minutePoints?.length ?? dayData!.hourlyPoints.length}` },
            ]} />

            {/* Live measurement */}
            <View style={styles.liveCardWrapper}>
              <LiveHeartRateCard />
            </View>
          </>
        )}
      </Reanimated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  gradientZone: { overflow: 'hidden' },
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
  headlineLeft: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  headlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  labelColumn: { flexDirection: 'column', alignItems: 'flex-start' },
  headlineScore: {
    fontSize: 88,
    fontFamily: fontFamily.regular,
  },
  headlineLabel: {
    color: '#FFFFFF',
    fontSize: 24,
    fontFamily: fontFamily.demiBold,
  },
  badgeRow: { flexDirection: 'row', alignSelf: 'flex-start', marginTop: 4 },
  chipRight: {
    overflow: 'hidden',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 12, fontFamily: fontFamily.demiBold, textTransform: 'uppercase' },
  chip: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
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
  liveCardWrapper: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  insightBlock: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xs,
  },
  insightText: { color: 'rgba(255,255,255,0.75)', fontSize: 16, fontFamily: fontFamily.regular, lineHeight: 24 },
});
