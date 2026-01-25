import React from 'react';
import { View, Text, StyleSheet, RefreshControl, Animated } from 'react-native';
import { SemiCircularGauge } from '../../components/home/SemiCircularGauge';
import { OverviewStatsRow } from '../../components/home/StatsRow';
import { InsightCard, PreviewCard, MoonIcon } from '../../components/home/InsightCard';
import { MetricInsightCard } from '../../components/home/MetricInsightCard';
import { GradientInfoCard } from '../../components/common/GradientInfoCard';
import { SleepScoreIcon } from '../../assets/icons';
import { useHomeDataContext } from '../../context/HomeDataContext';
import { getScoreMessage, getSleepMessage } from '../../hooks/useHomeData';
import { spacing, fontSize, fontFamily } from '../../theme/colors';
import NightTimeIcon from '../../assets/icons/NightTimeIcon';
import WakeTimeIcon from '../../assets/icons/WakeTimeIcon';

type OverviewTabProps = {
  onScroll?: Animated.AnimatedEvent<any>;
};

export function OverviewTab({ onScroll }: OverviewTabProps) {
  const homeData = useHomeDataContext();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    const startTime = Date.now();
    console.log('🔄 [OverviewTab] PULL-TO-REFRESH started at', new Date().toLocaleTimeString());
    // #region agent log - Hypothesis A: Pull-to-refresh entry point
    fetch('http://127.0.0.1:7244/ingest/2c24bd97-750e-43e0-a3f7-87f9cbe31856',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'OverviewTab.tsx:14',message:'Pull-to-refresh started',data:{timestamp:Date.now(),source:'pull-to-refresh'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    setRefreshing(true);
    await homeData.refresh();
    const elapsed = Date.now() - startTime;
    console.log(`🔄 [OverviewTab] PULL-TO-REFRESH completed in ${elapsed}ms`);
    // #region agent log - Hypothesis A: Pull-to-refresh completion
    fetch('http://127.0.0.1:7244/ingest/2c24bd97-750e-43e0-a3f7-87f9cbe31856',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'OverviewTab.tsx:21',message:'Pull-to-refresh completed',data:{elapsed,source:'pull-to-refresh'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    setRefreshing(false);
  }, [homeData.refresh]);

  const scoreMessage = getScoreMessage(homeData.overallScore);
  const sleepMessage = getSleepMessage(homeData.sleepScore);
  const sleep = homeData.lastNightSleep;

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
    <Animated.ScrollView
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
      {/* Main Score Gauge */}
      <View style={styles.gaugeSection}>
        <SemiCircularGauge
          score={homeData.overallScore}
          label="OVERALL SCORE"
          animated={!homeData.isLoading}
        />
        <Text style={styles.scoreMessage}>{scoreMessage}</Text>
      </View>

      {/* Metrics + Insight Card */}
      <View style={styles.metricsInsightSection}>
        <MetricInsightCard
          metrics={[
            { label: 'Strain', value: homeData.strain },
            { label: 'Readiness', value: homeData.readiness },
            { label: 'Sleep', value: homeData.sleepScore },
          ]}
          insight={homeData.insight}
          backgroundImage={require('../../assets/backgrounds/insights/blue-insight.jpg')}
        />
      </View>

      {/* Sleep Preview */}
      <View style={styles.previewSection}>
        <PreviewCard
          title="Last Night"
          subtitle="Sleep Score"
          value={homeData.sleepScore}
          unit="%"
          icon={<MoonIcon size={24} />}
        />
      </View>

      {/* Reusable gradient info card example */}
      <View style={styles.gradientCardSection}>
        <GradientInfoCard
          icon={<SleepScoreIcon />}
          title="Sleep Score"
          // gradientColors={['#7100C2', 'rgba(113, 0, 194, 0.2)']}
          headerValue={sleep.score || 0}
          headerSubtitle={sleepMessage}
          showArrow
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
            <Text style={styles.sleepStatText}>{sleep.restingHR ? `${sleep.restingHR} BPM` : '—'}</Text>
          </View>
        </GradientInfoCard>
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
  content: {
    paddingTop: spacing.lg,
    paddingBottom: 100,
  },
  gaugeSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  metricsInsightSection: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
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
  bottomSpacer: {
    height: 50,
  },
});

export default OverviewTab;
