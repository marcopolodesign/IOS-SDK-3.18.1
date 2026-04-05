import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { GradientInfoCard } from '../common/GradientInfoCard';
import { colors, fontFamily, fontSize } from '../../theme/colors';
import type { IllnessWatch, IllnessStatus } from '../../types/focus.types';

interface IllnessWatchCardProps {
  illness: IllnessWatch | null;
  isLoading: boolean;
}

function ShieldIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
        stroke="#6B8EFF"
        strokeWidth={1.8}
        fill="rgba(107,142,255,0.2)"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function statusColor(status: IllnessStatus): string {
  if (status === 'CLEAR') return colors.success;
  if (status === 'WATCH') return colors.warning;
  return colors.error;
}

function gradientColor(status: IllnessStatus): string {
  if (status === 'CLEAR') return '#00533F';
  if (status === 'WATCH') return '#4A3000';
  return '#4A0000';
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
  const [expanded, setExpanded] = useState(false);

  const status = illness?.status ?? 'CLEAR';
  const dotColor = statusColor(status);
  const bgColor = gradientColor(status);

  // Derive per-signal severity from illness data.
  // Server scores provide sub_* values; client fallback maps signals to mild severity.
  const score = illness?.score ?? 0;
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

  return (
    <GradientInfoCard
      icon={<ShieldIcon />}
      title={t('illness_watch.card_title')}
      showArrow={false}
      gradientStops={[
        { offset: 0, color: bgColor, opacity: 1 },
        { offset: 0.6, color: bgColor, opacity: 0 },
      ]}
      gradientCenter={{ x: 0.5, y: -0.5 }}
      gradientRadii={{ rx: '100%', ry: '250%' }}
      headerRight={
        <View style={styles.headerRight}>
          {!isLoading && (
            <>
              {score > 0 && (
                <Text style={[styles.scoreText, { color: dotColor }]}>{score}</Text>
              )}
              <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
              <Text style={[styles.statusText, { color: dotColor }]}>{status}</Text>
            </>
          )}
          <TouchableOpacity onPress={() => setExpanded(v => !v)} hitSlop={12} disabled={isLoading}>
            <Text style={styles.chevron}>{expanded ? '∧' : '∨'}</Text>
          </TouchableOpacity>
        </View>
      }
    >
      {isLoading ? (
        <View style={[styles.skeleton, { width: '70%' }]} />
      ) : illness == null ? (
        <Text style={styles.emptyText}>{t('illness_watch.empty_sync')}</Text>
      ) : expanded ? (
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
          <Text style={styles.summaryText}>{illness.summary}</Text>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/settings/illness-detail')}
            style={styles.detailLink}
            hitSlop={8}
          >
            <Text style={styles.detailLinkText}>{t('illness_watch.detail_view_details')} →</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {illness.stale && (
            <Text style={styles.staleWarning}>{t('illness_watch.stale_warning')}</Text>
          )}
          <Text style={styles.summaryText}>{illness.summary}</Text>
        </>
      )}
    </GradientInfoCard>
  );
}

/** Derive a rough severity tier from a magnitude label string (used for client fallback) */
function getSeverityFromDelta(delta: string | null | undefined): Severity {
  if (!delta) return 'mild';
  // HR delta: "+X bpm"
  const hrMatch = delta.match(/([+-]?\d+)\s*bpm/);
  if (hrMatch) {
    const v = Math.abs(parseInt(hrMatch[1], 10));
    if (v >= 15) return 'severe';
    if (v >= 10) return 'moderate';
    return 'mild';
  }
  // HRV delta: "-X%"
  const pctMatch = delta.match(/([+-]?\d+)%/);
  if (pctMatch) {
    const v = Math.abs(parseInt(pctMatch[1], 10));
    if (v >= 35) return 'severe';
    if (v >= 25) return 'moderate';
    return 'mild';
  }
  // Temp delta: "+X.X°C"
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scoreText: {
    fontFamily: fontFamily.demiBold,
    fontSize: fontSize.sm,
    letterSpacing: 0.3,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontFamily: fontFamily.demiBold,
    fontSize: fontSize.sm,
    letterSpacing: 0.5,
  },
  chevron: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: 'rgba(255,255,255,0.45)',
  },
  signals: {
    gap: 7,
  },
  signalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  signalLabel: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: 'rgba(255,255,255,0.6)',
    flex: 1,
  },
  signalMagnitude: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.45)',
    marginRight: 2,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
  },
  pillText: {
    fontFamily: fontFamily.demiBold,
    fontSize: 11,
    letterSpacing: 0.3,
  },
  summaryText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.45)',
    lineHeight: 19,
    marginTop: 2,
  },
  staleWarning: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    marginBottom: 2,
  },
  detailLink: {
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  detailLinkText: {
    fontFamily: fontFamily.demiBold,
    fontSize: fontSize.sm,
    color: colors.tertiary,
    letterSpacing: 0.2,
  },
  emptyText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.35)',
  },
  skeleton: {
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
});
