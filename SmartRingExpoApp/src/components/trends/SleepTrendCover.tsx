import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { GradientInfoCard } from '../common/GradientInfoCard';
import { TrendBarChart } from '../detail/TrendBarChart';
import { TrendSubStat, TrendSubStatDivider, TrendHeaderRight } from './TrendSubStat';
import { TREND_CHART_W, CARD_BLUR_STYLE } from './trendLayout';
import { BlurView } from 'expo-blur';
import { useMetricHistory, DaySleepData, buildDayNavigatorLabels } from '../../hooks/useMetricHistory';
import { bandFromBaseline, mean, trendDirection } from '../../utils/baselineStats';
import { formatMinutes } from '../../utils/sleepDerivations';
import type { FocusBaselines } from '../../types/focus.types';
import { spacing, fontFamily } from '../../theme/colors';

interface Props {
  baselines: FocusBaselines;
}

export function SleepTrendCover({ baselines }: Props) {
  const { t } = useTranslation();
  const router = useRouter();

  const { data, isLoading } = useMetricHistory<DaySleepData>('sleep', { initialDays: 7, fullDays: 14 });
  const dayLabels = useMemo(() => buildDayNavigatorLabels(7), []);

  const { avgScore, avgDeep, avgRem, barValues, headerValue, subtitle, band, maxBarVal, statusKey } = useMemo(() => {
    const entries: DaySleepData[] = dayLabels
      .map(d => data.get(d.dateKey))
      .filter((d): d is DaySleepData => !!d && d.timeAsleepMinutes > 0);

    const avg = entries.length > 0
      ? Math.round(entries.reduce((s, d) => s + d.timeAsleepMinutes, 0) / entries.length)
      : 0;
    const score = entries.length > 0
      ? Math.round(entries.reduce((s, d) => s + d.score, 0) / entries.length)
      : 0;
    const deep = entries.length > 0
      ? Math.round(entries.reduce((s, d) => s + d.deepMin, 0) / entries.length)
      : 0;
    const rem = entries.length > 0
      ? Math.round(entries.reduce((s, d) => s + d.remMin, 0) / entries.length)
      : 0;

    const bars = dayLabels.map(d => ({
      dateKey: d.dateKey,
      value: data.get(d.dateKey)?.timeAsleepMinutes ?? 0,
    }));

    const b = bandFromBaseline(baselines.sleepMinutes);
    const baselineMean = b ? b.mean : mean(baselines.sleepMinutes);
    const header = avg > 0 ? formatMinutes(avg) : '--';
    const maxBar = Math.max(600, ...(b ? [b.max * 1.1] : []), ...bars.map(d => d.value));

    let sub = t('trends.still_calibrating');
    if (b && avg > 0) {
      const diff = avg - baselineMean;
      const sign = diff >= 0 ? '+' : '';
      sub = `${sign}${formatMinutes(Math.abs(Math.round(diff)))} vs ${formatMinutes(Math.round(baselineMean))} baseline`;
    } else if (baselines.sleepMinutes.length >= 3 && avg > 0) {
      sub = `vs ${formatMinutes(Math.round(baselineMean))} baseline`;
    }

    const dir = trendDirection(bars.map(d => d.value));
    const statusKey = dir === 'up' ? 'trends.sleep_improving' : dir === 'down' ? 'trends.sleep_declining' : 'trends.sleep_stable';

    return { avgScore: score, avgDeep: deep, avgRem: rem, barValues: bars, headerValue: header, subtitle: sub, band: b, maxBarVal: maxBar, statusKey };
  }, [data, baselines, dayLabels, t]);

  return (
    <TouchableOpacity activeOpacity={0.88} onPress={() => router.push('/detail/sleep-trends')}>
      <BlurView intensity={22} tint="dark" style={CARD_BLUR_STYLE}>
      <GradientInfoCard
        style={{ backgroundColor: 'transparent' }}
        contentContainerStyle={{ backgroundColor: 'rgba(255,255,255,0.07)' }}
        icon={<Ionicons name="moon-outline" size={16} color="rgba(255,255,255,0.9)" />}
        title={t('trends.sleep_title')}
        headerValue={headerValue}
        headerSubtitle={t('trends.avg_label')}
        showArrow={false}
        headerRight={isLoading ? undefined : <TrendHeaderRight text={subtitle} />}
        gradientStops={[
          { offset: 0, color: '#3B2A7A', opacity: 1 },
          { offset: 0.6, color: '#1A1440', opacity: 1 },
          { offset: 1, color: '#0D0D0D', opacity: 0 },
        ]}
        gradientCenter={{ x: 0.5, y: -0.5 }}
        gradientRadii={{ rx: '120%', ry: '200%' }}
      >
        {!isLoading && <Text style={styles.statusLine}>{t(statusKey)}</Text>}
        <View style={styles.chartWrap}>
          <TrendBarChart
            dayEntries={dayLabels}
            values={barValues}
            selectedIndex={0}
            onSelectDay={() => {}}
            colorFn={() => '#6B8EFF'}
            maxValue={maxBarVal}
            minValue={0}
            chartHeight={110}
            colWidth={Math.floor(TREND_CHART_W / 7)}
            barWidth={Math.floor(TREND_CHART_W / 7) - 10}
            showValueLabels={false}
            roundedBars
            bandRange={band ?? undefined}
          />
        </View>
        <View style={styles.subStats}>
          <TrendSubStat label={t('trends.avg_score')} value={avgScore > 0 ? String(avgScore) : '--'} />
          <TrendSubStatDivider />
          <TrendSubStat label={t('trends.deep_label')} value={formatMinutes(avgDeep)} />
          <TrendSubStatDivider />
          <TrendSubStat label={t('trends.rem_label')} value={formatMinutes(avgRem)} />
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
