import React from 'react';
import { View, Text, StyleSheet, RefreshControl, Animated, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SemiCircularGauge } from '../../components/home/SemiCircularGauge';
import { MetricInsightCard } from '../../components/home/MetricInsightCard';
import { GradientInfoCard } from '../../components/common/GradientInfoCard';
import { SleepScoreIcon } from '../../assets/icons';
import DailyHeartRateCard from '../../components/home/DailyHeartRateCard';
import { LiveHeartRateCard } from '../../components/home/LiveHeartRateCard';
import DailySleepTrendCard from '../../components/home/DailySleepTrendCard';
import CalorieDeficitCard from '../../components/home/CalorieDeficitCard';
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
    setRefreshing(true);
    await homeData.refresh();
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
      <TouchableOpacity style={styles.metricsInsightSection} activeOpacity={0.85} onPress={() => router.push('/detail/recovery-detail')}>
        <MetricInsightCard
          metrics={[
            { label: 'Strain', value: homeData.strain },
            { label: 'Readiness', value: homeData.readiness },
            { label: 'Sleep', value: homeData.sleepScore },
          ]}
          insight={homeData.insight}
          backgroundImage={require('../../assets/backgrounds/insights/blue-insight.jpg')}
        />
      </TouchableOpacity>

      {/* Sleep Preview
      <View style={styles.previewSection}>
        <PreviewCard
          title="Last Night"
          subtitle="Sleep Score"
          value={homeData.sleepScore}
          unit="%"
          icon={<MoonIcon size={24} />}
        />
      </View> */}

      {/* Reusable gradient info card example */}
      <View style={styles.gradientCardSection}>
        <GradientInfoCard
          icon={<SleepScoreIcon />}
          title="Sleep Score"
          headerValue={sleep.score || 0}
          headerSubtitle={sleepMessage}
          showArrow
          onHeaderPress={() => router.push('/detail/sleep-detail')}
          gradientStops={[
            { offset: 0, color: '#7100C2', opacity: 1 },
            { offset: 0.55, color: '#7100C2', opacity: 0.2 },
          ]}
          gradientCenter={{ x: 0.51, y: -0.86 }}
          gradientRadii={{ rx: '80%', ry: '300%' }}
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

      {/* Live HR measurement */}
      <View style={styles.gradientCardSection}>
        <LiveHeartRateCard />
      </View>

      {/* Heart rate through the day */}
      <View style={styles.gradientCardSection}>
        <DailyHeartRateCard preloadedData={homeData.hrChartData} />
      </View>

      {/* Caloric deficit */}
      <View style={styles.gradientCardSection}>
        <CalorieDeficitCard activeCalories={homeData.activity.adjustedActiveCalories} />
      </View>

      {/* Sleep trend (7 days) */}
      <View style={styles.gradientCardSection}>
        <DailySleepTrendCard />
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
