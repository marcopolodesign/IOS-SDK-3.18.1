import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, RefreshControl, ActivityIndicator, Animated, FlatList, ImageBackground, Dimensions } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { SemiCircularGauge } from '../../components/home/SemiCircularGauge';
import { SleepHypnogram } from '../../components/home/SleepHypnogram';
import { MetricInsightCard } from '../../components/home/MetricInsightCard';
import { GradientInfoCard } from '../../components/common/GradientInfoCard';
import { SleepScoreIcon } from '../../assets/icons';
import DailySleepTrendCard from '../../components/home/DailySleepTrendCard';
import SleepDebtCard from '../../components/home/SleepDebtCard';
import SleepBaselineTierCard from '../../components/home/SleepBaselineTierCard';
import NapCard from '../../components/home/NapCard';
import { useHomeDataContext } from '../../context/HomeDataContext';
import { getSleepMessage } from '../../hooks/useHomeData';
import { spacing, fontSize, fontFamily, borderRadius } from '../../theme/colors';
import { InfoButton } from '../../components/common/InfoButton';

type SleepTabProps = {
  onScroll?: (event: any) => void;
  onHypnogramTouchStart?: () => void;
  onHypnogramTouchEnd?: () => void;
  isActive?: boolean;
};

function BrainIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15.5 5c-1.3 0-2.4.8-2.9 2H12v1c-.5-.7-1.3-1-2.1-1C8.3 7 7 8.3 7 9.9c0 .7.2 1.3.6 1.8C7.2 12.1 7 12.5 7 13c0 .5.2 1 .5 1.4C7.2 14.8 7 15.4 7 16c0 1.7 1.3 3 3 3 .6 0 1.2-.2 1.6-.5.4.3 1 .5 1.4.5 1.7 0 3-1.3 3-3 0-.3-.1-.6-.1-.9.5-.4.8-.9 1-1.5.4.2.8.4 1.1.4C19.3 14 20 13.3 20 12.5c0-.6-.4-1.2-.9-1.4.2-.4.4-.9.4-1.4C19.5 7.8 17.7 5 15.5 5zM5 9c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"
        fill="rgba(255,255,255,0.85)"
      />
    </Svg>
  );
}

function DropIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"
        fill="rgba(255,255,255,0.85)"
      />
    </Svg>
  );
}

const TIP_CARD_WIDTH = Dimensions.get('window').width * 0.75;

export function SleepTab({ onScroll, onHypnogramTouchStart, onHypnogramTouchEnd, isActive = false }: SleepTabProps) {
  const homeData = useHomeDataContext();
  const { t } = useTranslation();
  const [refreshing, setRefreshing] = React.useState(false);
  const [refreshCount, setRefreshCount] = React.useState(0);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    setRefreshCount((c) => c + 1);
    await homeData.refresh();
    setRefreshing(false);
  }, [homeData.refresh]);

  // Trigger targeted retry when this tab is visible but overnight SpO2 is missing.
  useEffect(() => {
    if (!isActive || !homeData.isRingConnected || homeData.isSyncing) return;
    if (homeData.cardDataStatus === 'retrying') return;
    if (homeData.todayVitals.lastSpo2 !== null) return;
    void homeData.refreshMissingCardData('tab-focus');
  }, [
    isActive,
    homeData.isRingConnected,
    homeData.isSyncing,
    homeData.cardDataStatus,
    homeData.todayVitals.lastSpo2,
    homeData.refreshMissingCardData,
  ]);

  const scrollRef = React.useRef<any>(null);

  useEffect(() => {
    if (isActive) scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [isActive]);

  const sleepMessage = getSleepMessage(homeData.sleepScore);
  const sleep = homeData.lastNightSleep;
  const sleepInsight =
    homeData.insightType === 'sleep'
      ? homeData.insight
      : 'Your deep sleep was above average last night. Deep sleep is crucial for physical recovery and memory consolidation.';

  const tips = useMemo(() => {
    if (sleep.score >= 70) {
      return [
        { key: 'great_1', text: t('sleep.tip_great_1'), image: require('../../assets/backgrounds/night.jpg') },
        { key: 'great_2', text: t('sleep.tip_great_2'), image: require('../../assets/backgrounds/dawn.jpg') },
      ];
    }
    return [
      { key: 'improve_1', text: t('sleep.tip_improve_1'), image: require('../../assets/backgrounds/sleep.jpg') },
      { key: 'improve_2', text: t('sleep.tip_improve_2'), image: require('../../assets/backgrounds/dusk.jpg') },
      { key: 'improve_3', text: t('sleep.tip_improve_3'), image: require('../../assets/backgrounds/night.jpg') },
    ];
  }, [sleep.score, t]);

  // HRV-derived stress classification
  const sdnn = homeData.hrvSdnn ?? 0;
  const stressLabel = sdnn >= 50 ? t('sleep.hrv_low') : sdnn >= 30 ? t('sleep.hrv_moderate') : sdnn > 0 ? t('sleep.hrv_high') : '--';
  const stressColor = sdnn >= 50 ? '#4ADE80' : sdnn >= 30 ? '#FFD700' : sdnn > 0 ? '#FF6B6B' : 'rgba(255,255,255,0.5)';

  // SpO2 status
  const lastSpO2 = homeData.todayVitals.lastSpo2;
  const spo2Status = lastSpO2
    ? lastSpO2 >= 95 ? t('sleep.spo2_status_normal') : lastSpO2 >= 90 ? t('sleep.spo2_status_low') : t('sleep.spo2_status_seek_care')
    : null;
  const spo2Color = lastSpO2
    ? lastSpO2 >= 95 ? '#4ADE80' : lastSpO2 >= 90 ? '#FFD700' : '#FF6B6B'
    : 'rgba(255,255,255,0.4)';

  return (
    <Animated.ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
      onScroll={onScroll}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="rgba(255,255,255,0.7)"
        />
      }
    >
      {/* Syncing Indicator */}
      {homeData.isSyncing && (
        <View style={styles.syncingBanner}>
          <ActivityIndicator size="small" color="rgba(255,255,255,0.8)" />
          <Text style={styles.syncingText}>{t('sleep.syncing')}</Text>
        </View>
      )}

      {/* Sleep Score Gauge */}
      <View style={styles.gaugeSection}>
        <SemiCircularGauge
          score={sleep.score}
          label={t('sleep.last_night')}
          animated={!homeData.isLoading}
        />
        <View style={styles.gaugeInfoBtn}>
          <InfoButton metricKey="sleep_score" />
        </View>
        <Text style={styles.scoreMessage}>{sleepMessage}</Text>
      </View>

      {/* Metrics + Insight Card */}
      <View style={styles.metricsInsightSection}>
        <MetricInsightCard
          metrics={[
            { label: t('sleep.time_asleep'), value: sleep.timeAsleep || '--' },
            { label: t('sleep.resting_hr'), value: sleep.restingHR || '--' },
            { label: 'Resp', value: sleep.respiratoryRate || '--' },
          ]}
          insight={sleepInsight}
          backgroundImage={require('../../assets/backgrounds/insights/violet-insight.jpg')}
        />
      </View>

      {/* Sleep Stats
      <View style={styles.statsSection}>
        <SleepStatsRow
          timeAsleep={sleep.timeAsleep}
          restingHR={sleep.restingHR}
          respiratoryRate={sleep.respiratoryRate}
        />
      </View> */}

      {/* Sleep Stages Hypnogram (unified: night + naps) */}
      {sleep.segments.length > 0 && (() => {
        const allSessions = homeData.unifiedSleepSessions;
        const hasNaps = allSessions.length > 1;

        return (
          <View style={styles.gradientCardSection}>
            <GradientInfoCard
              icon={<SleepScoreIcon />}
              title={hasNaps ? t('sleep.stages') + ' + Nap' : t('sleep.stages')}
              showArrow
              onHeaderPress={() => router.push('/detail/sleep-detail')}
              gradientStops={[
                { offset: 0, color: '#7100C2', opacity: 1 },
                { offset: 0.55, color: '#7100C2', opacity: 0.2 },
              ]}
              gradientCenter={{ x: 0.51, y: -0.86 }}
              gradientRadii={{ rx: '80%', ry: '300%' }}
              headerRight={<InfoButton metricKey="sleep_deep" />}
            >
              <SleepHypnogram
                segments={sleep.segments}
                bedTime={sleep.bedTime}
                wakeTime={sleep.wakeTime}
                sessions={hasNaps ? allSessions : undefined}
                onTouchStart={onHypnogramTouchStart}
                onTouchEnd={onHypnogramTouchEnd}
              />
            </GradientInfoCard>
          </View>
        );
      })()}

      {/* Nap summary card — lightweight when naps are in hypnogram, full otherwise */}
      {homeData.todayNaps.length > 0 && (
        <View style={styles.gradientCardSection}>
          <NapCard naps={homeData.todayNaps} totalMinutes={homeData.totalNapMinutesToday} />
        </View>
      )}

      {/* HRV & Stress Card */}
      <View style={styles.gradientCardSection}>
        <GradientInfoCard
          icon={<BrainIcon />}
          title={t('sleep.hrv_stress')}
          headerValue={sdnn > 0 ? String(sdnn) : '--'}
          headerSubtitle={sdnn > 0 ? 'SDNN · ms' : t('sleep.hrv_no_data')}
          gradientStops={[
            { offset: 0, color: 'rgba(0, 130, 120, 0.99)' },
            { offset: 0.75, color: 'rgba(0, 0, 0, 0.27)' },
          ]}
          gradientCenter={{ x: 0.51, y: -0.86 }}
          gradientRadii={{ rx: '80%', ry: '300%' }}
          showArrow
          onHeaderPress={() => router.push('/detail/hrv-detail')}
          headerRight={<InfoButton metricKey="hrv_sdnn" />}
        >
          <View style={styles.hrvBody}>
            <View style={styles.hrvRow}>
              <View style={styles.hrvMetric}>
                <Text style={styles.hrvMetricLabel}>{t('sleep.label_stress')}</Text>
                <Text style={[styles.hrvMetricValue, { color: stressColor }]}>{stressLabel}</Text>
              </View>
              <View style={styles.hrvDivider} />
              <View style={styles.hrvMetric}>
                <Text style={styles.hrvMetricLabel}>{t('sleep.label_recovery')}</Text>
                <Text style={styles.hrvMetricValue}>
                  {sdnn > 0 ? (sdnn >= 50 ? t('sleep.recovery_optimal') : sdnn >= 30 ? t('sleep.recovery_fair') : t('sleep.recovery_poor')) : '--'}
                </Text>
              </View>
              <View style={styles.hrvDivider} />
              <View style={styles.hrvMetric}>
                <Text style={styles.hrvMetricLabel}>{t('sleep.label_sdnn')}</Text>
                <Text style={styles.hrvMetricValue}>{sdnn > 0 ? `${sdnn} ms` : '--'}</Text>
              </View>
            </View>
            {sdnn > 0 && (
              <Text style={styles.hrvNote}>
                {sdnn >= 50
                  ? t('sleep.hrv_note_excellent')
                  : sdnn >= 30
                  ? t('sleep.hrv_note_moderate')
                  : t('sleep.hrv_note_poor')}
              </Text>
            )}
          </View>
        </GradientInfoCard>
      </View>

      {/* SpO2 Overnight Card */}
      <View style={styles.gradientCardSection}>
        <GradientInfoCard
          icon={<DropIcon />}
          title={t('sleep.blood_oxygen')}
          headerValue={lastSpO2 ? `${lastSpO2}%` : '--'}
          headerSubtitle={spo2Status ?? t('sleep.no_overnight_data')}
          gradientStops={[
            { offset: 0, color: 'rgba(23, 90, 190, 0.99)' },
            { offset: 0.75, color: 'rgba(0, 0, 0, 0.27)' },
          ]}
          gradientCenter={{ x: 0.51, y: -0.86 }}
          gradientRadii={{ rx: '80%', ry: '300%' }}
          showArrow
          onHeaderPress={() => router.push('/detail/spo2-detail')}
          headerRight={<InfoButton metricKey="spo2" />}
        >
          <View style={styles.spo2Body}>
            <View style={styles.spo2Row}>
              <View style={[styles.spo2Badge, { backgroundColor: `${spo2Color}22`, borderColor: `${spo2Color}55` }]}>
                <Text style={[styles.spo2BadgeText, { color: spo2Color }]}>
                  {spo2Status ?? 'No data'}
                </Text>
              </View>
              <Text style={styles.spo2Note}>
                {lastSpO2
                  ? lastSpO2 >= 95
                    ? t('sleep.spo2_healthy')
                    : lastSpO2 >= 90
                    ? t('sleep.spo2_slightly_low')
                    : t('sleep.spo2_very_low_note')
                  : t('sleep.spo2_sync_hint')}
              </Text>
            </View>
            <View style={styles.spo2Scale}>
              <Text style={styles.spo2ScaleLabel}>{t('sleep.spo2_normal_range')}</Text>
              <Text style={styles.spo2ScaleLabel}>{t('sleep.spo2_low_range')}</Text>
            </View>
          </View>
        </GradientInfoCard>
      </View>

      {/* 7-day Sleep Trend */}
      <View style={styles.gradientCardSection}>
        <DailySleepTrendCard headerRight={<InfoButton metricKey="sleep_trend_7d" />} />
      </View>

      {/* Sleep Baseline Tier */}
      <View style={styles.gradientCardSection}>
        <SleepBaselineTierCard refreshTrigger={refreshCount} />
      </View>

      {/* Sleep Debt */}
      <View style={styles.gradientCardSection}>
        <SleepDebtCard refreshTrigger={refreshCount} />
      </View>

      {/* Sleep Tips Section (conditional) */}
      <View style={styles.tipsSection}>
        <Text style={styles.tipsTitle}>
          {sleep.score >= 70 ? t('sleep.tips_great') : t('sleep.tips_improve')}
        </Text>
        <FlatList
          data={tips}
          keyExtractor={(item) => item.key}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={TIP_CARD_WIDTH + spacing.md}
          decelerationRate="fast"
          contentContainerStyle={{ paddingHorizontal: spacing.lg }}
          renderItem={({ item, index }) => (
            <ImageBackground
              source={item.image}
              style={[styles.tipCard, index < tips.length - 1 && { marginRight: spacing.md }]}
              imageStyle={styles.tipCardImage}
            >
              <View style={styles.tipCardOverlay}>
                <Text style={styles.tipText}>{item.text}</Text>
              </View>
            </ImageBackground>
          )}
        />
      </View>

      {/* Spacer for bottom padding */}
      <View style={styles.bottomSpacer} />
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  metricsInsightSection: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  content: {
    paddingTop: spacing.lg,
    paddingBottom: 100,
  },
  syncingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.3)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: 12,
    gap: 8,
  },
  syncingText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
  },
  gaugeSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  gaugeInfoBtn: {
    position: 'absolute',
    top: 8,
    right: 16,
  },
  scoreMessage: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: fontSize.md,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  statsSection: {
    marginBottom: spacing.lg,
  },
  contributorRow: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  contributorChip: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
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
  contributorMeta: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontFamily: fontFamily.regular,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  chartSection: {
    marginBottom: spacing.lg,
  },
  gradientCardSection: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  insightSection: {
    marginBottom: spacing.lg,
  },
  tipsSection: {
    marginBottom: spacing.lg,
  },
  tipsTitle: {
    color: '#FFFFFF',
    fontSize: fontSize.lg,
    fontFamily: fontFamily.demiBold,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  tipCard: {
    width: TIP_CARD_WIDTH,
    height: TIP_CARD_WIDTH,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  tipCardImage: {
    borderRadius: borderRadius.lg,
  },
  tipCardOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
    padding: spacing.lg,
  },
  tipText: {
    color: '#FFFFFF',
    fontSize: fontSize.md,
    fontFamily: fontFamily.demiBold,
    lineHeight: 24,
  },
  bottomSpacer: {
    height: 50,
  },
  hrvBody: {
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  hrvRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  hrvMetric: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  hrvMetricLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  hrvMetricValue: {
    color: '#fff',
    fontSize: fontSize.md,
    fontFamily: fontFamily.demiBold,
  },
  hrvDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  hrvNote: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing.sm,
  },
  spo2Body: {
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  spo2Row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  spo2Badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  spo2BadgeText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.demiBold,
  },
  spo2Note: {
    flex: 1,
    color: 'rgba(255,255,255,0.6)',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    lineHeight: 20,
  },
  spo2Scale: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  spo2ScaleLabel: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
  },
});

export default SleepTab;
