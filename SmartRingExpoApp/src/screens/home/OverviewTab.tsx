import React from 'react';
import { View, Text, StyleSheet, RefreshControl, Animated, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SemiCircularGauge } from '../../components/home/SemiCircularGauge';
import { MetricInsightCard } from '../../components/home/MetricInsightCard';
import { GradientInfoCard } from '../../components/common/GradientInfoCard';
import { SleepScoreIcon } from '../../assets/icons';
import DailyHeartRateCard from '../../components/home/DailyHeartRateCard';
import CalorieDeficitCard from '../../components/home/CalorieDeficitCard';
import DailyTimelineCard from '../../components/home/DailyTimelineCard';
import LogEntrySheet from '../../components/home/LogEntrySheet';
import { useHomeDataContext } from '../../context/HomeDataContext';
import { getScoreMessage, getSleepMessage } from '../../hooks/useHomeData';
import { useTimelineEntries } from '../../hooks/useTimelineEntries';
import { useAddOverlay } from '../../context/AddOverlayContext';
import { spacing, fontSize, fontFamily } from '../../theme/colors';
import NightTimeIcon from '../../assets/icons/NightTimeIcon';
import WakeTimeIcon from '../../assets/icons/WakeTimeIcon';
import { InfoButton } from '../../components/common/InfoButton';

type OverviewTabProps = {
  onScroll?: Animated.AnimatedEvent<any>;
};

export function OverviewTab({ onScroll }: OverviewTabProps) {
  const homeData = useHomeDataContext();
  const { setActionHandler, showOverlay } = useAddOverlay();
  const { entries: timelineEntries, addEntry } = useTimelineEntries();
  const [refreshing, setRefreshing] = React.useState(false);
  const [sheetMode, setSheetMode] = React.useState<'recovery' | 'meal' | 'activity' | null>(null);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await homeData.refresh();
    setRefreshing(false);
  }, [homeData.refresh]);

  const handleOverlayAction = React.useCallback((label: string) => {
    if (label === 'Log Recovery') {
      setSheetMode('recovery');
    } else if (label === 'Log Meal' || label === 'Capture Meal') {
      setSheetMode('meal');
    } else if (label === 'Log Activity') {
      setSheetMode('activity');
    }
  }, []);

  React.useEffect(() => {
    setActionHandler(handleOverlayAction);
    return () => setActionHandler(null);
  }, [setActionHandler, handleOverlayAction]);

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
    <>
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
        <View style={styles.gaugeInfoBtn}>
          <InfoButton metricKey="recovery_score" />
        </View>
        <Text style={styles.scoreMessage}>{scoreMessage}</Text>
      </View>

      {/* Metrics + Insight Card */}
      <TouchableOpacity style={styles.metricsInsightSection} activeOpacity={0.85} onPress={() => router.push('/detail/recovery-detail')}>
        <MetricInsightCard
          metrics={[
            { label: 'Strain', value: homeData.strain },
            { label: 'Readiness', value: homeData.readiness },
            { label: 'Sleep', value: homeData.sleepScore, onPress: () => router.push('/detail/sleep-detail') },
          ]}
          insight={homeData.insight}
          backgroundImage={require('../../assets/backgrounds/insights/blue-insight.jpg')}
        />
      </TouchableOpacity>
      {homeData.contributors.recovery.length > 0 && (
        <View style={styles.contributorRow}>
          {homeData.contributors.recovery.slice(0, 3).map((chip) => (
            <View key={chip.key} style={styles.contributorChip}>
              <Text style={styles.contributorLabel}>{chip.label}</Text>
              <Text style={styles.contributorValue}>{chip.display}</Text>
            </View>
          ))}
        </View>
      )}
      {homeData.contributors.recommendations[0] && (
        <View style={styles.recommendationWrap}>
          <Text style={styles.recommendationText}>{homeData.contributors.recommendations[0]}</Text>
        </View>
      )}

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

      {/* Sleep Score */}
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
            <Text style={styles.sleepStatText}>{sleep.restingHR ? `${sleep.restingHR} BPM` : '—'}</Text>
          </View>
        </GradientInfoCard>
      </View>

      {/* Heart rate through the day */}
      <View style={styles.gradientCardSection}>
        <DailyHeartRateCard preloadedData={homeData.hrChartData} headerRight={<InfoButton metricKey="daily_hr_chart" />} />
      </View>

      {/* Caloric deficit */}
      <View style={styles.gradientCardSection}>
        <CalorieDeficitCard activeCalories={homeData.activity.adjustedActiveCalories} headerRight={<InfoButton metricKey="calorie_deficit" />} />
      </View>

      {/* Daily Chronology Timeline */}
      <View style={styles.gradientCardSection}>
        <DailyTimelineCard
          sleep={sleep}
          activitySessions={homeData.activitySessions}
          manualEntries={timelineEntries}
          onAddPress={() => showOverlay()}
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
    marginBottom: spacing.lg,
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
