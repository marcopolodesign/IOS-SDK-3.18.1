import React, { useEffect } from 'react';
import { View, Text, StyleSheet, RefreshControl, Animated, TouchableOpacity, FlatList, Dimensions } from 'react-native';
import Reanimated from 'react-native-reanimated';
import { useTabScroll } from '../../hooks/useTabScroll';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { HeroLinearGauge } from '../../components/home/HeroLinearGauge';
import { MetricInsightCard } from '../../components/home/MetricInsightCard';
import { GradientInfoCard } from '../../components/common/GradientInfoCard';
import { useHomeDataContext } from '../../context/HomeDataContext';
import { getActivityMessage } from '../../hooks/useHomeData';
import { spacing, fontSize, borderRadius, fontFamily } from '../../theme/colors';
import { InfoButton } from '../../components/common/InfoButton';
import type { UnifiedActivity } from '../../types/activity.types';
import Ionicons from '@expo/vector-icons/Ionicons';
import { formatSleepDuration } from '../../utils/ringData/sleep';
import { TrainingInsightsCard } from '../../components/home/TrainingInsightsCard';
import { RingIcon } from '../../assets/icons';
import { useRelativeTime } from '../../hooks/useRelativeTime';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_W = SCREEN_WIDTH * 0.6;
const CARD_GAP = spacing.md;

function formatUnifiedMeta(a: UnifiedActivity): string {
  const parts: string[] = [];
  if (a.distanceM) parts.push(`${(a.distanceM / 1000).toFixed(1)} km`);
  if (a.durationSec) parts.push(formatSleepDuration(Math.round(a.durationSec / 60)));
  if (a.calories) parts.push(`${a.calories} kcal`);
  return parts.join(' · ');
}

function formatWorkoutDate(isoDate: string): string {
  const d = new Date(isoDate);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function StravaLogo({ size = 12 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="white">
      <Path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
    </Svg>
  );
}

function AppleHealthLogo({ size = 12 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="white">
      <Path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z" />
    </Svg>
  );
}

const SOURCE_BG: Record<string, string> = {
  strava: '#FC4C02',
  appleHealth: '#FF375F',
  ring: '#2A2A3E',
};

function SourceBadge({ source }: { source: string }) {
  const bg = SOURCE_BG[source] ?? SOURCE_BG.ring;
  return (
    <View style={[hCardStyles.sourceBadge, { backgroundColor: bg }]}>
      {source === 'strava' && <StravaLogo size={10} />}
      {source === 'appleHealth' && <AppleHealthLogo size={10} />}
      {source === 'ring' && <RingIcon width={10} height={10} fill="white" />}
    </View>
  );
}

function HorizontalWorkoutCard({ activity }: { activity: UnifiedActivity }) {
  const handlePress = () => {
    if (activity.source !== 'strava') return;
    const numericId = activity.id.replace('strava_', '');
    router.push({ pathname: '/(tabs)/coach/strava-detail', params: { id: numericId } });
  };

  return (
    <TouchableOpacity
      style={hCardStyles.card}
      onPress={handlePress}
      activeOpacity={activity.source === 'strava' ? 0.75 : 1}
    >
      {/* Icon + source badge */}
      <View style={hCardStyles.iconWrap}>
        <View style={[hCardStyles.iconCircle, { backgroundColor: `${activity.color}28` }]}>
          <Ionicons name={activity.icon as any} size={20} color={activity.color} />
        </View>
        <SourceBadge source={activity.source} />
      </View>
      {/* Text info */}
      <View style={hCardStyles.textBlock}>
        <Text style={hCardStyles.name} numberOfLines={1}>{activity.name}</Text>
        <Text style={hCardStyles.date}>{formatWorkoutDate(activity.startDate)}</Text>
        <Text style={hCardStyles.meta} numberOfLines={1}>{formatUnifiedMeta(activity)}</Text>
      </View>
    </TouchableOpacity>
  );
}

type ActivityTabProps = {
  onScroll?: (event: any) => void;
  isActive?: boolean;
};

function ThermometerIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 13V5c0-1.66-1.34-3-3-3S9 3.34 9 5v8c-1.21.91-2 2.37-2 4 0 2.76 2.24 5 5 5s5-2.24 5-5c0-1.63-.79-3.09-2-4zm-3 7c-1.65 0-3-1.35-3-3 0-1.3.84-2.4 2-2.82V5c0-.55.45-1 1-1s1 .45 1 1v9.18c1.16.42 2 1.52 2 2.82 0 1.65-1.35 3-3 3z"
        fill="rgba(255,255,255,0.85)"
      />
    </Svg>
  );
}

function OxygenIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-4h2v2h-2zm0-10h2v8h-2z"
        fill="rgba(255,255,255,0.85)"
      />
    </Svg>
  );
}

export function ActivityTab({ onScroll, isActive = false }: ActivityTabProps) {
  const homeData = useHomeDataContext();
  const { t } = useTranslation();
  const [refreshing, setRefreshing] = React.useState(false);
  const lastSyncLabel = useRelativeTime(homeData.lastSyncedAt);
  const { scrollRef, scrollY, handleScroll, isScrolled, firstCardStyle } = useTabScroll(isActive, onScroll);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await homeData.refresh();
    setRefreshing(false);
  }, [homeData.refresh]);

  // Trigger targeted retry when this tab is visible but vitals are still missing.
  useEffect(() => {
    if (!isActive || !homeData.isRingConnected || homeData.isSyncing) return;
    if (homeData.cardDataStatus === 'retrying') return;
    if (homeData.todayVitals.temperatureC !== null && homeData.todayVitals.minSpo2 !== null) return;
    void homeData.refreshMissingCardData('tab-focus');
  }, [
    isActive,
    homeData.isRingConnected,
    homeData.isSyncing,
    homeData.cardDataStatus,
    homeData.todayVitals.temperatureC,
    homeData.todayVitals.minSpo2,
    homeData.refreshMissingCardData,
  ]);

  const activityMessage = getActivityMessage(homeData.activity.score, t);
  const activity = homeData.activity;
  const calorieGoal = 650;
  const caloriesRounded = Math.round(activity.adjustedActiveCalories || activity.calories || 0);
  const stepsRounded = Math.round(activity.steps || 0);
  const distanceKm = Math.max(0, (activity.distance || 0) / 1000);
  const distanceKmDisplay = distanceKm >= 10 ? Math.round(distanceKm) : parseFloat(distanceKm.toFixed(1));

  // Temperature status
  const tempC = homeData.todayVitals.temperatureC ?? 0;
  const tempF = tempC > 0 ? Math.round(tempC * 9 / 5 + 32) : null;
  const tempTier: 'normal' | 'elevated' | 'low' | null = tempC >= 36.1 && tempC <= 37.2 ? 'normal' : tempC > 37.2 ? 'elevated' : tempC > 0 ? 'low' : null;
  const tempStatus = tempTier ? t(`activity.temp_${tempTier}`) : null;
  const tempColor = tempTier === 'normal' ? '#4ADE80' : tempTier === 'elevated' ? '#FF6B6B' : '#FFD700';

  // SpO2 status
  const minSpo2 = homeData.todayVitals.minSpo2;
  const spo2Status = minSpo2
    ? minSpo2 >= 95 ? t('activity.temp_normal') : minSpo2 >= 90 ? t('activity.temp_low') : t('activity.spo2_very_low')
    : null;
  const spo2Color = minSpo2
    ? minSpo2 >= 95 ? '#4ADE80' : minSpo2 >= 90 ? '#FFD700' : '#FF6B6B'
    : 'rgba(255,255,255,0.4)';

  return (
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
      {/* Activity Hero Gauge */}
      <View style={styles.gaugeSection}>
        <HeroLinearGauge
          label={t('activity.active_calories')}
          value={caloriesRounded}
          goal={calorieGoal}
          message={activityMessage}
        />
        <View style={styles.gaugeInfoBtn}>
          <InfoButton metricKey="steps" />
        </View>
      </View>

      {/* Activity Insight/metrics card (shared component) */}
      <TouchableOpacity style={styles.insightSection} activeOpacity={0.85} onPress={() => router.push('/detail/activity-detail')}>
        <MetricInsightCard
          metrics={[
            { label: t('activity.steps'), value: stepsRounded },
            { label: t('activity.est_km'), value: distanceKmDisplay },
            { label: t('activity.active_kcal'), value: caloriesRounded },
          ]}
          scrollY={scrollY}
        />
      </TouchableOpacity>

      {/* Training Insights */}
      <View style={styles.trainingInsightsSection}>
        <Text style={styles.sectionTitle}>{t('training_insights.title')}</Text>
        <TrainingInsightsCard
          unifiedActivities={homeData.unifiedActivities ?? []}
          stravaActivities={homeData.stravaActivities ?? []}
        />
      </View>

      {/* Recent Workouts */}
      <Reanimated.View style={[styles.workoutsSection, firstCardStyle]}>
        <Text style={[styles.sectionTitle, { paddingHorizontal: spacing.lg }]}>{t('activity.recent_workouts')}</Text>
        {homeData.unifiedActivities?.length > 0 ? (
          <FlatList
            data={homeData.unifiedActivities.slice(0, 10)}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={CARD_W + CARD_GAP}
            snapToAlignment="start"
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: CARD_GAP }}
            keyExtractor={item => item.id}
            renderItem={({ item }) => <HorizontalWorkoutCard activity={item} />}
          />
        ) : (
          <View style={[styles.emptyWorkouts, { marginHorizontal: spacing.lg }]}>
            <Text style={styles.emptyText}>{t('activity.no_workouts')}</Text>
            <Text style={styles.emptySubtext}>{t('activity.no_workouts_hint')}</Text>
          </View>
        )}
      </Reanimated.View>

      {/* Goals Progress */}
      <View style={styles.goalsSection}>
        <Text style={styles.sectionTitle}>{t('activity.daily_goals')}</Text>
        <View style={styles.goalsGrid}>
          <GoalCard
            title={t('activity.steps')}
            current={activity.steps}
            goal={10000}
            color="#FF6B35"
          />
          <GoalCard
            title={t('activity.calories')}
            current={activity.calories}
            goal={600}
            color="#4ADE80"
          />
        </View>
      </View>

      {/* Body Temperature Card */}
      <View style={styles.vitalsSection}>
        <Text style={styles.sectionTitle}>{t('activity.body_vitals')}</Text>
        <View style={styles.vitalsRow}>
          <GradientInfoCard
            icon={<ThermometerIcon />}
            title={t('activity.temperature')}
            titleCaption={lastSyncLabel}
            headerValue={tempC > 0 ? `${tempC.toFixed(1)}°` : '--'}
            headerSubtitle={tempStatus ?? t('activity.no_data')}
            gradientStops={[
              { offset: 0, color: 'rgba(200, 80, 20, 0.99)' },
              { offset: 0.75, color: 'rgba(0, 0, 0, 0.27)' },
            ]}
            gradientCenter={{ x: 0.51, y: -0.86 }}
            gradientRadii={{ rx: '80%', ry: '300%' }}
            showArrow
            onHeaderPress={() => router.push('/detail/temperature-detail')}
            style={{ flex: 1 }}
            headerRight={<InfoButton metricKey="body_temperature" />}
          >
            <View style={styles.vitalBody}>
              {tempF && (
                <Text style={styles.vitalAlt}>{tempF}°F</Text>
              )}
              {tempStatus && (
                <View style={[styles.vitalBadge, { borderColor: `${tempColor}55`, backgroundColor: `${tempColor}22` }]}>
                  <Text style={[styles.vitalBadgeText, { color: tempColor }]}>{tempStatus}</Text>
                </View>
              )}
              <Text style={styles.vitalNote}>
                {tempC > 0
                  ? t('activity.temp_normal_range')
                  : t('activity.temp_sync_hint')}
              </Text>
            </View>
          </GradientInfoCard>

          <GradientInfoCard
            icon={<OxygenIcon />}
            title={t('activity.min_spo2')}
            titleCaption={lastSyncLabel}
            headerValue={minSpo2 ? `${minSpo2}%` : '--'}
            headerSubtitle={spo2Status ?? t('activity.no_data')}
            gradientStops={[
              { offset: 0, color: 'rgba(23, 90, 190, 0.99)' },
              { offset: 0.75, color: 'rgba(0, 0, 0, 0.27)' },
            ]}
            gradientCenter={{ x: 0.51, y: -0.86 }}
            gradientRadii={{ rx: '80%', ry: '300%' }}
            showArrow
            onHeaderPress={() => router.push('/detail/spo2-detail')}
            style={{ flex: 1 }}
            headerRight={<InfoButton metricKey="spo2" />}
          >
            <View style={styles.vitalBody}>
              {minSpo2 && (
                <View style={[styles.vitalBadge, { borderColor: `${spo2Color}55`, backgroundColor: `${spo2Color}22` }]}>
                  <Text style={[styles.vitalBadgeText, { color: spo2Color }]}>{spo2Status}</Text>
                </View>
              )}
              <Text style={styles.vitalNote}>
                {minSpo2
                  ? t('activity.spo2_lowest_today')
                  : t('activity.spo2_sync_hint')}
              </Text>
            </View>
          </GradientInfoCard>
        </View>
      </View>

      {/* Spacer for bottom padding */}
      <View style={styles.bottomSpacer} />
    </Animated.ScrollView>
  );
}

function GoalCard({
  title,
  current,
  goal,
  color,
}: {
  title: string;
  current: number;
  goal: number;
  color: string;
}) {
  const progress = Math.min(100, (current / goal) * 100);

  return (
    <View style={styles.goalCard}>
      <View style={styles.goalHeader}>
        <Text style={styles.goalTitle}>{title}</Text>
        <Text style={styles.goalProgress}>
          {current.toLocaleString()}/{goal.toLocaleString()}
        </Text>
      </View>
      <View style={styles.progressBarBg}>
        <View
          style={[
            styles.progressBarFill,
            { width: `${progress}%`, backgroundColor: color },
          ]}
        />
      </View>
    </View>
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
    paddingHorizontal: spacing.lg,
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
  insightSection: {
    marginBottom: spacing.lg,
    marginHorizontal: spacing.md,
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
  trainingInsightsSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  workoutsSection: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: fontSize.lg,
    fontFamily: fontFamily.demiBold,
    marginBottom: spacing.md,
  },
  workoutDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: spacing.md,
  },
  emptyWorkouts: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: fontSize.md,
    fontFamily: fontFamily.regular,
  },
  emptySubtext: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    marginTop: 4,
  },
  goalsSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  goalsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  goalCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  goalTitle: {
    color: '#FFFFFF',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.demiBold,
  },
  goalProgress: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  bottomSpacer: {
    height: 50,
  },
  vitalsSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  sessionsSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  sessionsCard: {
    paddingVertical: spacing.sm,
  },
  sessionRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionLeft: {
    flex: 1,
  },
  sessionRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  sessionTitle: {
    color: '#FFFFFF',
    fontSize: fontSize.md,
    fontFamily: fontFamily.demiBold,
  },
  sessionMeta: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    marginTop: 2,
  },
  sessionStat: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
  },
  vitalsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  vitalBody: {
    paddingVertical: spacing.sm,
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  vitalAlt: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
  },
  vitalBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  vitalBadgeText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.demiBold,
  },
  vitalNote: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    lineHeight: 16,
  },
});

const hCardStyles = StyleSheet.create({
  card: {
    width: CARD_W,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 16,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sourceBadge: {
    position: 'absolute',
    bottom: -2,
    right: -8,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#1A1A2E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textBlock: {
    flex: 1,
    marginLeft: spacing.md,
  },
  name: {
    color: '#FFFFFF',
    fontSize: fontSize.md,
    fontFamily: fontFamily.demiBold,
    marginBottom: 2,
  },
  date: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    marginBottom: 4,
  },
  meta: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
  },
});

export default ActivityTab;
