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
import { useMetricHistory, DayHRVData, buildDayNavigatorLabels } from '../../hooks/useMetricHistory';
import { bandFromBaseline, mean, trendDirection } from '../../utils/baselineStats';
import { useHomeDataContext } from '../../context/HomeDataContext';
import type { FocusBaselines } from '../../types/focus.types';
import { spacing, fontFamily } from '../../theme/colors';

const HRV_COLOR = '#6B8EFF';

interface Props {
  baselines: FocusBaselines;
}

export function RecoveryTrendCover({ baselines }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const homeData = useHomeDataContext();

  const { data: hrvData, isLoading } = useMetricHistory<DayHRVData>('hrv', { initialDays: 7, fullDays: 30 });
  const dayLabels30 = useMemo(() => buildDayNavigatorLabels(30), []);

  const { chartData, todayHrv, subtitle, band, statusKey } = useMemo(() => {
    // most-recent-first for trendDirection; reverse for left-to-right chart
    const pointsDesc = dayLabels30.map(d => ({
      dateKey: d.dateKey,
      value: hrvData.get(d.dateKey)?.sdnn ?? 0,
    }));

    const today = pointsDesc[0]?.value ?? homeData.hrvSdnn ?? 0;
    const b = bandFromBaseline(baselines.hrv);
    const baselineMean = b ? b.mean : mean(baselines.hrv);

    let sub = t('trends.still_calibrating');
    if (b && today > 0) {
      const pct = Math.abs(Math.round(((today - baselineMean) / baselineMean) * 100));
      sub = today >= baselineMean
        ? `↑ ${pct}% ${t('trends.above_baseline')}`
        : `↓ ${pct}% ${t('trends.below_baseline')}`;
    } else if (baselines.hrv.length >= 3 && today > 0) {
      sub = `vs ${Math.round(baselineMean)} ms baseline`;
    }

    const dir = trendDirection(pointsDesc.map(d => d.value));
    const key = dir === 'up' ? 'trends.recovery_improving' : dir === 'down' ? 'trends.recovery_declining' : 'trends.recovery_stable';

    return {
      chartData: [...pointsDesc].reverse(),
      todayHrv: today,
      subtitle: sub,
      band: b,
      statusKey: key,
    };
  }, [hrvData, dayLabels30, baselines, homeData.hrvSdnn, t]);

  const rhr = homeData.lastNightSleep?.restingHR ?? 0;
  const spo2 = homeData.todayVitals?.lastSpo2 ?? null;
  const tempC = homeData.todayVitals?.temperatureC ?? null;

  return (
    <TouchableOpacity activeOpacity={0.88} onPress={() => router.push('/detail/recovery-trends')}>
      <BlurView intensity={22} tint="dark" style={CARD_BLUR_STYLE}>
      <GradientInfoCard
        style={{ backgroundColor: 'transparent' }}
        contentContainerStyle={{ backgroundColor: 'rgba(255,255,255,0.07)' }}
        icon={<Ionicons name="pulse-outline" size={16} color="rgba(255,255,255,0.9)" />}
        title={t('trends.recovery_title')}
        headerValue={todayHrv > 0 ? `${Math.round(todayHrv)}` : '--'}
        headerSubtitle="ms"
        showArrow={false}
        headerRight={isLoading ? undefined : <TrendHeaderRight text={subtitle} />}
        gradientStops={[
          { offset: 0, color: '#1A3A6B', opacity: 1 },
          { offset: 0.6, color: '#0D1E3A', opacity: 1 },
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
            color={HRV_COLOR}
            bandRange={band}
          />
        </View>
        <View style={styles.subStats}>
          <TrendSubStat label={t('trends.rhr_label')} value={rhr > 0 ? `${rhr} bpm` : '--'} />
          <TrendSubStatDivider />
          <TrendSubStat label={t('trends.spo2_label')} value={spo2 != null ? `${spo2}%` : '--'} />
          <TrendSubStatDivider />
          <TrendSubStat label={t('trends.temp_label')} value={tempC != null ? `${tempC.toFixed(1)}°` : '--'} />
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
