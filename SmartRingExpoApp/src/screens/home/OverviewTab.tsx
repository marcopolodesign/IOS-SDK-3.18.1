import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, RefreshControl, Animated, TouchableOpacity } from 'react-native';
import Reanimated from 'react-native-reanimated';
import { useTabScroll } from '../../hooks/useTabScroll';
import { router } from 'expo-router';
import { SemiCircularGauge } from '../../components/home/SemiCircularGauge';
import { MetricInsightCard } from '../../components/home/MetricInsightCard';
import { GradientInfoCard } from '../../components/common/GradientInfoCard';
import { SleepScoreIcon } from '../../assets/icons';
import DailyHeartRateCard from '../../components/home/DailyHeartRateCard';
import { IllnessWatchCard } from '../../components/focus/IllnessWatchCard';

import DailyTimelineCard from '../../components/home/DailyTimelineCard';
import { CaffeineWindowCard } from '../../components/home/CaffeineWindowCard';
import { CaffeineBarChart } from '../../components/detail/CaffeineBarChart';
import { clearanceHour, recommendedWindow, MAX_CAFFEINE_MG, CAFFEINE_PRESETS } from '../../utils/caffeinePk';
import { formatDecimalHour, getSleepHours } from '../../utils/time';
import LogEntrySheet from '../../components/home/LogEntrySheet';
import { useHomeDataContext } from '../../context/HomeDataContext';
import { useFocusDataContext } from '../../context/FocusDataContext';
import { getScoreMessage, getSleepMessage } from '../../hooks/useHomeData';
import { useTimelineEntries } from '../../hooks/useTimelineEntries';
import { useAddOverlay } from '../../context/AddOverlayContext';
import { spacing, fontSize, fontFamily } from '../../theme/colors';
import NightTimeIcon from '../../assets/icons/NightTimeIcon';
import WakeTimeIcon from '../../assets/icons/WakeTimeIcon';
import { InfoButton } from '../../components/common/InfoButton';
import { useSleepDebt } from '../../hooks/useSleepDebt';
import { useBaselineMode } from '../../context/BaselineModeContext';
import { BaselineProgressCard } from '../../components/home/BaselineProgressCard';
import type { SleepDebtCategory } from '../../types/sleepDebt.types';
import { useRelativeTime } from '../../hooks/useRelativeTime';
import { useOverviewGaugePhase } from '../../hooks/useOverviewGaugePhase';
import { WindDownHero } from '../../components/home/WindDownHero';
import { useCaffeineTimeline } from '../../hooks/useCaffeineTimeline';

const DEBT_COLORS: Record<SleepDebtCategory, string> = {
  none: '#4ADE80',
  low: '#FFD700',
  moderate: '#FF6B35',
  high: '#FF4444',
};

type OverviewTabProps = {
  onScroll?: Animated.AnimatedEvent<any>;
  onChartTouchStart?: () => void;
  onChartTouchEnd?: () => void;
  onSleepPress?: () => void;
  isActive?: boolean;
};

export function OverviewTab({ onScroll, onChartTouchStart, onChartTouchEnd, onSleepPress, isActive = false }: OverviewTabProps) {
  const { t } = useTranslation();
  const homeData = useHomeDataContext();
  const focusData = useFocusDataContext();
  const { setActionHandler, showOverlay } = useAddOverlay();
  const { entries: timelineEntries, addEntry } = useTimelineEntries();
  const { entries: caffeineEntries, doses: caffeineDoses, currentMg: caffeineCurrentMg } = useCaffeineTimeline();
  const [refreshing, setRefreshing] = React.useState(false);
  const [sheetMode, setSheetMode] = React.useState<'recovery' | 'activity' | null>(null);
  const lastSyncLabel = useRelativeTime(homeData.lastSyncedAt);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await homeData.refresh();
    setRefreshing(false);
  }, [homeData.refresh]);

  const handleOverlayAction = React.useCallback((label: string) => {
    if (label === 'Log Recovery') {
      setSheetMode('recovery');
    } else if (label === 'Log Activity') {
      setSheetMode('activity');
    }
  }, []);

  React.useEffect(() => {
    setActionHandler(handleOverlayAction);
    return () => setActionHandler(null);
  }, [setActionHandler, handleOverlayAction]);

  const { scrollRef, scrollY, handleScroll, isScrolled, firstCardStyle } = useTabScroll(isActive, onScroll as any);

  const { sleepDebt } = useSleepDebt();
  const baseline = useBaselineMode();
  const gauge = useOverviewGaugePhase();
  const scoreMessage = getScoreMessage(homeData.overallScore, t);
  const sleepMessage = getSleepMessage(homeData.sleepScore, t);
  const sleep = homeData.lastNightSleep;

  // Caffeine window computations — used for the inline bar chart below the gauge
  const { wakeHour: caffeineWakeHour, bedHour: caffeineBedHour } = getSleepHours(sleep.wakeTime, sleep.bedTime);
  const caffeineClearHour = React.useMemo(() => clearanceHour(caffeineDoses), [caffeineDoses]);
  const caffeineWindow = React.useMemo(() => recommendedWindow(caffeineWakeHour, caffeineBedHour), [caffeineWakeHour, caffeineBedHour]);
  const caffeineNow = new Date();
  const caffeineNowHour = caffeineNow.getHours() + caffeineNow.getMinutes() / 60;
  const caffeineActivePhase: 'pre' | 'open' | 'closed' =
    caffeineNowHour < caffeineWindow.start ? 'pre' : caffeineNowHour <= caffeineWindow.end ? 'open' : 'closed';

  const insightText = React.useMemo(() => {
    if (gauge.key === 'caffeine') {
      const windowEndTime = formatDecimalHour(caffeineWindow.end);
      const clearTime = formatDecimalHour(caffeineClearHour);
      const budget = Math.max(0, Math.round(MAX_CAFFEINE_MG - caffeineCurrentMg));
      const topDrinks = CAFFEINE_PRESETS.filter(p => p.key !== 'custom' && p.defaultMg <= budget).slice(0, 2);
      if (caffeineActivePhase === 'closed' || topDrinks.length === 0) {
        return `Caffeine clears at ${clearTime}. Skip more for quality sleep tonight.`;
      }
      const drinkNames = topDrinks.map(d => t(`adenosine.preset.${d.key}`)).join(' or ');
      return `Window open until ${windowEndTime}. You can still have a ${drinkNames}.`;
    }
    if (gauge.key !== 'wind_down') {
      return [homeData.userName ? `${homeData.userName} — ` : null, scoreMessage, homeData.insight]
        .filter(Boolean).join('');
    }
    const debt = sleepDebt.totalDebtMin;
    const minsUntilBed = gauge.meta?.minsUntilBed ?? 0;
    if (minsUntilBed < 0) {
      const past = Math.round(-minsUntilBed);
      return debt >= 30
        ? `You're ${past} min past your target — and carrying ${Math.floor(debt / 60)}h ${Math.round(debt % 60)}m of sleep debt. Head to bed now.`
        : `You're ${past} min past your target. Head to bed to protect tomorrow's recovery.`;
    }
    return debt >= 30
      ? `You're carrying ${Math.floor(debt / 60)}h ${Math.round(debt % 60)}m of sleep debt. Getting to bed on time helps recovery.`
      : `Your sleep debt is low. Stick to your target bedtime to keep it that way.`;
  }, [gauge.key, gauge.meta?.minsUntilBed, sleepDebt.totalDebtMin, homeData.userName, scoreMessage, homeData.insight, caffeineClearHour, caffeineWindow.end, caffeineCurrentMg, caffeineActivePhase, t]);

  const isOnboarding = baseline.isInBaselineMode;

  const formatTime = (date?: Date) => {
    if (!date) return '--';
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const formattedMinutes = minutes.toString().padStart(2, '0');
    const formattedHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    const meridiem = hours >= 12 ? 'PM' : 'AM';
    return `${formattedHours}:${formattedMinutes} ${meridiem}`;
  };

  return (
    <>
    <Animated.ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
      onScroll={handleScroll}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="rgba(255,255,255,0.7)"
        />
      }
    >
      {isOnboarding ? (
        /* ── Baseline Progress Card ── */
        <BaselineProgressCard />
      ) : (
        <>
          {/* Main hero — phase-specific component, not always the gauge */}
          <View style={styles.gaugeSection}>
            {gauge.key === 'wind_down' ? (
              <WindDownHero
                targetBedtimeMs={gauge.meta?.targetBedtimeMs ?? Date.now()}
                minsUntilBed={gauge.meta?.minsUntilBed ?? 0}
                sleepDebtTotalMin={sleepDebt.totalDebtMin}
              />
            ) : gauge.key === 'caffeine' ? (
              <CaffeineBarChart
                doses={caffeineDoses}
                entries={caffeineEntries}
                win={caffeineWindow}
                clearHour={caffeineClearHour}
                timeStart={caffeineWakeHour}
                timeEnd={caffeineBedHour}
                height={200}
                heroMode
              />
            ) : (
              <SemiCircularGauge
                score={gauge.score}
                label={t(gauge.labelKey)}
                animated={!homeData.isLoading}
                phaseKey={gauge.key}
              />
            )}
            <View style={styles.gaugeInfoBtn}>
              <InfoButton metricKey={gauge.metricKey} />
            </View>
          </View>

          {/* Metrics + Insight Card */}
          <TouchableOpacity style={styles.metricsInsightSection} activeOpacity={0.85} onPress={() => router.push('/detail/recovery-detail')}>
            <MetricInsightCard
              metrics={[
                { label: t('overview.strain'), value: homeData.strain },
                { label: t('overview.readiness'), value: focusData.readiness?.score ?? homeData.readiness },
                { label: t('overview.sleep'), value: homeData.sleepScore, onPress: () => router.push('/detail/sleep-detail') },
              ]}
              insight={insightText}
              scrollY={scrollY}

            />
          </TouchableOpacity>

          {/* Sleep Score */}
          <Reanimated.View style={[styles.gradientCardSection, firstCardStyle]}>
            <GradientInfoCard
              icon={<SleepScoreIcon />}
              title={t('overview.sleep_score')}
              titleCaption={lastSyncLabel}
              headerValue={sleep.score || 0}
              headerSubtitle={sleepMessage}
              showArrow
              onHeaderPress={onSleepPress}
              gradientStops={[
                { offset: 0, color: '#7100C2', opacity: 1 },
                { offset: 0.55, color: '#7100C2', opacity: 0.2 },
              ]}
              gradientCenter={{ x: 0.51, y: -0.86 }}
              gradientRadii={{ rx: '80%', ry: '300%' }}
              headerRight={<InfoButton metricKey="sleep_score" />}
            >
              <View style={styles.sleepTimeline}>
                <View style={styles.sleepTimeItem}>
                  <NightTimeIcon />
                  <Text style={styles.sleepTimeText}>{formatTime(sleep.bedTime)}</Text>
                </View>
                <View style={styles.sleepProgress} />
                <View style={styles.sleepTimeItem}>
                  <WakeTimeIcon />
                  <Text style={styles.sleepTimeText}>{formatTime(sleep.wakeTime)}</Text>
                </View>
              </View>

              <View style={styles.sleepStatsRow}>
                <Text style={styles.sleepStatText}>{sleep.timeAsleep || '—'}</Text>
                <Text style={styles.sleepStatText}>{sleep.restingHR ? `${sleep.restingHR} ${t('overview.bpm_unit')}` : '—'}</Text>
              </View>

              {sleepDebt.isReady && (
                <View style={styles.debtRow}>
                  <View style={[styles.debtDot, { backgroundColor: DEBT_COLORS[sleepDebt.category] }]} />
                  <Text style={styles.debtText}>
                    {t('sleep_debt.debt_label')}: {sleepDebt.totalDebtMin < 30
                      ? t('sleep_debt.category_none')
                      : `${Math.floor(sleepDebt.totalDebtMin / 60)}h ${Math.round(sleepDebt.totalDebtMin % 60)}m`}
                  </Text>
                </View>
              )}
            </GradientInfoCard>
          </Reanimated.View>
        </>
      )}

      {/* Heart rate through the day */}
      <View style={styles.gradientCardSection}>
        <DailyHeartRateCard preloadedData={homeData.hrChartData} headerRight={<InfoButton metricKey="daily_hr_chart" />} onTouchStart={onChartTouchStart} onTouchEnd={onChartTouchEnd} />
      </View>

      {/* Caffeine Window */}
      <View style={styles.gradientCardSection}>
        <CaffeineWindowCard />
      </View>

      {/* Daily Chronology Timeline */}
      <View style={styles.gradientCardSection}>
        <DailyTimelineCard
          sleep={sleep}
          activitySessions={homeData.activitySessions}
          manualEntries={timelineEntries}
          unifiedActivities={homeData.unifiedActivities}
          todayNaps={homeData.todayNaps}
          caffeineEntries={caffeineEntries}
          onAddPress={() => showOverlay()}
        />
      </View>

      {/* Illness Watch */}
      <View style={styles.gradientCardSection}>
        <IllnessWatchCard
          illness={focusData.illness}
          isLoading={focusData.isLoading}
        />
      </View>

      {/* Spacer for bottom padding */}
      <View style={styles.bottomSpacer} />
    </Animated.ScrollView>

    <LogEntrySheet
      visible={sheetMode !== null}
      mode={sheetMode}
      onClose={() => setSheetMode(null)}
      onSave={addEntry}
    />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingTop: spacing.lg,
    paddingBottom: 100,
  },
  gaugeSection: {
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  gaugeInfoBtn: {
    position: 'absolute',
    top: 8,
    right: 16,
  },
  metricsInsightSection: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  contributorRow: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  contributorChip: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  contributorLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
  },
  contributorValue: {
    color: '#FFFFFF',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.demiBold,
    marginTop: 2,
  },
  recommendationWrap: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  recommendationText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    lineHeight: 20,
  },
  statsSection: {
    marginBottom: spacing.lg,
  },
  insightSection: {
    marginBottom: spacing.md,
  },
  previewSection: {
    marginBottom: spacing.md,
  },
  gradientCardSection: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  sleepTimeline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sleepTimeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sleepTimeIcon: {
    fontSize: 14,
  },
  sleepTimeText: {
    color: 'rgba(255,255,255,0.85)',
    fontFamily: fontFamily.regular,
  },
  sleepProgress: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  sleepStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sleepStatText: {
    color: 'rgba(255,255,255,0.85)',
    fontFamily: fontFamily.regular,
  },
  debtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  debtDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  debtText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontFamily: fontFamily.regular,
  },
  bottomSpacer: {
    height: 50,
  },
});

export default OverviewTab;
