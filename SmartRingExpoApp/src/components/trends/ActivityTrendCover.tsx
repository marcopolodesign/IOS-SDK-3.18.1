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
import { useMetricHistory, DayActivityData, buildDayNavigatorLabels } from '../../hooks/useMetricHistory';
import { trendDirection } from '../../utils/baselineStats';
import { useHomeDataContext } from '../../context/HomeDataContext';
import { spacing, fontFamily } from '../../theme/colors';

const STEP_COLOR = '#FFB84D';

function formatSteps(n: number): string {
  if (n <= 0) return '--';
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
}

export function ActivityTrendCover() {
  const { t } = useTranslation();
  const router = useRouter();
  const homeData = useHomeDataContext();

  const { data: activityData, isLoading } = useMetricHistory<DayActivityData>('activity', { initialDays: 7 });
  const dayLabels = useMemo(() => buildDayNavigatorLabels(7), []);

  const { avgSteps, barValues, workoutCount, maxBarVal, statusKey } = useMemo(() => {
    const entries: DayActivityData[] = dayLabels
      .map(d => activityData.get(d.dateKey))
      .filter((d): d is DayActivityData => !!d);

    const stepsEntries = entries.filter(d => d.steps > 0);
    const avg = stepsEntries.length > 0
      ? Math.round(stepsEntries.reduce((s, d) => s + d.steps, 0) / stepsEntries.length)
      : 0;

    const bars = dayLabels.map(d => ({
      dateKey: d.dateKey,
      value: activityData.get(d.dateKey)?.steps ?? 0,
    }));

    const maxBar = bars.reduce((m, b) => Math.max(m, b.value * 1.1), 10000);

    const workouts = homeData.strainBreakdown.reduce(
      (count, d) => count + d.stravaWorkouts.length,
      0
    );

    const dir = trendDirection(bars.map(b => b.value));
    const key = dir === 'up' ? 'trends.activity_improving' : dir === 'down' ? 'trends.activity_declining' : 'trends.activity_stable';

    return { avgSteps: avg, barValues: bars, workoutCount: workouts, maxBarVal: maxBar, statusKey: key };
  }, [activityData, dayLabels, homeData.strainBreakdown]);

  const strain = Math.round(homeData.strain);

  return (
    <TouchableOpacity activeOpacity={0.88} onPress={() => router.push('/detail/activity-trends')}>
      <BlurView intensity={22} tint="dark" style={CARD_BLUR_STYLE}>
      <GradientInfoCard
        style={{ backgroundColor: 'transparent' }}
        contentContainerStyle={{ backgroundColor: 'rgba(255,255,255,0.07)' }}
        icon={<Ionicons name="flame-outline" size={16} color="rgba(255,255,255,0.9)" />}
        title={t('trends.activity_title')}
        headerValue={formatSteps(avgSteps)}
        headerSubtitle="steps"
        showArrow={false}
        headerRight={isLoading ? undefined : <TrendHeaderRight text={t('trends.avg_steps')} />}
        gradientStops={[
          { offset: 0, color: '#6B3A0A', opacity: 1 },
          { offset: 0.6, color: '#3A1F05', opacity: 1 },
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
            colorFn={() => STEP_COLOR}
            maxValue={maxBarVal}
            minValue={0}
            chartHeight={110}
            colWidth={Math.floor(TREND_CHART_W / 7)}
            barWidth={Math.floor(TREND_CHART_W / 7) - 10}
            showValueLabels={false}
            roundedBars
          />
        </View>
        <View style={styles.subStats}>
          <TrendSubStat label={t('trends.strain_label')} value={strain > 0 ? String(strain) : '--'} />
          <TrendSubStatDivider />
          <TrendSubStat label={t('trends.workouts_label')} value={String(workoutCount)} />
          <TrendSubStatDivider />
          <TrendSubStat
            label={t('trends.avg_steps')}
            value={avgSteps > 0 ? avgSteps.toLocaleString() : '--'}
          />
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
