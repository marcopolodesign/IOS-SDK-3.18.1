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
import Svg, { Defs, RadialGradient, Rect, Stop, Path, Line, Circle, Text as SvgText } from 'react-native-svg';
import { TrendBarChart } from '../../src/components/detail/TrendBarChart';
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
const PAD_LEFT = 34; // reserved for Y-axis labels
const PAD_RIGHT = 8;
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

function formatHourLabel(hour: number): string {
  if (hour === 0) return '12:00 AM';
  if (hour === 12) return '12:00 PM';
  return hour > 12 ? `${hour - 12}:00 PM` : `${hour}:00 AM`;
}

function formatHourCompact(hour: number): string {
  if (hour === 0) return '12AM';
  if (hour === 12) return '12PM';
  return hour > 12 ? `${hour - 12}PM` : `${hour}AM`;
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
    restingHR: Math.min(...vals),
    peakHR: Math.max(...vals),
    avgHR: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
  };
}

// ─── Hourly HR line chart ─────────────────────────────────────────────────────
function HourlyHRLine({ points, restingHR, peakHR, endHour, isToday }: { points: DayHRData['hourlyPoints']; restingHR: number; peakHR: number; endHour: number; isToday?: boolean }) {
  const [tooltip, setTooltip] = useState<{ hour: number; heartRate: number; svgX: number; touchPx: number } | null>(null);
  const layoutWidth = useRef(0);
  const currentHour = new Date().getHours();

  const hourMap = new Map<number, number[]>();
  points.forEach(p => {
    if (p.heartRate <= 0) return;
    // Drop readings from future hours when viewing today
    if (isToday && p.hour > currentHour) return;
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

  // X-axis always spans midnight (0) to endHour so scale is consistent across days
  const hourSpan = Math.max(1, endHour);
  const toX = (hour: number) => PAD_LEFT + (hour / hourSpan) * (CHART_W - PAD_LEFT - PAD_RIGHT);
  const toY = (hr: number) => PAD_V + (1 - (hr - minY) / range) * (CHART_H - PAD_V * 2);

  const linePts = sorted.map(p => ({ x: toX(p.hour), y: toY(p.heartRate) }));
  const linePath = 'M ' + linePts.map(p => `${p.x} ${p.y}`).join(' L ');

  const firstX = toX(sorted[0].hour);
  const lastX = toX(sorted[sorted.length - 1].hour);
  const baselineY = toY(minY);
  const areaPath = [
    `M ${PAD_LEFT} ${baselineY}`,
    `L ${firstX} ${baselineY}`,
    ...linePts.map(p => `L ${p.x} ${p.y}`),
    `L ${lastX} ${baselineY}`,
    'Z',
  ].join(' ');

  // Ref-based handler so PanResponder (created once) always calls the latest closure
  const handleRef = useRef<(touchPx: number) => void>(null as any);
  handleRef.current = (touchPx: number) => {
    if (!layoutWidth.current || sorted.length === 0) return;
    const svgX = (touchPx / layoutWidth.current) * CHART_W;
    let nearest = sorted[0];
    let nearestDist = Infinity;
    for (const p of sorted) {
      const dist = Math.abs(toX(p.hour) - svgX);
      if (dist < nearestDist) { nearestDist = dist; nearest = p; }
    }
    setTooltip({ hour: nearest.hour, heartRate: nearest.heartRate, svgX: toX(nearest.hour), touchPx });
  };

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: evt => handleRef.current(evt.nativeEvent.locationX),
    onPanResponderMove: evt => handleRef.current(evt.nativeEvent.locationX),
    onPanResponderRelease: () => setTooltip(null),
    onPanResponderTerminate: () => setTooltip(null),
  })).current;

  const tooltipLeft = tooltip
    ? Math.max(4, Math.min(layoutWidth.current - TOOLTIP_W - 4, tooltip.touchPx - TOOLTIP_W / 2))
    : 0;

  return (
    <View
      {...pan.panHandlers}
      onLayout={e => { layoutWidth.current = e.nativeEvent.layout.width; }}
      style={chartStyles.chartWrapper}
    >
      {tooltip && (
        <View style={[chartStyles.tooltip, { left: tooltipLeft }]}>
          <Text style={chartStyles.tooltipValue}>{tooltip.heartRate} bpm</Text>
          <Text style={chartStyles.tooltipTime}>{formatHourLabel(tooltip.hour)}</Text>
        </View>
      )}
      <Svg width={CHART_W} height={CHART_H}>
        {[0.25, 0.5, 0.75].map((frac, i) => {
          const lineY = PAD_V + frac * (CHART_H - PAD_V * 2);
          const bpm = Math.round(minY + (1 - frac) * range);
          return (
            <React.Fragment key={i}>
              <Line
                x1={PAD_LEFT} x2={CHART_W - PAD_RIGHT}
                y1={lineY} y2={lineY}
                stroke="rgba(255,255,255,0.08)" strokeWidth={1} strokeDasharray="3,4"
              />
              <SvgText
                x={2} y={lineY + 3}
                textAnchor="start" fontSize={9}
                fill="rgba(255,255,255,0.3)"
                fontFamily={fontFamily.regular}
              >{bpm}</SvgText>
            </React.Fragment>
          );
        })}
        <Path d={areaPath} fill="rgba(171,13,13,0.18)" />
        <Path
          d={linePath}
          stroke="rgba(255,255,255,0.85)"
          strokeWidth={1.2}
          fill="none"
        />
        {tooltip && (
          <Line
            x1={tooltip.svgX} y1={PAD_V}
            x2={tooltip.svgX} y2={CHART_H - PAD_V}
            stroke="rgba(255,255,255,0.5)" strokeWidth={1}
          />
        )}
        {sorted.map(p => {
          const isSelected = tooltip?.hour === p.hour;
          return (
            <Circle
              key={p.hour}
              cx={toX(p.hour)}
              cy={toY(p.heartRate)}
              r={isSelected ? 6 : 4.5}
              fill="#FFFFFF"
            />
          );
        })}
        {[0, 6, 12, 18, 24].map(h => (
          <SvgText key={h} x={toX(h)} y={CHART_H - 2} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.4)" fontFamily={fontFamily.regular}>
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

  // Only use live context data when it's actually from today
  const todayLive = selectedIndex === 0 && homeData.hrDataIsToday && homeData.hrChartData.length > 0
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
        // Trust live data for peakHR — Supabase may contain readings from overnight UTC
        // that cross local midnight and incorrectly inflate today's peak.
        peakHR: todayLive.peakHR,
        restingHR: todayLive.restingHR || supabaseToday?.restingHR || 0,
        avgHR: todayLive.avgHR || supabaseToday?.avgHR || 0,
      };
    }
    return supabaseToday;
  })();

  // Chart always spans the full 24h day; future hours are blank (no data)
  const endHour = 24;

  const hrValues = useMemo(() =>
    DAY_ENTRIES.map(d => ({
      dateKey: d.dateKey,
      value: d.dateKey === todayKey && todayLive
        ? todayLive.restingHR
        : (data.get(d.dateKey)?.restingHR ?? 0),
    })),
    [data, todayLive]
  );

  const hasData = !!dayData && (dayData.restingHR > 0 || dayData.hourlyPoints.length > 0);
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
            {dayData!.hourlyPoints.length >= 2 && (
              <View style={styles.chartContainer}>
                <HourlyHRLine
                  points={dayData!.hourlyPoints}
                  restingHR={dayData!.restingHR}
                  peakHR={dayData!.peakHR}
                  endHour={endHour}
                  isToday={selectedIndex === 0}
                />
              </View>
            )}

            {/* Metrics grid */}
            <MetricsGrid metrics={[
              { label: 'Resting HR', value: `${dayData!.restingHR || '--'}`, unit: 'bpm' },
              { label: 'Average HR', value: `${dayData!.avgHR || '--'}`, unit: 'bpm' },
              { label: 'Peak HR', value: `${dayData!.peakHR || '--'}`, unit: 'bpm' },
              { label: 'Hours Tracked', value: `${dayData!.hourlyPoints.length}` },
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
