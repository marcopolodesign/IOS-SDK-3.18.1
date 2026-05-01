import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
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
  const formatRunDate = useFormatRunDate();
  return (lastRun: LastRunContext): string => {
    const pace = formatPace(lastRun.paceMinsPerKm);
    const avgHR = Math.round(lastRun.avgHR);
    const low = lastRun.hrRangeLow;
    const high = lastRun.hrRangeHigh;
    const distance = lastRun.distanceKm.toFixed(1);
    const date = formatRunDate(lastRun.runDate);
    if (lastRun.effortVerdict === 'harder_than_expected') {
      return t('last_run.body_harder', { pace, avgHR, low, high, distance, date });
    }
    if (lastRun.effortVerdict === 'easier_than_expected') {
      return t('last_run.body_easier', { pace, avgHR, low, high, distance, date });
    }
    return t('last_run.body_as_expected', { pace, avgHR, low, high, distance, date });
  };
}

const EFFORT_LABEL: Record<EffortVerdict, string> = {
  as_expected: 'as expected',
  harder_than_expected: 'harder than expected',
  easier_than_expected: 'easier than expected',
};

function buildRunAnalysisQuery(lastRun: LastRunContext): string {
  const pace = formatPace(lastRun.paceMinsPerKm);
  const readiness = lastRun.bodyStateAtRun.readinessScore != null
    ? `${lastRun.bodyStateAtRun.readinessScore}/100`
    : 'unknown';
  const sleep = lastRun.bodyStateAtRun.sleepMinutes != null
    ? `${lastRun.bodyStateAtRun.sleepMinutes} min`
    : 'unknown';
  const hrv = lastRun.bodyStateAtRun.hrvVsNorm ?? 'unknown';

  return (
    `Analyze my last run:\n\n` +
    `Activity: ${lastRun.runName} — ${lastRun.runDate.slice(0, 10)}\n` +
    `Distance: ${lastRun.distanceKm.toFixed(1)} km | Pace: ${pace} | Avg HR: ${Math.round(lastRun.avgHR)} bpm\n` +
    `Effort: ${EFFORT_LABEL[lastRun.effortVerdict]} (expected HR ${lastRun.hrRangeLow}–${lastRun.hrRangeHigh} bpm)\n\n` +
    `Body state that day:\n` +
    `- Readiness: ${readiness}\n` +
    `- Sleep: ${sleep}\n` +
    `- HRV vs baseline: ${hrv}\n\n` +
    `Give me a thorough post-run analysis: how did my biometric state affect this run, was the effort level appropriate given my recovery, what does this tell me about my current fitness and training load? Also factor in weather conditions (temperature, wind) for that date if relevant.`
  );
}

export function LastRunContextCard({ lastRun, isLoading, hasStrava }: LastRunContextCardProps) {
  const { t } = useTranslation();
  const buildBodyText = useBodyText();

  return (
    <View style={styles.glowWrap}>
      <Pressable
        onPress={() => {
          router.push({ pathname: '/chat', params: { q: buildRunAnalysisQuery(lastRun!), mode: 'coach', activityId: String(lastRun!.stravaActivityId) } });
        }}
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

        <View style={styles.body}>
          {isLoading ? (
            <>
              <View style={[styles.skeleton, { width: '50%', marginBottom: 6 }]} />
              <View style={[styles.skeleton, { width: '75%' }]} />
            </>
          ) : !hasStrava && lastRun == null ? (
            <View style={styles.noStravaBody}>
              <Text style={styles.emptyText}>{t('last_run.no_strava')}</Text>
              <Pressable
                style={styles.ctaButton}
                onPress={() => router.push('/(tabs)/coach/strava')}
              >
                <Text style={styles.ctaText}>{t('last_run.connect_strava')}</Text>
              </Pressable>
            </View>
          ) : lastRun == null ? (
            <Text style={styles.emptyText}>{t('last_run.no_runs')}</Text>
          ) : (
            <Text style={styles.explanation}>{buildBodyText(lastRun)}</Text>
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
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    gap: 8,
  },
  explanation: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 22,
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
