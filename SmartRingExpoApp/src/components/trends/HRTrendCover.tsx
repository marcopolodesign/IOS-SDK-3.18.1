import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { GradientInfoCard } from '../common/GradientInfoCard';
import { TrendLineChart } from './TrendLineChart';
import { TrendSubStat, TrendSubStatDivider, TrendHeaderRight } from './TrendSubStat';
import { TREND_LINE_CHART_W, CARD_BLUR_STYLE } from './trendLayout';
import { BlurView } from 'expo-blur';
import { useMetricHistory, type DayHRData, buildDayNavigatorLabels } from '../../hooks/useMetricHistory';
import { bandFromBaseline, mean, trendDirection } from '../../utils/baselineStats';
import { useHomeDataContext } from '../../context/HomeDataContext';
import type { FocusBaselines } from '../../types/focus.types';
import { spacing, fontFamily } from '../../theme/colors';

const HR_COLOR = '#FF6B6B';

interface Props {
  baselines: FocusBaselines;
}

export function HRTrendCover({ baselines }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const homeData = useHomeDataContext();

  const { data: hrData, isLoading } = useMetricHistory<DayHRData>('heartRate', { initialDays: 7, fullDays: 30 });
  const dayLabels = useMemo(() => buildDayNavigatorLabels(30), []);

  const { chartData, todayRHR, todayAvgHR, subtitle, statusKey } = useMemo(() => {
    const pointsDesc = dayLabels.map(d => ({
      dateKey: d.dateKey,
      value: hrData.get(d.dateKey)?.restingHR ?? 0,
    }));

    const today = pointsDesc[0]?.value || homeData.lastNightSleep?.restingHR || 0;
    const b = bandFromBaseline(baselines.restingHR);
    const baselineMean = b ? b.mean : mean(baselines.restingHR);

    let sub = t('trends.still_calibrating');
    if (b && today > 0) {
      const pct = Math.abs(Math.round(((today - baselineMean) / baselineMean) * 100));
      // Lower resting HR vs baseline = good
      sub = today <= baselineMean
        ? `↓ ${pct}% ${t('trends.below_baseline')}`
        : `↑ ${pct}% ${t('trends.above_baseline')}`;
    } else if (baselines.restingHR.length >= 3 && today > 0) {
      sub = `vs ${Math.round(baselineMean)} bpm baseline`;
    }

    // Lower resting HR trend = improving (inverted vs HRV)
    const dir = trendDirection(pointsDesc.map(d => d.value));
    const key =
      dir === 'down' ? 'trends.hr_improving' :
      dir === 'up'   ? 'trends.hr_declining' :
                       'trends.hr_stable';

    const todayDay = hrData.get(dayLabels[0]?.dateKey ?? '');

    return {
      chartData: [...pointsDesc].reverse(),
      todayRHR: today,
      todayAvgHR: todayDay?.avgHR ?? 0,
      subtitle: sub,
      statusKey: key,
    };
  }, [hrData, dayLabels, baselines, homeData.lastNightSleep?.restingHR, t]);

  const hrv = homeData.hrvSdnn;

  return (
    <TouchableOpacity activeOpacity={0.88} onPress={() => router.push('/detail/hr-trends')}>
      <BlurView intensity={22} tint="dark" style={CARD_BLUR_STYLE}>
        <GradientInfoCard
          style={{ backgroundColor: 'transparent' }}
          contentContainerStyle={{ backgroundColor: 'rgba(255,255,255,0.07)' }}
          icon={<Ionicons name="heart-outline" size={16} color="rgba(255,255,255,0.9)" />}
          title={t('trends.hr_title')}
          headerValue={todayRHR > 0 ? `${Math.round(todayRHR)}` : '--'}
          headerSubtitle="bpm"
          showArrow={false}
          headerRight={isLoading ? undefined : <TrendHeaderRight text={subtitle} />}
          gradientStops={[
            { offset: 0, color: '#7B0000', opacity: 1 },
            { offset: 0.6, color: '#3A0000', opacity: 1 },
            { offset: 1, color: '#0D0D0D', opacity: 0 },
          ]}
          gradientCenter={{ x: 0.5, y: -0.5 }}
          gradientRadii={{ rx: '120%', ry: '200%' }}
        >
          {!isLoading && <Text style={styles.statusLine}>{t(statusKey)}</Text>}
          <View style={styles.chartWrap}>
            <TrendLineChart
              data={chartData}
              width={TREND_LINE_CHART_W}
              height={110}
              color={HR_COLOR}
            />
          </View>
          <View style={styles.subStats}>
            <TrendSubStat label={t('trends.rhr_label')} value={todayRHR > 0 ? `${Math.round(todayRHR)} bpm` : '--'} />
            <TrendSubStatDivider />
            <TrendSubStat label={t('trends.avg_hr_label')} value={todayAvgHR > 0 ? `${Math.round(todayAvgHR)} bpm` : '--'} />
            <TrendSubStatDivider />
            <TrendSubStat label={t('trends.hrv_label')} value={hrv > 0 ? `${Math.round(hrv)} ms` : '--'} />
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
