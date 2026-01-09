import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SemiCircularGauge } from '../../components/home/SemiCircularGauge';
import { OverviewStatsRow } from '../../components/home/StatsRow';
import { InsightCard, PreviewCard, MoonIcon } from '../../components/home/InsightCard';
import { useHomeData, getScoreMessage } from '../../hooks/useHomeData';
import { spacing, fontSize } from '../../theme/colors';

export function OverviewTab() {
  const homeData = useHomeData();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await homeData.refresh();
    setRefreshing(false);
  }, [homeData.refresh]);

  const scoreMessage = getScoreMessage(homeData.overallScore);

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
      {/* Main Score Gauge */}
      <View style={styles.gaugeSection}>
        <SemiCircularGauge
          score={homeData.overallScore}
          label="OVERALL SCORE"
          animated={!homeData.isLoading}
        />
        <Text style={styles.scoreMessage}>{scoreMessage}</Text>
      </View>

      {/* Stats Row */}
      <View style={styles.statsSection}>
        <OverviewStatsRow
          strain={homeData.strain}
          readiness={homeData.readiness}
          sleep={homeData.sleepScore}
        />
      </View>

      {/* AI Insight */}
      <View style={styles.insightSection}>
        <InsightCard
          insight={homeData.insight}
          type={homeData.insightType}
          title="AI Insight"
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
  insightSection: {
    marginBottom: spacing.md,
  },
  previewSection: {
    marginBottom: spacing.md,
  },
  bottomSpacer: {
    height: 50,
  },
});

export default OverviewTab;


