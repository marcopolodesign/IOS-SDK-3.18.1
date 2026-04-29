import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { fontFamily, fontSize, borderRadius, spacing } from '../../theme/colors';
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

function formatPace(paceMinsPerKm: number): string {
  const mins = Math.floor(paceMinsPerKm);
  const secs = String(Math.round((paceMinsPerKm % 1) * 60)).padStart(2, '0');
  return `${mins}:${secs}/km`;
}

function useBodyText() {
  const { t } = useTranslation();
  return (lastRun: LastRunContext): string => {
    const pace = formatPace(lastRun.paceMinsPerKm);
    const avgHR = Math.round(lastRun.avgHR);
    const low = lastRun.hrRangeLow;
    const high = lastRun.hrRangeHigh;
    if (lastRun.effortVerdict === 'harder_than_expected') {
      return t('last_run.body_harder', { pace, avgHR, low, high });
    }
    if (lastRun.effortVerdict === 'easier_than_expected') {
      return t('last_run.body_easier', { pace, avgHR, low, high });
    }
    return t('last_run.body_as_expected', { pace, avgHR, low, high });
  };
}

export function LastRunContextCard({ lastRun, isLoading, hasStrava }: LastRunContextCardProps) {
  const { t } = useTranslation();
  const formatRunDate = useFormatRunDate();
  const verdictLabel = useVerdictLabel();
  const buildBodyText = useBodyText();

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
          <Text style={styles.titleRow} numberOfLines={2}>
            <Text style={styles.titleBold}>{t('last_run.card_title')}</Text>
            {!isLoading && lastRun != null && (
              <Text style={styles.titleMeta}>{`  ·  ${lastRun.distanceKm.toFixed(1)} km  ·  ${formatRunDate(lastRun.runDate)}  ·  ${verdictLabel(lastRun.effortVerdict)}`}</Text>
            )}
          </Text>
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
              <Text style={styles.explanation}>{buildBodyText(lastRun)}</Text>
              <TouchableOpacity
                style={styles.coachChip}
                onPress={() => router.push({
                  pathname: '/(tabs)/settings/chat',
                  params: { q: `Tell me more about my last run — ${lastRun.explanation}` },
                })}
                activeOpacity={0.7}
              >
                <Text style={styles.coachChipText}>{t('last_run.talk_through')}</Text>
                <Ionicons name="arrow-forward" size={13} color="rgba(255,255,255,0.55)" />
              </TouchableOpacity>
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
  titleRow: {
    flex: 1,
    flexShrink: 1,
    paddingRight: 8,
  },
  titleBold: {
    color: '#FFFFFF',
    fontFamily: fontFamily.demiBold,
    fontSize: 18,
    letterSpacing: 0.2,
  },
  titleMeta: {
    color: 'rgba(255,255,255,0.5)',
    fontFamily: fontFamily.regular,
    fontSize: 13,
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: 8,
  },
  explanation: {
    fontFamily: fontFamily.regular,
    fontSize: 17,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 26,
  },
  coachChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  coachChipText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.55)',
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
