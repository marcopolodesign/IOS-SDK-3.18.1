import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { supabase } from '../services/SupabaseService';
import { useAuth } from '../hooks/useAuth';
import {
  StravaActivitySummary,
  StravaSplit,
  StravaLap,
  StravaBestEffort,
  StravaHRZones,
} from '../types/strava.types';

// ─── Constants ────────────────────────────────────────────────────────────────

const STRAVA_ORANGE = '#FC4C02';

const ZONE_COLORS = ['#6B8EFF', '#00D4AA', '#FFD700', '#FC4C02', '#FF2D2D'];
const ZONE_NAMES = ['Z1 Recovery', 'Z2 Endurance', 'Z3 Tempo', 'Z4 Threshold', 'Z5 Anaerobic'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPace(speedMs: number): string {
  if (!speedMs || speedMs <= 0) return '--';
  const secPerKm = 1000 / speedMs;
  const mins = Math.floor(secPerKm / 60);
  const secs = Math.round(secPerKm % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}/km`;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function getSportEmoji(sportType: string): string {
  const map: Record<string, string> = {
    Run: '🏃',
    TrailRun: '🥾',
    Ride: '🚴',
    MountainBikeRide: '🚵',
    GravelRide: '🚴',
    Hike: '🥾',
    Swim: '🏊',
    Walk: '🚶',
  };
  return map[sportType] ?? '🏅';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatItem({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, accent ? { color: accent } : {}]}>{value}</Text>
    </View>
  );
}

function HRZonesCard({ zones }: { zones: StravaHRZones }) {
  const { t } = useTranslation();
  const hrZones = zones?.heart_rate?.zones || [];
  const withTime = hrZones.filter(z => z.time > 0);
  if (withTime.length === 0) return null;
  const totalTime = hrZones.reduce((s, z) => s + z.time, 0);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('strava_detail.section_hr_zones')}</Text>
      <View style={styles.glassCard}>
        {hrZones.map((zone, i) => {
          const pct = totalTime > 0 ? (zone.time / totalTime) * 100 : 0;
          const mins = Math.round(zone.time / 60);
          const color = ZONE_COLORS[i] ?? '#888';
          return (
            <View key={i} style={styles.zoneRow}>
              <Text style={[styles.zoneLabel, { color }]}>{ZONE_NAMES[i] ?? `Z${i + 1}`}</Text>
              <View style={styles.zoneBarBg}>
                <View
                  style={[
                    styles.zoneBarFill,
                    { width: `${Math.max(pct, 1)}%` as any, backgroundColor: color },
                  ]}
                />
              </View>
              <Text style={styles.zoneTime}>
                {mins}m ({Math.round(pct)}%)
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function SplitsCard({ splits }: { splits: StravaSplit[] }) {
  const { t } = useTranslation();
  if (!splits || splits.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('strava_detail.section_splits')}</Text>
      <View style={styles.glassCard}>
        {splits.map((split, i) => {
          const pace = formatPace(split.average_speed);
          const hr = split.average_heartrate
            ? `${Math.round(split.average_heartrate)} bpm`
            : '';
          return (
            <View key={i} style={styles.splitRow}>
              <Text style={styles.splitKm}>km {i + 1}</Text>
              <Text style={styles.splitPace}>{pace}</Text>
              {hr ? <Text style={styles.splitHR}>{hr}</Text> : <View />}
            </View>
          );
        })}
      </View>
    </View>
  );
}

function BestEffortsCard({ efforts }: { efforts: StravaBestEffort[] }) {
  const { t } = useTranslation();
  if (!efforts || efforts.length === 0) return null;
  const keyDistances = ['1 kilometer', '1 mile', '5k', '10k', 'Half-Marathon', 'Marathon'];
  const filtered = efforts.filter(e =>
    keyDistances.some(k => e.name.toLowerCase().includes(k.toLowerCase()))
  );
  if (filtered.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('strava_detail.section_best_efforts')}</Text>
      <View style={styles.glassCard}>
        {filtered.map((effort, i) => (
          <View key={i} style={styles.effortRow}>
            <Text style={styles.effortName}>{effort.name}</Text>
            <Text style={styles.effortTime}>{formatDuration(effort.elapsed_time)}</Text>
            {effort.is_kom && (
              <View style={styles.prBadge}>
                <Text style={styles.prBadgeText}>{t('strava_detail.badge_pr')}</Text>
              </View>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

function LapsCard({ laps }: { laps: StravaLap[] }) {
  const { t } = useTranslation();
  if (!laps || laps.length <= 1) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('strava_detail.section_laps')}</Text>
      <View style={styles.glassCard}>
        <View style={styles.lapsHeader}>
          <Text style={styles.lapsHeaderText}>{t('strava_detail.col_lap')}</Text>
          <Text style={styles.lapsHeaderText}>{t('strava_detail.col_dist')}</Text>
          <Text style={styles.lapsHeaderText}>{t('strava_detail.col_time')}</Text>
          <Text style={styles.lapsHeaderText}>{t('strava_detail.col_pace')}</Text>
        </View>
        {laps.map((lap, i) => (
          <View key={lap.id ?? i} style={styles.lapRow}>
            <Text style={styles.lapCell}>{lap.lap_index ?? i + 1}</Text>
            <Text style={styles.lapCell}>{(lap.distance / 1000).toFixed(2)}km</Text>
            <Text style={styles.lapCell}>{formatDuration(lap.elapsed_time)}</Text>
            <Text style={styles.lapCell}>{formatPace(lap.average_speed)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function StravaActivityDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [activity, setActivity] = useState<StravaActivitySummary | null>(null);

  const loadActivity = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('strava_activities')
        .select('*')
        .eq('id', parseInt(id))
        .single();
      if (data) setActivity(data as unknown as StravaActivitySummary);
    } catch (e) {
      console.error('Error loading activity:', e);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={STRAVA_ORANGE} />
        </View>
      </SafeAreaView>
    );
  }

  if (!activity) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{t('strava_detail.not_found')}</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ color: STRAVA_ORANGE, marginTop: 12 }}>{t('strava_detail.go_back')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const zones = activity.zones_json as unknown as StravaHRZones | null;
  const splits = activity.splits_metric_json as unknown as StravaSplit[] | null;
  const laps = activity.laps_json as unknown as StravaLap[] | null;
  const bestEfforts = activity.best_efforts_json as unknown as StravaBestEffort[] | null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Back button */}
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>{t('strava_detail.button_back')}</Text>
        </TouchableOpacity>

        {/* Hero header */}
        <View style={[styles.glassCard, styles.heroCard]}>
          <Text style={styles.heroEmoji}>{getSportEmoji(activity.sport_type || '')}</Text>
          <Text style={styles.heroTitle}>{activity.name || t('strava_detail.label_activity')}</Text>
          {activity.start_date && (
            <Text style={styles.heroSubtitle}>{formatDate(activity.start_date)}</Text>
          )}
        </View>

        {/* Summary stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('strava_detail.section_summary')}</Text>
          <View style={[styles.glassCard, styles.statsGrid]}>
            <StatItem
              label={t('strava_detail.label_distance')}
              value={
                activity.distance_m
                  ? `${(activity.distance_m / 1000).toFixed(2)} km`
                  : '--'
              }
            />
            <StatItem
              label={t('strava_detail.label_duration')}
              value={
                activity.moving_time_sec
                  ? formatDuration(activity.moving_time_sec)
                  : '--'
              }
            />
            <StatItem
              label={t('strava_detail.label_pace')}
              value={activity.average_speed ? formatPace(activity.average_speed) : '--'}
            />
            <StatItem
              label={t('strava_detail.label_elevation')}
              value={
                activity.total_elevation_gain_m
                  ? `↑${Math.round(activity.total_elevation_gain_m)}m`
                  : '--'
              }
            />
            {activity.average_heartrate ? (
              <StatItem
                label={t('strava_detail.label_avg_hr')}
                value={`${Math.round(activity.average_heartrate)} bpm`}
              />
            ) : null}
            {activity.max_heartrate ? (
              <StatItem
                label={t('strava_detail.label_max_hr')}
                value={`${Math.round(activity.max_heartrate)} bpm`}
              />
            ) : null}
            {activity.average_cadence ? (
              <StatItem
                label={t('strava_detail.label_cadence')}
                value={`${Math.round(activity.average_cadence)} ${t('strava_detail.unit_cadence')}`}
              />
            ) : null}
            {activity.suffer_score ? (
              <StatItem
                label={t('strava_detail.label_suffer')}
                value={String(activity.suffer_score)}
                accent={STRAVA_ORANGE}
              />
            ) : null}
          </View>
        </View>

        {zones && <HRZonesCard zones={zones} />}
        {splits && <SplitsCard splits={splits} />}
        {bestEfforts && <BestEffortsCard efforts={bestEfforts} />}
        {laps && <LapsCard laps={laps} />}

        <View style={{ height: 50 }} />
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 60,
  },
  backButton: {
    marginBottom: 16,
  },
  backText: {
    color: STRAVA_ORANGE,
    fontSize: 16,
  },
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 16,
  },
  heroCard: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  heroEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginTop: 4,
  },
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 0,
  },
  statItem: {
    width: '50%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    marginBottom: 2,
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  zoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  zoneLabel: {
    fontSize: 11,
    width: 110,
  },
  zoneBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  zoneBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  zoneTime: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    width: 65,
    textAlign: 'right',
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  splitKm: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    width: 50,
  },
  splitPace: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  splitHR: {
    color: 'rgba(255,100,100,0.9)',
    fontSize: 13,
  },
  effortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  effortName: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    flex: 1,
  },
  effortTime: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginRight: 8,
  },
  prBadge: {
    backgroundColor: 'rgba(252,76,2,0.2)',
    borderWidth: 1,
    borderColor: STRAVA_ORANGE,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  prBadgeText: {
    color: STRAVA_ORANGE,
    fontSize: 11,
    fontWeight: '700',
  },
  lapsHeader: {
    flexDirection: 'row',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.15)',
    marginBottom: 4,
  },
  lapsHeaderText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    flex: 1,
  },
  lapRow: {
    flexDirection: 'row',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  lapCell: {
    color: '#FFFFFF',
    fontSize: 13,
    flex: 1,
  },
});
