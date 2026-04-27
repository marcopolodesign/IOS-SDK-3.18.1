import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { BlurView } from 'expo-blur';
import { GradientInfoCard } from '../common/GradientInfoCard';
import { TrendBarChart } from '../detail/TrendBarChart';
import { TrendSubStat, TrendSubStatDivider, TrendHeaderRight } from './TrendSubStat';
import { TREND_CHART_W, CARD_BLUR_STYLE } from './trendLayout';
import { useRunningHistory } from '../../hooks/useRunningHistory';
import { trendDirection } from '../../utils/baselineStats';
import { spacing, fontFamily } from '../../theme/colors';

const RUN_COLOR = '#FC4C02';

function formatKm(km: number): string {
  if (km <= 0) return '--';
  return km >= 10 ? `${Math.round(km)}` : km.toFixed(1);
}

function formatPace(minPerKm: number | null): string {
  if (!minPerKm || minPerKm <= 0) return '--';
  const mins = Math.floor(minPerKm);
  const secs = Math.round((minPerKm - mins) * 60);
  return `${mins}:${String(secs).padStart(2, '0')} /km`;
}

export function RunningTrendCover() {
  const { t } = useTranslation();
  const router = useRouter();

  const { weeks, isLoading, hasData, avgPaceMinPerKm, longestRunKm } = useRunningHistory(8);

  const { dayEntries, barValues, thisWeekKm, statusKey } = useMemo(() => {
    const entries = weeks.map(w => ({ label: w.weekKey, dateKey: w.weekKey }));
    const bars = weeks.map(w => ({ dateKey: w.weekKey, value: parseFloat(formatKm(w.totalKm)) || 0 }));
    const thisWeek = weeks[0]?.totalKm ?? 0;

    const dir = trendDirection(weeks.map(w => w.totalKm));
    const key = dir === 'up' ? 'trends.running_improving' : dir === 'down' ? 'trends.running_declining' : 'trends.running_stable';

    return { dayEntries: entries, barValues: bars, thisWeekKm: thisWeek, statusKey: key };
  }, [weeks]);

  if (!isLoading && !hasData) return null;

  const maxBarVal = Math.max(10, ...barValues.map(b => b.value * 1.2));
  const totalRuns = weeks.reduce((s, w) => s + w.runCount, 0);

  return (
    <TouchableOpacity activeOpacity={0.88} onPress={() => router.push('/detail/running-trends')}>
      <BlurView intensity={22} tint="dark" style={CARD_BLUR_STYLE}>
        <GradientInfoCard
          style={{ backgroundColor: 'transparent' }}
          contentContainerStyle={{ backgroundColor: 'rgba(255,255,255,0.07)' }}
          icon={<Ionicons name="walk-outline" size={16} color="rgba(255,255,255,0.9)" />}
          title={t('trends.running_title')}
          headerValue={formatKm(thisWeekKm)}
          headerSubtitle="km"
          showArrow={false}
          headerRight={isLoading ? undefined : <TrendHeaderRight text={t('trends.running_this_week')} />}
          gradientStops={[
            { offset: 0, color: '#7C2800', opacity: 1 },
            { offset: 0.6, color: '#3D1200', opacity: 1 },
            { offset: 1, color: '#0D0D0D', opacity: 0 },
          ]}
          gradientCenter={{ x: 0.5, y: -0.5 }}
          gradientRadii={{ rx: '120%', ry: '200%' }}
        >
          {!isLoading && <Text style={styles.statusLine}>{t(statusKey)}</Text>}
          <View style={styles.chartWrap}>
            <TrendBarChart
              dayEntries={dayEntries}
              values={barValues}
              selectedIndex={0}
              onSelectDay={() => {}}
              colorFn={() => RUN_COLOR}
              maxValue={maxBarVal}
              minValue={0}
              chartHeight={110}
              colWidth={Math.floor(TREND_CHART_W / 8)}
              barWidth={Math.floor(TREND_CHART_W / 8) - 8}
              showValueLabels={false}
              roundedBars
            />
          </View>
          <View style={styles.subStats}>
            <TrendSubStat label={t('trends.avg_pace')} value={formatPace(avgPaceMinPerKm)} />
            <TrendSubStatDivider />
            <TrendSubStat label={t('trends.total_runs')} value={totalRuns > 0 ? String(totalRuns) : '--'} />
            <TrendSubStatDivider />
            <TrendSubStat label={t('trends.longest_run')} value={longestRunKm > 0 ? `${formatKm(longestRunKm)} km` : '--'} />
          </View>
        </GradientInfoCard>
      </BlurView>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  statusLine: {
    color: 'rgba(255,255,255,0.5)',
    fontFamily: fontFamily.regular,
    fontSize: 13,
    marginBottom: spacing.xs,
  },
  chartWrap: {
    marginHorizontal: -spacing.lg,
    overflow: 'hidden',
  },
  subStats: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.sm,
  },
});
