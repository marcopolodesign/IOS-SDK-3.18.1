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
import Svg, { Circle, Line, Rect, Text as SvgText } from 'react-native-svg';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DayNavigator } from '../../src/components/detail/DayNavigator';
import { DetailStatRow } from '../../src/components/detail/DetailStatRow';
import { DetailChartContainer } from '../../src/components/detail/DetailChartContainer';
import { useMetricHistory, buildDayNavigatorLabels } from '../../src/hooks/useMetricHistory';
import type { DaySpO2Data } from '../../src/hooks/useMetricHistory';
import { spacing, fontSize, fontFamily } from '../../src/theme/colors';

const DAY_ENTRIES = buildDayNavigatorLabels(7);
const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - spacing.md * 2 - 32;
const CHART_HEIGHT = 150;
const PAD_H = 10;
const PAD_V = 14;

// ─── SpO2 scatter plot ─────────────────────────────────────────────────────────

function SpO2ScatterChart({ readings }: { readings: DaySpO2Data['readings'] }) {
  if (readings.length === 0) return null;

  const vals = readings.map(r => r.value).filter(v => v > 0);
  const minVal = Math.max(85, Math.min(...vals) - 2);
  const maxVal = Math.min(100, Math.max(...vals) + 1);
  const range = maxVal - minVal;

  // Normal band: 95–100%
  const yNormal95 = PAD_V + ((maxVal - 95) / range) * (CHART_HEIGHT - PAD_V * 2);
  const yNormal100 = PAD_V;

  const midnight = new Date(readings[0].recordedAt);
  midnight.setHours(0, 0, 0, 0);
  const dayMs = 24 * 60 * 60 * 1000;

  const xFor = (d: Date) => PAD_H + (((d.getTime() - midnight.getTime()) / dayMs)) * (CHART_WIDTH - PAD_H * 2);
  const yFor = (v: number) => PAD_V + ((maxVal - v) / range) * (CHART_HEIGHT - PAD_V * 2);

  return (
    <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
      {/* Normal range band */}
      <Rect x={PAD_H} y={yNormal100} width={CHART_WIDTH - PAD_H * 2} height={yNormal95 - yNormal100} fill="rgba(74,222,128,0.08)" />
      <Line x1={PAD_H} x2={CHART_WIDTH - PAD_H} y1={yNormal95} y2={yNormal95} stroke="rgba(74,222,128,0.4)" strokeWidth={1} strokeDasharray="4,4" />
      <SvgText x={CHART_WIDTH - PAD_H - 2} y={yNormal95 - 4} fill="rgba(74,222,128,0.5)" fontSize={9} textAnchor="end">95%</SvgText>

      {/* Data dots */}
      {readings.map((r, i) => {
        if (r.value === 0) return null;
        const x = xFor(r.recordedAt);
        const y = yFor(r.value);
        const color = r.value >= 95 ? '#4ADE80' : r.value >= 90 ? '#FBBF24' : '#EF4444';
        return <Circle key={i} cx={x} cy={y} r={4} fill={color} opacity={0.85} />;
      })}

      {/* Y-axis labels */}
      <SvgText x={PAD_H - 2} y={PAD_V + 4} fill="rgba(255,255,255,0.3)" fontSize={9} textAnchor="end">{maxVal}%</SvgText>
      <SvgText x={PAD_H - 2} y={CHART_HEIGHT - PAD_V + 4} fill="rgba(255,255,255,0.3)" fontSize={9} textAnchor="end">{minVal}%</SvgText>
    </Svg>
  );
}

// ─── Insight ───────────────────────────────────────────────────────────────────

function spo2Insight(d: DaySpO2Data | undefined): string {
  if (!d || d.readings.length === 0) return 'Sync your ring to see blood oxygen insights.';
  if (d.avg >= 97) return `Excellent SpO₂ of ${d.avg}% — your blood oxygen is optimal. Cellular energy delivery is unrestricted.`;
  if (d.avg >= 95) return `Normal SpO₂ of ${d.avg}%. ${d.timeBelowNormal > 0 ? `${d.timeBelowNormal} brief readings dipped below 95% — monitor during sleep.` : 'All readings within normal range.'}`;
  if (d.avg >= 90) return `Below-normal SpO₂ of ${d.avg}%. ${d.timeBelowNormal} readings below 95%. Consider consulting a physician if this persists.`;
  return `Low SpO₂ of ${d.avg}% — please consult a medical professional. Values below 90% may indicate a health concern.`;
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function SpO2DetailScreen() {
  const insets = useSafeAreaInsets();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { data, isLoading } = useMetricHistory<DaySpO2Data>('spo2');

  const selectedDateKey = DAY_ENTRIES[selectedIndex]?.dateKey;
  const dayData = selectedDateKey ? data.get(selectedDateKey) : undefined;

  const avgColor = !dayData ? 'rgba(255,255,255,0.4)'
    : dayData.avg >= 97 ? '#4ADE80'
    : dayData.avg >= 95 ? '#4ADE80'
    : dayData.avg >= 90 ? '#FBBF24'
    : '#EF4444';

  const riskLabel = !dayData ? '--'
    : dayData.avg >= 95 ? 'Normal'
    : dayData.avg >= 90 ? 'Caution'
    : 'Alert';

  const riskColor = riskLabel === 'Normal' ? '#4ADE80' : riskLabel === 'Caution' ? '#FBBF24' : '#EF4444';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.backArrow}>{'‹'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Blood Oxygen</Text>
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
            <Text style={styles.emptyText}>No SpO₂ data for this day</Text>
          </View>
        ) : (
          <>
            {/* Headline */}
            <View style={styles.headlineRow}>
              <View style={styles.headlineStat}>
                <Text style={[styles.headlineValue, { color: avgColor }]}>{dayData.avg || '--'}</Text>
                <Text style={styles.headlineUnit}>% AVG SpO₂</Text>
              </View>
              <View style={styles.headlineDivider} />
              <View style={styles.headlineStat}>
                <View style={[styles.riskBadge, { backgroundColor: `${riskColor}22`, borderColor: `${riskColor}55` }]}>
                  <Text style={[styles.riskBadgeText, { color: riskColor }]}>{riskLabel}</Text>
                </View>
                <Text style={styles.headlineUnit}>RISK LEVEL</Text>
              </View>
            </View>

            {/* Chart */}
            <DetailChartContainer
              timeLabels={['12AM', '6AM', '12PM', '6PM', '12AM']}
              height={CHART_HEIGHT + 24}
              yMax={`${dayData.max}%`}
              yMin={`${dayData.min}%`}
            >
              <SpO2ScatterChart readings={dayData.readings} />
            </DetailChartContainer>

            {/* Legend */}
            <View style={styles.legend}>
              <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#4ADE80' }]} /><Text style={styles.legendText}>Normal ≥95%</Text></View>
              <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#FBBF24' }]} /><Text style={styles.legendText}>Caution 90–95%</Text></View>
              <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} /><Text style={styles.legendText}>Low &lt;90%</Text></View>
            </View>

            {/* Stats */}
            <View style={styles.statsContainer}>
              <DetailStatRow title="Overnight Avg" value={dayData.avg ? `${dayData.avg}` : '--'} unit="%" accent="#4ADE80" />
              <DetailStatRow title="Minimum" value={dayData.min ? `${dayData.min}` : '--'} unit="%" accent={dayData.min < 90 ? '#EF4444' : dayData.min < 95 ? '#FBBF24' : undefined} />
              <DetailStatRow title="Maximum" value={dayData.max ? `${dayData.max}` : '--'} unit="%" />
              <DetailStatRow title="Readings" value={`${dayData.readings.length}`} unit="recorded" />
              <DetailStatRow
                title="Time Below 95%"
                value={`${dayData.timeBelowNormal}`}
                unit="readings"
                accent={dayData.timeBelowNormal > 5 ? '#EF4444' : dayData.timeBelowNormal > 0 ? '#FBBF24' : undefined}
              />
              <DetailStatRow
                title="Status"
                value={riskLabel}
                badge={{ label: riskLabel, color: riskColor }}
              />
            </View>

            <View style={styles.insightBlock}>
              <Text style={styles.insightText}>{spo2Insight(dayData)}</Text>
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
  headlineStat: { flex: 1, alignItems: 'center', gap: 8 },
  headlineValue: { fontSize: 52, fontFamily: fontFamily.regular },
  headlineUnit: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: fontFamily.regular, textTransform: 'uppercase', letterSpacing: 0.8 },
  headlineDivider: { width: 1, height: 48, backgroundColor: 'rgba(255,255,255,0.1)' },
  riskBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12, borderWidth: 1 },
  riskBadgeText: { fontSize: 16, fontFamily: fontFamily.demiBold },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: 'rgba(255,255,255,0.45)', fontSize: 10, fontFamily: fontFamily.regular },
  statsContainer: { marginHorizontal: spacing.md, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, overflow: 'hidden', marginVertical: spacing.sm },
  insightBlock: { marginHorizontal: spacing.lg, marginBottom: spacing.lg, padding: spacing.md, backgroundColor: 'rgba(74,222,128,0.1)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(74,222,128,0.25)' },
  insightText: { color: 'rgba(255,255,255,0.75)', fontSize: fontSize.sm, fontFamily: fontFamily.regular, lineHeight: 22 },
});
