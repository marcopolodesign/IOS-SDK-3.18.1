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
  FadeIn,
} from 'react-native-reanimated';
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
  Path,
  Text as SvgText,
} from 'react-native-svg';
import { TrendBarChart } from '../../src/components/detail/TrendBarChart';
import { DetailPageHeader } from '../../src/components/detail/DetailPageHeader';
import { MetricsGrid } from '../../src/components/detail/MetricsGrid';
import { useMetricHistory, buildDayNavigatorLabels } from '../../src/hooks/useMetricHistory';
import type { DayActivityData } from '../../src/hooks/useMetricHistory';
import { useHomeDataContext } from '../../src/context/HomeDataContext';
import { spacing, fontSize, fontFamily } from '../../src/theme/colors';

const COLLAPSE_END = 80;
const DAY_ENTRIES = buildDayNavigatorLabels(30);
const SCREEN_WIDTH = Dimensions.get('window').width;
const STEP_GOAL = 10000;
const ACTIVITY_BLUE = '#3B82F6';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function activityColor(steps: number): string {
  const pct = steps / STEP_GOAL;
  if (pct >= 1) return '#4ADE80';
  if (pct >= 0.7) return '#FBBF24';
  if (pct >= 0.4) return ACTIVITY_BLUE;
  return 'rgba(255,255,255,0.3)';
}

function activityLevelLabel(steps: number): string {
  const pct = (steps / STEP_GOAL) * 100;
  if (pct >= 100) return 'Active';
  if (pct >= 70) return 'Moderate';
  if (pct >= 40) return 'Light';
  return 'Sedentary';
}

function activityInsight(d: DayActivityData | undefined): string {
  if (!d) return 'Sync your ring to see activity insights.';
  const pct = Math.round((d.steps / STEP_GOAL) * 100);
  const distKm = (d.distanceM / 1000).toFixed(2);
  if (d.steps >= STEP_GOAL) {
    return `Goal reached! ${d.steps.toLocaleString()} steps — ${distKm} km covered and ${d.calories} kcal burned. Keep up the momentum.`;
  }
  if (d.steps >= STEP_GOAL * 0.7) {
    return `Almost there — ${pct}% of your ${STEP_GOAL.toLocaleString()} step goal. ${(STEP_GOAL - d.steps).toLocaleString()} steps remain.`;
  }
  return `${d.steps.toLocaleString()} steps logged — ${pct}% of daily goal. Even a short 10-minute walk can make a significant difference.`;
}

function buildTodayActivityFromContext(activity: { steps: number; calories: number; distance: number }): DayActivityData | null {
  if (!activity || (activity.steps === 0 && activity.calories === 0)) return null;
  const today = new Date().toISOString().split('T')[0];
  return {
    date: today,
    steps: activity.steps,
    distanceM: activity.distance,
    calories: activity.calories,
    sleepTotalMin: null,
    hrAvg: null,
    hrMin: null,
  };
}

// ─── Steps arc gauge ───────────────────────────────────────────────────────────

const GAUGE_SIZE = 200;
const GAUGE_CENTER = GAUGE_SIZE / 2;
const GAUGE_RADIUS = 80;
const GAUGE_STROKE = 14;

function polarToXY(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const start = polarToXY(cx, cy, r, startDeg);
  const end = polarToXY(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

function StepsArcGauge({ steps, goal }: { steps: number; goal: number }) {
  const pct = Math.min(steps / goal, 1);
  const arcStart = -140;
  const arcTotal = 280;
  const fillEnd = arcStart + pct * arcTotal;
  const color = activityColor(steps);

  return (
    <Svg width={GAUGE_SIZE} height={GAUGE_SIZE}>
      <Path
        d={arcPath(GAUGE_CENTER, GAUGE_CENTER, GAUGE_RADIUS, arcStart, arcStart + arcTotal)}
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={GAUGE_STROKE}
        fill="none"
        strokeLinecap="round"
      />
      {pct > 0 && (
        <Path
          d={arcPath(GAUGE_CENTER, GAUGE_CENTER, GAUGE_RADIUS, arcStart, fillEnd)}
          stroke={color}
          strokeWidth={GAUGE_STROKE}
          fill="none"
          strokeLinecap="round"
        />
      )}
      <SvgText x={GAUGE_CENTER} y={GAUGE_CENTER - 8} textAnchor="middle" fill="#FFFFFF" fontSize={28} fontWeight="300">
        {steps >= 1000 ? `${(steps / 1000).toFixed(1)}k` : `${steps}`}
      </SvgText>
      <SvgText x={GAUGE_CENTER} y={GAUGE_CENTER + 14} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize={11}>
        STEPS
      </SvgText>
      <SvgText x={GAUGE_CENTER} y={GAUGE_CENTER + 32} textAnchor="middle" fill={color} fontSize={12}>
        {Math.round(pct * 100)}% of goal
      </SvgText>
    </Svg>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function ActivityDetailScreen() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { data, isLoading } = useMetricHistory<DayActivityData>('activity', { fullDays: 30 });
  const homeData = useHomeDataContext();

  const selectedDateKey = DAY_ENTRIES[selectedIndex]?.dateKey;
  const todayKey = DAY_ENTRIES[0]?.dateKey;

  const contextToday = useMemo(
    () => buildTodayActivityFromContext(homeData.activity),
    [homeData.activity],
  );

  const dayData = useMemo(() => {
    if (selectedIndex === 0) {
      return contextToday ?? data.get(todayKey);
    }
    return selectedDateKey ? data.get(selectedDateKey) : undefined;
  }, [selectedIndex, contextToday, data, todayKey, selectedDateKey]);

  const stepValues = useMemo(() =>
    DAY_ENTRIES.map(d => ({
      dateKey: d.dateKey,
      value: d.dateKey === todayKey && contextToday
        ? contextToday.steps
        : (data.get(d.dateKey)?.steps ?? 0),
    })),
    [data, contextToday, todayKey],
  );

  const steps = dayData?.steps ?? 0;
  const color = activityColor(steps);
  const level = activityLevelLabel(steps);
  const hasData = !!dayData;

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
      <Reanimated.View entering={FadeIn.duration(600)} style={styles.gradientBg} pointerEvents="none">
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
          <Defs>
            <RadialGradient id="actGrad" cx="51%" cy="-20%" rx="90%" ry="220%">
              <Stop offset="0%" stopColor={ACTIVITY_BLUE} stopOpacity={1} />
              <Stop offset="70%" stopColor={ACTIVITY_BLUE} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="actGrad2" cx="85%" cy="10%" rx="60%" ry="80%">
              <Stop offset="0%" stopColor="#1D4ED8" stopOpacity={0.75} />
              <Stop offset="100%" stopColor="#1D4ED8" stopOpacity={0} />
            </RadialGradient>
            <LinearGradient id="actFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="40%" stopColor="#0A0A0F" stopOpacity={0} />
              <Stop offset="100%" stopColor="#0A0A0F" stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100" height="100" fill="url(#actGrad)" />
          <Rect x="0" y="0" width="100" height="100" fill="url(#actGrad2)" />
          <Rect x="0" y="0" width="100" height="100" fill="url(#actFade)" />
        </Svg>
      </Reanimated.View>

      <View style={styles.gradientZone}>
        <DetailPageHeader title="Activity" />
        <TrendBarChart
          dayEntries={DAY_ENTRIES}
          values={stepValues}
          selectedIndex={selectedIndex}
          onSelectDay={setSelectedIndex}
          colorFn={activityColor}
          maxValue={STEP_GOAL}
          showValueLabels={false}
          guideLines={[Math.round(STEP_GOAL * 0.7), STEP_GOAL]}
        />
      </View>

      {hasData && (
        <Reanimated.View style={[styles.headlineSection, headlineHeightStyle]}>
          <View style={styles.headlineLeft}>
            <View style={styles.headlineRow}>
              <Reanimated.Text style={[styles.headlineScore, numberAnimStyle]}>
                {steps >= 1000 ? `${(steps / 1000).toFixed(1)}k` : `${steps}`}
              </Reanimated.Text>
              <View style={styles.labelColumn}>
                <Reanimated.Text style={[styles.headlineLabel, labelAnimStyle]}>
                  Steps
                </Reanimated.Text>
                <Reanimated.View style={[styles.badgeRow, badgeExpandedStyle]}>
                  <View style={[styles.badge, { backgroundColor: `${color}22`, borderColor: `${color}55` }]}>
                    <Text style={[styles.badgeText, { color }]}>{level}</Text>
                  </View>
                </Reanimated.View>
              </View>
            </View>
          </View>
          <View style={styles.chipRight}>
            <Reanimated.View style={[styles.chip, chipSlideStyle, { backgroundColor: `${color}22`, borderColor: `${color}55` }]}>
              <Text style={[styles.chipText, { color }]}>{level}</Text>
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
            <Text style={styles.emptyText}>No activity data for this day</Text>
            <Text style={styles.emptySubtext}>Sync your ring to record steps automatically</Text>
          </View>
        ) : (
          <>
            <View style={styles.insightBlock}>
              <Text style={styles.insightText}>{activityInsight(dayData)}</Text>
            </View>

            <View style={styles.gaugeContainer}>
              <StepsArcGauge steps={dayData!.steps} goal={STEP_GOAL} />
              {dayData!.hrAvg !== null && (
                <Text style={styles.gaugeSubLabel}>{dayData!.hrAvg} bpm avg HR</Text>
              )}
            </View>

            <MetricsGrid metrics={[
              { label: 'Steps', value: dayData!.steps.toLocaleString(), accent: color },
              { label: 'Distance', value: `${(dayData!.distanceM / 1000).toFixed(2)}`, unit: 'km' },
              { label: 'Calories', value: `${dayData!.calories}`, unit: 'kcal' },
              { label: 'Avg HR', value: dayData!.hrAvg !== null ? `${dayData!.hrAvg}` : '--', unit: dayData!.hrAvg !== null ? 'bpm' : undefined },
            ]} />
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
  headlineScore: { fontSize: 88, fontFamily: fontFamily.regular },
  headlineLabel: { color: '#FFFFFF', fontSize: 24, fontFamily: fontFamily.demiBold },
  badgeRow: { flexDirection: 'row', alignSelf: 'flex-start', marginTop: 4 },
  chipRight: { overflow: 'hidden' },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontFamily: fontFamily.demiBold, textTransform: 'uppercase' },
  chip: { paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, borderWidth: 1, alignSelf: 'flex-start' },
  chipText: { fontSize: 10, fontFamily: fontFamily.demiBold, textTransform: 'uppercase' },
  insightBlock: { marginHorizontal: spacing.md, marginBottom: spacing.lg, paddingHorizontal: spacing.xs },
  insightText: { color: 'rgba(255,255,255,0.75)', fontSize: 16, fontFamily: fontFamily.regular, lineHeight: 24 },
  gaugeContainer: { alignItems: 'center', paddingVertical: spacing.sm, marginBottom: spacing.sm },
  gaugeSubLabel: { color: 'rgba(255,255,255,0.35)', fontSize: fontSize.sm, fontFamily: fontFamily.regular, marginTop: spacing.xs },
});
