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
import Svg, { Line, Path, Rect, Circle, Text as SvgText } from 'react-native-svg';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DayNavigator } from '../../src/components/detail/DayNavigator';
import { DetailStatRow } from '../../src/components/detail/DetailStatRow';
import { DetailChartContainer } from '../../src/components/detail/DetailChartContainer';
import { useMetricHistory, buildDayNavigatorLabels } from '../../src/hooks/useMetricHistory';
import type { DayTemperatureData } from '../../src/hooks/useMetricHistory';
import { spacing, fontSize, fontFamily } from '../../src/theme/colors';

const DAY_ENTRIES = buildDayNavigatorLabels(7);
const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - spacing.md * 2 - 32;
const CHART_HEIGHT = 140;
const PAD_H = 10;
const PAD_V = 16;

// Normal range: 36.1–37.2°C
const NORMAL_LOW = 36.1;
const NORMAL_HIGH = 37.2;

// ─── Temperature line chart ────────────────────────────────────────────────────

function TempLineChart({ readings }: { readings: DayTemperatureData['readings'] }) {
  if (readings.length === 0) return null;

  const vals = readings.map(r => r.value).filter(v => v > 0);
  const domainMin = Math.min(...vals, NORMAL_LOW) - 0.3;
  const domainMax = Math.max(...vals, NORMAL_HIGH) + 0.3;
  const range = domainMax - domainMin;

  const midnight = new Date(readings[0].recordedAt);
  midnight.setHours(0, 0, 0, 0);
  const dayMs = 24 * 60 * 60 * 1000;

  const xFor = (d: Date) => PAD_H + ((d.getTime() - midnight.getTime()) / dayMs) * (CHART_WIDTH - PAD_H * 2);
  const yFor = (v: number) => PAD_V + ((domainMax - v) / range) * (CHART_HEIGHT - PAD_V * 2);

  const yNormalHigh = yFor(NORMAL_HIGH);
  const yNormalLow = yFor(NORMAL_LOW);

  // Build SVG smooth path
  const validPts = readings
    .filter(r => r.value > 0)
    .map(r => ({ x: xFor(r.recordedAt), y: yFor(r.value), v: r.value }));

  let pathD = '';
  for (let i = 0; i < validPts.length; i++) {
    const p = validPts[i];
    if (i === 0) {
      pathD = `M ${p.x} ${p.y}`;
    } else {
      const prev = validPts[i - 1];
      const cx = (prev.x + p.x) / 2;
      pathD += ` C ${cx} ${prev.y} ${cx} ${p.y} ${p.x} ${p.y}`;
    }
  }

  return (
    <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
      {/* Normal band */}
      <Rect x={PAD_H} y={yNormalHigh} width={CHART_WIDTH - PAD_H * 2} height={yNormalLow - yNormalHigh} fill="rgba(74,222,128,0.08)" />
      <Line x1={PAD_H} x2={CHART_WIDTH - PAD_H} y1={yNormalHigh} y2={yNormalHigh} stroke="rgba(74,222,128,0.3)" strokeWidth={1} strokeDasharray="4,3" />
      <Line x1={PAD_H} x2={CHART_WIDTH - PAD_H} y1={yNormalLow} y2={yNormalLow} stroke="rgba(74,222,128,0.3)" strokeWidth={1} strokeDasharray="4,3" />
      <SvgText x={PAD_H + 2} y={yNormalHigh - 3} fill="rgba(74,222,128,0.4)" fontSize={8}>37.2°</SvgText>
      <SvgText x={PAD_H + 2} y={yNormalLow + 10} fill="rgba(74,222,128,0.4)" fontSize={8}>36.1°</SvgText>

      {/* Line */}
      {pathD.length > 0 && (
        <Path d={pathD} stroke="rgba(251,146,60,0.9)" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      )}

      {/* Dots colored by normal/abnormal */}
      {validPts.map((p, i) => {
        const isNormal = p.v >= NORMAL_LOW && p.v <= NORMAL_HIGH;
        const color = isNormal ? '#4ADE80' : p.v > NORMAL_HIGH ? '#EF4444' : '#60A5FA';
        return <Circle key={i} cx={p.x} cy={p.y} r={3.5} fill={color} />;
      })}
    </Svg>
  );
}

// ─── Deviation from 7-day baseline ────────────────────────────────────────────

function computeBaseline(data: Map<string, DayTemperatureData>): number | null {
  const avgs = Array.from(data.values()).map(d => d.avg).filter(v => v > 0);
  if (avgs.length === 0) return null;
  return Math.round((avgs.reduce((a, b) => a + b, 0) / avgs.length) * 10) / 10;
}

// ─── Insight ───────────────────────────────────────────────────────────────────

function tempInsight(d: DayTemperatureData | undefined, baseline: number | null): string {
  if (!d || d.readings.length === 0) return 'Sync your ring to see temperature insights.';
  const dev = baseline !== null ? Math.round((d.avg - baseline) * 10) / 10 : null;
  if (d.avg > NORMAL_HIGH) {
    return `Temperature of ${d.avg}°C is above normal range (36.1–37.2°C).${dev ? ` +${dev}°C from your 7-day baseline.` : ''} This can indicate elevated inflammation or early illness.`;
  }
  if (d.avg < NORMAL_LOW) {
    return `Temperature of ${d.avg}°C is below normal range.${dev ? ` ${dev}°C from baseline.` : ''} Low body temp can indicate poor circulation or high parasympathetic activity.`;
  }
  return `Body temperature of ${d.avg}°C is within normal range.${dev !== null ? ` ${dev > 0 ? '+' : ''}${dev}°C from your ${baseline}°C baseline.` : ''} No notable deviations.`;
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function TemperatureDetailScreen() {
  const insets = useSafeAreaInsets();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { data, isLoading } = useMetricHistory<DayTemperatureData>('temperature');

  const selectedDateKey = DAY_ENTRIES[selectedIndex]?.dateKey;
  const dayData = selectedDateKey ? data.get(selectedDateKey) : undefined;

  const baseline = computeBaseline(data);
  const deviation = dayData && baseline !== null
    ? Math.round((dayData.avg - baseline) * 10) / 10
    : null;

  const statusColor = !dayData ? 'rgba(255,255,255,0.4)'
    : dayData.avg > NORMAL_HIGH ? '#EF4444'
    : dayData.avg < NORMAL_LOW ? '#60A5FA'
    : '#4ADE80';

  const statusLabel = !dayData ? '--'
    : dayData.avg > NORMAL_HIGH ? 'Elevated'
    : dayData.avg < NORMAL_LOW ? 'Low'
    : 'Normal';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.backArrow}>{'‹'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Body Temperature</Text>
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
            <Text style={styles.emptyText}>No temperature data for this day</Text>
          </View>
        ) : (
          <>
            {/* Headline */}
            <View style={styles.headlineRow}>
              <View style={styles.headlineStat}>
                <Text style={[styles.headlineValue, { color: statusColor }]}>
                  {dayData.current > 0 ? `${dayData.current.toFixed(1)}` : '--'}
                </Text>
                <Text style={styles.headlineUnit}>°C CURRENT</Text>
              </View>
              <View style={styles.headlineDivider} />
              <View style={styles.headlineStat}>
                <Text style={[styles.headlineValue, { color: statusColor, fontSize: 32 }]}>{statusLabel}</Text>
                {deviation !== null && (
                  <Text style={[styles.headlineUnit, { color: Math.abs(deviation) > 0.3 ? statusColor : 'rgba(255,255,255,0.4)' }]}>
                    {deviation > 0 ? '+' : ''}{deviation}° from baseline
                  </Text>
                )}
              </View>
            </View>

            {/* Chart */}
            <DetailChartContainer
              timeLabels={['12AM', '6AM', '12PM', '6PM', '12AM']}
              height={CHART_HEIGHT + 24}
              yMax={`${dayData.max.toFixed(1)}°C`}
              yMin={`${dayData.min.toFixed(1)}°C`}
            >
              <TempLineChart readings={dayData.readings} />
            </DetailChartContainer>

            {/* Normal range note */}
            <View style={styles.normalNote}>
              <View style={[styles.normalDot, { backgroundColor: '#4ADE80' }]} />
              <Text style={styles.normalText}>Normal range: 36.1–37.2°C</Text>
            </View>

            {/* Stats */}
            <View style={styles.statsContainer}>
              <DetailStatRow title="Current" value={dayData.current > 0 ? `${dayData.current.toFixed(1)}` : '--'} unit="°C" accent={statusColor} />
              <DetailStatRow title="Average" value={dayData.avg > 0 ? `${dayData.avg.toFixed(1)}` : '--'} unit="°C" />
              <DetailStatRow title="Minimum" value={dayData.min > 0 ? `${dayData.min.toFixed(1)}` : '--'} unit="°C" accent="#60A5FA" />
              <DetailStatRow title="Maximum" value={dayData.max > 0 ? `${dayData.max.toFixed(1)}` : '--'} unit="°C" accent={dayData.max > NORMAL_HIGH ? '#EF4444' : undefined} />
              {baseline !== null && (
                <DetailStatRow title="7-Day Baseline" value={`${baseline.toFixed(1)}`} unit="°C" />
              )}
              {deviation !== null && (
                <DetailStatRow
                  title="Deviation"
                  value={`${deviation > 0 ? '+' : ''}${deviation}`}
                  unit="°C"
                  accent={Math.abs(deviation) > 0.5 ? '#EF4444' : Math.abs(deviation) > 0.3 ? '#FBBF24' : undefined}
                />
              )}
              <DetailStatRow title="Readings" value={`${dayData.readings.length}`} unit="recorded" />
              <DetailStatRow title="Status" value={statusLabel} badge={{ label: statusLabel, color: statusColor }} />
            </View>

            <View style={styles.insightBlock}>
              <Text style={styles.insightText}>{tempInsight(dayData, baseline)}</Text>
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
  headlineRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },
  headlineStat: { flex: 1, alignItems: 'center', gap: 6 },
  headlineValue: { fontSize: 44, fontFamily: fontFamily.regular },
  headlineUnit: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: fontFamily.regular, textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'center' },
  headlineDivider: { width: 1, height: 48, backgroundColor: 'rgba(255,255,255,0.1)' },
  normalNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing.xs },
  normalDot: { width: 8, height: 8, borderRadius: 4 },
  normalText: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontFamily: fontFamily.regular },
  statsContainer: { marginHorizontal: spacing.md, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, overflow: 'hidden', marginVertical: spacing.sm },
  insightBlock: { marginHorizontal: spacing.lg, marginBottom: spacing.lg, padding: spacing.md, backgroundColor: 'rgba(251,146,60,0.1)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(251,146,60,0.25)' },
  insightText: { color: 'rgba(255,255,255,0.75)', fontSize: fontSize.sm, fontFamily: fontFamily.regular, lineHeight: 22 },
});
