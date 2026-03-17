/**
 * RecoveryTimelineCard — horizontal recovery stage bar (Rest → Easy → Go)
 * with score marker and actionable tips to reach the next level.
 * No card background — renders inline within the screen.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, fontFamily, fontSize, spacing, borderRadius } from '../../theme/colors';
import type { FocusBaselines, ReadinessComponents, ReadinessScore } from '../../types/focus.types';

// ─── Zones ────────────────────────────────────────────────────────────────────

interface RecoveryZone {
  labelKey: string;
  minScore: number;
  maxScore: number;
  flex: number;        // proportional to score range width
  barColor: string;
  accentColor: string;
}

const ZONES: RecoveryZone[] = [
  { labelKey: 'recovery_timeline.zone_rest', minScore: 0,  maxScore: 44,  flex: 44, barColor: 'rgba(255,107,107,0.22)', accentColor: '#FF6B6B' },
  { labelKey: 'recovery_timeline.zone_easy', minScore: 45, maxScore: 69,  flex: 25, barColor: 'rgba(255,184,77,0.22)',  accentColor: '#FFB84D' },
  { labelKey: 'recovery_timeline.zone_go',   minScore: 70, maxScore: 100, flex: 31, barColor: 'rgba(0,212,170,0.22)',   accentColor: colors.primary },
];

const DOT_SIZE = 16;

// ─── Tips ─────────────────────────────────────────────────────────────────────

// Maps component key → translation key suffix used in low / med / peak tips
const TIP_KEY: Record<keyof ReadinessComponents, string> = {
  sleep:        'sleep',
  hrv:          'hrv',
  restingHR:    'rhr',
  trainingLoad: 'load',
};

type TFn = (key: string) => string;

function getTips(
  components: ReadinessComponents | null,
  daysLogged: number,
  zoneIndex: number,
  t: TFn,
): string[] {
  if (!components || daysLogged < 3) {
    return [
      t('recovery_timeline.tip_calib_1'),
      t('recovery_timeline.tip_calib_2'),
    ];
  }

  const ranked = (Object.keys(TIP_KEY) as Array<keyof ReadinessComponents>)
    .filter(k => components[k] !== null)
    .map(k => ({ k, score: components[k] as number }))
    .sort((a, b) => a.score - b.score);

  if (zoneIndex === 2) {
    // In Go — show how to push toward 100
    const improvable = ranked.filter(x => x.score < 85);
    if (improvable.length === 0) return [t('recovery_timeline.all_optimal')];
    return improvable.slice(0, 2).map(({ k }) =>
      t(`recovery_timeline.tip_${TIP_KEY[k]}_peak`)
    );
  }

  // Rest or Easy — target the 2 weakest components
  return ranked.slice(0, 2).map(({ k, score }) =>
    t(`recovery_timeline.tip_${TIP_KEY[k]}_${score < 40 ? 'low' : 'med'}`)
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  daysLogged: number;
  baselines: FocusBaselines | null;
  readiness: ReadinessScore | null;
}

export function BaselineJourneyCard({ daysLogged, baselines: _baselines, readiness }: Props) {
  const { t } = useTranslation();

  const isCalibrating = daysLogged < 3 ||
    (readiness != null && Object.values(readiness.components).every(v => v == null));

  const score      = readiness?.score ?? null;
  const components = readiness?.components ?? null;

  const zoneIndex  = !isCalibrating && score != null
    ? ZONES.findIndex(z => score >= z.minScore && score <= z.maxScore)
    : -1;

  const currentZone = zoneIndex >= 0 ? ZONES[zoneIndex] : null;
  const nextZone    = zoneIndex >= 0 && zoneIndex < ZONES.length - 1 ? ZONES[zoneIndex + 1] : null;

  // Clamp marker so dot stays fully visible
  const markerPct = (!isCalibrating && score != null)
    ? `${Math.max(1, Math.min(97, score))}%`
    : null;

  const tips = getTips(components, daysLogged, zoneIndex, t);

  const tipsTitleKey = isCalibrating
    ? 'recovery_timeline.to_unlock'
    : nextZone
    ? 'recovery_timeline.to_reach'
    : 'recovery_timeline.to_peak';

  const tipsTitle = nextZone
    ? t('recovery_timeline.to_reach', { zone: t(nextZone.labelKey) })
    : t(tipsTitleKey);

  return (
    <View style={styles.container}>
      {/* ── Title ── */}
      <Text style={styles.title}>{t('recovery_timeline.title')}</Text>

      {/* ── Bar ── */}
      <View style={styles.barSection}>
        <View style={styles.barTrack}>
          {ZONES.map((zone, i) => (
            <View
              key={zone.labelKey}
              style={[
                styles.barSegment,
                { flex: zone.flex, backgroundColor: zone.barColor },
                i === 0                && styles.barSegmentLeft,
                i === ZONES.length - 1 && styles.barSegmentRight,
              ]}
            />
          ))}

          {markerPct != null && (
            <View style={[styles.markerAnchor, { left: markerPct }]}>
              <View style={[
                styles.marker,
                {
                  backgroundColor: currentZone?.accentColor ?? colors.primary,
                  shadowColor:     currentZone?.accentColor ?? colors.primary,
                },
              ]} />
            </View>
          )}
        </View>

        {/* Zone labels */}
        <View style={styles.barLabels}>
          {ZONES.map((zone) => (
            <View key={zone.labelKey} style={{ flex: zone.flex, alignItems: 'center' }}>
              <Text style={[
                styles.barLabel,
                !isCalibrating && currentZone?.labelKey === zone.labelKey && { color: zone.accentColor },
              ]}>
                {t(zone.labelKey)}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Tips ── */}
      {tips.length > 0 && (
        <View style={styles.tipsBlock}>
          <Text style={styles.tipsTitle}>{tipsTitle}</Text>
          {tips.map((tip, i) => (
            <View key={i} style={styles.tipRow}>
              <View style={[styles.tipBullet, { backgroundColor: currentZone?.accentColor ?? colors.primary }]} />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },

  title: {
    fontFamily: fontFamily.demiBold,
    fontSize: 24,
    color: '#FFFFFF',
    lineHeight: 30,
  },

  // Bar
  barSection: {
    gap: 6,
  },
  barTrack: {
    height: 10,
    borderRadius: 5,
    flexDirection: 'row',
    position: 'relative',
    overflow: 'visible',
  },
  barSegment: {
    height: '100%',
  },
  barSegmentLeft: {
    borderTopLeftRadius: 5,
    borderBottomLeftRadius: 5,
  },
  barSegmentRight: {
    borderTopRightRadius: 5,
    borderBottomRightRadius: 5,
  },
  markerAnchor: {
    position: 'absolute',
    top: -(DOT_SIZE / 2 - 5),
    marginLeft: -(DOT_SIZE / 2),
  },
  marker: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    borderWidth: 2.5,
    borderColor: 'rgba(13,13,13,0.9)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 4,
  },
  barLabels: {
    flexDirection: 'row',
    marginTop: 2,
  },
  barLabel: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.30)',
    textAlign: 'center',
  },

  // Tips
  tipsBlock: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: 10,
  },
  tipsTitle: {
    fontFamily: fontFamily.demiBold,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  tipBullet: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 7,
    opacity: 0.7,
  },
  tipText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 20,
    flex: 1,
  },
});
