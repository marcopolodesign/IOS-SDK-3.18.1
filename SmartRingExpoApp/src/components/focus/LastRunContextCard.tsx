import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { GradientInfoCard } from '../common/GradientInfoCard';
import { colors, fontFamily, fontSize, borderRadius } from '../../theme/colors';
import type { LastRunContext, EffortVerdict } from '../../types/focus.types';

interface LastRunContextCardProps {
  lastRun: LastRunContext | null;
  isLoading: boolean;
  hasStrava: boolean;
}

function RunIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
        stroke="#FFB84D"
        strokeWidth={1.8}
        fill="rgba(255,184,77,0.2)"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function useFormatRunDate() {
  const { t } = useTranslation();
  return (iso: string): string => {
    const d = new Date(iso);
    const now = new Date();
    const diffDays = Math.round((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return t('last_run.date_today');
    if (diffDays === 1) return t('last_run.date_yesterday');
    if (diffDays < 7) return t('last_run.date_days_ago', { days: diffDays });
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };
}

function formatPace(minsPerKm: number): string {
  const mins = Math.floor(minsPerKm);
  const secs = Math.round((minsPerKm % 1) * 60);
  return `${mins}:${String(secs).padStart(2, '0')}/km`;
}

function useVerdictLabel() {
  const { t } = useTranslation();
  return (v: EffortVerdict): string => {
    if (v === 'harder_than_expected') return t('last_run.verdict_harder');
    if (v === 'easier_than_expected') return t('last_run.verdict_easier');
    return t('last_run.verdict_expected');
  };
}

function verdictColor(v: EffortVerdict): string {
  if (v === 'harder_than_expected') return colors.warning;
  if (v === 'easier_than_expected') return colors.success;
  return colors.info;
}

export function LastRunContextCard({ lastRun, isLoading, hasStrava }: LastRunContextCardProps) {
  const { t } = useTranslation();
  const formatRunDate = useFormatRunDate();
  const verdictLabel = useVerdictLabel();
  const [expanded, setExpanded] = useState(false);

  return (
    <GradientInfoCard
      icon={<RunIcon />}
      title={t('last_run.card_title')}
      headerValue={lastRun ? `${lastRun.distanceKm.toFixed(1)} km` : undefined}
      headerSubtitle={lastRun ? formatRunDate(lastRun.runDate) : undefined}
      showArrow={false}
      gradientStops={[
        { offset: 0, color: '#3D2200', opacity: 1 },
        { offset: 0.6, color: '#3D2200', opacity: 0 },
      ]}
      gradientCenter={{ x: 0.5, y: -0.5 }}
      gradientRadii={{ rx: '100%', ry: '250%' }}
      headerRight={
        lastRun != null ? (
          <TouchableOpacity onPress={() => setExpanded(v => !v)} hitSlop={12}>
            <Text style={styles.chevron}>{expanded ? '∧' : '∨'}</Text>
          </TouchableOpacity>
        ) : undefined
      }
    >
      {isLoading ? (
        <>
          <View style={[styles.skeleton, { width: '50%', marginBottom: 6 }]} />
          <View style={[styles.skeleton, { width: '75%' }]} />
        </>
      ) : !hasStrava && lastRun == null ? (
        <View style={styles.noStravaBody}>
          <Text style={styles.emptyText}>{t('last_run.no_strava')}</Text>
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={() => router.push('/(tabs)/settings/strava')}
            activeOpacity={0.7}
          >
            <Text style={styles.ctaText}>{t('last_run.connect_strava')}</Text>
          </TouchableOpacity>
        </View>
      ) : lastRun == null ? (
        <>
          <Text style={styles.emptyText}>{t('last_run.no_runs')}</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/settings/strava')} hitSlop={8}>
            <Text style={styles.viewStravaLink}>{t('last_run.view_strava')} →</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          {/* Run summary row */}
          <View style={styles.runRow}>
            <Text style={styles.runName}>{lastRun.runName}</Text>
            <Text style={styles.runPace}>{formatPace(lastRun.paceMinsPerKm)}</Text>
          </View>

          {/* Verdict badge */}
          <View style={[styles.verdictBadge, { backgroundColor: verdictColor(lastRun.effortVerdict) + '22', borderColor: verdictColor(lastRun.effortVerdict) + '55' }]}>
            <Text style={[styles.verdictText, { color: verdictColor(lastRun.effortVerdict) }]}>
              {verdictLabel(lastRun.effortVerdict)}
            </Text>
          </View>

          {/* Always-visible explanation + HR comparison */}
          <Text style={styles.explanation}>"{lastRun.explanation}"</Text>
          <Text style={styles.hrComparison}>
            {t('last_run.hr_comparison', {
              actual: Math.round(lastRun.avgHR),
              expected: Math.round(lastRun.expectedHR),
            })}
          </Text>

          {/* Expanded body state (sleep score + HRV rows) */}
          {expanded && (
            <View style={styles.expandedSection}>
              <Text style={styles.sectionHeading}>{t('last_run.body_state')}</Text>
              <View style={styles.bodyStateRow}>
                <Text style={styles.bodyStateLabel}>{t('last_run.sleep_score')}</Text>
                <Text style={styles.bodyStateValue}>
                  {lastRun.bodyStateAtRun.sleepScore != null ? String(lastRun.bodyStateAtRun.sleepScore) : '--'}
                </Text>
              </View>
              <View style={styles.bodyStateRow}>
                <Text style={styles.bodyStateLabel}>{t('last_run.hrv_vs_norm')}</Text>
                <Text style={styles.bodyStateValue}>
                  {lastRun.bodyStateAtRun.hrvVsNorm ?? '--'}
                </Text>
              </View>
            </View>
          )}

          {/* View Strava link */}
          <TouchableOpacity onPress={() => router.push('/(tabs)/settings/strava')} hitSlop={8}>
            <Text style={styles.viewStravaLink}>{t('last_run.view_strava')} →</Text>
          </TouchableOpacity>
        </>
      )}
    </GradientInfoCard>
  );
}

const styles = StyleSheet.create({
  chevron: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: 'rgba(255,255,255,0.45)',
  },
  runRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  runName: {
    fontFamily: fontFamily.demiBold,
    fontSize: fontSize.md,
    color: '#FFFFFF',
  },
  runPace: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.5)',
  },
  verdictBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  verdictText: {
    fontFamily: fontFamily.demiBold,
    fontSize: fontSize.xs,
    letterSpacing: 0.5,
  },
  expandedSection: {
    gap: 6,
    marginTop: 4,
  },
  sectionHeading: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  bodyStateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bodyStateLabel: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: 'rgba(255,255,255,0.5)',
  },
  bodyStateValue: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: '#FFFFFF',
  },
  explanation: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.45)',
    fontStyle: 'italic',
    lineHeight: 20,
    marginTop: 4,
  },
  hrComparison: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 2,
  },
  viewStravaLink: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.primary,
    marginTop: 10,
    opacity: 0.85,
  },
  noStravaBody: {
    gap: 10,
  },
  emptyText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.35)',
  },
  ctaButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: borderRadius.sm,
  },
  ctaText: {
    fontFamily: fontFamily.demiBold,
    fontSize: fontSize.sm,
    color: colors.textInverse,
  },
  skeleton: {
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
});
