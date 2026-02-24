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
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DayNavigator } from '../../src/components/detail/DayNavigator';
import { DetailStatRow } from '../../src/components/detail/DetailStatRow';
import { DetailChartContainer } from '../../src/components/detail/DetailChartContainer';
import { useMetricHistory, buildDayNavigatorLabels } from '../../src/hooks/useMetricHistory';
import type { DayHRData } from '../../src/hooks/useMetricHistory';
import { useHomeDataContext } from '../../src/context/HomeDataContext';
import { spacing, fontSize, fontFamily } from '../../src/theme/colors';

const DAY_ENTRIES = buildDayNavigatorLabels(7);
const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - spacing.md * 2 - 32; // minus padding
const CHART_HEIGHT = 160;
const PADDING_H = 8;
const PADDING_V = 12;

function HourlyHRBars({ points }: { points: DayHRData['hourlyPoints'] }) {
  if (points.length === 0) return null;

  const vals = points.map(p => p.heartRate).filter(v => v > 0);
  const maxHR = vals.length > 0 ? Math.max(...vals) : 100;
  const minHR = vals.length > 0 ? Math.min(...vals) : 40;
  const range = Math.max(maxHR - minHR + 20, 40);

  const barWidth = (CHART_WIDTH - PADDING_H * 2) / 24 - 1;

  return (
    <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
      {Array.from({ length: 24 }, (_, hour) => {
        const pt = points.find(p => p.hour === hour);
        const hr = pt?.heartRate ?? 0;
        if (hr === 0) return null;

        const barHeight = Math.max(4, ((hr - minHR + 10) / range) * (CHART_HEIGHT - PADDING_V * 2));
        const x = PADDING_H + (hour / 24) * (CHART_WIDTH - PADDING_H * 2);
        const y = CHART_HEIGHT - PADDING_V - barHeight;

        const color = hr >= 120 ? '#FF6B6B' : hr >= 90 ? '#FFD700' : '#3B82F6';

        return (
          <Rect
            key={hour}
            x={x}
            y={y}
            width={Math.max(2, barWidth)}
            height={barHeight}
            fill={color}
            rx={2}
            opacity={0.85}
          />
        );
      })}
      {/* Resting HR reference line */}
      {vals.length > 0 && (
        <Line
          x1={PADDING_H}
          x2={CHART_WIDTH - PADDING_H}
          y1={CHART_HEIGHT - PADDING_V - Math.max(4, ((Math.min(...vals) - minHR + 10) / range) * (CHART_HEIGHT - PADDING_V * 2))}
          y2={CHART_HEIGHT - PADDING_V - Math.max(4, ((Math.min(...vals) - minHR + 10) / range) * (CHART_HEIGHT - PADDING_V * 2))}
          stroke="rgba(74,222,128,0.3)"
          strokeWidth={1}
          strokeDasharray="4,4"
        />
      )}
    </Svg>
  );
}

function hrInsight(data: DayHRData | undefined): string {
  if (!data) return 'Sync your ring to see heart rate insights.';
  if (data.peakHR > 120) return `High intensity detected — peak HR reached ${data.peakHR} bpm. Recovery is key today.`;
  if (data.restingHR < 55) return `Excellent resting HR of ${data.restingHR} bpm — indicates strong cardiovascular fitness.`;
  return `Your HR stayed in a healthy range today. Resting HR of ${data.restingHR} bpm is a good indicator of recovery.`;
}

function buildTodayHRFromContext(hrChartData: Array<{ timeMinutes: number; heartRate: number }>): DayHRData | null {
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

export default function HeartRateDetailScreen() {
  const insets = useSafeAreaInsets();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { data, isLoading } = useMetricHistory<DayHRData>('heartRate');
  const homeData = useHomeDataContext();

  const selectedDateKey = DAY_ENTRIES[selectedIndex]?.dateKey;

  // For today, fall back to live context data if Supabase has nothing yet
  const todayKey = DAY_ENTRIES[0]?.dateKey;
  const todayFallback = selectedIndex === 0 && !data.get(todayKey)
    ? buildTodayHRFromContext(homeData.hrChartData)
    : null;

  const dayData = todayFallback ?? (selectedDateKey ? data.get(selectedDateKey) : undefined);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.backArrow}>{'‹'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Heart Rate</Text>
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
            <Text style={styles.emptyText}>No heart rate data for this day</Text>
          </View>
        ) : (
          <>
            {/* Headline */}
            <View style={styles.headlineRow}>
              <View style={styles.headlineStat}>
                <Text style={styles.headlineValue}>{dayData.restingHR || '--'}</Text>
                <Text style={styles.headlineLabel}>RESTING{'\n'}BPM</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.headlineStat}>
                <Text style={styles.headlineValue}>{dayData.avgHR || '--'}</Text>
                <Text style={styles.headlineLabel}>AVG{'\n'}BPM</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.headlineStat}>
                <Text style={[styles.headlineValue, { color: '#FF6B6B' }]}>{dayData.peakHR || '--'}</Text>
                <Text style={styles.headlineLabel}>PEAK{'\n'}BPM</Text>
              </View>
            </View>

            {/* Chart */}
            <DetailChartContainer
              timeLabels={['12AM', '6AM', '12PM', '6PM', '12AM']}
              height={CHART_HEIGHT + 24}
              yMax={`${dayData.peakHR} bpm`}
              yMin={`${dayData.restingHR} bpm`}
            >
              <HourlyHRBars points={dayData.hourlyPoints} />
            </DetailChartContainer>

            {/* Zone legend */}
            <View style={styles.zoneLegend}>
              <View style={styles.zoneItem}><View style={[styles.zoneDot, { backgroundColor: '#3B82F6' }]} /><Text style={styles.zoneText}>Rest ≤90</Text></View>
              <View style={styles.zoneItem}><View style={[styles.zoneDot, { backgroundColor: '#FFD700' }]} /><Text style={styles.zoneText}>Active 90–120</Text></View>
              <View style={styles.zoneItem}><View style={[styles.zoneDot, { backgroundColor: '#FF6B6B' }]} /><Text style={styles.zoneText}>High &gt;120</Text></View>
            </View>

            {/* Stats */}
            <View style={styles.statsContainer}>
              <DetailStatRow title="Resting HR" value={`${dayData.restingHR || '--'}`} unit="bpm" accent="#4ADE80" />
              <DetailStatRow title="Average HR" value={`${dayData.avgHR || '--'}`} unit="bpm" />
              <DetailStatRow title="Peak HR" value={`${dayData.peakHR || '--'}`} unit="bpm" accent="#FF6B6B" />
              <DetailStatRow title="Readings" value={`${dayData.hourlyPoints.length}`} unit="hours tracked" />
            </View>

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
  headlineStat: { flex: 1, alignItems: 'center', gap: 4 },
  headlineValue: { color: '#FFFFFF', fontSize: 40, fontFamily: fontFamily.regular },
  headlineLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: fontFamily.regular, textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'center' },
  divider: { width: 1, height: 48, backgroundColor: 'rgba(255,255,255,0.1)' },
  zoneLegend: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  zoneItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  zoneDot: { width: 8, height: 8, borderRadius: 4 },
  zoneText: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontFamily: fontFamily.regular },
  statsContainer: { marginHorizontal: spacing.md, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, overflow: 'hidden', marginVertical: spacing.sm },
  insightBlock: { marginHorizontal: spacing.lg, marginBottom: spacing.lg, padding: spacing.md, backgroundColor: 'rgba(59,130,246,0.12)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(59,130,246,0.3)' },
  insightText: { color: 'rgba(255,255,255,0.75)', fontSize: fontSize.sm, fontFamily: fontFamily.regular, lineHeight: 22 },
});
