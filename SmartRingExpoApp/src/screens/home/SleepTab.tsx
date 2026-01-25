import React from 'react';
import { View, Text, StyleSheet, RefreshControl, ActivityIndicator, Animated } from 'react-native';
import { SemiCircularGauge } from '../../components/home/SemiCircularGauge';
import { SleepStatsRow } from '../../components/home/StatsRow';
import { SleepHypnogram } from '../../components/home/SleepHypnogram';
import { MetricInsightCard } from '../../components/home/MetricInsightCard';
import { useHomeDataContext } from '../../context/HomeDataContext';
import { getSleepMessage } from '../../hooks/useHomeData';
import { spacing, fontSize, fontFamily } from '../../theme/colors';

type SleepTabProps = {
  onScroll?: Animated.AnimatedEvent<any>;
};

export function SleepTab({ onScroll }: SleepTabProps) {
  const homeData = useHomeDataContext();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await homeData.refresh();
    setRefreshing(false);
  }, [homeData.refresh]);

  const sleepMessage = getSleepMessage(homeData.sleepScore);
  const sleep = homeData.lastNightSleep;
  const sleepInsight =
    homeData.insightType === 'sleep'
      ? homeData.insight
      : 'Your deep sleep was above average last night. Deep sleep is crucial for physical recovery and memory consolidation.';

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
      {/* Syncing Indicator */}
      {homeData.isSyncing && (
        <View style={styles.syncingBanner}>
          <ActivityIndicator size="small" color="rgba(255,255,255,0.8)" />
          <Text style={styles.syncingText}>Syncing with ring...</Text>
        </View>
      )}

      {/* Sleep Score Gauge */}
      <View style={styles.gaugeSection}>
        <SemiCircularGauge
          score={sleep.score}
          label="LAST NIGHT"
          animated={!homeData.isLoading}
        />
        <Text style={styles.scoreMessage}>{sleepMessage}</Text>
      </View>

      {/* Metrics + Insight Card */}
      <View style={styles.metricsInsightSection}>
        <MetricInsightCard
          metrics={[
            { label: 'Sleep', value: sleep.score || 0 },
            { label: 'Rest HR', value: sleep.restingHR || '--' },
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

      {/* Sleep Stages Hypnogram */}
      {sleep.segments.length > 0 && (
        <View style={styles.chartSection}>
          <SleepHypnogram
            segments={sleep.segments}
            bedTime={sleep.bedTime}
            wakeTime={sleep.wakeTime}
          />
        </View>
      )}

      {/* Sleep Tips Section */}
      <View style={styles.tipsSection}>
        <Text style={styles.tipsTitle}>Sleep Tips</Text>
        <View style={styles.tipCard}>
          <Text style={styles.tipText}>
            💤 Maintain a consistent sleep schedule, even on weekends
          </Text>
        </View>
        <View style={styles.tipCard}>
          <Text style={styles.tipText}>
            🌙 Create a relaxing bedtime routine 30-60 minutes before sleep
          </Text>
        </View>
        <View style={styles.tipCard}>
          <Text style={styles.tipText}>
            📱 Avoid screens at least 1 hour before bedtime
          </Text>
        </View>
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
  chartSection: {
    marginBottom: spacing.lg,
  },
  insightSection: {
    marginBottom: spacing.lg,
  },
  tipsSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  tipsTitle: {
    color: '#FFFFFF',
    fontSize: fontSize.lg,
    fontFamily: fontFamily.demiBold,
    marginBottom: spacing.md,
  },
  tipCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  tipText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    lineHeight: 22,
  },
  bottomSpacer: {
    height: 50,
  },
});

export default SleepTab;
