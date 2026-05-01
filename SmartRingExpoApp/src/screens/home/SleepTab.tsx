import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, RefreshControl, ActivityIndicator, Animated, FlatList, ImageBackground, Dimensions, TouchableOpacity } from 'react-native';
import Reanimated from 'react-native-reanimated';
import { useTabScroll } from '../../hooks/useTabScroll';
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
import type { SleepSegment } from '../../components/home/SleepStagesChart';
import { spacing, fontSize, fontFamily, borderRadius } from '../../theme/colors';
import { InfoButton } from '../../components/common/InfoButton';
import { useBaselineMode } from '../../context/BaselineModeContext';
import { useRelativeTime } from '../../hooks/useRelativeTime';
import { Ionicons } from '@expo/vector-icons';
import SleepTimeEditModal from '../../components/sleep/SleepTimeEditModal';
import { setSleepOverride } from '../../services/SleepOverrideService';

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
  const baseline = useBaselineMode();
  const [refreshing, setRefreshing] = React.useState(false);
  const [refreshCount, setRefreshCount] = React.useState(0);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [fixingBedtime, setFixingBedtime] = useState(false);
  const lastSyncLabel = useRelativeTime(homeData.lastSyncedAt);

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

  const { scrollRef, scrollY, handleScroll, isScrolled, firstCardStyle } = useTabScroll(isActive, onScroll);

  const handleFixBedtime = async () => {
    if (!sleep.suggestedBedTime || fixingBedtime) return;
    setFixingBedtime(true);
    try {
      await setSleepOverride(sleep.suggestedBedTime, sleep.wakeTime);
      await homeData.applyOverrideNow();
      homeData.refresh();
      setRefreshCount(c => c + 1);
    } catch (e) {
      console.warn('[SleepTab] fix bedtime failed:', e);
    } finally {
      setFixingBedtime(false);
    }
  };

  const sleepMessage = getSleepMessage(homeData.sleepScore, t);
  const sleep = homeData.lastNightSleep;

  const sleepDateLabel = (() => {
    const cutoff = Date.now() - 36 * 60 * 60 * 1000;
    if (!sleep.wakeTime || sleep.wakeTime.getTime() >= cutoff) return t('sleep.last_night');
    return sleep.wakeTime.toLocaleDateString([], { month: 'short', day: 'numeric' }).toUpperCase();
  })();

  // Hypnogram uses inBedTime (ring block start) as chart start and prepends a synthetic
  // awake segment to cover the in-bed awake period before sleep onset.
  const hypnogramBedTime = sleep.inBedTime ?? sleep.bedTime;
  const hypnogramSegments: SleepSegment[] = useMemo(() => {
    if (!sleep.inBedTime || sleep.segments.length === 0) return sleep.segments;
    const firstSeg = sleep.segments[0];
    if (sleep.inBedTime >= firstSeg.startTime) return sleep.segments;
    const awake: SleepSegment = { stage: 'awake', startTime: sleep.inBedTime, endTime: firstSeg.startTime, isInBed: true };
    return [awake, ...sleep.segments];
  }, [sleep.inBedTime, sleep.segments]);

  const sleepInsight =
    homeData.insightType === 'sleep'
      ? homeData.insight
      : t('sleep.insight_default');

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
      {/* Syncing Indicator */}
      {homeData.isSyncing && (
        <View style={styles.syncingBanner}>
          <ActivityIndicator size="small" color="rgba(255,255,255,0.8)" />
          <Text style={styles.syncingText}>{t('sleep.syncing')}</Text>
        </View>
      )}

      {/* Sleep Score Gauge — or baseline banner */}
      {baseline.isInBaselineMode && !baseline.metrics.sleep.ready ? (
        <View style={styles.baselineBanner}>
          <Text style={styles.baselineTitle}>
            {t('baseline.sleep_tracking', { current: baseline.metrics.sleep.current, required: baseline.metrics.sleep.required })}
          </Text>
          <Text style={styles.baselineBannerText}>{t('baseline.sleep_subtitle')}</Text>
        </View>
      ) : (
        <>
          <View style={styles.gaugeSection}>
            <SemiCircularGauge
              score={sleep.score}
              label={sleepDateLabel}
              animated={!homeData.isLoading}
            />
            <View style={styles.gaugeInfoBtn}>
              <InfoButton metricKey="sleep_score" />
            </View>
          </View>

          {/* Metrics + Insight Card */}
          <View style={styles.metricsInsightSection}>
            <MetricInsightCard
              metrics={[
                { label: t('sleep.time_asleep'), value: sleep.timeAsleep || '--' },
                { label: t('sleep.resting_hr'), value: sleep.restingHR || '--' },
                { label: t('sleep.deep'), value: (() => {
                  const deepMin = sleep.segments.filter(s => s.stage === 'deep').reduce((sum, s) => sum + Math.round((s.endTime.getTime() - s.startTime.getTime()) / 60000), 0);
                  return deepMin > 0 ? `${Math.floor(deepMin / 60)}h ${deepMin % 60}m` : '--';
                })() },
              ]}
              insight={[sleepMessage, sleepInsight].filter(Boolean).join(' ')}
              scrollY={scrollY}

            />
          </View>
        </>
      )}

      {/* Sleep Stats
      <View style={styles.statsSection}>
        <SleepStatsRow
          timeAsleep={sleep.timeAsleep}
          restingHR={sleep.restingHR}
          respiratoryRate={sleep.respiratoryRate}
        />
      </View> */}

      {/* Bedtime Gap Banner — ring started recording late, HealthKit/history suggests earlier bedtime */}
      {sleep.suggestedBedTime && !sleep.segments.some(s => (s as any).isInferred) && (() => {
        const gapMin = Math.round((sleep.bedTime.getTime() - sleep.suggestedBedTime!.getTime()) / 60000);
        const gapText = gapMin >= 60 ? `${Math.floor(gapMin / 60)}h${gapMin % 60 > 0 ? ` ${gapMin % 60}m` : ''}` : `${gapMin}m`;
        const suggestedStr = sleep.suggestedBedTime!.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return (
          <TouchableOpacity
            style={styles.gapBanner}
            onPress={handleFixBedtime}
            disabled={fixingBedtime}
            activeOpacity={0.75}
          >
            <Ionicons name="moon-outline" size={15} color="rgba(255,255,255,0.75)" />
            <Text style={styles.gapBannerText}>
              Ring missed ~{gapText} · bed at {suggestedStr}?
            </Text>
            {fixingBedtime
              ? <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" />
              : <Text style={styles.gapBannerFix}>Fix</Text>
            }
          </TouchableOpacity>
        );
      })()}

      {/* Sleep Stages Hypnogram (unified: night + naps) */}
      {sleep.segments.length > 0 && (() => {
        const allSessions = homeData.unifiedSleepSessions;
        const hasNaps = allSessions.length > 1;

        return (
          <Reanimated.View style={[styles.gradientCardSection, firstCardStyle]}>
            <GradientInfoCard
              icon={<SleepScoreIcon />}
              title={hasNaps ? t('sleep.stages') + ' + Nap' : t('sleep.stages')}
              titleCaption={(sleep.inBedTime ?? sleep.bedTime) ? (sleep.inBedTime ?? sleep.bedTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null}
              showArrow
              onHeaderPress={() => router.push('/detail/sleep-detail')}
              gradientStops={[
                { offset: 0, color: '#7100C2', opacity: 1 },
                { offset: 0.55, color: '#7100C2', opacity: 0.2 },
              ]}
              gradientCenter={{ x: 0.51, y: -0.86 }}
              gradientRadii={{ rx: '80%', ry: '300%' }}
              headerRight={
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <TouchableOpacity onPress={() => setEditModalVisible(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="pencil-outline" size={16} color="rgba(255,255,255,0.5)" />
                  </TouchableOpacity>
                  <InfoButton metricKey="sleep_deep" />
                </View>
              }
            >
              <SleepHypnogram
                segments={hypnogramSegments}
                bedTime={hypnogramBedTime}
                wakeTime={sleep.wakeTime}
                sessions={hasNaps ? allSessions : undefined}
                onTouchStart={onHypnogramTouchStart}
                onTouchEnd={onHypnogramTouchEnd}
              />
            </GradientInfoCard>
          </Reanimated.View>
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
          titleCaption={lastSyncLabel}
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
          titleCaption={lastSyncLabel}
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

    <SleepTimeEditModal
      visible={editModalVisible}
      initialBedTime={sleep.inBedTime ?? sleep.bedTime}
      initialWakeTime={sleep.wakeTime}
      onClose={() => setEditModalVisible(false)}
      onSaved={async () => {
        await homeData.applyOverrideNow();
        homeData.refresh();
        setRefreshCount(c => c + 1);
      }}
    />
    </>
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
  gapBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.35)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: 12,
    gap: 8,
  },
  gapBannerText: {
    flex: 1,
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
  },
  gapBannerFix: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.demiBold,
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
  baselineBanner: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  baselineTitle: {
    fontSize: fontSize.xxl,
    fontFamily: fontFamily.demiBold,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 6,
  },
  baselineBannerText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default SleepTab;
