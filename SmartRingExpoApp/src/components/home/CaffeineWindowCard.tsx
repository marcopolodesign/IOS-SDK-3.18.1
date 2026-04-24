import React, { useMemo } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, Pressable } from 'react-native';
import Svg, {
  Defs,
  RadialGradient as SvgRadialGradient,
  LinearGradient as SvgLinearGradient,
  Stop,
  Path,
  Circle,
  Line,
  Rect,
  Text as SvgText,
} from 'react-native-svg';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { InfoButton } from '../common/InfoButton';
import { fontFamily, spacing } from '../../theme/colors';
import { formatDecimalHour } from '../../utils/time';
import {
  buildMultiDoseCurvePath,
  totalMgAt,
  clearanceHour,
  recommendedWindow,
  withDefaultDose,
  peakMgForDoses,
  SLEEP_THRESHOLD_MG,
} from '../../utils/caffeinePk';
import { useCaffeineTimeline } from '../../hooks/useCaffeineTimeline';

// ─── Chart geometry ───────────────────────────────────────────────────────────
const CHART_PAD_L  = 30;
const CHART_PAD_R  = 8;
const TIME_START   = 6;    // 6 AM
const TIME_END     = 23;   // 11 PM
const TIME_SPAN    = TIME_END - TIME_START;
const CURVE_TOP_Y  = 10;
const CURVE_BOT_Y  = 75;

const BLOCK_R      = 10;
const PHASE_BAR_H  = 10;
const PHASE_BAR_R  = 4;
const LABEL_Y      = CURVE_BOT_Y + 80;
const BLOCKS_H     = LABEL_Y - 52;
const PHASE_BAR_Y  = LABEL_Y - PHASE_BAR_H - 22;
const CHART_HEIGHT = LABEL_Y + 18;

// Y-scale is computed dynamically from effective doses (see below).
// Minimum 150 so the 100 mg sleep-limit line is always visible with headroom.
const MIN_Y_SCALE = 150;

function mgToY(mg: number, yScale: number): number {
  const conc = Math.min(mg / yScale, 1);
  return CURVE_TOP_Y + (1 - conc) * (CURVE_BOT_Y - CURVE_TOP_Y);
}

// ─── Component ───────────────────────────────────────────────────────────────
interface CaffeineWindowCardProps {
  wakeHour?: number;   // decimal hour, from homeData.lastNightSleep.wakeTime
  bedHour?: number;    // decimal hour, defaults to 23
}

export function CaffeineWindowCard({
  wakeHour = 7.0,
  bedHour = 23,
}: CaffeineWindowCardProps) {
  const { t } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = screenWidth - spacing.md * 2;
  const innerW    = cardWidth - CHART_PAD_L - CHART_PAD_R;

  const { doses, clearanceHour: loggedClearHour } = useCaffeineTimeline();

  const now = new Date();
  const nowHour = now.getHours() + now.getMinutes() / 60;
  const clampedNow = Math.max(TIME_START, Math.min(TIME_END, nowHour));

  const tx = (h: number) => CHART_PAD_L + ((h - TIME_START) / TIME_SPAN) * innerW;

  const window = useMemo(
    () => recommendedWindow(wakeHour, bedHour),
    [wakeHour, bedHour],
  );

  // effectiveDoses = default baseline + actual logged drinks (superposition).
  // The chart always shows a curve; logged drinks push the descending portion upward.
  const effectiveDoses = useMemo(
    () => withDefaultDose(doses, wakeHour),
    [doses, wakeHour],
  );

  const hasDoses = doses.length > 0; // true only when user has actually logged something

  // Dynamic Y-scale: curve always peaks at the top of the chart.
  const yScale = useMemo(
    () => Math.max(Math.ceil(peakMgForDoses(effectiveDoses)), MIN_Y_SCALE),
    [effectiveDoses],
  );

  const curvePath = useMemo(
    () => buildMultiDoseCurvePath(effectiveDoses, innerW, CHART_PAD_L, TIME_START, TIME_END, CURVE_TOP_Y, CURVE_BOT_Y, yScale),
    [effectiveDoses, innerW, yScale],
  );

  const clearHour = useMemo(() => clearanceHour(effectiveDoses), [effectiveDoses]);

  const blockInset  = 8;
  const bx1         = CHART_PAD_L + blockInset;
  const blockRight  = CHART_PAD_L + innerW - blockInset;

  const openStart = Math.min(...effectiveDoses.map(d => d.intakeHour));
  const openEnd   = clearHour ?? window.end;

  const bx2 = Math.max(bx1, Math.min(tx(openStart), blockRight));
  const bx3 = Math.max(bx2, Math.min(tx(openEnd), blockRight));

  const blockW1 = bx2 - bx1;
  const blockW2 = bx3 - bx2;
  const blockW3 = blockRight - bx3;

  const activePhase: 'pre' | 'open' | 'closed' =
    clampedNow < openStart ? 'pre' : clampedNow < openEnd ? 'open' : 'closed';

  const nowX = tx(clampedNow);
  const nowMg = totalMgAt(clampedNow, effectiveDoses);
  const nowY = mgToY(nowMg, yScale);

  const timeLabels = [
    { label: '6AM',  x: tx(6) },
    { label: '12PM', x: tx(12) - 11 },
    { label: '3PM',  x: tx(15) },
    { label: '11PM', x: tx(23) - 22 },
  ];

  const yAxisLabels = [yScale, Math.round(yScale / 2), 0].map(mg => ({
    mg,
    y: mgToY(mg, yScale),
    label: `${mg}`,
  }));

  const clearanceLabel = formatDecimalHour(clearHour);

  return (
    <Pressable onPress={() => router.push('/detail/adenosine-detail')} style={{ borderRadius: 20 }}>
      <View style={[styles.card, { width: cardWidth }]}>

        {/* ── Green radial gradient ── */}
        <Svg
          style={StyleSheet.absoluteFill}
          viewBox={`0 0 ${cardWidth} 430`}
          preserveAspectRatio="xMidYMid slice"
        >
          <Defs>
            <SvgRadialGradient id="greenTop" cx="51.5%" cy="-8%" rx="82%" ry="55%">
              <Stop offset="0%"    stopColor="#1F9F50" stopOpacity={1}    />
              <Stop offset="94.7%" stopColor="#1F9F50" stopOpacity={0.15} />
              <Stop offset="100%"  stopColor="#1F9F50" stopOpacity={0}    />
            </SvgRadialGradient>
          </Defs>
          <Rect x="0" y="0" width={cardWidth} height="430" fill="url(#greenTop)" />
        </Svg>

        {/* ── Header ── */}
        <View style={styles.topSection}>
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={styles.iconWrapper}>
                <Text style={styles.iconEmoji}>☕</Text>
              </View>
              <Text style={styles.headerLabel}>{t('adenosine.phase.' + activePhase).toUpperCase()}</Text>
            </View>
            <View style={styles.headerRight}>
              <InfoButton metricKey="caffeine_window" />
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.45)" style={{ marginLeft: 4 }} />
            </View>
          </View>
          <Text style={styles.title}>Adenosine Window{'\n'}Clearance</Text>
          <Text style={styles.subtitle}>
            {hasDoses
              ? `Caffeine clears at ${clearanceLabel}`
              : t('adenosine.empty_hint')}
          </Text>
        </View>

        {/* ── Chart ── */}
        <View style={[styles.chartSection, { width: cardWidth }]}>

          {/* Window blocks */}
          <Svg style={StyleSheet.absoluteFill} width={cardWidth} height={CHART_HEIGHT}>
            <Defs>
              <SvgLinearGradient id="w_pre" x1={bx1} y1={0} x2={bx2} y2={0} gradientUnits="userSpaceOnUse">
                <Stop offset="0%"   stopColor="#FFAC3F" />
                <Stop offset="65%"  stopColor="#FFAC3F" />
                <Stop offset="100%" stopColor="#00D7A9" />
              </SvgLinearGradient>
              <SvgLinearGradient id="w_open" x1={bx2} y1={0} x2={bx3} y2={0} gradientUnits="userSpaceOnUse">
                <Stop offset="0%"   stopColor="#00D7A9" />
                <Stop offset="100%" stopColor="#00D7A9" />
              </SvgLinearGradient>
              <SvgLinearGradient id="w_closed" x1={bx3} y1={0} x2={bx3 + blockW3} y2={0} gradientUnits="userSpaceOnUse">
                <Stop offset="0%"   stopColor="#00D7A9" />
                <Stop offset="35%"  stopColor="#FD8D8F" />
                <Stop offset="100%" stopColor="#FD8D8F" />
              </SvgLinearGradient>
              <SvgLinearGradient id="w_vignette" x1={0} y1={0} x2={0} y2={BLOCKS_H} gradientUnits="userSpaceOnUse">
                <Stop offset="0%"   stopColor="#000000" stopOpacity={1} />
                <Stop offset="100%" stopColor="#000000" stopOpacity={0} />
              </SvgLinearGradient>
            </Defs>
            {blockW1 > 0 && <Rect x={bx1} y={0} width={blockW1} height={BLOCKS_H} rx={BLOCK_R} fill="url(#w_pre)"    />}
            {blockW2 > 0 && <Rect x={bx2} y={0} width={blockW2} height={BLOCKS_H} rx={BLOCK_R} fill="url(#w_open)"   />}
            {blockW3 > 0 && <Rect x={bx3} y={0} width={blockW3} height={BLOCKS_H} rx={BLOCK_R} fill="url(#w_closed)" />}
            <Rect x={bx1} y={0} width={blockRight - bx1} height={BLOCKS_H} fill="url(#w_vignette)" />
          </Svg>

          {/* Curve + labels */}
          <Svg width={cardWidth} height={CHART_HEIGHT} style={StyleSheet.absoluteFill}>

            {/* Y-axis */}
            {yAxisLabels.map(({ mg, y, label }) => (
              <React.Fragment key={mg}>
                <Line x1={CHART_PAD_L} y1={y} x2={cardWidth - CHART_PAD_R} y2={y}
                  stroke="rgba(255,255,255,0.07)" strokeWidth={1} strokeDasharray="2,4" />
                <SvgText x={CHART_PAD_L - 4} y={y + 4} fill="rgba(255,255,255,0.38)"
                  fontSize={9} fontFamily={fontFamily.regular} textAnchor="end">
                  {label}
                </SvgText>
              </React.Fragment>
            ))}
            <SvgText x={2} y={10} fill="rgba(255,255,255,0.25)" fontSize={8} fontFamily={fontFamily.regular}>mg</SvgText>

            {/* Sleep threshold */}
            <Line x1={CHART_PAD_L} y1={mgToY(SLEEP_THRESHOLD_MG, yScale)} x2={cardWidth - CHART_PAD_R} y2={mgToY(SLEEP_THRESHOLD_MG, yScale)}
              stroke="rgba(253,141,143,0.65)" strokeWidth={1} strokeDasharray="4,4" />
            <SvgText x={cardWidth - CHART_PAD_R} y={mgToY(SLEEP_THRESHOLD_MG, yScale) - 4}
              fill="rgba(253,141,143,0.80)" fontSize={8} fontFamily={fontFamily.regular} textAnchor="end">
              sleep limit
            </SvgText>

            {/* NOW dashed line */}
            <Line x1={nowX} y1={0} x2={nowX} y2={nowY - 8}
              stroke="rgba(255,255,255,0.35)" strokeWidth={1} strokeDasharray="3,3" />

            {/* Multi-dose curve (always present — default baseline + logged drinks) */}
            <Path d={curvePath} fill="none" stroke="white" strokeWidth={2}
              strokeLinecap="round" strokeLinejoin="round" />

            {/* NOW dot */}
            <Circle cx={nowX} cy={nowY} r={8}   fill="rgba(255,255,255,0.22)" />
            <Circle cx={nowX} cy={nowY} r={4.5} fill="white" />

            {/* Time labels */}
            {timeLabels.map(({ label, x }) => (
              <SvgText key={label} x={x} y={LABEL_Y} fill="rgba(255,255,255,0.38)"
                fontSize={10} fontFamily={fontFamily.regular}>
                {label}
              </SvgText>
            ))}

            {/* Phase indicator bar */}
            {(() => {
              const gap = 5;
              return (
                <>
                  {blockW1 > 0 && <Rect x={bx1} y={PHASE_BAR_Y} width={blockW1 - gap / 2} height={PHASE_BAR_H} rx={PHASE_BAR_R}
                    fill={activePhase === 'pre'    ? '#FFAC3F' : 'rgba(255,255,255,0.20)'} />}
                  {blockW2 > 0 && <Rect x={bx2 + gap / 2} y={PHASE_BAR_Y} width={blockW2 - gap} height={PHASE_BAR_H} rx={PHASE_BAR_R}
                    fill={activePhase === 'open'   ? '#00D7A9' : 'rgba(255,255,255,0.20)'} />}
                  {blockW3 > 0 && <Rect x={bx3 + gap / 2} y={PHASE_BAR_Y} width={blockW3 - gap / 2} height={PHASE_BAR_H} rx={PHASE_BAR_R}
                    fill={activePhase === 'closed' ? '#FD8D8F' : 'rgba(255,255,255,0.20)'} />}
                </>
              );
            })()}
          </Svg>
        </View>

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {hasDoses
              ? `Caffeine drops below sleep threshold at ${clearanceLabel}.`
              : t('adenosine.empty_footer')}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#060D09',
  },
  topSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrapper: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  iconEmoji: {
    fontSize: 16,
  },
  headerLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontFamily: fontFamily.regular,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.68,
  },
  title: {
    color: '#FFFFFF',
    fontFamily: fontFamily.regular,
    fontSize: 28,
    letterSpacing: -0.56,
    lineHeight: 34,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  chartSection: {
    height: CHART_HEIGHT,
    backgroundColor: '#000',
    marginTop: 12,
  },
  footer: {
    backgroundColor: 'rgba(255,255,255,0.20)',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  footerText: {
    color: 'rgba(255,255,255,0.72)',
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 17,
  },
});
