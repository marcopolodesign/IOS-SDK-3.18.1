import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { fontFamily, fontSize, spacing } from '../../theme/colors';
import { RollingNumber } from '../common/RollingNumber';
import type { ReadinessScore, ReadinessRecommendation } from '../../types/focus.types';

// ─── Props ────────────────────────────────────────────────────────────────────

interface FocusScoreRingProps {
  score: number | null;
  recommendation: ReadinessRecommendation | null;
  isLoading: boolean;
  /** When provided, renders metric rows inside the component. */
  readiness?: ReadinessScore | null;
}

// ─── Geometry ─────────────────────────────────────────────────────────────────

const { width: SCREEN_W } = Dimensions.get('window');
const SVG_W  = SCREEN_W - 48;
const R      = SVG_W * 0.44;
const CX     = SVG_W / 2;
const CY     = R + 20;         // circle centre; top of arc ~20 px from SVG top
const SVG_H  = CY + R * 0.62; // tall enough to show the arc endpoints + glow
const STROKE = 13;

// Arc: 240° sweep, 120° open gap centred at the bottom.
// SVG angles — 0° = right (3 o'clock), increasing clockwise.
// Start 150° = 8 o'clock,  End 390°≡30° = 4 o'clock.
const A_START = 150;
const A_SWEEP = 240;

function toXY(deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: CX + R * Math.cos(rad), y: CY + R * Math.sin(rad) };
}

function arcPath(startDeg: number, sweepDeg: number): string {
  const s = toXY(startDeg);
  const e = toXY(startDeg + sweepDeg);
  const large = sweepDeg > 180 ? 1 : 0;
  return `M${s.x} ${s.y} A${R} ${R} 0 ${large} 1 ${e.x} ${e.y}`;
}

// Both arc endpoints sit at y = CY + R·sin(150°) = CY + 0.5R.
// A vertical gradient from that y (transparent) to the arc top CY−R (bright)
// makes BOTH ends fade simultaneously.
const GRAD_Y_FROM = CY + R * 0.5; // arc endpoint level  → opacity 0
const GRAD_Y_TO   = CY - R;        // top of arc (270°)  → opacity 0.95

// Content starts so its visual centre aligns with CY.
// Block: arcLabel 18 + gap 4 + score 84 + gap 6 + subtitle 20 = 132 px → top = CY − 66.
const CONTENT_PADDING_TOP = CY - 66;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function describeScore(score: number | null, t: (k: string) => string): string {
  if (score == null) return t('readiness.desc_no_data');
  if (score >= 80)   return t('readiness.desc_excellent');
  if (score >= 65)   return t('readiness.desc_above_norm');
  if (score >= 45)   return t('readiness.desc_on_track');
  return t('readiness.desc_below_norm');
}

// ─── Metric row ───────────────────────────────────────────────────────────────

function MetricRow({ label, score, t }: { label: string; score: number | null; t: (k: string) => string }) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <View style={rowStyles.track}>
        <View style={[rowStyles.fill, { width: `${score ?? 0}%` }]} />
      </View>
      <Text style={rowStyles.desc}>{describeScore(score, t)}</Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  label: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.5)',
    width: 84,
  },
  track: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  desc: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.45)',
    width: 80,
    textAlign: 'right',
  },
});

// ─── Component ────────────────────────────────────────────────────────────────

export function FocusScoreRing({ score, recommendation, isLoading, readiness }: FocusScoreRingProps) {
  const { t } = useTranslation();

  const progress      = score != null ? score / 100 : 0;
  const progressSweep = Math.max(0, progress * A_SWEEP);
  const tip           = toXY(A_START + progressSweep);
  const hasTip        = !isLoading && score != null && score > 0;
  const showFull      = readiness !== undefined;

  const subtitle =
    recommendation === 'GO'   ? t('readiness.subtitle_go')   :
    recommendation === 'EASY' ? t('readiness.subtitle_easy') :
    recommendation === 'REST' ? t('readiness.subtitle_rest') : null;

  const body =
    recommendation === 'GO'   ? t('readiness.body_go')   :
    recommendation === 'EASY' ? t('readiness.body_easy') :
    recommendation === 'REST' ? t('readiness.body_rest') : null;

  return (
    <View style={styles.outer}>

      {/* ── Arc SVG — absolute background, pointer-events pass through ── */}
      <View style={styles.arcBg} pointerEvents="none">
        <Svg width={SVG_W} height={SVG_H}>
          <Defs>
            {/* Track gradient — same fade zones, very dim peak */}
            <LinearGradient
              id="trackFill"
              x1={CX} y1={GRAD_Y_FROM}
              x2={CX} y2={GRAD_Y_TO}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0"    stopColor="white" stopOpacity={0.0} />
              <Stop offset="0.48" stopColor="white" stopOpacity={0.0} />
              <Stop offset="0.72" stopColor="white" stopOpacity={0.07} />
              <Stop offset="1"    stopColor="white" stopOpacity={0.07} />
            </LinearGradient>
            {/* Progress arc gradient — long transparent zone, bright peak */}
            <LinearGradient
              id="arcFill"
              x1={CX} y1={GRAD_Y_FROM}
              x2={CX} y2={GRAD_Y_TO}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0"    stopColor="white" stopOpacity={0.0} />
              <Stop offset="0.48" stopColor="white" stopOpacity={0.0} />
              <Stop offset="0.70" stopColor="white" stopOpacity={0.65} />
              <Stop offset="0.88" stopColor="white" stopOpacity={0.88} />
              <Stop offset="1"    stopColor="white" stopOpacity={0.92} />
            </LinearGradient>
          </Defs>

          {/* Track */}
          <Path
            d={arcPath(A_START, A_SWEEP)}
            stroke="url(#trackFill)"
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
          />

          {/* Progress arc */}
          {progressSweep > 0.5 && (
            <Path
              d={arcPath(A_START, progressSweep)}
              stroke="url(#arcFill)"
              strokeWidth={STROKE}
              fill="none"
              strokeLinecap="round"
            />
          )}

          {/* Glow at tip */}
          {hasTip && (
            <>
              <Circle cx={tip.x} cy={tip.y} r={STROKE * 2.2} fill="rgba(255,255,255,0.05)" />
              <Circle cx={tip.x} cy={tip.y} r={STROKE * 1.2} fill="rgba(255,255,255,0.16)" />
              <Circle cx={tip.x} cy={tip.y} r={STROKE * 0.55} fill="rgba(255,255,255,0.92)" />
            </>
          )}
        </Svg>
      </View>

      {/* ── All content flows on top of the arc ── */}
      <View style={styles.content}>

        {/* Hero: READINESS label + score + subtitle + body */}
        <View style={styles.hero}>
          <Text style={styles.arcLabel}>READINESS</Text>
          {isLoading || score == null ? (
            <Text style={styles.scoreDash}>--</Text>
          ) : (
            <RollingNumber
              value={score}
              style={styles.score}
              digitHeight={84}
              gap={-2}
            />
          )}
          {showFull && subtitle && !isLoading && (
            <Text style={styles.arcSubtitle}>{subtitle}</Text>
          )}
          {showFull && body && !isLoading && (
            <Text style={styles.metricBody}>{body}</Text>
          )}
          {!showFull && recommendation != null && !isLoading && (
            <View style={styles.pill}>
              <Text style={styles.pillText}>{recommendation}</Text>
            </View>
          )}
        </View>

        {/* Metrics: component bars */}
        {showFull && (
          <View style={styles.metricsBlock}>

            {isLoading ? (
              <>
                <View style={styles.skeletonRow} />
                <View style={styles.skeletonRow} />
                <View style={styles.skeletonRow} />
                <View style={styles.skeletonRow} />
              </>
            ) : readiness == null ? (
              <Text style={styles.emptyText}>{t('readiness.empty_sync')}</Text>
            ) : (
              <>
                <MetricRow label={t('readiness.component_hrv')}        score={readiness.components.hrv}          t={t} />
                <MetricRow label={t('readiness.component_sleep')}      score={readiness.components.sleep}        t={t} />
                <MetricRow label={t('readiness.component_resting_hr')} score={readiness.components.restingHR}    t={t} />
                <MetricRow label={t('readiness.component_training')}   score={readiness.components.trainingLoad} t={t} />
              </>
            )}
          </View>
        )}

      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  outer: {
    width: SVG_W,
    alignSelf: 'center',
    marginTop: -32,
    marginBottom: 8,
  },
  arcBg: {
    position: 'absolute',
    top: 80,
    left: 0,
  },
  content: {
    paddingTop: 150,
    paddingBottom: spacing.xl,
  },
  hero: {
    alignItems: 'center',
  },
  arcLabel: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  score: {
    fontFamily: fontFamily.demiBold,
    fontSize: 82,
    color: '#FFFFFF',
  },
  scoreDash: {
    fontFamily: fontFamily.demiBold,
    fontSize: 82,
    lineHeight: 84,
    color: 'rgba(255,255,255,0.35)',
  },
  arcSubtitle: {
    fontFamily: fontFamily.demiBold,
    fontSize: 32,
    color: '#FFFFFF',
    marginTop: 8,
  },
  pill: {
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  pillText: {
    fontFamily: fontFamily.demiBold,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 1.2,
  },
  metricsBlock: {
    marginTop: 6,
  },
  metricBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 0,
  },
  emptyText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.35)',
  },
  skeletonRow: {
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 12,
  },
});
