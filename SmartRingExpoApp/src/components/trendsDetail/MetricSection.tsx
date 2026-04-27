import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { TrendBarChart } from '../detail/TrendBarChart';
import { ClockTimeBarChart } from './ClockTimeBarChart';
import { fontFamily, spacing } from '../../theme/colors';
import type { MetricDefinition } from '../../screens/trendsDetail/domains';
import type { TrendBucket, TrendSeries } from '../../hooks/useTrendsData';

const SCREEN_W = Dimensions.get('window').width;
const CHART_H = 110;

interface Props {
  metric: MetricDefinition;
  buckets: TrendBucket[];
  series: TrendSeries;
  isLoading: boolean;
}

export function MetricSection({ metric, buckets, series, isLoading }: Props) {
  const { t } = useTranslation();

  const { currentValue, avgValue, minValue, maxValue } = useMemo(() => {
    let current: number | null = null;
    const nonNull: number[] = [];
    for (const s of series) {
      if (s.value !== null && s.value > 0) {
        nonNull.push(s.value);
        if (current === null) current = s.value;
      }
    }
    const avg = nonNull.length > 0 ? nonNull.reduce((a, b) => a + b, 0) / nonNull.length : null;
    const mn = nonNull.length > 0 ? Math.min(...nonNull) : null;
    const mx = nonNull.length > 0 ? Math.max(...nonNull) : null;
    return { currentValue: current, avgValue: avg, minValue: mn, maxValue: mx };
  }, [series]);

  // Section has marginHorizontal: spacing.lg each side; chart lives within those bounds.
  const colW = useMemo(
    () => Math.max(24, Math.floor((SCREEN_W - spacing.lg * 2) / Math.max(1, buckets.length))),
    [buckets.length],
  );
  const barW = Math.max(12, colW - 8);

  const maxBarVal = useMemo(() => {
    if (metric.maxValue !== undefined) return metric.maxValue;
    const vals = series.map(s => s.value ?? 0);
    return Math.max(1, ...vals) * 1.1;
  }, [metric.maxValue, series]);

  const formattedCurrent = currentValue !== null ? metric.formatValue(currentValue) : '--';
  const formattedAvg = avgValue !== null ? metric.formatValue(Math.round(avgValue)) : '--';
  const formattedMin = minValue !== null ? metric.formatValue(minValue) : '--';
  const formattedMax = maxValue !== null ? metric.formatValue(maxValue) : '--';

  return (
    <View style={styles.section}>
      {/* Title row — matches IllnessDetailScreen signalTitleRow */}
      <View style={styles.titleRow}>
        <Text style={styles.title}>{t(metric.labelKey)}</Text>
      </View>

      {/* Value row — matches IllnessDetailScreen valueRow */}
      <View style={styles.valueRow}>
        <Text style={styles.valueBig}>{isLoading ? '--' : formattedCurrent}</Text>
      </View>

      {/* Chart */}
      <View style={styles.chartWrap}>
        {isLoading ? (
          <ActivityIndicator color={metric.color} size="small" style={styles.loader} />
        ) : metric.chartType === 'clockTime' && metric.clockRange ? (
          <ClockTimeBarChart
            buckets={buckets}
            series={series}
            color={metric.color}
            clockRange={metric.clockRange}
            chartHeight={CHART_H}
            colWidth={colW}
            barWidth={barW}
          />
        ) : (
          <TrendBarChart
            dayEntries={buckets}
            values={series.map(s => ({ dateKey: s.bucketKey, value: s.value ?? 0 }))}
            selectedIndex={0}
            onSelectDay={() => {}}
            colorFn={() => metric.color}
            maxValue={maxBarVal}
            minValue={metric.minValue ?? 0}
            chartHeight={CHART_H}
            colWidth={colW}
            barWidth={barW}
            showValueLabels={false}
            roundedBars
            unselectedOpacity={0.35}
            labelsBelow
          />
        )}
      </View>

      {/* Sub-stats */}
      <View style={styles.subRow}>
        <View style={styles.subCell}>
          <Text style={styles.subValue}>{formattedAvg}</Text>
          <Text style={styles.subLabel}>{t('trends_detail.stat.avg')}</Text>
        </View>
        <View style={styles.subDivider} />
        <View style={styles.subCell}>
          <Text style={styles.subValue}>{formattedMin}</Text>
          <Text style={styles.subLabel}>{t('trends_detail.stat.min')}</Text>
        </View>
        <View style={styles.subDivider} />
        <View style={styles.subCell}>
          <Text style={styles.subValue}>{formattedMax}</Text>
          <Text style={styles.subLabel}>{t('trends_detail.stat.max')}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // All children share the section's horizontal bounds — no internal padding offsets.
  section: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    overflow: 'hidden',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontFamily: fontFamily.regular,
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.md,
  },
  valueBig: {
    fontFamily: fontFamily.demiBold,
    fontSize: 36,
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  chartWrap: {
    overflow: 'hidden',
    height: CHART_H + 36,
  },
  loader: {
    marginTop: CHART_H / 2 - 12,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.sm,
  },
  subCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  subValue: {
    fontFamily: fontFamily.demiBold,
    fontSize: 18,
    color: '#FFFFFF',
  },
  subLabel: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  subDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
});
