import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
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

function statusColor(status: IllnessStatus): string {
  if (status === 'CLEAR') return colors.success;
  if (status === 'WATCH') return colors.warning;
  return colors.error;
}

function gradientColor(status: IllnessStatus): string {
  if (status === 'CLEAR') return '#00533F';
  if (status === 'WATCH') return '#4A3000';
  return '#4A0000';
}

function SignalRow({
  label,
  flagged,
  status,
  elevatedLabel,
  normalLabel,
}: {
  label: string;
  flagged: boolean;
  status: IllnessStatus;
  elevatedLabel: string;
  normalLabel: string;
}) {
  const icon = flagged ? (status === 'SICK' ? '✕' : '⚠') : '✓';
  const textColor = flagged
    ? status === 'SICK' ? colors.error : colors.warning
    : colors.success;

  return (
    <View style={styles.signalRow}>
      <Text style={[styles.signalIcon, { color: textColor }]}>{icon}</Text>
      <Text style={styles.signalLabel}>{label}</Text>
      <Text style={[styles.signalValue, { color: textColor }]}>
        {flagged ? elevatedLabel : normalLabel}
      </Text>
    </View>
  );
}

export function IllnessWatchCard({ illness, isLoading }: IllnessWatchCardProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const status = illness?.status ?? 'CLEAR';
  const dotColor = statusColor(status);
  const bgColor = gradientColor(status);

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
          <SignalRow label={t('illness_watch.signal_temp')} flagged={illness.signals.tempDeviation} status={status} elevatedLabel={illness.details?.tempDelta ?? t('illness_watch.value_elevated')} normalLabel={t('illness_watch.value_normal')} />
          <SignalRow label={t('illness_watch.signal_resting_hr')} flagged={illness.signals.restingHRElevated} status={status} elevatedLabel={illness.details?.hrDelta ?? t('illness_watch.value_elevated')} normalLabel={t('illness_watch.value_normal')} />
          <SignalRow label={t('illness_watch.signal_hrv')} flagged={illness.signals.hrvSuppressed} status={status} elevatedLabel={illness.details?.hrvDelta ?? t('illness_watch.value_suppressed')} normalLabel={t('illness_watch.value_normal')} />
          <SignalRow label={t('illness_watch.signal_sleep')} flagged={illness.signals.sleepFragmented} status={status} elevatedLabel={t('illness_watch.value_elevated')} normalLabel={t('illness_watch.value_normal')} />
          <SignalRow label={t('illness_watch.signal_breathing')} flagged={illness.signals.respiratoryRateElevated} status={status} elevatedLabel={t('illness_watch.value_elevated')} normalLabel={t('illness_watch.value_normal')} />
          <Text style={styles.summaryText}>{illness.summary}</Text>
        </View>
      ) : (
        <Text style={styles.summaryText}>{illness.summary}</Text>
      )}
    </GradientInfoCard>
  );
}

const styles = StyleSheet.create({
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    gap: 6,
  },
  signalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  signalIcon: {
    fontSize: 13,
    width: 14,
    textAlign: 'center',
  },
  signalLabel: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: 'rgba(255,255,255,0.6)',
    flex: 1,
  },
  signalValue: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
  },
  summaryText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.45)',
    lineHeight: 19,
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
