import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GlassCard } from './GlassCard';
import { colors, spacing, fontSize, fontFamily, borderRadius } from '../../theme/colors';
import { formatSleepDuration } from '../../utils/ringData/sleep';
import { deriveTrainingInsights } from '../../utils/activity/trainingInsights';
import { UnifiedActivity } from '../../types/activity.types';
import { StravaActivitySummary } from '../../types/strava.types';

interface TrainingInsightsCardProps {
  unifiedActivities: UnifiedActivity[];
  stravaActivities: StravaActivitySummary[];
}

const ZONE_I18N_KEYS = [
  'strava_detail.zone_z1',
  'strava_detail.zone_z2',
  'strava_detail.zone_z3',
  'strava_detail.zone_z4',
  'strava_detail.zone_z5',
] as const;

export function TrainingInsightsCard({ unifiedActivities, stravaActivities }: TrainingInsightsCardProps) {
  const { t } = useTranslation();

  const insights = useMemo(
    () => deriveTrainingInsights(unifiedActivities, stravaActivities),
    [unifiedActivities, stravaActivities],
  );

  const { weeklyStats, zoneSummary, sportBreakdown, overflowCount, hasData } = insights;

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
          {zoneSummary.zones.length > 0 && zoneSummary.totalSeconds > 0 && (
            <>
              <View style={styles.sectionDivider} />
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>{t('strava_detail.section_hr_zones')}</Text>

                {/* Segmented bar */}
                <View style={styles.zoneBar}>
                  {zoneSummary.zones.map((z) => (
                    <View
                      key={z.zoneIndex}
                      style={[
                        styles.zoneSegment,
                        {
                          flex: z.seconds / zoneSummary.totalSeconds,
                          backgroundColor: z.color,
                        },
                      ]}
                    />
                  ))}
                </View>

                {/* Legend */}
                <View style={styles.zoneLegend}>
                  {zoneSummary.zones.map((z) => (
                    <View key={z.zoneIndex} style={styles.zoneLegendItem}>
                      <View style={[styles.zoneDot, { backgroundColor: z.color }]} />
                      <Text style={styles.zoneLegendText}>
                        {t(ZONE_I18N_KEYS[z.zoneIndex])}
                      </Text>
                      <Text style={styles.zoneLegendTime}>
                        {Math.round(z.seconds / 60)}m
                      </Text>
                    </View>
                  ))}
                </View>

                {!zoneSummary.hasExactData && (
                  <Text style={styles.estimatedCaption}>
                    {t('training_insights.zones_estimated')}
                  </Text>
                )}
              </View>
            </>
          )}

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
  zoneBar: {
    height: 8,
    borderRadius: borderRadius.sm,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  zoneSegment: {
    height: '100%',
  },
  zoneLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  zoneLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  zoneDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  zoneLegendText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontFamily: fontFamily.regular,
  },
  zoneLegendTime: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontFamily: fontFamily.regular,
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
