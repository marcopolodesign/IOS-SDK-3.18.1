import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { GradientInfoCard } from '../common/GradientInfoCard';
import { InfoButton } from '../common/InfoButton';
import { useSleepBaseline } from '../../hooks/useSleepBaseline';
import { spacing, fontSize, fontFamily } from '../../theme/colors';
import type { SleepBaselineTier } from '../../types/sleepBaseline.types';

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIER_COLORS: Record<SleepBaselineTier, string> = {
  low:        '#FF6B6B',
  developing: '#FFB84D',
  good:       '#6B8EFF',
  optimal:    '#00D4AA',
};

const TIER_ORDER: SleepBaselineTier[] = ['low', 'developing', 'good', 'optimal'];

const TIER_RANGES = {
  low:        { start: 0,  end: 49  },
  developing: { start: 50, end: 64  },
  good:       { start: 65, end: 79  },
  optimal:    { start: 80, end: 100 },
};

// ─── Icons ────────────────────────────────────────────────────────────────────

function MoonIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12.1 22c5.5 0 10-4.5 10-10 0-1.1-.2-2.2-.5-3.2-.3-.9-1.4-1.1-2-.4-1.4 1.7-3.5 2.7-5.9 2.7-4.1 0-7.5-3.4-7.5-7.5 0-2.3 1-4.5 2.7-5.9.7-.6.5-1.8-.4-2C7.3 2.2 6.2 2 5.1 2 2.6 2 .1 4.5.1 10c0 5.5 4.5 10 10 10h2z"
        fill="rgba(255,255,255,0.85)"
      />
    </Svg>
  );
}

// ─── Tier Zone Bar ────────────────────────────────────────────────────────────

function TierBar({ averageScore, currentTier }: { averageScore: number; currentTier: SleepBaselineTier }) {
  // Dot position as % within 0–100 range
  const dotPct = Math.max(0, Math.min(100, averageScore));

  return (
    <View style={barStyles.container}>
      {/* Zone segments */}
      <View style={barStyles.track}>
        {TIER_ORDER.map((tier, i) => {
          const isActive = tier === currentTier;
          const color = TIER_COLORS[tier];
          const range = TIER_RANGES[tier];

          return (
            <View
              key={tier}
              style={[
                barStyles.segment,
                {
                  flex: range.end - range.start + 1,
                  backgroundColor: isActive ? color : `${color}40`,
                  borderTopLeftRadius: i === 0 ? 4 : 0,
                  borderBottomLeftRadius: i === 0 ? 4 : 0,
                  borderTopRightRadius: i === TIER_ORDER.length - 1 ? 4 : 0,
                  borderBottomRightRadius: i === TIER_ORDER.length - 1 ? 4 : 0,
                },
              ]}
            />
          );
        })}

        {/* Score dot */}
        <View
          style={[
            barStyles.dot,
            {
              left: `${dotPct}%` as `${number}%`,
              backgroundColor: TIER_COLORS[currentTier],
              borderColor: '#1A1A2E',
            },
          ]}
          pointerEvents="none"
        />
      </View>

      {/* Zone labels */}
      <View style={barStyles.labelRow}>
        {TIER_ORDER.map((tier) => (
          <View key={tier} style={{ flex: TIER_RANGES[tier].end - TIER_RANGES[tier].start + 1 }}>
            <Text
              style={[
                barStyles.zoneLabel,
                { color: tier === currentTier ? TIER_COLORS[tier] : 'rgba(255,255,255,0.35)' },
              ]}
              numberOfLines={1}
            >
              {tier === currentTier ? '▲' : ''}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const barStyles = StyleSheet.create({
  container: {
    gap: 4,
  },
  track: {
    height: 8,
    flexDirection: 'row',
    borderRadius: 4,
    overflow: 'visible',
    position: 'relative',
  },
  segment: {
    height: '100%',
  },
  dot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    top: -2,
    marginLeft: -6,
  },
  labelRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
  zoneLabel: {
    fontSize: 9,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
  },
});

// ─── Main Card ────────────────────────────────────────────────────────────────

interface SleepBaselineTierCardProps {
  refreshTrigger?: number;
}

export default function SleepBaselineTierCard({ refreshTrigger }: SleepBaselineTierCardProps) {
  const { t } = useTranslation();
  const { baseline, refresh } = useSleepBaseline();

  React.useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) refresh();
  }, [refreshTrigger, refresh]);

  const tierColor = TIER_COLORS[baseline.tier];
  const tierName = t(`sleep_baseline.tier_${baseline.tier}`);

  return (
    <GradientInfoCard
      icon={<MoonIcon />}
      title={t('sleep_baseline.title')}
      headerValue={baseline.daysInBaseline > 0 ? baseline.averageScore : undefined}
      headerSubtitle={t('sleep_baseline.avg_score')}
      showArrow={false}
      gradientStops={[
        { offset: 0, color: '#6B8EFF', opacity: 0.9 },
        { offset: 0.65, color: '#6B8EFF', opacity: 0.15 },
      ]}
      gradientCenter={{ x: 0.51, y: -0.86 }}
      gradientRadii={{ rx: '80%', ry: '300%' }}
      headerRight={<InfoButton metricKey="sleep_baseline" />}
    >
      <View style={styles.body}>
        {/* Tier bar */}
        <TierBar averageScore={baseline.averageScore} currentTier={baseline.tier} />

        {/* Stats row */}
        <View style={styles.statsRow}>
          {/* Tier badge */}
          <View
            style={[
              styles.badge,
              { backgroundColor: `${tierColor}22`, borderColor: `${tierColor}55` },
            ]}
          >
            <Text style={[styles.badgeText, { color: tierColor }]}>{tierName}</Text>
          </View>

          {/* Days tracked */}
          <Text style={styles.daysText}>
            {t('sleep_baseline.days_logged', { count: baseline.daysInBaseline })}
          </Text>
        </View>

        {/* Advancement tip */}
        {baseline.tier === 'optimal' ? (
          <Text style={styles.tipText}>{t('sleep_baseline.at_optimal')}</Text>
        ) : baseline.advancementTipKey && baseline.pointsToNextTier != null ? (
          <View style={styles.tipRow}>
            <Text style={styles.tipLabel} numberOfLines={1}>
              {t('sleep_baseline.to_reach', {
                tier: t(`sleep_baseline.tier_${TIER_ORDER[TIER_ORDER.indexOf(baseline.tier) + 1]}`),
              })}
              {' +'}
              {baseline.pointsToNextTier}
              {' pts · '}
            </Text>
            <Text style={styles.tipText} numberOfLines={2}>
              {t(baseline.advancementTipKey)}
            </Text>
          </View>
        ) : null}
      </View>
    </GradientInfoCard>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.demiBold,
  },
  daysText: {
    flex: 1,
    color: 'rgba(255,255,255,0.45)',
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
  },
  tipRow: {
    gap: 2,
  },
  tipLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: fontSize.xs,
    fontFamily: fontFamily.demiBold,
  },
  tipText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    lineHeight: 18,
  },
});
