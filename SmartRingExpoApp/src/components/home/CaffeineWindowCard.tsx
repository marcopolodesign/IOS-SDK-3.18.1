import React, { useMemo } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
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
import { InfoButton } from '../common/InfoButton';
import { fontFamily, spacing } from '../../theme/colors';

// ─── Chart geometry ───────────────────────────────────────────────────────────
const CHART_PAD_L  = 30;   // left space for Y-axis labels
const CHART_PAD_R  = 8;
const TIME_START   = 6;    // 6 AM
const TIME_END     = 23;   // 11 PM
const TIME_SPAN    = TIME_END - TIME_START;
const CURVE_TOP_Y  = 10;   // y at peak (100%)
const CURVE_BOT_Y  = 75;   // y at zero

const BLOCK_R      = 10;
const PHASE_BAR_H  = 10;
const PHASE_BAR_R  = 4;                          // softer radius than background blocks
const LABEL_Y      = CURVE_BOT_Y + 80;           // baseline of time labels
const BLOCKS_H     = LABEL_Y - 52;               // blocks stop well above phase bar
const PHASE_BAR_Y  = LABEL_Y - PHASE_BAR_H - 22; // generous gap above labels
const CHART_HEIGHT = LABEL_Y + 18;

const DOSE_MG             = 400;
const Y_TICKS             = [400, 200, 0] as const;
const SLEEP_THRESHOLD_MG  = 100; // max caffeine compatible with sleep onset

// ─── Caffeine PK model ────────────────────────────────────────────────────────
const ABSORPTION_H = 0.75;  // 45 min to peak
const HALF_LIFE_H  = 5;

function concAt(hour: number, intakeHour: number): number {
  if (hour <= intakeHour) return 0;
  const peak = intakeHour + ABSORPTION_H;
  if (hour < peak) return (hour - intakeHour) / ABSORPTION_H; // linear rise
  return Math.pow(0.5, (hour - peak) / HALF_LIFE_H);          // exponential decay
}

function yFor(conc: number): number {
  return CURVE_TOP_Y + (1 - conc) * (CURVE_BOT_Y - CURVE_TOP_Y);
}

function mgToY(mg: number): number {
  return yFor(mg / DOSE_MG);
}

function buildCurvePath(intakeHour: number, innerW: number): string {
  const pts: string[] = [];
  for (let t = intakeHour; t <= TIME_END + 0.05; t += 0.12) {
    const tc = Math.min(t, TIME_END);
    const x  = (CHART_PAD_L + ((tc - TIME_START) / TIME_SPAN) * innerW).toFixed(1);
    const y  = yFor(concAt(tc, intakeHour)).toFixed(1);
    pts.push(pts.length === 0 ? `M${x},${y}` : `L${x},${y}`);
  }
  return pts.join(' ');
}

// Returns the hour at which caffeine drops to 25% of peak (≈100 mg / 400 mg dose)
function calcClearanceHour(intakeHour: number): number {
  const peak = intakeHour + ABSORPTION_H;
  // 0.5^(t/HALF_LIFE) = 0.25  →  t = 2 * HALF_LIFE
  return Math.min(peak + 2 * HALF_LIFE_H, TIME_END);
}

// ─── Props ───────────────────────────────────────────────────────────────────
interface CaffeineWindowCardProps {
  intakeHour?: number;      // decimal hour, e.g. 8.5 = 8:30 AM
  currentHour?: number;     // defaults to new Date()
  clearanceLabel?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────
export function CaffeineWindowCard({
  intakeHour = 8.0,
  currentHour,
  clearanceLabel = '9:30 PM tonight',
}: CaffeineWindowCardProps) {
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = screenWidth - spacing.md * 2;
  const innerW    = cardWidth - CHART_PAD_L - CHART_PAD_R;

  const now = currentHour ?? (() => {
    const d = new Date();
    return d.getHours() + d.getMinutes() / 60;
  })();
  const clampedNow = Math.max(TIME_START, Math.min(TIME_END, now));

  const tx = (h: number) => CHART_PAD_L + ((h - TIME_START) / TIME_SPAN) * innerW;

  const curvePath = useMemo(
    () => buildCurvePath(intakeHour, innerW),
    [intakeHour, innerW],
  );

  // Window blocks — boundaries tied to actual intake/clearance times
  const blockInset  = 8;
  const bx1         = CHART_PAD_L + blockInset;
  const blockRight  = CHART_PAD_L + innerW - blockInset;
  const bx2         = Math.max(bx1, Math.min(tx(intakeHour), blockRight));
  const bx3         = Math.max(bx2, Math.min(tx(calcClearanceHour(intakeHour)), blockRight));
  const blockW1     = bx2 - bx1;
  const blockW2     = bx3 - bx2;
  const blockW3     = blockRight - bx3;
  const blockTotalW = blockRight - bx1;

  const clearHour   = calcClearanceHour(intakeHour);
  const activePhase = clampedNow < intakeHour ? 'pre' : clampedNow < clearHour ? 'open' : 'closed';

  const nowX = tx(clampedNow);
  const nowY = yFor(concAt(clampedNow, intakeHour));

  const timeLabels = [
    { label: '6AM',  x: tx(6) },
    { label: '12PM', x: tx(12) - 11 },
    { label: '3PM',  x: tx(15) },
    { label: '11PM', x: tx(23) - 22 },
  ];

  const yAxisLabels = Y_TICKS.map(mg => ({
    mg,
    y: mgToY(mg),
    label: `${mg}`,
  }));

  return (
    <View style={[styles.card, { width: cardWidth }]}>

      {/* ── Green radial gradient — top section header background ── */}
      <Svg
        style={StyleSheet.absoluteFill}
        viewBox={`0 0 ${cardWidth} 430`}
        preserveAspectRatio="xMidYMid slice"
      >
        <Defs>
          <SvgRadialGradient id="greenTop" cx="51.5%" cy="-8%" rx="82%" ry="55%">
            <Stop offset="0%"   stopColor="#1F9F50" stopOpacity={1}   />
            <Stop offset="94.7%" stopColor="#1F9F50" stopOpacity={0.15} />
            <Stop offset="100%" stopColor="#1F9F50" stopOpacity={0}   />
          </SvgRadialGradient>
        </Defs>
        <Rect x="0" y="0" width={cardWidth} height="430" fill="url(#greenTop)" />
      </Svg>

      {/* ── Header + text ── */}
      <View style={styles.topSection}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <View style={styles.iconWrapper}>
              <Text style={styles.iconEmoji}>☕</Text>
            </View>
            <Text style={styles.headerLabel}>CAFFEINE WINDOW</Text>
          </View>
          <InfoButton metricKey="caffeine_window" />
        </View>
        <Text style={styles.title}>Adenosine Window{'\n'}Clearance</Text>
        <Text style={styles.subtitle}>
          Delay caffeine to let residual adenosine clear, and heighten the stimulant effect during your productivity peak.
        </Text>
      </View>

      {/* ── Chart — solid black base so green doesn't bleed through ── */}
      <View style={[styles.chartSection, { width: cardWidth }]}>

        {/* ── Window blocks: pre / open / closed — full chart background ── */}
        <Svg
          style={StyleSheet.absoluteFill}
          width={cardWidth}
          height={CHART_HEIGHT}
        >
          <Defs>
            {/* Pre: amber dominant, quick teal fade at right edge */}
            <SvgLinearGradient id="w_pre" x1={bx1} y1={0} x2={bx2} y2={0} gradientUnits="userSpaceOnUse">
              <Stop offset="0%"   stopColor="#FFAC3F" />
              <Stop offset="65%"  stopColor="#FFAC3F" />
              <Stop offset="100%" stopColor="#00D7A9" />
            </SvgLinearGradient>
            {/* Open: solid teal */}
            <SvgLinearGradient id="w_open" x1={bx2} y1={0} x2={bx3} y2={0} gradientUnits="userSpaceOnUse">
              <Stop offset="0%"   stopColor="#00D7A9" />
              <Stop offset="100%" stopColor="#00D7A9" />
            </SvgLinearGradient>
            {/* Closed: quick teal fade at left edge, rose dominant */}
            <SvgLinearGradient id="w_closed" x1={bx3} y1={0} x2={bx3 + blockW3} y2={0} gradientUnits="userSpaceOnUse">
              <Stop offset="0%"   stopColor="#00D7A9" />
              <Stop offset="35%"  stopColor="#FD8D8F" />
              <Stop offset="100%" stopColor="#FD8D8F" />
            </SvgLinearGradient>
            {/* Dark top vignette across all blocks */}
            <SvgLinearGradient id="w_vignette" x1={0} y1={0} x2={0} y2={BLOCKS_H} gradientUnits="userSpaceOnUse">
              <Stop offset="0%"   stopColor="#000000" stopOpacity={1} />
              <Stop offset="100%" stopColor="#000000" stopOpacity={0} />
            </SvgLinearGradient>
          </Defs>

          <Rect x={bx1} y={0} width={blockW1} height={BLOCKS_H} rx={BLOCK_R} fill="url(#w_pre)"    />
          <Rect x={bx2} y={0} width={blockW2} height={BLOCKS_H} rx={BLOCK_R} fill="url(#w_open)"   />
          <Rect x={bx3} y={0} width={blockW3} height={BLOCKS_H} rx={BLOCK_R} fill="url(#w_closed)" />
          <Rect x={bx1} y={0} width={blockTotalW} height={BLOCKS_H}           fill="url(#w_vignette)" />
        </Svg>

        {/* Curve + labels SVG — full chart size, on top of blocks */}
        <Svg width={cardWidth} height={CHART_HEIGHT} style={StyleSheet.absoluteFill}>

          {/* Y-axis: gridlines + mg labels */}
          {yAxisLabels.map(({ mg, y, label }) => (
            <React.Fragment key={mg}>
              <Line
                x1={CHART_PAD_L} y1={y}
                x2={cardWidth - CHART_PAD_R} y2={y}
                stroke="rgba(255,255,255,0.07)"
                strokeWidth={1}
                strokeDasharray="2,4"
              />
              <SvgText
                x={CHART_PAD_L - 4}
                y={y + 4}
                fill="rgba(255,255,255,0.38)"
                fontSize={9}
                fontFamily={fontFamily.regular}
                textAnchor="end"
              >
                {label}
              </SvgText>
            </React.Fragment>
          ))}
          <SvgText x={2} y={10} fill="rgba(255,255,255,0.25)" fontSize={8} fontFamily={fontFamily.regular}>
            mg
          </SvgText>

          {/* Sleep threshold — max caffeine for sleep onset */}
          <Line
            x1={CHART_PAD_L} y1={mgToY(SLEEP_THRESHOLD_MG)}
            x2={cardWidth - CHART_PAD_R} y2={mgToY(SLEEP_THRESHOLD_MG)}
            stroke="rgba(253,141,143,0.65)"
            strokeWidth={1}
            strokeDasharray="4,4"
          />
          <SvgText
            x={cardWidth - CHART_PAD_R}
            y={mgToY(SLEEP_THRESHOLD_MG) - 4}
            fill="rgba(253,141,143,0.80)"
            fontSize={8}
            fontFamily={fontFamily.regular}
            textAnchor="end"
          >
            sleep limit
          </SvgText>

          {/* NOW dashed line */}
          <Line
            x1={nowX} y1={0}
            x2={nowX} y2={nowY - 8}
            stroke="rgba(255,255,255,0.35)"
            strokeWidth={1}
            strokeDasharray="3,3"
          />

          {/* Curve */}
          <Path
            d={curvePath}
            fill="none"
            stroke="white"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* NOW dot */}
          <Circle cx={nowX} cy={nowY} r={8}   fill="rgba(255,255,255,0.22)" />
          <Circle cx={nowX} cy={nowY} r={4.5} fill="white" />

          {/* Time axis labels */}
          {timeLabels.map(({ label, x }) => (
            <SvgText
              key={label}
              x={x}
              y={LABEL_Y}
              fill="rgba(255,255,255,0.38)"
              fontSize={10}
              fontFamily={fontFamily.regular}
            >
              {label}
            </SvgText>
          ))}

          {/* Phase indicator bar — plain solid colors, above time labels */}
          {(() => {
            const gap = 5;
            return (
              <>
                <Rect
                  x={bx1} y={PHASE_BAR_Y} width={blockW1 - gap / 2} height={PHASE_BAR_H} rx={PHASE_BAR_R}
                  fill={activePhase === 'pre'    ? '#FFAC3F' : 'rgba(255,255,255,0.20)'}
                />
                <Rect
                  x={bx2 + gap / 2} y={PHASE_BAR_Y} width={blockW2 - gap} height={PHASE_BAR_H} rx={PHASE_BAR_R}
                  fill={activePhase === 'open'   ? '#00D7A9' : 'rgba(255,255,255,0.20)'}
                />
                <Rect
                  x={bx3 + gap / 2} y={PHASE_BAR_Y} width={blockW3 - gap / 2} height={PHASE_BAR_H} rx={PHASE_BAR_R}
                  fill={activePhase === 'closed' ? '#FD8D8F' : 'rgba(255,255,255,0.20)'}
                />
              </>
            );
          })()}
        </Svg>
      </View>

      {/* ── Footer ── */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Caffeine concentration drops below sleep threshold at {clearanceLabel}.
        </Text>
      </View>
    </View>
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
