import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, fontFamily, fontSize, borderRadius, spacing } from '../../theme/colors';
import type { LastRunContext, EffortVerdict } from '../../types/focus.types';

interface LastRunContextCardProps {
  lastRun: LastRunContext | null;
  isLoading: boolean;
  hasStrava: boolean;
}

function useFormatRunDate() {
  const { t } = useTranslation();
  return (iso: string): string => {
    const runDate = iso.slice(0, 10);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const localToday = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const yest = new Date(now.getTime() - 86400000);
    const localYesterday = `${yest.getFullYear()}-${pad(yest.getMonth() + 1)}-${pad(yest.getDate())}`;

    if (runDate === localToday) return t('last_run.date_today');
    if (runDate === localYesterday) return t('last_run.date_yesterday');
    const runNoon = new Date(`${runDate}T12:00:00`);
    const daysAgo = Math.round((now.getTime() - runNoon.getTime()) / 86400000);
    if (daysAgo < 7) return t('last_run.date_days_ago', { days: daysAgo });
    return runNoon.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };
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
  const titleSub = lastRun
    ? `${lastRun.distanceKm.toFixed(1)} km · ${formatRunDate(lastRun.runDate)} • ${verdictLabel(lastRun.effortVerdict)}`
    : null;

  return (
    <View style={styles.glowWrap}>
      <Pressable
        onPress={() => lastRun != null
          ? router.push({ pathname: '/(tabs)/coach/strava-detail', params: { id: String(lastRun.stravaActivityId) } })
          : undefined
        }
        disabled={lastRun == null || isLoading}
        style={({ pressed }) => [styles.card, pressed && lastRun != null && styles.cardPressed]}
      >
        {/* Glassmorphic blur base */}
        <BlurView intensity={50} tint="systemUltraThinMaterialDark" style={StyleSheet.absoluteFill} />

        {/* Edge glow — 4 linear fades */}
        <LinearGradient colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.edgeLeft} pointerEvents="none" />
        <LinearGradient colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']} start={{ x: 1, y: 0 }} end={{ x: 0, y: 0 }} style={styles.edgeRight} pointerEvents="none" />
        <LinearGradient colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.edgeTop} pointerEvents="none" />
        <LinearGradient colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 1 }} end={{ x: 0, y: 0 }} style={styles.edgeBottom} pointerEvents="none" />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>{t('last_run.card_title')}</Text>
            {!isLoading && titleSub != null && (
              <Text style={styles.titleSub}>{titleSub}</Text>
            )}
          </View>
          <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.55)" />
        </View>

        {/* Body */}
        <View style={styles.body}>
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
                onPress={() => router.push('/(tabs)/coach/strava')}
                activeOpacity={0.7}
              >
                <Text style={styles.ctaText}>{t('last_run.connect_strava')}</Text>
              </TouchableOpacity>
            </View>
          ) : lastRun == null ? (
            <Text style={styles.emptyText}>{t('last_run.no_runs')}</Text>
          ) : (
            <>
              <Text style={styles.explanation}>"{lastRun.explanation}"</Text>
              <Text style={styles.hrComparison}>
                {t('last_run.hr_comparison', {
                  actual: Math.round(lastRun.avgHR),
                  expected: Math.round(lastRun.expectedHR),
                })}
              </Text>
            </>
          )}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  glowWrap: {
    borderRadius: 20,
    shadowColor: 'rgba(255,255,255,0.6)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
  },
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  cardPressed: {
    opacity: 0.82,
  },
  edgeLeft: {
    position: 'absolute', top: 0, left: 0, bottom: 0, width: '15%',
  },
  edgeRight: {
    position: 'absolute', top: 0, right: 0, bottom: 0, width: '15%',
  },
  edgeTop: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '15%',
  },
  edgeBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: '15%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  titleBlock: {
    flex: 1,
    gap: 3,
  },
  title: {
    color: '#FFFFFF',
    fontFamily: fontFamily.demiBold,
    fontSize: 22,
    letterSpacing: 0.2,
  },
  titleSub: {
    color: 'rgba(255,255,255,0.55)',
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 17,
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: 8,
  },



  explanation: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.7)',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  hrComparison: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.45)',
  },

  noStravaBody: {
    gap: 10,
  },
  emptyText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.7)',
  },
  ctaButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: borderRadius.sm,
  },
  ctaText: {
    fontFamily: fontFamily.demiBold,
    fontSize: fontSize.sm,
    color: '#000000',
  },
  skeleton: {
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
});
