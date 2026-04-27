import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontSize, fontFamily, spacing } from '../../theme/colors';

interface WindDownHeroProps {
  targetBedtimeMs: number;
  minsUntilBed: number;
  sleepDebtTotalMin: number;
}

function formatBedtime(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m} ${ampm}`;
}

function formatCountdown(minsUntilBed: number): { text: string; isLate: boolean } {
  const isLate = minsUntilBed < 0;
  const abs = Math.abs(Math.round(minsUntilBed));
  const h = Math.floor(abs / 60);
  const m = abs % 60;

  if (abs < 2) return { text: 'Time to sleep', isLate: false };

  const duration = h > 0 ? `${h}h ${m}m` : `${m} min`;
  return isLate
    ? { text: `${duration} past target`, isLate: true }
    : { text: `in ${duration}`, isLate: false };
}

export function WindDownHero({ targetBedtimeMs, minsUntilBed, sleepDebtTotalMin }: WindDownHeroProps) {
  const { text: countdownText, isLate } = formatCountdown(minsUntilBed);

  const debtH = Math.floor(sleepDebtTotalMin / 60);
  const debtM = Math.round(sleepDebtTotalMin % 60);
  const debtLabel = debtH > 0 ? `${debtH}h ${debtM}m sleep debt` : `${debtM}m sleep debt`;
  const hasDebt = sleepDebtTotalMin >= 30;

  return (
    <View style={styles.container}>
      <Ionicons name="moon-outline" size={24} color="rgba(255,255,255,0.5)" />
      <Text style={styles.label}>WIND DOWN</Text>
      <Text style={styles.bedtime}>{formatBedtime(targetBedtimeMs)}</Text>
      <Text style={[styles.countdown, isLate && styles.countdownLate]}>
        {countdownText}
      </Text>
      {hasDebt && (
        <View style={styles.debtRow}>
          <View style={styles.debtDot} />
          <Text style={styles.debtText}>{debtLabel}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: spacing.lg,
    gap: 4,
  },
  label: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: fontSize.xs,
    fontFamily: fontFamily.demiBold,
    letterSpacing: 2,
    marginTop: 8,
    marginBottom: 4,
  },
  bedtime: {
    color: '#FFFFFF',
    fontSize: 72,
    fontFamily: fontFamily.regular,
    lineHeight: 80,
  },
  countdown: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: fontSize.md,
    fontFamily: fontFamily.regular,
    marginTop: 2,
  },
  countdownLate: {
    color: '#FF6B35',
  },
  debtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  debtDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFD700',
  },
  debtText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
  },
});

export default WindDownHero;
