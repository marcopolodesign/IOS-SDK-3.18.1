import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { spacing, fontSize, fontFamily } from '../../theme/colors';
import type { SleepData } from '../../hooks/useHomeData';
import type { X3ActivitySession } from '../../types/sdk.types';
import type { TimelineEntry, RecoverySubtype } from '../../types/timeline.types';
import type { UnifiedActivity } from '../../types/activity.types';

// ─── Types ────────────────────────────────────────────────────────────────────

type TimelineEventKind =
  | 'bed_time'
  | 'fall_asleep'
  | 'wake_up'
  | 'activity'
  | 'recovery'
  | 'manual_activity'
  | 'strava_activity'
  | 'nap';

interface TimelineEvent {
  id: string;
  kind: TimelineEventKind;
  time: number; // ms epoch start
  endTime?: number; // ms epoch end
  label: string;
  // Simple detail string for sleep events
  detail?: string;
  // Structured metrics for activity / recovery events
  durationSecs?: number;
  calories?: number;
  heartRateAvg?: number;
  heartRateMax?: number;
  distanceLabel?: string;  // e.g. "8.4 km" for Strava activities
  iconOverride?: string;   // per-activity icon (unified activities)
  colorOverride?: string;  // per-activity color (unified activities)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours();
  const min = d.getMinutes().toString().padStart(2, '0');
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const meridiem = h >= 12 ? 'PM' : 'AM';
  return `${displayH}:${min} ${meridiem}`;
}

function formatDuration(secs: number): string {
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function durationFromMs(startMs: number, endMs: number): number {
  return Math.round((endMs - startMs) / 1000);
}

// ─── Icon config ──────────────────────────────────────────────────────────────

const EVENT_CONFIG: Record<
  TimelineEventKind,
  { icon: React.ComponentProps<typeof Ionicons>['name']; color: string }
> = {
  bed_time:        { icon: 'bed-outline',          color: '#6B8EFF' },
  fall_asleep:     { icon: 'moon-outline',          color: '#B16BFF' },
  wake_up:         { icon: 'sunny-outline',         color: '#FFB84D' },
  activity:        { icon: 'fitness-outline',       color: '#00D4AA' },
  recovery:        { icon: 'snow-outline',          color: '#6BFFF5' },
  manual_activity: { icon: 'bicycle-outline',       color: '#00D4AA' },
  strava_activity: { icon: 'trophy-outline',         color: '#FC4C02' },
  nap:             { icon: 'moon-outline',           color: '#B16BFF' },
};

function recoveryIcon(subtype: RecoverySubtype | string): React.ComponentProps<typeof Ionicons>['name'] {
  if (subtype === 'sauna') return 'thermometer-outline';
  if (subtype === 'ice_bath') return 'snow-outline';
  if (subtype === 'compression_boots') return 'medkit-outline';
  return 'heart-outline';
}

// ─── Metrics chip row ─────────────────────────────────────────────────────────

function MetricsRow({ event, accentColor }: { event: TimelineEvent; accentColor: string }) {
  const chips: { label: string; icon?: React.ComponentProps<typeof Ionicons>['name'] }[] = [];

  if (event.distanceLabel) {
    chips.unshift({ label: event.distanceLabel, icon: 'map-outline' });
  }

  if (event.durationSecs) {
    chips.push({ label: formatDuration(event.durationSecs), icon: 'time-outline' });
  }

  if (event.calories) {
    chips.push({ label: `${event.calories} kcal`, icon: 'flame-outline' });
  }

  if (event.heartRateAvg) {
    const hrLabel = event.heartRateMax
      ? `${event.heartRateAvg} / ${event.heartRateMax} bpm`
      : `${event.heartRateAvg} bpm`;
    chips.push({ label: hrLabel, icon: 'heart-outline' });
  }

  if (chips.length === 0) return null;

  return (
    <View style={metricStyles.row}>
      {chips.map((chip, i) => (
        <View key={i} style={metricStyles.chip}>
          {chip.icon && (
            <Ionicons name={chip.icon} size={10} color={accentColor} style={metricStyles.chipIcon} />
          )}
          <Text style={[metricStyles.chipText, { color: accentColor }]}>{chip.label}</Text>
        </View>
      ))}
    </View>
  );
}

const metricStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    gap: 3,
  },
  chipIcon: {
    opacity: 0.7,
  },
  chipText: {
    fontSize: 11,
    fontFamily: fontFamily.regular,
    opacity: 0.9,
  },
});

// ─── Props ────────────────────────────────────────────────────────────────────

interface DailyTimelineCardProps {
  sleep: SleepData;
  activitySessions: X3ActivitySession[];
  manualEntries: TimelineEntry[];
  unifiedActivities?: UnifiedActivity[];
  todayNaps?: Array<{
    id: string;
    startTime: string;
    endTime: string;
    totalMin: number;
  }>;
  onAddPress?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DailyTimelineCard({
  sleep,
  activitySessions,
  manualEntries,
  unifiedActivities = [],
  todayNaps = [],
  onAddPress,
}: DailyTimelineCardProps) {
  const { t } = useTranslation();
  const events = useMemo<TimelineEvent[]>(() => {
    const list: TimelineEvent[] = [];

    // Sleep events
    if (sleep.bedTime) {
      list.push({
        id: 'bed_time',
        kind: 'bed_time',
        time: sleep.bedTime.getTime(),
        label: t('timeline.event_bedtime'),
        detail: formatTime(sleep.bedTime.getTime()),
      });
    }

    // Fall asleep = first non-awake segment
    const fallAsleepSegment = sleep.segments?.find((s) => s.stage !== 'awake');
    if (fallAsleepSegment?.startTime) {
      const fallAsleepMs = fallAsleepSegment.startTime instanceof Date
        ? fallAsleepSegment.startTime.getTime()
        : (fallAsleepSegment.startTime as number);
      list.push({
        id: 'fall_asleep',
        kind: 'fall_asleep',
        time: fallAsleepMs,
        label: t('timeline.event_fell_asleep'),
        detail: formatTime(fallAsleepMs),
      });
    }

    if (sleep.wakeTime) {
      list.push({
        id: 'wake_up',
        kind: 'wake_up',
        time: sleep.wakeTime.getTime(),
        label: t('timeline.event_wake_up'),
        detail: formatTime(sleep.wakeTime.getTime()),
      });
    }

    // Ring activity sessions are now included in unifiedActivities (deduplicated)
    // so we no longer add them separately here.

    // Manual entries (recovery, manual_activity)
    manualEntries.forEach((entry) => {
      const durationSecs =
        entry.endTime ? durationFromMs(entry.startTime, entry.endTime) : undefined;
      list.push({
        id: entry.id,
        kind: entry.type === 'recovery' ? 'recovery' : 'manual_activity',
        time: entry.startTime,
        endTime: entry.endTime,
        label: entry.title,
        durationSecs,
      });
    });

    // Nap events
    todayNaps.forEach(nap => {
      const startMs = new Date(nap.startTime).getTime();
      const endMs = new Date(nap.endTime).getTime();
      list.push({
        id: `nap_${nap.id}`,
        kind: 'nap',
        time: startMs,
        endTime: endMs,
        label: t('timeline.event_nap'),
        durationSecs: Math.round((endMs - startMs) / 1000),
      });
    });

    // Unified activities (Strava + Apple Health + Ring, deduplicated) — today only
    const todayIso = new Date().toISOString().slice(0, 10);
    unifiedActivities.forEach((activity) => {
      if (!activity.startDate?.startsWith(todayIso)) return;
      const startMs = new Date(activity.startDate).getTime();
      const endMs = activity.durationSec ? startMs + activity.durationSec * 1000 : undefined;
      list.push({
        id: activity.id,
        kind: 'strava_activity', // reuse existing kind for metrics chip rendering
        time: startMs,
        endTime: endMs,
        label: activity.name || activity.sportType || t('timeline.event_activity'),
        durationSecs: activity.durationSec || undefined,
        calories: activity.calories,
        heartRateAvg: activity.avgHeartRate,
        distanceLabel: activity.distanceM ? `${(activity.distanceM / 1000).toFixed(1)} km` : undefined,
        iconOverride: activity.icon,
        colorOverride: activity.color,
      });
    });

    return list.sort((a, b) => a.time - b.time);
  }, [sleep, activitySessions, manualEntries, unifiedActivities, todayNaps]);

  // Kinds that get the metrics chip row instead of plain detail text
  const isMetricKind = (kind: TimelineEventKind) =>
    kind === 'activity' || kind === 'recovery' || kind === 'manual_activity' || kind === 'strava_activity' || kind === 'nap';

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{t('timeline.header')}</Text>
      <View style={styles.timeline}>
        {events.map((event, index) => {
          const cfg = EVENT_CONFIG[event.kind];
          const isLast = index === events.length - 1;

          let iconName = event.iconOverride || cfg.icon;
          const iconColor = event.colorOverride || cfg.color;
          if (event.kind === 'recovery') {
            const entry = manualEntries.find((e) => e.id === event.id);
            if (entry) iconName = recoveryIcon(entry.subtype);
          }

          // Time range string for the header row (activity/recovery with endTime)
          const timeRangeStr =
            isMetricKind(event.kind) && event.endTime
              ? `${formatTime(event.time)} → ${formatTime(event.endTime)}`
              : formatTime(event.time);

          return (
            <View key={event.id} style={styles.row}>
              {/* Left column: connector line + icon */}
              <View style={styles.leftCol}>
                {(!isLast || onAddPress) && <View style={styles.connectorLine} />}
                <View style={[styles.iconCircle, { borderColor: iconColor }]}>
                  <Ionicons name={iconName as any} size={14} color={iconColor} />
                </View>
              </View>

              {/* Right column: time label above bubble */}
              <View style={styles.entryOuter}>
                <Text style={[styles.entryTime, { color: iconColor }]}>{timeRangeStr}</Text>
                <View style={styles.entryBubble}>
                  <View style={styles.eventRow}>
                    <Text style={styles.eventLabel}>{event.label}</Text>
                  </View>

                  {/* Metrics chips for activity/recovery/manual_activity */}
                  {isMetricKind(event.kind) ? (
                    <MetricsRow event={event} accentColor={iconColor} />
                  ) : (
                    event.detail && (
                      <Text style={styles.eventDetail}>{event.detail}</Text>
                    )
                  )}
                </View>
              </View>
            </View>
          );
        })}

        {/* Add entry row */}
        {onAddPress && (
          <Pressable style={styles.row} onPress={onAddPress}>
            <View style={styles.leftCol}>
              <View style={styles.addCircle}>
                <Ionicons name="add-outline" size={14} color="rgba(255,255,255,0.4)" />
              </View>
            </View>
            <View style={styles.entryOuter}>
              <View style={[styles.entryBubble, styles.addBubble]}>
                <Text style={styles.addLabel}>{t('timeline.button_add')}</Text>
              </View>
            </View>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // No background, border, or padding — entries carry their own bubbles
  },
  header: {
    color: '#FFFFFF',
    fontSize: fontSize.lg,
    fontFamily: fontFamily.demiBold,
    marginBottom: spacing.md,
  },
  timeline: {
    gap: 0,
  },
  row: {
    flexDirection: 'row',
    // paddingBottom creates the gap between entries while keeping leftCol
    // tall enough for the connector to span all the way to the next icon
    paddingBottom: spacing.xl,
  },
  leftCol: {
    width: 32,
    alignItems: 'center',
    position: 'relative',
  },
  connectorLine: {
    position: 'absolute',
    top: 34,          // just below icon bottom (marginTop:4 + height:30)
    bottom: -spacing.xl, // extends through paddingBottom gap into next row
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
    left: 15,
  },
  iconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  entryOuter: {
    flex: 1,
    marginLeft: spacing.md,
  },
  entryTime: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    marginBottom: 4,
    marginLeft: 2,
    opacity: 0.8,
  },
  entryBubble: {
    backgroundColor: '#222222',
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  addBubble: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderStyle: 'dashed',
  },
  eventRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eventLabel: {
    color: '#FFFFFF',
    fontSize: fontSize.md,
    fontFamily: fontFamily.demiBold,
    flex: 1,
  },
  eventDetail: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    marginTop: 2,
  },
  addCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  addLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
  },
});
