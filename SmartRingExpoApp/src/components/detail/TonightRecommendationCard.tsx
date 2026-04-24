import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fontFamily, spacing } from '../../theme/colors';
import { formatSleepTime } from '../../utils/time';
import { useTranslation } from 'react-i18next';

interface Props {
  recommendedMin: number;
  targetMin: number;
  extraPerNight: number;
  rationaleKey: string;
  accent: string;
}

export function TonightRecommendationCard({
  recommendedMin,
  targetMin,
  extraPerNight,
  rationaleKey,
  accent,
}: Props) {
  const { t } = useTranslation();

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{t('sleep_debt.recommendation_title').toUpperCase()}</Text>
      <Text style={[styles.value, { color: accent }]}>{formatSleepTime(recommendedMin)}</Text>
      {extraPerNight > 0 && (
        <Text style={styles.extra}>
          {t('sleep_debt.recommendation_extra', { minutes: extraPerNight })}
        </Text>
      )}
      <Text style={styles.rationale}>{t(rationaleKey)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    gap: 6,
  },
  label: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontFamily: fontFamily.regular,
    letterSpacing: 0.8,
  },
  value: {
    fontSize: 40,
    fontFamily: fontFamily.demiBold,
    lineHeight: 44,
  },
  extra: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontFamily: fontFamily.regular,
  },
  rationale: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 14,
    fontFamily: fontFamily.regular,
    lineHeight: 20,
  },
});
