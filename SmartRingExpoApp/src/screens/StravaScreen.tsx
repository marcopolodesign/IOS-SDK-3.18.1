import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, spacing, borderRadius, fontSize } from '../theme/colors';
import { stravaService } from '../services/StravaService';
import { supabaseService } from '../services/SupabaseService';
import { useAuth } from '../hooks/useAuth';
import { StravaActivity, StravaActivityStats, StravaAthlete } from '../types/strava.types';

// Strava brand color
const STRAVA_ORANGE = '#FC4C02';

function StravaIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={STRAVA_ORANGE}>
      <Path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
    </Svg>
  );
}

function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(meters)} m`;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function ActivityCard({ activity }: { activity: StravaActivity }) {
  const sportIcon = getSportIcon(activity.sport_type);
  
  return (
    <View style={styles.activityCard}>
      <View style={styles.activityHeader}>
        <View style={styles.activityIconContainer}>
          <Text style={styles.activityIcon}>{sportIcon}</Text>
        </View>
        <View style={styles.activityInfo}>
          <Text style={styles.activityName} numberOfLines={1}>{activity.name}</Text>
          <Text style={styles.activityDate}>{formatDate(activity.start_date)}</Text>
        </View>
      </View>
      <View style={styles.activityStats}>
        <View style={styles.activityStat}>
          <Text style={styles.statValue}>{formatDistance(activity.distance)}</Text>
          <Text style={styles.statLabel}>Distance</Text>
        </View>
        <View style={styles.activityStat}>
          <Text style={styles.statValue}>{formatDuration(activity.moving_time)}</Text>
          <Text style={styles.statLabel}>Duration</Text>
        </View>
        {activity.average_heartrate && (
          <View style={styles.activityStat}>
            <Text style={styles.statValue}>{Math.round(activity.average_heartrate)}</Text>
            <Text style={styles.statLabel}>Avg HR</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function getSportIcon(sportType: string): string {
  const icons: Record<string, string> = {
    Run: '🏃',
    TrailRun: '🥾',
    Ride: '🚴',
    MountainBikeRide: '🚵',
    GravelRide: '🚴',
    EBikeRide: '🔋',
    Swim: '🏊',
    Walk: '🚶',
    Hike: '🥾',
    Yoga: '🧘',
    WeightTraining: '🏋️',
    Workout: '💪',
    Soccer: '⚽',
    Tennis: '🎾',
    Golf: '⛳',
  };
  return icons[sportType] || '🏅';
}

function StatsCard({ stats }: { stats: StravaActivityStats }) {
  return (
    <View style={styles.statsContainer}>
      <Text style={styles.statsTitle}>All-Time Stats</Text>
      <View style={styles.statsGrid}>
        <View style={styles.statBox}>
          <Text style={styles.statBoxValue}>
            {formatDistance(stats.all_run_totals.distance + stats.all_ride_totals.distance)}
          </Text>
          <Text style={styles.statBoxLabel}>Total Distance</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statBoxValue}>
            {stats.all_run_totals.count + stats.all_ride_totals.count + stats.all_swim_totals.count}
          </Text>
          <Text style={styles.statBoxLabel}>Activities</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statBoxValue}>
            {formatDuration(stats.all_run_totals.moving_time + stats.all_ride_totals.moving_time)}
          </Text>
          <Text style={styles.statBoxLabel}>Total Time</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statBoxValue}>
            {formatDistance(stats.all_run_totals.elevation_gain + stats.all_ride_totals.elevation_gain)}
          </Text>
          <Text style={styles.statBoxLabel}>Elevation Gain</Text>
        </View>
      </View>
    </View>
  );
}

export function StravaScreen() {
  const { user, isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [athlete, setAthlete] = useState<StravaAthlete | null>(null);
  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [stats, setStats] = useState<StravaActivityStats | null>(null);

  const loadData = useCallback(async () => {
    console.log('[StravaScreen] loadData called, user:', user?.id);
    if (!user) {
      console.log('[StravaScreen] No user, skipping load');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      console.log('[StravaScreen] Calling stravaService.reload()...');
      await stravaService.reload();
      console.log('[StravaScreen] reload complete, isConnected:', stravaService.isConnected);
      setIsConnected(stravaService.isConnected);

      if (stravaService.isConnected) {
        const [athleteData, statsData] = await Promise.all([
          stravaService.getAthlete(),
          stravaService.getAthleteStats(),
        ]);
        setAthlete(athleteData);
        setStats(statsData);

        // Load activities from Supabase
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const storedActivities = await supabaseService.getStravaActivities(
          user.id,
          thirtyDaysAgo,
          new Date()
        );
        
        // Convert to StravaActivity format
        setActivities(storedActivities.map(a => ({
          ...a,
          distance: a.distance_m || 0,
          moving_time: a.moving_time_sec || 0,
          elapsed_time: a.elapsed_time_sec || 0,
          total_elevation_gain: a.total_elevation_gain_m || 0,
          start_date: a.start_date || '',
          sport_type: a.sport_type || 'Workout',
        } as unknown as StravaActivity)));
      }
    } catch (e) {
      console.error('Error loading Strava data:', e);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const result = await stravaService.connect();
      if (result.success) {
        setIsConnected(true);
        await loadData();
      } else {
        Alert.alert('Connection Failed', result.error || 'Failed to connect to Strava');
      }
    } catch (e) {
      Alert.alert('Error', 'An error occurred while connecting to Strava');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    Alert.alert(
      'Disconnect Strava',
      'Are you sure you want to disconnect your Strava account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            await stravaService.disconnect();
            setIsConnected(false);
            setAthlete(null);
            setActivities([]);
            setStats(null);
          },
        },
      ]
    );
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await stravaService.syncActivitiesToSupabase(30);
      if (result.success) {
        Alert.alert('Sync Complete', `Synced ${result.count} activities`);
        await loadData();
      } else {
        Alert.alert('Sync Failed', 'Failed to sync activities');
      }
    } catch (e) {
      Alert.alert('Error', 'An error occurred while syncing');
    } finally {
      setIsSyncing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.message}>Please sign in to connect Strava</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <StravaIcon size={32} />
          <Text style={styles.headerTitle}>Strava</Text>
        </View>

        {!isConnected ? (
          // Not connected view
          <View style={styles.connectContainer}>
            <View style={styles.connectCard}>
              <StravaIcon size={48} />
              <Text style={styles.connectTitle}>Connect to Strava</Text>
              <Text style={styles.connectDescription}>
                Sync your workouts and activities from Strava to get a complete picture of your fitness.
              </Text>
              <TouchableOpacity
                style={[styles.connectButton, isConnecting && styles.buttonDisabled]}
                onPress={handleConnect}
                disabled={isConnecting}
              >
                {isConnecting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.connectButtonText}>Connect with Strava</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          // Connected view
          <>
            {/* Athlete Info */}
            {athlete && (
              <View style={styles.athleteCard}>
                <View style={styles.athleteInfo}>
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarText}>
                      {athlete.firstname?.[0]}{athlete.lastname?.[0]}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.athleteName}>
                      {athlete.firstname} {athlete.lastname}
                    </Text>
                    <Text style={styles.athleteLocation}>
                      {[athlete.city, athlete.state].filter(Boolean).join(', ')}
                    </Text>
                  </View>
                </View>
                <View style={styles.athleteActions}>
                  <TouchableOpacity
                    style={[styles.syncButton, isSyncing && styles.buttonDisabled]}
                    onPress={handleSync}
                    disabled={isSyncing}
                  >
                    {isSyncing ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Text style={styles.syncButtonText}>Sync</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.disconnectButton}
                    onPress={handleDisconnect}
                  >
                    <Text style={styles.disconnectButtonText}>Disconnect</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Stats */}
            {stats && <StatsCard stats={stats} />}

            {/* Recent Activities */}
            <View style={styles.activitiesSection}>
              <Text style={styles.sectionTitle}>Recent Activities</Text>
              {activities.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No activities synced yet</Text>
                  <TouchableOpacity style={styles.syncNowButton} onPress={handleSync}>
                    <Text style={styles.syncNowButtonText}>Sync Now</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                activities.slice(0, 10).map(activity => (
                  <ActivityCard key={activity.id} activity={activity} />
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  message: {
    color: colors.textSecondary,
    fontSize: fontSize.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  headerTitle: {
    fontSize: fontSize.xxxl,
    fontWeight: '700',
    color: colors.text,
  },
  connectContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
  },
  connectCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  connectTitle: {
    fontSize: fontSize.xxl,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  connectDescription: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  connectButton: {
    backgroundColor: STRAVA_ORANGE,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    width: '100%',
    alignItems: 'center',
  },
  connectButtonText: {
    color: '#fff',
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  athleteCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  athleteInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: STRAVA_ORANGE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  athleteName: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
  },
  athleteLocation: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  athleteActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  syncButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  syncButtonText: {
    color: colors.background,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  disconnectButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.error,
  },
  disconnectButtonText: {
    color: colors.error,
    fontSize: fontSize.sm,
  },
  statsContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statsTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statBox: {
    width: '48%',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  statBoxValue: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: STRAVA_ORANGE,
  },
  statBoxLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  activitiesSection: {
    marginTop: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  activityCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  activityIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  activityIcon: {
    fontSize: 20,
  },
  activityInfo: {
    flex: 1,
  },
  activityName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  activityDate: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  activityStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  activityStat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  emptyState: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyStateText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  syncNowButton: {
    backgroundColor: STRAVA_ORANGE,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
  },
  syncNowButtonText: {
    color: '#fff',
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
});

export default StravaScreen;

