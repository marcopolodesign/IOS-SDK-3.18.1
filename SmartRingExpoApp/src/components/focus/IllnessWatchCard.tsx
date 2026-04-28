import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { colors, fontFamily, fontSize, spacing } from '../../theme/colors';
import type { IllnessWatch, IllnessStatus } from '../../types/focus.types';

interface IllnessWatchCardProps {
  illness: IllnessWatch | null;
  isLoading: boolean;
}

export function statusColor(status: IllnessStatus): string {
  if (status === 'CLEAR') return colors.success;
  if (status === 'WATCH') return colors.warning;
  return colors.error;
}

function borderGradient(status: IllnessStatus): readonly [string, string, string, string] {
  if (status === 'CLEAR') return ['#00D4AA', '#00B8D4', '#4488FF', '#00D4AA'];
  if (status === 'WATCH') return ['#FFB84D', '#FF8C42', '#FFD166', '#FFB84D'];
  return ['#FF6B6B', '#C9184A', '#FF8FA3', '#FF6B6B'];
}

export type Severity = 'normal' | 'mild' | 'moderate' | 'severe';

export function getSeverity(subScore: number, weight: number): Severity {
  if (subScore <= 0) return 'normal';
  const pct = subScore / weight;
  if (pct >= 0.9) return 'severe';
  if (pct >= 0.55) return 'moderate';
  return 'mild';
}

export function severityColor(s: Severity): string {
  if (s === 'normal') return colors.success;
  if (s === 'mild') return '#FFD166';
  if (s === 'moderate') return '#FF8C42';
  return colors.error;
}

export function SeverityPill({ severity, label }: { severity: Severity; label: string }) {
  if (severity === 'normal') {
    return (
      <View style={[styles.pill, styles.pillNormal]}>
        <Text style={[styles.pillText, styles.pillTextNormal]}>{label}</Text>
      </View>
    );
  }
  const bg = severityColor(severity) + '28';
  const border = severityColor(severity) + '66';
  const text = severityColor(severity);
  return (
    <View style={[styles.pill, { backgroundColor: bg, borderColor: border }]}>
      <Text style={[styles.pillText, { color: text }]}>{label}</Text>
    </View>
  );
}

function SignalRow({
  label,
  magnitude,
  severity,
}: {
  label: string;
  magnitude: string | null;
  severity: Severity;
}) {
  const { t } = useTranslation();
  const severityLabel = t(`illness_watch.severity_${severity}`);
  return (
    <View style={styles.signalRow}>
      <Text style={styles.signalLabel}>{label}</Text>
      {magnitude != null && severity !== 'normal' ? (
        <Text style={styles.signalMagnitude}>{magnitude}</Text>
      ) : null}
      <SeverityPill severity={severity} label={severityLabel} />
    </View>
  );
}

export function IllnessWatchCard({ illness, isLoading }: IllnessWatchCardProps) {
  const { t } = useTranslation();

  const status = illness?.status ?? 'CLEAR';
  const score = illness?.score ?? 0;
  const collarColor = statusColor(status);

  const nhrSeverity: Severity = illness
    ? (illness.signals.restingHRElevated ? getSeverityFromDelta(illness.details.hrDelta) : 'normal')
    : 'normal';
  const hrvSeverity: Severity = illness
    ? (illness.signals.hrvSuppressed ? getSeverityFromDelta(illness.details.hrvDelta) : 'normal')
    : 'normal';
  const spo2Severity: Severity = illness
    ? (illness.signals.spo2Low ? 'moderate' : 'normal')
    : 'normal';
  const tempSeverity: Severity = illness
    ? (illness.signals.tempDeviation ? getSeverityFromDelta(illness.details.tempDelta) : 'normal')
    : 'normal';
  const sleepSeverity: Severity = illness
    ? (illness.signals.sleepFragmented ? 'mild' : 'normal')
    : 'normal';

  const canNavigate = !isLoading && illness != null;

  return (
    <View style={[styles.glowWrap, { shadowColor: collarColor }]}>
      <LinearGradient
        colors={borderGradient(status)}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBorder}
      >
      <Pressable
        onPress={() => router.push('/(tabs)/coach/illness-detail')}
        disabled={!canNavigate}
        style={({ pressed }) => [styles.card, pressed && canNavigate && styles.cardPressed]}
      >
      {/* Glassmorphic blur base */}
      <BlurView intensity={20} tint="systemUltraThinMaterialDark" style={StyleSheet.absoluteFill} />

      {/* Subtle inward color bleed from each edge */}
      <LinearGradient colors={[collarColor + '80', collarColor + '00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.edgeLeft} pointerEvents="none" />
      <LinearGradient colors={[collarColor + '80', collarColor + '00']} start={{ x: 1, y: 0 }} end={{ x: 0, y: 0 }} style={styles.edgeRight} pointerEvents="none" />
      <LinearGradient colors={[collarColor + '80', collarColor + '00']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.edgeTop} pointerEvents="none" />
      <LinearGradient colors={[collarColor + '80', collarColor + '00']} start={{ x: 0, y: 1 }} end={{ x: 0, y: 0 }} style={styles.edgeBottom} pointerEvents="none" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{t('illness_watch.card_title')}</Text>
          {!isLoading && illness != null && (
            <Text style={styles.titleSub}>{illness.summary}</Text>
          )}
        </View>
        <View style={styles.headerRight}>
          {!isLoading && (
            <>
              {score > 0 && (
                <Text style={styles.scoreText}>{score}</Text>
              )}
              <View style={[styles.statusDot, { backgroundColor: collarColor }]} />
              <Text style={styles.statusText}>{status}</Text>
            </>
          )}
          <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.55)" />
        </View>
      </View>

      {/* Body */}
      <View style={styles.body}>
        {isLoading ? (
          <View style={[styles.skeleton, { width: '70%' }]} />
        ) : illness == null ? (
          <Text style={styles.emptyText}>{t('illness_watch.empty_sync')}</Text>
        ) : (
          <View style={styles.signals}>
            {illness.stale && (
              <Text style={styles.staleWarning}>{t('illness_watch.stale_warning')}</Text>
            )}
            <SignalRow
              label={t('illness_watch.signal_nocturnal_hr')}
              magnitude={illness.details.hrDelta}
              severity={nhrSeverity}
            />
            <SignalRow
              label={t('illness_watch.signal_hrv')}
              magnitude={illness.details.hrvDelta}
              severity={hrvSeverity}
            />
            <SignalRow
              label={t('illness_watch.signal_spo2_min')}
              magnitude={illness.details.spo2Delta}
              severity={spo2Severity}
            />
            <SignalRow
              label={t('illness_watch.signal_temperature')}
              magnitude={illness.details.tempDelta}
              severity={tempSeverity}
            />
            <SignalRow
              label={t('illness_watch.signal_sleep')}
              magnitude={illness.details.sleepDelta}
              severity={sleepSeverity}
            />
          </View>
        )}
      </View>
    </Pressable>
    </LinearGradient>
    </View>
  );
}

/** Derive a rough severity tier from a magnitude label string */
function getSeverityFromDelta(delta: string | null | undefined): Severity {
  if (!delta) return 'mild';
  const hrMatch = delta.match(/([+-]?\d+)\s*bpm/);
  if (hrMatch) {
    const v = Math.abs(parseInt(hrMatch[1], 10));
    if (v >= 15) return 'severe';
    if (v >= 10) return 'moderate';
    return 'mild';
  }
  const pctMatch = delta.match(/([+-]?\d+)%/);
  if (pctMatch) {
    const v = Math.abs(parseInt(pctMatch[1], 10));
    if (v >= 35) return 'severe';
    if (v >= 25) return 'moderate';
    return 'mild';
  }
  const tempMatch = delta.match(/([+-]?\d+\.?\d*)[°]/);
  if (tempMatch) {
    const v = Math.abs(parseFloat(tempMatch[1]));
    if (v >= 1.0) return 'severe';
    if (v >= 0.6) return 'moderate';
    return 'mild';
  }
  return 'mild';
}

const styles = StyleSheet.create({
  glowWrap: {
    borderRadius: 20,
  },
  gradientBorder: {
    borderRadius: 20,
    padding: 2,
  },
  card: {
    borderRadius: 18.5,
    overflow: 'hidden',
    backgroundColor: colors.background,
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scoreText: {
    fontFamily: fontFamily.demiBold,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.3,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  statusText: {
    fontFamily: fontFamily.demiBold,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.5,
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  signals: {
    gap: 8,
  },
  signalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  signalLabel: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: '#FFFFFF',
    flex: 1,
  },
  signalMagnitude: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.85)',
    marginRight: 2,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
  },
  pillNormal: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.22)',
  },
  pillText: {
    fontFamily: fontFamily.demiBold,
    fontSize: 11,
    letterSpacing: 0.3,
  },
  pillTextNormal: {
    color: '#FFFFFF',
  },
  staleWarning: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 2,
  },
  emptyText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.7)',
  },
  skeleton: {
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
});
