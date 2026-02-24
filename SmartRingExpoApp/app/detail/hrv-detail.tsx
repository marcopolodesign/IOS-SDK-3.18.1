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
import Svg, { Line, Circle, Path, Rect, Text as SvgText } from 'react-native-svg';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DayNavigator } from '../../src/components/detail/DayNavigator';
import { DetailStatRow } from '../../src/components/detail/DetailStatRow';
import { useMetricHistory, buildDayNavigatorLabels } from '../../src/hooks/useMetricHistory';
import type { DayHRVData } from '../../src/hooks/useMetricHistory';
import { useHomeDataContext } from '../../src/context/HomeDataContext';
import { spacing, fontSize, fontFamily } from '../../src/theme/colors';

const DAY_ENTRIES = buildDayNavigatorLabels(7);
const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - spacing.md * 2 - 32;
const CHART_HEIGHT = 140;
const PAD_H = 16;
const PAD_V = 16;

// ─── 7-day SDNN trend line chart ──────────────────────────────────────────────

function HRV7DayChart({
  data,
  dayEntries,
  selectedIndex,
}: {
  data: Map<string, DayHRVData>;
  dayEntries: Array<{ label: string; dateKey: string }>;
  selectedIndex: number;
}) {
  // Collect values in chronological order (oldest → newest = left → right)
  const points = [...dayEntries].reverse().map((d, i) => ({
    i,
    sdnn: data.get(d.dateKey)?.sdnn ?? null,
    dateKey: d.dateKey,
  }));

  const validVals = points.map(p => p.sdnn).filter((v): v is number => v !== null);
  if (validVals.length === 0) return null;

  const maxVal = Math.max(...validVals, 60);
  const minVal = Math.min(...validVals, 20);
  const range = maxVal - minVal + 10;

  const xFor = (i: number) => PAD_H + (i / (dayEntries.length - 1)) * (CHART_WIDTH - PAD_H * 2);
  const yFor = (v: number) => CHART_HEIGHT - PAD_V - ((v - minVal + 5) / range) * (CHART_HEIGHT - PAD_V * 2);

  // Build SVG path
  let pathD = '';
  let prev: { x: number; y: number } | null = null;
  for (const pt of points) {
    if (pt.sdnn === null) { prev = null; continue; }
    const x = xFor(pt.i);
    const y = yFor(pt.sdnn);
    if (!prev) {
      pathD += `M ${x} ${y}`;
    } else {
      const cx = (prev.x + x) / 2;
      pathD += ` C ${cx} ${prev.y} ${cx} ${y} ${x} ${y}`;
    }
    prev = { x, y };
  }

  // Reference bands Y positions
  const y50 = yFor(50); // optimal threshold
  const y30 = yFor(30); // moderate threshold

  // Selected day highlight index (in reversed order = 6 - selectedIndex)
  const selI = dayEntries.length - 1 - selectedIndex;

  return (
    <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
      {/* Red band: below 30 (high stress) */}
      <Rect x={PAD_H} y={y30} width={CHART_WIDTH - PAD_H * 2} height={CHART_HEIGHT - PAD_V - y30} fill="rgba(239,68,68,0.08)" />
      {/* Yellow band: 30–50 */}
      <Rect x={PAD_H} y={y50} width={CHART_WIDTH - PAD_H * 2} height={y30 - y50} fill="rgba(234,179,8,0.08)" />
      {/* Green band: above 50 */}
      <Rect x={PAD_H} y={PAD_V} width={CHART_WIDTH - PAD_H * 2} height={y50 - PAD_V} fill="rgba(74,222,128,0.08)" />

      {/* Band reference lines */}
      <Line x1={PAD_H} x2={CHART_WIDTH - PAD_H} y1={y50} y2={y50} stroke="rgba(74,222,128,0.3)" strokeWidth={1} strokeDasharray="4,4" />
      <Line x1={PAD_H} x2={CHART_WIDTH - PAD_H} y1={y30} y2={y30} stroke="rgba(234,179,8,0.3)" strokeWidth={1} strokeDasharray="4,4" />

      {/* Band labels */}
      <SvgText x={CHART_WIDTH - PAD_H - 2} y={y50 - 4} fill="rgba(74,222,128,0.5)" fontSize={9} textAnchor="end">Optimal</SvgText>
      <SvgText x={CHART_WIDTH - PAD_H - 2} y={y30 - 4} fill="rgba(234,179,8,0.5)" fontSize={9} textAnchor="end">Moderate</SvgText>

      {/* Trend line */}
      {pathD.length > 0 && (
        <Path d={pathD} stroke="rgba(139,92,246,0.9)" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      )}

      {/* Dots */}
      {points.map(pt => {
        if (pt.sdnn === null) return null;
        const x = xFor(pt.i);
        const y = yFor(pt.sdnn);
        const isSel = pt.i === selI;
        const color = pt.sdnn >= 50 ? '#4ADE80' : pt.sdnn >= 30 ? '#FBBF24' : '#EF4444';
        return (
          <Circle key={pt.dateKey} cx={x} cy={y} r={isSel ? 6 : 4} fill={isSel ? color : 'rgba(15,15,20,1)'} stroke={color} strokeWidth={isSel ? 0 : 2} />
        );
      })}

      {/* Selected day value label */}
      {(() => {
        const selPt = points[selI];
        if (!selPt || selPt.sdnn === null) return null;
        const x = xFor(selPt.i);
        const y = yFor(selPt.sdnn);
        return (
          <SvgText x={x} y={y - 12} fill="#FFFFFF" fontSize={11} textAnchor="middle" fontWeight="bold">
            {selPt.sdnn}ms
          </SvgText>
        );
      })()}
    </Svg>
  );
}

// ─── Insight text ──────────────────────────────────────────────────────────────

function hrvInsight(d: DayHRVData | undefined): string {
  if (!d || d.sdnn === null) return 'Sync your ring to see HRV insights.';
  if (d.sdnn >= 50) return `Strong HRV of ${d.sdnn}ms — your nervous system is well-recovered. A great day to push hard in training.`;
  if (d.sdnn >= 30) return `Moderate HRV of ${d.sdnn}ms. Focus on quality sleep and manage stress. Opt for lighter activity today.`;
  return `Low HRV of ${d.sdnn}ms indicates elevated stress or poor recovery. Prioritize rest, hydration, and breathwork.`;
}

// ─── Context fallback for today ────────────────────────────────────────────────

function buildTodayHRVFromContext(hrvSdnn: number): DayHRVData | null {
  if (!hrvSdnn || hrvSdnn === 0) return null;
  const today = new Date().toISOString().split('T')[0];
  const sdnn = Math.round(hrvSdnn);
  return {
    date: today,
    sdnn,
    rmssd: null,
    pnn50: null,
    lf: null,
    hf: null,
    lfHfRatio: null,
    heartRate: null,
    stressLabel: sdnn >= 50 ? 'Low' : sdnn >= 30 ? 'Moderate' : 'High',
    recoveryLabel: sdnn >= 50 ? 'Optimal' : sdnn >= 30 ? 'Fair' : 'Poor',
  };
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function HRVDetailScreen() {
  const insets = useSafeAreaInsets();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { data, isLoading } = useMetricHistory<DayHRVData>('hrv');
  const homeData = useHomeDataContext();

  const selectedDateKey = DAY_ENTRIES[selectedIndex]?.dateKey;
  const todayKey = DAY_ENTRIES[0]?.dateKey;
  const todayFallback = selectedIndex === 0 && !data.get(todayKey)
    ? buildTodayHRVFromContext(homeData.hrvSdnn)
    : null;
  const dayData = todayFallback ?? (selectedDateKey ? data.get(selectedDateKey) : undefined);

  const sdnnColor = !dayData?.sdnn ? 'rgba(255,255,255,0.4)'
    : dayData.sdnn >= 50 ? '#4ADE80'
    : dayData.sdnn >= 30 ? '#FBBF24'
    : '#EF4444';

  const recoveryColor = !dayData?.sdnn ? 'rgba(255,255,255,0.4)'
    : dayData.sdnn >= 50 ? '#4ADE80'
    : dayData.sdnn >= 30 ? '#FBBF24'
    : '#EF4444';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.backArrow}>{'‹'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>HRV & Stress</Text>
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
            <Text style={styles.emptyText}>No HRV data for this day</Text>
          </View>
        ) : (
          <>
            {/* Headline */}
            <View style={styles.headlineRow}>
              <View style={styles.headlineStat}>
                <Text style={[styles.headlineValue, { color: sdnnColor }]}>{dayData.sdnn ?? '--'}</Text>
                <Text style={styles.headlineUnit}>ms SDNN</Text>
              </View>
              <View style={styles.headlineDivider} />
              <View style={styles.headlineStat}>
                <Text style={[styles.headlineValue, { color: recoveryColor, fontSize: 28 }]}>{dayData.recoveryLabel}</Text>
                <Text style={styles.headlineUnit}>RECOVERY</Text>
              </View>
            </View>

            {/* 7-day chart */}
            <View style={styles.chartContainer}>
              <Text style={styles.chartTitle}>7-Day SDNN Trend</Text>
              <HRV7DayChart data={data} dayEntries={DAY_ENTRIES} selectedIndex={selectedIndex} />
              {/* Band legend */}
              <View style={styles.bandLegend}>
                <View style={styles.bandItem}><View style={[styles.bandDot, { backgroundColor: '#4ADE80' }]} /><Text style={styles.bandText}>Optimal ≥50</Text></View>
                <View style={styles.bandItem}><View style={[styles.bandDot, { backgroundColor: '#FBBF24' }]} /><Text style={styles.bandText}>Fair 30–50</Text></View>
                <View style={styles.bandItem}><View style={[styles.bandDot, { backgroundColor: '#EF4444' }]} /><Text style={styles.bandText}>Low &lt;30</Text></View>
              </View>
            </View>

            {/* Stats */}
            <View style={styles.statsContainer}>
              <DetailStatRow title="SDNN" value={dayData.sdnn !== null ? `${dayData.sdnn}` : '--'} unit="ms" accent="#8B5CF6" />
              <DetailStatRow title="RMSSD" value={dayData.rmssd !== null ? `${dayData.rmssd}` : '--'} unit="ms" />
              <DetailStatRow title="pNN50" value={dayData.pnn50 !== null ? `${dayData.pnn50}` : '--'} unit="%" />
              <DetailStatRow
                title="Stress Level"
                value={dayData.stressLabel}
                badge={dayData.stressLabel === 'Low' ? { label: 'Low', color: '#4ADE80' }
                  : dayData.stressLabel === 'Moderate' ? { label: 'Moderate', color: '#FBBF24' }
                  : { label: 'High', color: '#EF4444' }}
              />
              <DetailStatRow
                title="Recovery"
                value={dayData.recoveryLabel}
                badge={dayData.recoveryLabel === 'Optimal' ? { label: 'Optimal', color: '#4ADE80' }
                  : dayData.recoveryLabel === 'Fair' ? { label: 'Fair', color: '#FBBF24' }
                  : { label: 'Poor', color: '#EF4444' }}
              />
              {dayData.lfHfRatio !== null && (
                <DetailStatRow title="LF/HF Ratio" value={dayData.lfHfRatio.toFixed(2)} />
              )}
              {dayData.heartRate !== null && (
                <DetailStatRow title="Heart Rate" value={`${dayData.heartRate}`} unit="bpm" />
              )}
            </View>

            <View style={styles.insightBlock}>
              <Text style={styles.insightText}>{hrvInsight(dayData)}</Text>
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
  headlineValue: { color: '#FFFFFF', fontSize: 44, fontFamily: fontFamily.regular },
  headlineUnit: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: fontFamily.regular, textTransform: 'uppercase', letterSpacing: 0.8 },
  headlineDivider: { width: 1, height: 48, backgroundColor: 'rgba(255,255,255,0.1)' },
  chartContainer: { marginHorizontal: spacing.md, marginBottom: spacing.sm, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 16, overflow: 'hidden' },
  chartTitle: { color: 'rgba(255,255,255,0.45)', fontSize: 11, fontFamily: fontFamily.regular, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  bandLegend: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md, marginTop: 12 },
  bandItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  bandDot: { width: 8, height: 8, borderRadius: 4 },
  bandText: { color: 'rgba(255,255,255,0.45)', fontSize: 10, fontFamily: fontFamily.regular },
  statsContainer: { marginHorizontal: spacing.md, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, overflow: 'hidden', marginVertical: spacing.sm },
  insightBlock: { marginHorizontal: spacing.lg, marginBottom: spacing.lg, padding: spacing.md, backgroundColor: 'rgba(139,92,246,0.12)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(139,92,246,0.3)' },
  insightText: { color: 'rgba(255,255,255,0.75)', fontSize: fontSize.sm, fontFamily: fontFamily.regular, lineHeight: 22 },
});
