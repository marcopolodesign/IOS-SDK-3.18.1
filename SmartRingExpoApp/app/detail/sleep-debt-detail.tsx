import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from 'react-native';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  interpolateColor,
  Extrapolation,
  FadeIn,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { DetailPageHeader } from '../../src/components/detail/DetailPageHeader';
import { DetailStatRow } from '../../src/components/detail/DetailStatRow';
import { MetricsGrid } from '../../src/components/detail/MetricsGrid';
import { SleepDebtGauge } from '../../src/components/home/SleepDebtGauge';
import { TonightRecommendationCard } from '../../src/components/detail/TonightRecommendationCard';
import { SleepDebtLine } from '../../src/components/detail/SleepDebtLine';
import { SleepVsTargetOverlay } from '../../src/components/detail/SleepVsTargetOverlay';
import { useSleepDebt } from '../../src/hooks/useSleepDebt';
import { gradientForCategory } from '../../src/services/SleepDebtService';
import { spacing, fontSize, fontFamily } from '../../src/theme/colors';
import { formatSleepTime } from '../../src/utils/time';

const COLLAPSE_END = 80;

const TARGET_PRESETS = [420, 450, 480, 510, 540];

function formatAvgTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

export default function SleepDebtDetailScreen() {
  const { t } = useTranslation();
  const { sleepDebt, updateTarget } = useSleepDebt();

  const [gradStart, gradEnd] = useMemo(
    () => gradientForCategory(sleepDebt.category),
    [sleepDebt.category]
  );
  const accent = gradStart;

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => { scrollY.value = e.contentOffset.y; },
  });

  const numberAnimStyle = useAnimatedStyle(() => ({
    fontSize: interpolate(scrollY.value, [0, COLLAPSE_END], [72, 28], Extrapolation.CLAMP),
    lineHeight: interpolate(scrollY.value, [0, COLLAPSE_END], [80, 36], Extrapolation.CLAMP),
    color: interpolateColor(scrollY.value, [0, COLLAPSE_END], [accent, '#FFFFFF']),
  }));
  const labelAnimStyle = useAnimatedStyle(() => ({
    fontSize: interpolate(scrollY.value, [0, COLLAPSE_END], [14, 11], Extrapolation.CLAMP),
    opacity: interpolate(scrollY.value, [0, COLLAPSE_END * 0.6], [1, 0], Extrapolation.CLAMP),
  }));
  const chipSlideStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(scrollY.value, [0, COLLAPSE_END], [30, 0], Extrapolation.CLAMP) }],
    opacity: interpolate(scrollY.value, [0, COLLAPSE_END], [0, 1], Extrapolation.CLAMP),
  }));
  const headlineHeightStyle = useAnimatedStyle(() => ({
    height: interpolate(scrollY.value, [0, COLLAPSE_END], [96, 44], Extrapolation.CLAMP),
  }));

  const handleEditTarget = () => {
    const options = TARGET_PRESETS.map((m) => `${m / 60}h`);
    Alert.alert(
      t('sleep_debt.edit_target'),
      undefined,
      [
        ...options.map((label, i) => ({
          text: label,
          onPress: () => updateTarget(TARGET_PRESETS[i]),
        })),
        { text: t('profile.alerts.cancel'), style: 'cancel' as const },
      ]
    );
  };

  const categoryLabel = t(`sleep_debt.category_${sleepDebt.category}`);

  return (
    <View style={styles.container}>
      {/* Full-screen gradient background */}
      <Reanimated.View entering={FadeIn.duration(600)} style={styles.gradientBg} pointerEvents="none">
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <RadialGradient id="debtGrad1" cx="50%" cy="-20%" rx="90%" ry="220%">
            <Stop offset="0%" stopColor={gradStart} stopOpacity={1} />
            <Stop offset="70%" stopColor={gradStart} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="debtGrad2" cx="15%" cy="20%" rx="60%" ry="80%">
            <Stop offset="0%" stopColor={gradEnd} stopOpacity={0.75} />
            <Stop offset="100%" stopColor={gradEnd} stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id="debtFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="40%" stopColor="#0A0A0F" stopOpacity={0} />
            <Stop offset="100%" stopColor="#0A0A0F" stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill="url(#debtGrad1)" />
        <Rect x="0" y="0" width="100" height="100" fill="url(#debtGrad2)" />
        <Rect x="0" y="0" width="100" height="100" fill="url(#debtFade)" />
        </Svg>
      </Reanimated.View>

      {/* Gradient zone: header only (no day selector) */}
      <View style={styles.gradientZone}>
        <DetailPageHeader title={t('sleep_debt.detail_title')} marginBottom={spacing.md} />
      </View>

      {/* Collapsing headline */}
      <Reanimated.View style={[styles.headlineSection, headlineHeightStyle]}>
        <View style={styles.headlineLeft}>
          <View style={styles.headlineRow}>
            <Reanimated.Text style={[styles.headlineScore, numberAnimStyle]}>
              {formatSleepTime(sleepDebt.totalDebtMin)}
            </Reanimated.Text>
            <Reanimated.Text style={[styles.headlineLabel, labelAnimStyle]}>
              {t('sleep_debt.card_title').toUpperCase()}
            </Reanimated.Text>
          </View>
        </View>
        <View style={styles.chipRight}>
          <Reanimated.View
            style={[
              styles.chip,
              chipSlideStyle,
              { backgroundColor: `${accent}22`, borderColor: `${accent}55` },
            ]}
          >
            <Text style={[styles.chipText, { color: accent }]}>{categoryLabel}</Text>
          </Reanimated.View>
        </View>
      </Reanimated.View>

      <Reanimated.ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {!sleepDebt.isReady ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {t('sleep_debt.not_enough_data', { count: 3 - sleepDebt.daysWithData })}
            </Text>
            <TouchableOpacity onPress={handleEditTarget} activeOpacity={0.7} style={styles.targetButton}>
              <Text style={styles.targetButtonText}>{t('sleep_debt.edit_target')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Insight */}
            <View style={styles.insightBlock}>
              <Text style={styles.insightText}>
                {t(`sleep_debt.insight_${sleepDebt.category}`)}
              </Text>
            </View>

            {/* Tonight recommendation */}
            {sleepDebt.tonight && (
              <TonightRecommendationCard
                recommendedMin={sleepDebt.tonight.recommendedMin}
                targetMin={sleepDebt.targetMin}
                extraPerNight={sleepDebt.tonight.extraPerNight}
                rationaleKey={sleepDebt.tonight.rationaleKey}
                accent={accent}
              />
            )}

            {/* Main line chart: running sleep debt over 30 days */}
            {(sleepDebt.last30 ?? []).length >= 2 && (
              <View style={styles.chartSection}>
                <View style={styles.chartHeader}>
                  <Text style={styles.chartTitle}>{t('sleep_debt.chart_debt_title')}</Text>
                  <Text style={styles.chartSubtitle}>{t('sleep_debt.chart_debt_subtitle')}</Text>
                </View>
                <SleepDebtLine
                  points={sleepDebt.last30!}
                />
              </View>
            )}

            {/* Overlap chart: actual sleep vs recommended (last 7 nights) */}
            {(sleepDebt.last7 ?? []).length >= 2 && (
              <View style={styles.chartSection}>
                <View style={styles.chartHeader}>
                  <Text style={styles.chartTitle}>{t('sleep_debt.chart_overlap_title')}</Text>
                  <Text style={styles.chartSubtitle}>{t('sleep_debt.chart_overlap_subtitle')}</Text>
                </View>
                <SleepVsTargetOverlay
                  nights={sleepDebt.last7!}
                />
              </View>
            )}

            {/* Metrics grid */}
            <MetricsGrid metrics={[
              { label: t('sleep_debt.avg_label'), value: formatAvgTime(sleepDebt.averageSleepMin) },
              { label: t('sleep_debt.target_label'), value: formatAvgTime(sleepDebt.targetMin), onPress: handleEditTarget },
              { label: t('sleep_debt.days_tracked'), value: `${sleepDebt.daysWithData} / 7` },
              { label: t('sleep_debt.total_debt'), value: formatSleepTime(sleepDebt.totalDebtMin), accent },
            ]} />

            {/* Target edit row */}
            <View style={styles.statsContainer}>
              <TouchableOpacity onPress={handleEditTarget} activeOpacity={0.7}>
                <DetailStatRow
                  title={t('sleep_debt.target_label')}
                  value={formatAvgTime(sleepDebt.targetMin)}
                  unit={t('sleep_debt.tap_to_edit')}
                />
              </TouchableOpacity>
            </View>

            {/* Gauge (small recap) */}
            <View style={styles.gaugeRecap}>
              <SleepDebtGauge
                totalDebtMin={sleepDebt.totalDebtMin}
                category={sleepDebt.category}
              />
            </View>
          </>
        )}
      </Reanimated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  gradientBg: { position: 'absolute', top: 0, left: 0, right: 0, height: 480 },
  gradientZone: {},
  headlineSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    overflow: 'hidden',
  },
  headlineLeft: { flex: 1, flexDirection: 'column', alignItems: 'flex-start' },
  headlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headlineScore: { fontFamily: fontFamily.regular },
  headlineLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontFamily: fontFamily.regular,
    letterSpacing: 0.8,
  },
  chipRight: { overflow: 'hidden' },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  chipText: { fontSize: 11, fontFamily: fontFamily.demiBold, textTransform: 'uppercase' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 60 },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
  },
  targetButton: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  targetButtonText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
  },
  insightBlock: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  insightText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 16,
    fontFamily: fontFamily.regular,
    lineHeight: 24,
  },
  chartSection: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.xs,
  },
  chartTitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    fontFamily: fontFamily.demiBold,
  },
  chartSubtitle: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    fontFamily: fontFamily.regular,
  },
  statsContainer: {
    marginHorizontal: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  gaugeRecap: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }],
    opacity: 0.7,
  },
});
