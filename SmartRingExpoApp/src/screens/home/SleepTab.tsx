import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SemiCircularGauge } from '../../components/home/SemiCircularGauge';
import { SleepStatsRow } from '../../components/home/StatsRow';
import { SleepStagesChart } from '../../components/home/SleepStagesChart';
import { InsightCard } from '../../components/home/InsightCard';
import { useHomeData, getSleepMessage } from '../../hooks/useHomeData';
import { spacing, fontSize } from '../../theme/colors';

export function SleepTab() {
  const homeData = useHomeData();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await homeData.refresh();
    setRefreshing(false);
  }, [homeData.refresh]);

  const sleepMessage = getSleepMessage(homeData.sleepScore);
  const sleep = homeData.lastNightSleep;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="rgba(255,255,255,0.7)"
        />
      }
    >
      {/* Sleep Score Gauge */}
      <View style={styles.gaugeSection}>
        <SemiCircularGauge
          score={sleep.score}
          label="LAST NIGHT"
          animated={!homeData.isLoading}
        />
        <Text style={styles.scoreMessage}>{sleepMessage}</Text>
      </View>

      {/* Sleep Stats */}
      <View style={styles.statsSection}>
        <SleepStatsRow
          timeAsleep={sleep.timeAsleep}
          restingHR={sleep.restingHR}
          respiratoryRate={sleep.respiratoryRate}
        />
      </View>

      {/* Sleep Stages Chart */}
      {sleep.segments.length > 0 && (
        <View style={styles.chartSection}>
          <SleepStagesChart
            segments={sleep.segments}
            bedTime={sleep.bedTime}
            wakeTime={sleep.wakeTime}
          />
        </View>
      )}

      {/* Sleep Insight */}
      <View style={styles.insightSection}>
        <InsightCard
          insight="Your deep sleep was above average last night. Deep sleep is crucial for physical recovery and memory consolidation."
          type="sleep"
          title="Sleep Analysis"
        />
      </View>

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
    </ScrollView>
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
  scoreMessage: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: fontSize.md,
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
    fontWeight: '600',
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
    lineHeight: 22,
  },
  bottomSpacer: {
    height: 50,
  },
});

export default SleepTab;


