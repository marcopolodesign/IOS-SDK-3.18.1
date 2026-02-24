import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import Svg, { Circle, Path, G, Text as SvgText, Rect, Line } from 'react-native-svg';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DayNavigator } from '../../src/components/detail/DayNavigator';
import { DetailStatRow } from '../../src/components/detail/DetailStatRow';
import { useMetricHistory, buildDayNavigatorLabels } from '../../src/hooks/useMetricHistory';
import type { DayActivityData } from '../../src/hooks/useMetricHistory';
import { useHomeDataContext } from '../../src/context/HomeDataContext';
import { spacing, fontSize, fontFamily } from '../../src/theme/colors';

const DAY_ENTRIES = buildDayNavigatorLabels(7);
const SCREEN_WIDTH = Dimensions.get('window').width;
const STEP_GOAL = 10000;

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

  const color = pct >= 1 ? '#4ADE80' : pct >= 0.7 ? '#FBBF24' : '#3B82F6';

  return (
    <Svg width={GAUGE_SIZE} height={GAUGE_SIZE}>
      {/* Track */}
      <Path
        d={arcPath(GAUGE_CENTER, GAUGE_CENTER, GAUGE_RADIUS, arcStart, arcStart + arcTotal)}
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={GAUGE_STROKE}
        fill="none"
        strokeLinecap="round"
      />
      {/* Fill */}
      {pct > 0 && (
        <Path
          d={arcPath(GAUGE_CENTER, GAUGE_CENTER, GAUGE_RADIUS, arcStart, fillEnd)}
          stroke={color}
          strokeWidth={GAUGE_STROKE}
          fill="none"
          strokeLinecap="round"
        />
      )}
      {/* Center text */}
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

// ─── 7-day bar chart ───────────────────────────────────────────────────────────

const BAR_CHART_WIDTH = SCREEN_WIDTH - spacing.md * 2 - 32;
const BAR_CHART_HEIGHT = 100;
const B_PAD_H = 12;
const B_PAD_V = 8;

function StepsBarChart({
  data,
  dayEntries,
  selectedIndex,
}: {
  data: Map<string, DayActivityData>;
  dayEntries: Array<{ label: string; dateKey: string }>;
  selectedIndex: number;
}) {
  const reversed = [...dayEntries].reverse();
  const vals = reversed.map(d => data.get(d.dateKey)?.steps ?? 0);
  const maxVal = Math.max(...vals, STEP_GOAL);
  const barW = (BAR_CHART_WIDTH - B_PAD_H * 2) / reversed.length - 3;
  const selI = reversed.length - 1 - selectedIndex;

  return (
    <Svg width={BAR_CHART_WIDTH} height={BAR_CHART_HEIGHT}>
      {/* Goal line */}
      {(() => {
        const goalY = B_PAD_V + ((maxVal - STEP_GOAL) / maxVal) * (BAR_CHART_HEIGHT - B_PAD_V * 2);
        return (
          <>
            <Line x1={B_PAD_H} x2={BAR_CHART_WIDTH - B_PAD_H} y1={goalY} y2={goalY} stroke="rgba(74,222,128,0.3)" strokeWidth={1} strokeDasharray="4,3" />
            <SvgText x={BAR_CHART_WIDTH - B_PAD_H - 2} y={goalY - 3} fill="rgba(74,222,128,0.4)" fontSize={8} textAnchor="end">Goal</SvgText>
          </>
        );
      })()}

      {reversed.map((d, i) => {
        const v = data.get(d.dateKey)?.steps ?? 0;
        const barH = Math.max(4, (v / maxVal) * (BAR_CHART_HEIGHT - B_PAD_V * 2));
        const x = B_PAD_H + i * ((BAR_CHART_WIDTH - B_PAD_H * 2) / reversed.length);
        const y = BAR_CHART_HEIGHT - B_PAD_V - barH;
        const isSel = i === selI;
        const color = v >= STEP_GOAL ? '#4ADE80' : v >= STEP_GOAL * 0.7 ? '#FBBF24' : '#3B82F6';
        return (
          <Rect
            key={d.dateKey}
            x={x + 1.5}
            y={y}
            width={barW}
            height={barH}
            fill={isSel ? color : `${color}55`}
            rx={3}
          />
        );
      })}
    </Svg>
  );
}

// ─── Insight ───────────────────────────────────────────────────────────────────

function activityInsight(d: DayActivityData | undefined): string {
  if (!d) return 'Sync your ring to see activity insights.';
  const pct = Math.round((d.steps / STEP_GOAL) * 100);
  const distKm = (d.distanceM / 1000).toFixed(2);
  if (d.steps >= STEP_GOAL) {
    return `Goal reached! ${d.steps.toLocaleString()} steps — ${distKm}km covered and ${d.calories} kcal burned. Keep up the momentum.`;
  }
  if (d.steps >= STEP_GOAL * 0.7) {
    return `Almost there — ${pct}% of your ${STEP_GOAL.toLocaleString()} step goal. ${(STEP_GOAL - d.steps).toLocaleString()} steps remain.`;
  }
  return `${d.steps.toLocaleString()} steps logged — ${pct}% of daily goal. Even a short 10-minute walk can make a significant difference.`;
}

// ─── Context fallback for today ────────────────────────────────────────────────

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
  };
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function ActivityDetailScreen() {
  const insets = useSafeAreaInsets();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { data, isLoading } = useMetricHistory<DayActivityData>('activity');
  const homeData = useHomeDataContext();

  const selectedDateKey = DAY_ENTRIES[selectedIndex]?.dateKey;
  const todayKey = DAY_ENTRIES[0]?.dateKey;
  const todayFallback = selectedIndex === 0 && !data.get(todayKey)
    ? buildTodayActivityFromContext(homeData.activity)
    : null;
  const dayData = todayFallback ?? (selectedDateKey ? data.get(selectedDateKey) : undefined);

  const pct = dayData ? Math.round((dayData.steps / STEP_GOAL) * 100) : 0;
  const activityLevel = pct >= 100 ? 'Active' : pct >= 70 ? 'Moderate' : pct >= 40 ? 'Light' : 'Sedentary';
  const levelColor = pct >= 100 ? '#4ADE80' : pct >= 70 ? '#FBBF24' : pct >= 40 ? '#3B82F6' : 'rgba(255,255,255,0.4)';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.backArrow}>{'‹'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Activity</Text>
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
        ) : !dayData ? (
          <View style={styles.centered}>
            <Text style={styles.emptyText}>No activity data for this day</Text>
          </View>
        ) : (
          <>
            {/* Gauge + level */}
            <View style={styles.gaugeRow}>
              <StepsArcGauge steps={dayData.steps} goal={STEP_GOAL} />
              <View style={styles.gaugeRight}>
                <View style={[styles.levelBadge, { backgroundColor: `${levelColor}22`, borderColor: `${levelColor}55` }]}>
                  <Text style={[styles.levelText, { color: levelColor }]}>{activityLevel}</Text>
                </View>
                <Text style={styles.gaugeRightLabel}>Goal: {STEP_GOAL.toLocaleString()} steps</Text>
                {dayData.hrAvg !== null && (
                  <Text style={styles.gaugeRightSub}>{dayData.hrAvg} bpm avg HR</Text>
                )}
              </View>
            </View>

            {/* 7-day bar chart */}
            <View style={styles.chartContainer}>
              <Text style={styles.chartTitle}>7-Day Steps History</Text>
              <StepsBarChart data={data} dayEntries={DAY_ENTRIES} selectedIndex={selectedIndex} />
            </View>

            {/* Stats */}
            <View style={styles.statsContainer}>
              <DetailStatRow title="Steps" value={dayData.steps.toLocaleString()} accent="#3B82F6" />
              <DetailStatRow title="Goal" value={`${pct}%`} unit={`of ${STEP_GOAL.toLocaleString()}`} accent={pct >= 100 ? '#4ADE80' : undefined} />
              <DetailStatRow title="Distance" value={`${(dayData.distanceM / 1000).toFixed(2)}`} unit="km" />
              <DetailStatRow title="Calories" value={`${dayData.calories}`} unit="kcal" />
              {dayData.hrAvg !== null && (
                <DetailStatRow title="Avg Heart Rate" value={`${dayData.hrAvg}`} unit="bpm" />
              )}
              {dayData.sleepTotalMin !== null && (
                <DetailStatRow
                  title="Sleep"
                  value={`${Math.floor(dayData.sleepTotalMin / 60)}h ${dayData.sleepTotalMin % 60}m`}
                />
              )}
              <DetailStatRow
                title="Activity Level"
                value={activityLevel}
                badge={{ label: activityLevel, color: levelColor }}
              />
            </View>

            <View style={styles.insightBlock}>
              <Text style={styles.insightText}>{activityInsight(dayData)}</Text>
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
  emptyText: { color: 'rgba(255,255,255,0.5)', fontSize: fontSize.sm, fontFamily: fontFamily.regular },
  gaugeRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  gaugeRight: { flex: 1, gap: 10, paddingLeft: spacing.md },
  levelBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, alignSelf: 'flex-start' },
  levelText: { fontSize: 14, fontFamily: fontFamily.demiBold },
  gaugeRightLabel: { color: 'rgba(255,255,255,0.45)', fontSize: fontSize.sm, fontFamily: fontFamily.regular },
  gaugeRightSub: { color: 'rgba(255,255,255,0.3)', fontSize: 12, fontFamily: fontFamily.regular },
  chartContainer: { marginHorizontal: spacing.md, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 16, marginBottom: spacing.sm },
  chartTitle: { color: 'rgba(255,255,255,0.45)', fontSize: 11, fontFamily: fontFamily.regular, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  statsContainer: { marginHorizontal: spacing.md, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, overflow: 'hidden', marginVertical: spacing.sm },
  insightBlock: { marginHorizontal: spacing.lg, marginBottom: spacing.lg, padding: spacing.md, backgroundColor: 'rgba(59,130,246,0.1)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(59,130,246,0.25)' },
  insightText: { color: 'rgba(255,255,255,0.75)', fontSize: fontSize.sm, fontFamily: fontFamily.regular, lineHeight: 22 },
});
