import React from 'react';
import { View, Text, StyleSheet, RefreshControl, Animated } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { SemiCircularGauge } from '../../components/home/SemiCircularGauge';
import { ActivityStatsRow } from '../../components/home/StatsRow';
import { GlassCard } from '../../components/home/GlassCard';
import { InsightCard } from '../../components/home/InsightCard';
import { useHomeDataContext } from '../../context/HomeDataContext';
import { getActivityMessage, Workout } from '../../hooks/useHomeData';
import { spacing, fontSize, borderRadius, fontFamily } from '../../theme/colors';

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
  onScroll?: Animated.AnimatedEvent<any>;
};

export function ActivityTab({ onScroll }: ActivityTabProps) {
  const homeData = useHomeDataContext();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await homeData.refresh();
    setRefreshing(false);
  }, [homeData.refresh]);

  const activityMessage = getActivityMessage(homeData.activity.score);
  const activity = homeData.activity;

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
      {/* Activity Score Gauge */}
      <View style={styles.gaugeSection}>
        <SemiCircularGauge
          score={activity.score}
          label="ACTIVITY SCORE"
          animated={!homeData.isLoading}
        />
        <Text style={styles.scoreMessage}>{activityMessage}</Text>
      </View>

      {/* Activity Stats */}
      <View style={styles.statsSection}>
        <ActivityStatsRow
          steps={activity.steps}
          calories={activity.calories}
          activeMinutes={activity.activeMinutes}
        />
      </View>

      {/* Activity Insight */}
      <View style={styles.insightSection}>
        <InsightCard
          insight="You're on track to hit your daily step goal! Keep moving to maintain your streak."
          type="activity"
          title="Activity Tip"
        />
      </View>

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
});

export default ActivityTab;
