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
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { router } from 'expo-router';
import { colors, spacing, borderRadius, fontSize, fontFamily } from '../theme/colors';
import { stravaService } from '../services/StravaService';
import { supabase } from '../services/SupabaseService';
import { useAuth } from '../hooks/useAuth';
import {
  StravaActivity,
  StravaActivityStats,
  StravaAthlete,
  StravaActivitySummary,
} from '../types/strava.types';

// ─── Constants ───────────────────────────────────────────────────────────────

const STRAVA_ORANGE = '#FC4C02';

const SPORT_COLORS: Record<string, string> = {
  Run: '#FC4C02',
  TrailRun: '#FC4C02',
  Ride: '#6B8EFF',
  MountainBikeRide: '#6B8EFF',
  GravelRide: '#6B8EFF',
  Hike: '#FFB84D',
  Swim: '#B16BFF',
};

function getSportColor(sportType: string): string {
  return SPORT_COLORS[sportType] ?? '#00D4AA';
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

// ─── Helper Functions ─────────────────────────────────────────────────────────

function formatPace(averageSpeedMs: number): string {
  if (!averageSpeedMs || averageSpeedMs <= 0) return '--';
  const secPerKm = 1000 / averageSpeedMs;
  const mins = Math.floor(secPerKm / 60);
  const secs = Math.round(secPerKm % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}/km`;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function formatTotalHours(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function formatDate(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

// ─── StravaIcon SVG ───────────────────────────────────────────────────────────

function StravaIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={STRAVA_ORANGE}>
      <Path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
    </Svg>
  );
}

// ─── Activity Card ────────────────────────────────────────────────────────────

function ActivityCard({ activity, onPress }: { activity: StravaActivitySummary; onPress: () => void }) {
  const { t } = useTranslation();
  const sportColor = getSportColor(activity.sport_type || '');
  const sportIcon = getSportIcon(activity.sport_type || '');

  const distStr = activity.distance_m
    ? `${(activity.distance_m / 1000).toFixed(1)} km`
    : null;
  const durStr = activity.moving_time_sec
    ? formatDuration(activity.moving_time_sec)
    : null;
  const paceStr = activity.average_speed
    ? formatPace(activity.average_speed)
    : null;
  const elevStr = activity.total_elevation_gain_m
    ? `↑${Math.round(activity.total_elevation_gain_m)}m`
    : null;

  const metricsLine = [distStr, durStr, paceStr, elevStr]
    .filter(Boolean)
    .join('  ·  ');

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.activityCard, { borderLeftColor: sportColor, borderLeftWidth: 3 }]}>
        <View style={styles.activityHeader}>
          <Text style={styles.activityIcon}>{sportIcon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.activityName} numberOfLines={1}>{activity.name}</Text>
            <Text style={styles.activityDate}>{formatDate(activity.start_date || '')}</Text>
          </View>
        </View>
        {metricsLine ? (
          <Text style={styles.metricsLine}>{metricsLine}</Text>
        ) : null}
        {(activity.average_heartrate || activity.suffer_score) ? (
          <View style={styles.activityBadges}>
            {activity.average_heartrate ? (
              <View style={[styles.badge, { borderColor: 'rgba(255,100,100,0.4)', backgroundColor: 'rgba(255,100,100,0.1)' }]}>
                <Text style={[styles.badgeText, { color: '#FF6B6B' }]}>
                  {Math.round(activity.average_heartrate)} {t('strava.badge_bpm_avg')}
                </Text>
              </View>
            ) : null}
            {activity.suffer_score ? (
              <View style={[styles.badge, { borderColor: `${sportColor}44`, backgroundColor: `${sportColor}1A` }]}>
                <Text style={[styles.badgeText, { color: sportColor }]}>
                  {t('strava.badge_suffer', { score: activity.suffer_score })}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// ─── Stats Card ───────────────────────────────────────────────────────────────

function ComputedStatsCard({ activities }: { activities: StravaActivitySummary[] }) {
  const { t } = useTranslation();
  const runActivities = activities.filter(a => {
    const s = (a.sport_type || '').toLowerCase();
    return s.includes('run') || s === 'trailrun';
  });

  const totalRuns = runActivities.length;

  const totalKm = activities.reduce((sum, a) => sum + (a.distance_m || 0), 0) / 1000;

  const runWithSpeed = runActivities.filter(a => (a.average_speed || 0) > 0);
  let avgPace = '--';
  if (runWithSpeed.length > 0) {
    const avgSpeed = runWithSpeed.reduce((sum, a) => sum + (a.average_speed || 0), 0) / runWithSpeed.length;
    avgPace = formatPace(avgSpeed);
  }

  const totalTimeSec = activities.reduce((sum, a) => sum + (a.moving_time_sec || 0), 0);
  const totalTime = formatTotalHours(totalTimeSec);

  return (
    <View style={styles.statsCard}>
      <Text style={styles.statsTitle}>{t('strava.stats_title')}</Text>
      <View style={styles.statsGrid}>
        <View style={styles.statBox}>
          <Text style={styles.statBoxValue}>{totalRuns}</Text>
          <Text style={styles.statBoxLabel}>{t('strava.stat_total_runs')}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statBoxValue}>{totalKm.toFixed(1)} km</Text>
          <Text style={styles.statBoxLabel}>{t('strava.stat_total_km')}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statBoxValue}>{avgPace}</Text>
          <Text style={styles.statBoxLabel}>{t('strava.stat_avg_pace')}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statBoxValue}>{totalTime}</Text>
          <Text style={styles.statBoxLabel}>{t('strava.stat_total_time')}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Filter Tabs ──────────────────────────────────────────────────────────────

type FilterType = 'all' | 'run' | 'ride' | 'hike';

function FilterTabs({
  active,
  onChange,
}: {
  active: FilterType;
  onChange: (f: FilterType) => void;
}) {
  const { t } = useTranslation();
  const FILTERS: { key: FilterType; label: string }[] = [
    { key: 'all', label: t('strava.filter_all') },
    { key: 'run', label: t('strava.filter_runs') },
    { key: 'ride', label: t('strava.filter_rides') },
    { key: 'hike', label: t('strava.filter_hikes') },
  ];
  return (
    <View style={styles.filterRow}>
      {FILTERS.map(f => (
        <TouchableOpacity
          key={f.key}
          onPress={() => onChange(f.key)}
          activeOpacity={0.7}
          style={[styles.filterTab, active === f.key && styles.filterTabActive]}
        >
          <Text style={[styles.filterTabText, active === f.key && styles.filterTabTextActive]}>
            {f.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function StravaScreen() {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();

  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [athlete, setAthlete] = useState<StravaAthlete | null>(null);
  const [activities, setActivities] = useState<StravaActivitySummary[]>([]);
  const [stats, setStats] = useState<StravaActivityStats | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  // ── Load activities from Supabase ─────────────────────────────────────────

  const loadActivities = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('strava_activities')
      .select(
        'id, name, sport_type, start_date, distance_m, moving_time_sec, average_heartrate, max_heartrate, suffer_score, calories, average_speed, total_elevation_gain_m'
      )
      .eq('user_id', user.id)
      .order('start_date', { ascending: false })
      .limit(50);

    if (data) {
      setActivities(data as StravaActivitySummary[]);
    }
  }, [user]);

  // ── Load all data ─────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      await stravaService.reload();
      setIsConnected(stravaService.isConnected);

      if (stravaService.isConnected) {
        const [athleteData, statsData] = await Promise.all([
          stravaService.getAthlete(),
          stravaService.getAthleteStats(),
          stravaService.backgroundSync(7).catch(() => null),
        ]);
        setAthlete(athleteData);
        setStats(statsData);
        await loadActivities();
      }
    } catch (e) {
      console.error('[StravaScreen] Error loading data:', e);
    } finally {
      setIsLoading(false);
    }
  }, [user, loadActivities]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const result = await stravaService.connect();
      if (result.success) {
        setIsConnected(true);
        await loadData();
      } else {
        Alert.alert(t('strava.alert_connect_failed_title'), result.error || t('strava.alert_connect_failed_message'));
      }
    } catch (e) {
      Alert.alert(t('strava.alert_error_title'), t('strava.alert_connect_error_message'));
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    Alert.alert(
      t('strava.alert_disconnect_title'),
      t('strava.alert_disconnect_message'),
      [
        { text: t('strava.button_cancel'), style: 'cancel' },
        {
          text: t('strava.button_disconnect_confirm'),
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
    setSyncProgress(t('strava.sync_fetching'));
    try {
      const result = await stravaService.syncActivitiesToSupabase(60);
      if (result.success) {
        setSyncProgress(
          result.count > 0
            ? t('strava.sync_synced', { count: result.count })
            : t('strava.sync_up_to_date')
        );
        const detailResult = await stravaService.syncAllActivityDetails(user!.id, (done, total) => {
          setSyncProgress(t('strava.sync_details', { done, total }));
        });
        console.log('[StravaScreen] Detail sync result:', detailResult);
        setSyncProgress('');
        await loadActivities();
      } else {
        setSyncProgress('');
        Alert.alert(t('strava.alert_sync_failed_title'), t('strava.alert_sync_failed_message'));
      }
    } catch (e) {
      console.error('[StravaScreen] handleSync error:', e);
      setSyncProgress('');
      Alert.alert(t('strava.alert_error_title'), `${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // ── Filtered activities ───────────────────────────────────────────────────

  const filteredActivities =
    activeFilter === 'all'
      ? activities
      : activities.filter(a => {
          const sport = (a.sport_type || '').toLowerCase();
          if (activeFilter === 'run') return sport.includes('run') || sport === 'trailrun';
          if (activeFilter === 'ride') return sport.includes('ride');
          if (activeFilter === 'hike') return sport === 'hike';
          return true;
        });

  // ── Loading / auth states ─────────────────────────────────────────────────

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.message}>{t('strava.sign_in_required')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

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
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('strava.header_title')}</Text>
          {isConnected ? (
            <TouchableOpacity onPress={handleDisconnect} style={styles.headerBtn}>
              <Text style={styles.headerBtnText}>{t('strava.button_disconnect')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {!isConnected ? (
          /* ── Not connected ───────────────────────────────────────────── */
          <View style={styles.connectContainer}>
            <View style={styles.connectCard}>
              <StravaIcon size={48} />
              <Text style={styles.connectTitle}>{t('strava.connect_title')}</Text>
              <Text style={styles.connectDescription}>
                {t('strava.connect_description')}
              </Text>
              <TouchableOpacity
                style={[styles.connectButton, isConnecting && styles.buttonDisabled]}
                onPress={handleConnect}
                disabled={isConnecting}
                activeOpacity={0.8}
              >
                {isConnecting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.connectButtonText}>{t('strava.button_connect')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* ── Connected ───────────────────────────────────────────────── */
          <>
            {/* Athlete row */}
            {athlete ? (
              <View style={styles.athleteRow}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>
                    {athlete.firstname?.[0] ?? ''}{athlete.lastname?.[0] ?? ''}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.athleteName}>
                    {athlete.firstname} {athlete.lastname}
                  </Text>
                  {(athlete.city || athlete.state) ? (
                    <Text style={styles.athleteLocation}>
                      {[athlete.city, athlete.state].filter(Boolean).join(', ')}
                    </Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  style={[styles.syncBtn, isSyncing && styles.buttonDisabled]}
                  onPress={handleSync}
                  disabled={isSyncing}
                  activeOpacity={0.8}
                >
                  {isSyncing ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text style={styles.syncBtnText}>{t('strava.button_sync_athlete')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Sync progress label */}
            {syncProgress ? (
              <Text style={styles.syncProgressText}>{syncProgress}</Text>
            ) : null}

            {/* All-time stats from local activities */}
            {activities.length > 0 ? (
              <ComputedStatsCard activities={activities} />
            ) : null}

            {/* Filter tabs */}
            <FilterTabs active={activeFilter} onChange={setActiveFilter} />

            {/* Activity list */}
            {filteredActivities.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>
                  {activities.length === 0
                    ? t('strava.empty_no_activities')
                    : t('strava.empty_no_match')}
                </Text>
                {activities.length === 0 ? (
                  <TouchableOpacity
                    style={styles.syncNowBtn}
                    onPress={handleSync}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.syncNowBtnText}>{t('strava.button_sync')}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : (
              filteredActivities.map(activity => (
                <ActivityCard
                  key={activity.id}
                  activity={activity}
                  onPress={() =>
                    router.push({
                      pathname: '/(tabs)/coach/strava-detail',
                      params: { id: String(activity.id) },
                    })
                  }
                />
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 100,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  message: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: fontSize.lg,
    fontFamily: fontFamily.regular,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  headerTitle: {
    fontSize: fontSize.xxxl,
    fontFamily: fontFamily.demiBold,
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  headerBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,100,100,0.4)',
  },
  headerBtnText: {
    color: '#FF6B6B',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
  },

  // ── Connect card ──
  connectContainer: {
    paddingVertical: spacing.xxl,
  },
  connectCard: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: spacing.xl,
    alignItems: 'center',
  },
  connectTitle: {
    fontSize: fontSize.xxl,
    fontFamily: fontFamily.demiBold,
    color: '#FFFFFF',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  connectDescription: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.regular,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  connectButton: {
    backgroundColor: STRAVA_ORANGE,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    width: '100%',
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  connectButtonText: {
    color: '#FFFFFF',
    fontSize: fontSize.md,
    fontFamily: fontFamily.demiBold,
  },
  buttonDisabled: {
    opacity: 0.55,
  },

  // ── Athlete row ──
  athleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  avatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: STRAVA_ORANGE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: fontSize.md,
    fontFamily: fontFamily.demiBold,
  },
  athleteName: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.demiBold,
    color: '#FFFFFF',
  },
  athleteLocation: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  syncBtn: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#00D4AA',
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  },
  syncBtnText: {
    color: '#00D4AA',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.demiBold,
  },
  syncProgressText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    marginBottom: spacing.md,
    textAlign: 'center',
  },

  // ── Stats card ──
  statsCard: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  statsTitle: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.demiBold,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statBox: {
    width: '48%',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  statBoxValue: {
    fontSize: fontSize.xl,
    fontFamily: fontFamily.demiBold,
    color: '#FFFFFF',
  },
  statBoxLabel: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 3,
  },

  // ── Filter tabs ──
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  filterTabActive: {
    backgroundColor: 'rgba(0,212,170,0.15)',
    borderColor: '#00D4AA',
  },
  filterTabText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    color: 'rgba(255,255,255,0.5)',
  },
  filterTabTextActive: {
    color: '#00D4AA',
    fontFamily: fontFamily.demiBold,
  },

  // ── Activity card ──
  activityCard: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    marginBottom: 10,
    padding: 14,
    overflow: 'hidden',
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: 8,
  },
  activityIcon: {
    fontSize: 20,
    lineHeight: 24,
  },
  activityName: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.demiBold,
    color: '#FFFFFF',
    lineHeight: 20,
  },
  activityDate: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  metricsLine: {
    fontSize: 13,
    fontFamily: fontFamily.regular,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  activityBadges: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  badge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
  },

  // ── Empty state ──
  emptyState: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: spacing.xl,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  emptyStateText: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.regular,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  syncNowBtn: {
    backgroundColor: STRAVA_ORANGE,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
  },
  syncNowBtnText: {
    color: '#FFFFFF',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.demiBold,
  },
});

export default StravaScreen;
