import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, RefreshControl, Animated, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import Svg, { Circle, Path } from 'react-native-svg';
import { HeroLinearGauge } from '../../components/home/HeroLinearGauge';
import { GlassCard } from '../../components/home/GlassCard';
import { MetricInsightCard } from '../../components/home/MetricInsightCard';
import { GradientInfoCard } from '../../components/common/GradientInfoCard';
import { useHomeDataContext } from '../../context/HomeDataContext';
import { getActivityMessage, Workout } from '../../hooks/useHomeData';
import { spacing, fontSize, borderRadius, fontFamily } from '../../theme/colors';
import JstyleService from '../../services/JstyleService';

// Workout type icons
function WorkoutIcon({ type }: { type: string }) {
  const getIcon = () => {
    switch (type.toLowerCase()) {
      case 'running':
        return (
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path
              d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7"
              fill="#FF6B35"
            />
          </Svg>
        );
      case 'gym':
      case 'strength':
        return (
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path
              d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29l-1.43-1.43z"
              fill="#4ADE80"
            />
          </Svg>
        );
      case 'cycling':
      case 'bike':
        return (
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path
              d="M15.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM5 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zm5.8-10l2.4-2.4.8.8c1.3 1.3 3 2.1 5 2.1V9c-1.5 0-2.7-.6-3.6-1.5l-1.9-1.9c-.5-.4-1-.6-1.6-.6s-1.1.2-1.4.6L7.8 8.4c-.4.4-.6.9-.6 1.4 0 .6.2 1.1.6 1.4L11 14v5h2v-6.2l-2.2-2.3zM19 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5z"
              fill="#3B82F6"
            />
          </Svg>
        );
      default:
        return (
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Circle cx={12} cy={12} r={8} stroke="#FFD700" strokeWidth={2} fill="none" />
            <Path d="M12 8v4l3 3" stroke="#FFD700" strokeWidth={2} strokeLinecap="round" />
          </Svg>
        );
    }
  };

  return <View style={styles.workoutIconContainer}>{getIcon()}</View>;
}

function WorkoutCard({ workout }: { workout: Workout }) {
  const formatDate = (date: Date) => {
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isToday) return 'Today';
    if (isYesterday) return 'Yesterday';
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <View style={styles.workoutCard}>
      <WorkoutIcon type={workout.type} />
      <View style={styles.workoutInfo}>
        <Text style={styles.workoutName}>{workout.name}</Text>
        <Text style={styles.workoutMeta}>
          {formatDate(workout.date)} • {workout.duration} min • {workout.calories} kcal
        </Text>
      </View>
    </View>
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
  const [refreshing, setRefreshing] = React.useState(false);
  const [temperature, setTemperature] = useState<number | null>(null);
  const [minSpo2, setMinSpo2] = useState<number | null>(null);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await homeData.refresh();
    setRefreshing(false);
  }, [homeData.refresh]);

  // Fetch temperature and SpO2 only when Activity tab is visible and home sync is idle.
  useEffect(() => {
    if (!isActive || !homeData.isRingConnected || homeData.isSyncing) return;
    let cancelled = false;
    const fetchVitals = async () => {
      try {
        try {
          const tempData = await JstyleService.getTemperatureDataNormalized();
          if (!cancelled && tempData.length > 0) {
            setTemperature(tempData[tempData.length - 1].temperature);
          }
        } catch (e) { console.log('[ActivityTab] temperature error:', e); }
        try {
          const rawSpo2 = await JstyleService.getSpO2Data();
          console.log('[ActivityTab] RAW spo2:', JSON.stringify(rawSpo2));
          if (!cancelled) {
            // flatten arrayAutomaticSpo2Data entries from all packets
            const allEntries: any[] = [];
            for (const rec of rawSpo2.records || []) {
              const arr: any[] = rec.arrayAutomaticSpo2Data || [];
              allEntries.push(...arr);
            }
            console.log('[ActivityTab] spo2 flattened entries count:', allEntries.length);
            console.log('[ActivityTab] spo2 first 3 entries:', JSON.stringify(allEntries.slice(0, 3)));
            const values = allEntries.map((e: any) => Number(e.automaticSpo2Data ?? 0)).filter(v => v > 0);
            if (values.length > 0) setMinSpo2(Math.min(...values));
          }
        } catch (e) { console.log('[ActivityTab] spo2 error:', e); }
      } catch (e) { console.log('[ActivityTab] fetchVitals error:', e); }
    };
    fetchVitals();
    return () => { cancelled = true; };
  }, [isActive, homeData.isRingConnected, homeData.isSyncing]);

  const activityMessage = getActivityMessage(homeData.activity.score);
  const activity = homeData.activity;
  const calorieGoal = 650;
  const caloriesRounded = Math.round(activity.adjustedActiveCalories || activity.calories || 0);
  const stepsRounded = Math.round(activity.steps || 0);
  const distanceKm = Math.max(0, (activity.distance || 0) / 1000);
  const distanceKmRounded = Math.round(distanceKm);

  // Temperature status
  const tempC = temperature ?? 0;
  const tempF = tempC > 0 ? Math.round(tempC * 9 / 5 + 32) : null;
  const tempStatus = tempC >= 36.1 && tempC <= 37.2 ? 'Normal' : tempC > 37.2 ? 'Elevated' : tempC > 0 ? 'Low' : null;
  const tempColor = tempStatus === 'Normal' ? '#4ADE80' : tempStatus === 'Elevated' ? '#FF6B6B' : '#FFD700';

  // SpO2 status
  const spo2Status = minSpo2
    ? minSpo2 >= 95 ? 'Normal' : minSpo2 >= 90 ? 'Low' : 'Very low'
    : null;
  const spo2Color = minSpo2
    ? minSpo2 >= 95 ? '#4ADE80' : minSpo2 >= 90 ? '#FFD700' : '#FF6B6B'
    : 'rgba(255,255,255,0.4)';

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
      {/* Activity Hero Gauge */}
      <View style={styles.gaugeSection}>
        <HeroLinearGauge
          label="ACTIVE CALORIES"
          value={caloriesRounded}
          goal={calorieGoal}
          message={activityMessage}
        />
      </View>

      {/* Activity Insight/metrics card (shared component) */}
      <TouchableOpacity style={styles.insightSection} activeOpacity={0.85} onPress={() => router.push('/detail/activity-detail')}>
        <MetricInsightCard
          metrics={[
            { label: 'Steps', value: stepsRounded },
            { label: 'Est. Km', value: distanceKmRounded },
            { label: 'Active kcal', value: caloriesRounded },
          ]}
          insight={activityMessage}
          backgroundImage={require('../../assets/backgrounds/insights/red-insight.jpg')}
        />
      </TouchableOpacity>

      {/* Recent Workouts */}
      <View style={styles.workoutsSection}>
        <Text style={styles.sectionTitle}>Recent Workouts</Text>
        <GlassCard style={styles.workoutsCard} noPadding>
          {activity.workouts.length > 0 ? (
            activity.workouts.map((workout, index) => (
              <React.Fragment key={workout.id}>
                <WorkoutCard workout={workout} />
                {index < activity.workouts.length - 1 && <View style={styles.workoutDivider} />}
              </React.Fragment>
            ))
          ) : (
            <View style={styles.emptyWorkouts}>
              <Text style={styles.emptyText}>No recent workouts</Text>
              <Text style={styles.emptySubtext}>Connect Strava to sync your activities</Text>
            </View>
          )}
        </GlassCard>
      </View>

      {/* Goals Progress */}
      <View style={styles.goalsSection}>
        <Text style={styles.sectionTitle}>Daily Goals</Text>
        <View style={styles.goalsGrid}>
          <GoalCard
            title="Steps"
            current={activity.steps}
            goal={10000}
            color="#FF6B35"
          />
          <GoalCard
            title="Calories"
            current={activity.calories}
            goal={600}
            color="#4ADE80"
          />
        </View>
      </View>

      {/* Body Temperature Card */}
      <View style={styles.vitalsSection}>
        <Text style={styles.sectionTitle}>Body Vitals</Text>
        <View style={styles.vitalsRow}>
          <GradientInfoCard
            icon={<ThermometerIcon />}
            title="Temperature"
            headerValue={tempC > 0 ? `${tempC.toFixed(1)}°` : '--'}
            headerSubtitle={tempStatus ?? 'No data'}
            gradientStops={[
              { offset: 0, color: 'rgba(200, 80, 20, 0.99)' },
              { offset: 0.75, color: 'rgba(0, 0, 0, 0.27)' },
            ]}
            gradientCenter={{ x: 0.51, y: -0.86 }}
            gradientRadii={{ rx: '80%', ry: '300%' }}
            showArrow
            onHeaderPress={() => router.push('/detail/temperature-detail')}
            style={{ flex: 1 }}
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
                  ? 'Normal range: 36.1–37.2°C'
                  : 'Sync ring to see temperature'}
              </Text>
            </View>
          </GradientInfoCard>

          <GradientInfoCard
            icon={<OxygenIcon />}
            title="Min SpO2"
            headerValue={minSpo2 ? `${minSpo2}%` : '--'}
            headerSubtitle={spo2Status ?? 'No data'}
            gradientStops={[
              { offset: 0, color: 'rgba(23, 90, 190, 0.99)' },
              { offset: 0.75, color: 'rgba(0, 0, 0, 0.27)' },
            ]}
            gradientCenter={{ x: 0.51, y: -0.86 }}
            gradientRadii={{ rx: '80%', ry: '300%' }}
            showArrow
            onHeaderPress={() => router.push('/detail/spo2-detail')}
            style={{ flex: 1 }}
          >
            <View style={styles.vitalBody}>
              {minSpo2 && (
                <View style={[styles.vitalBadge, { borderColor: `${spo2Color}55`, backgroundColor: `${spo2Color}22` }]}>
                  <Text style={[styles.vitalBadgeText, { color: spo2Color }]}>{spo2Status}</Text>
                </View>
              )}
              <Text style={styles.vitalNote}>
                {minSpo2
                  ? 'Lowest reading today'
                  : 'Sync ring to see SpO2'}
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
    marginBottom: spacing.lg,
    marginHorizontal: spacing.md,
  },
  workoutsSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: fontSize.lg,
    fontFamily: fontFamily.demiBold,
    marginBottom: spacing.md,
  },
  workoutsCard: {
    paddingVertical: spacing.sm,
  },
  workoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  workoutIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  workoutInfo: {
    flex: 1,
  },
  workoutName: {
    color: '#FFFFFF',
    fontSize: fontSize.md,
    fontFamily: fontFamily.demiBold,
  },
  workoutMeta: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    marginTop: 2,
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

export default ActivityTab;
