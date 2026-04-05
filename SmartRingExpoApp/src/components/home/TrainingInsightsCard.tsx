import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { GlassCard } from './GlassCard';
import { colors, spacing, fontSize, fontFamily, borderRadius } from '../../theme/colors';
import { formatSleepDuration } from '../../utils/ringData/sleep';
import { deriveTrainingInsights, type ZoneEntry } from '../../utils/activity/trainingInsights';
import { UnifiedActivity } from '../../types/activity.types';
import { StravaActivitySummary } from '../../types/strava.types';

interface TrainingInsightsCardProps {
  unifiedActivities: UnifiedActivity[];
  stravaActivities: StravaActivitySummary[];
}

const ZONE_SHORT = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'];

const ZONE_I18N_KEYS = [
  'strava_detail.zone_z1',
  'strava_detail.zone_z2',
  'strava_detail.zone_z3',
  'strava_detail.zone_z4',
  'strava_detail.zone_z5',
] as const;

// --- Donut chart helpers ---

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  // Clamp sweep to avoid degenerate paths
  const sweep = Math.min(endDeg - startDeg, 359.99);
  const end = polarToCartesian(cx, cy, r, startDeg + sweep);
  const start = polarToCartesian(cx, cy, r, startDeg);
  const largeArc = sweep > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

function DonutChart({ zones, dominant }: { zones: ZoneEntry[]; dominant: number }) {
  const SIZE = 64;
  const STROKE = 10;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const r = (SIZE - STROKE) / 2;

  let cursor = -90; // start at 12 o'clock
  const paths: React.ReactElement[] = [];

  for (let i = zones.length - 1; i >= 0; i--) {
    const z = zones[i];
    if (z.percentage <= 0) continue;
    const sweep = (z.percentage / 100) * 360;
    const d = describeArc(cx, cy, r, cursor, cursor + sweep);
    cursor += sweep;
    paths.push(
      <Path
        key={z.zoneIndex}
        d={d}
        stroke={z.color}
        strokeWidth={STROKE}
        strokeLinecap="butt"
        fill="none"
        opacity={z.zoneIndex === dominant ? 1 : 0.45}
      />,
    );
  }

  // If no data, draw a gray ring
  if (paths.length === 0) {
    paths.push(
      <Path
        key="empty"
        d={describeArc(cx, cy, r, -90, 269.99)}
        stroke="rgba(255,255,255,0.1)"
        strokeWidth={STROKE}
        fill="none"
      />,
    );
  }

  return (
    <Svg width={SIZE} height={SIZE}>
      <G>{paths}</G>
    </Svg>
  );
}

// --- BPM range label ---
function bpmRangeLabel(zone: ZoneEntry, isFirst: boolean, isLast: boolean): string {
  if (isLast) return `>${zone.bpmMin} bpm`;
  if (isFirst) return `<${zone.bpmMax + 1} bpm`;
  return `${zone.bpmMin} - ${zone.bpmMax} bpm`;
}

// --- Main component ---

export function TrainingInsightsCard({ unifiedActivities, stravaActivities }: TrainingInsightsCardProps) {
  const { t } = useTranslation();

  const insights = useMemo(
    () => deriveTrainingInsights(unifiedActivities, stravaActivities),
    [unifiedActivities, stravaActivities],
  );

  const { weeklyStats, zoneSummary, sportBreakdown, overflowCount, hasData } = insights;
  const { zones, totalSeconds, hasExactData, dominantZoneIndex } = zoneSummary;

  // Zones displayed Z5→Z1 (descending)
  const reversedZones = [...zones].reverse();

  const dominantZone = zones[dominantZoneIndex];
  const dominantPct = Math.round(dominantZone?.percentage ?? 0);
  const dominantName = t(ZONE_I18N_KEYS[dominantZoneIndex] ?? 'strava_detail.zone_z1');

  return (
    <GlassCard style={styles.card}>
      {!hasData ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{t('training_insights.no_data')}</Text>
        </View>
      ) : (
        <>
          {/* Weekly summary */}
          <View style={styles.statsRow}>
            <View style={styles.statCol}>
              <Text style={styles.statValue}>{weeklyStats.sessionCount}</Text>
              <Text style={styles.statLabel}>{t('training_insights.sessions')}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statValue}>
                {formatSleepDuration(Math.round(weeklyStats.totalDurationSec / 60))}
              </Text>
              <Text style={styles.statLabel}>{t('training_insights.time')}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statValue}>
                {(weeklyStats.totalDistanceM / 1000).toFixed(1)}{' '}
                <Text style={styles.statUnit}>km</Text>
              </Text>
              <Text style={styles.statLabel}>{t('training_insights.distance')}</Text>
            </View>
          </View>

          {/* HR Zones */}
          <View style={styles.sectionDivider} />
          <View style={styles.section}>
            {/* Header */}
            <Text style={styles.zoneHeaderTitle}>
              {totalSeconds > 0
                ? t('training_insights.dominant_zone', { pct: dominantPct, zone: dominantName })
                : t('strava_detail.section_hr_zones')}
            </Text>
            <Text style={styles.zoneHeaderSubtitle}>{t('training_insights.past_7_days')}</Text>

            {/* Body: donut + bar rows */}
            <View style={styles.zoneBody}>
              {/* Donut */}
              <View style={styles.zoneDonutCol}>
                <DonutChart zones={zones} dominant={dominantZoneIndex} />
              </View>

              {/* Bar rows Z5→Z1 */}
              <View style={styles.zoneRowsCol}>
                {reversedZones.map((z, idx) => {
                  const isDominant = z.zoneIndex === dominantZoneIndex && totalSeconds > 0;
                  const pct = Math.round(z.percentage);
                  const isFirst = z.zoneIndex === 0;
                  const isLast = z.zoneIndex === 4;
                  return (
                    <View key={z.zoneIndex} style={[styles.zoneRow, idx > 0 && styles.zoneRowGap]}>
                      <Text style={[styles.zoneRowLabel, { color: z.color, opacity: isDominant ? 1 : 0.55 }]}>
                        {ZONE_SHORT[z.zoneIndex]}
                      </Text>
                      <View style={styles.zoneBarTrack}>
                        {z.percentage > 0 && (
                          <View
                            style={[
                              styles.zoneBarFill,
                              {
                                width: `${z.percentage}%` as any,
                                backgroundColor: z.color,
                                opacity: isDominant ? 1 : 0.45,
                              },
                            ]}
                          />
                        )}
                        {z.percentage === 0 && (
                          <View style={[styles.zoneBarFill, { width: 3, backgroundColor: z.color, opacity: 0.3 }]} />
                        )}
                      </View>
                      <Text style={[styles.zoneRowPct, isDominant && styles.zoneRowPctDominant]}>
                        {pct}%
                      </Text>
                      <Text style={styles.zoneRowBpm}>
                        {bpmRangeLabel(z, isFirst, isLast)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {!hasExactData && totalSeconds > 0 && (
              <Text style={styles.estimatedCaption}>
                {t('training_insights.zones_estimated')}
              </Text>
            )}
          </View>

          {/* Sport breakdown */}
          {sportBreakdown.length > 0 && (
            <>
              <View style={styles.sectionDivider} />
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>{t('training_insights.sports')}</Text>
                <View style={styles.chipsRow}>
                  {sportBreakdown.map((s) => (
                    <View
                      key={s.sportType}
                      style={[styles.chip, { backgroundColor: `${s.color}20`, borderColor: `${s.color}40` }]}
                    >
                      <View style={[styles.chipDot, { backgroundColor: s.color }]} />
                      <Text style={[styles.chipText, { color: s.color }]}>
                        {s.sportType} · {formatSleepDuration(Math.round(s.durationSec / 60))}
                      </Text>
                    </View>
                  ))}
                  {overflowCount > 0 && (
                    <View style={[styles.chip, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }]}>
                      <Text style={[styles.chipText, { color: colors.textSecondary }]}>
                        +{overflowCount}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </>
          )}
        </>
      )}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: spacing.md,
    paddingHorizontal: 0,
  },
  emptyState: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontFamily: fontFamily.regular,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  statValue: {
    fontSize: fontSize.lg,
    color: colors.text,
    fontFamily: fontFamily.demiBold,
    marginBottom: 2,
  },
  statUnit: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontFamily: fontFamily.regular,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontFamily: fontFamily.regular,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  section: {
    paddingHorizontal: spacing.lg,
  },
  sectionLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontFamily: fontFamily.regular,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  // Zone header
  zoneHeaderTitle: {
    fontSize: fontSize.xl,
    color: colors.text,
    fontFamily: fontFamily.demiBold,
    marginBottom: 2,
  },
  zoneHeaderSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontFamily: fontFamily.regular,
    marginBottom: spacing.md,
  },
  // Zone body
  zoneBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  zoneDonutCol: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneRowsCol: {
    flex: 1,
  },
  zoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  zoneRowGap: {
    marginTop: 7,
  },
  zoneRowLabel: {
    width: 22,
    fontSize: fontSize.xs,
    fontFamily: fontFamily.demiBold,
    textAlign: 'left',
  },
  zoneBarTrack: {
    flex: 1,
    height: 10,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  zoneBarFill: {
    height: '100%',
    borderRadius: borderRadius.sm,
  },
  zoneRowPct: {
    width: 28,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontFamily: fontFamily.regular,
    textAlign: 'right',
  },
  zoneRowPctDominant: {
    color: colors.text,
    fontFamily: fontFamily.demiBold,
  },
  zoneRowBpm: {
    width: 72,
    fontSize: 10,
    color: colors.textMuted,
    fontFamily: fontFamily.regular,
    textAlign: 'right',
  },
  estimatedCaption: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontFamily: fontFamily.regular,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    gap: 4,
  },
  chipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  chipText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
  },
});
