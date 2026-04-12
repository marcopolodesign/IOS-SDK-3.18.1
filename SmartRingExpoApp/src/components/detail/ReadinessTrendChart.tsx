import React, { useRef, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import Svg, { Rect, Path, G, Line, Text as SvgText } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { fontFamily } from '../../theme/colors';

const SCREEN_WIDTH = Dimensions.get('window').width;
const COL_W = 38;
const BAR_W = 28;
const CHART_H = 130;
const PAD_V = 20;
const GHOST_COLS = Math.ceil(SCREEN_WIDTH / COL_W / 2) + 1;

const R_TOP = 8;
const R_BOT = 2;

function readinessColor(val: number): string {
  if (val >= 80) return '#4ADE80';
  if (val >= 60) return '#FBBF24';
  if (val > 0) return '#EF4444';
  return '#222233';
}

/** SVG path for a rect with independent top and bottom corner radii. */
function roundedBar(x: number, y: number, w: number, h: number, rTop: number, rBot: number): string {
  const rt = Math.min(rTop, h / 2, w / 2);
  const rb = Math.min(rBot, h / 2, w / 2);
  return [
    `M ${x + rt} ${y}`,
    `H ${x + w - rt}`,
    `Q ${x + w} ${y} ${x + w} ${y + rt}`,
    `V ${y + h - rb}`,
    `Q ${x + w} ${y + h} ${x + w - rb} ${y + h}`,
    `H ${x + rb}`,
    `Q ${x} ${y + h} ${x} ${y + h - rb}`,
    `V ${y + rt}`,
    `Q ${x} ${y} ${x + rt} ${y}`,
    `Z`,
  ].join(' ');
}

/** 5-day centered rolling average. Skips zero/null values. */
function rollingAvg(values: number[], i: number, window = 5): number | null {
  const half = Math.floor(window / 2);
  const from = Math.max(0, i - half);
  const to = Math.min(values.length - 1, i + half);
  const valid = values.slice(from, to + 1).filter(v => v > 0);
  return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
}

function monotoneCubicPath(pts: Array<{ x: number; y: number }>): string {
  if (pts.length < 2) return '';
  const n = pts.length;
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    d.push((pts[i + 1].y - pts[i].y) / (pts[i + 1].x - pts[i].x));
  }
  const m: number[] = new Array(n).fill(0);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  }
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const alpha = m[i] / d[i];
    const beta = m[i + 1] / d[i];
    const r = alpha * alpha + beta * beta;
    if (r > 9) {
      const t = 3 / Math.sqrt(r);
      m[i] = t * alpha * d[i];
      m[i + 1] = t * beta * d[i];
    }
  }
  let path = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const dx = (pts[i + 1].x - pts[i].x) / 3;
    path += ` C ${pts[i].x + dx} ${pts[i].y + m[i] * dx} ${pts[i + 1].x - dx} ${pts[i + 1].y - m[i + 1] * dx} ${pts[i + 1].x} ${pts[i + 1].y}`;
  }
  return path;
}

interface ReadinessTrendChartProps {
  dayEntries: Array<{ label: string; dateKey: string }>;
  scores: Array<{ dateKey: string; score: number }>;
  selectedIndex: number;
  onSelectDay: (index: number) => void;
}

export function ReadinessTrendChart({ dayEntries, scores, selectedIndex, onSelectDay }: ReadinessTrendChartProps) {
  const scrollRef = useRef<ScrollView>(null);
  const lastHapticColRef = useRef<number>(-1);

  const reversed = [...dayEntries].reverse();
  const todayColIndex = reversed.length - 1;
  const totalCols = reversed.length + GHOST_COLS;
  const contentW = totalCols * COL_W;
  const maxBarH = CHART_H - PAD_V * 2;
  const baseline = CHART_H - PAD_V;

  const MAX_SCORE = 100;

  useEffect(() => {
    const todayCenterX = todayColIndex * COL_W + COL_W / 2;
    const offset = todayCenterX - SCREEN_WIDTH / 2;
    scrollRef.current?.scrollTo({ x: Math.max(0, offset), animated: false });
    lastHapticColRef.current = todayColIndex;
  }, []);

  function handleScroll(scrollX: number) {
    const centeredCol = Math.round((scrollX + SCREEN_WIDTH / 2 - COL_W / 2) / COL_W);
    const clamped = Math.max(0, Math.min(reversed.length - 1, centeredCol));
    const origIndex = reversed.length - 1 - clamped;
    if (clamped !== lastHapticColRef.current) {
      lastHapticColRef.current = clamped;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onSelectDay(origIndex);
    }
  }

  const rawValues = reversed.map(d => scores.find(s => s.dateKey === d.dateKey)?.score ?? 0);

  // Rolling average trendline
  const trendPoints: Array<{ x: number; y: number }> = [];
  reversed.forEach((_, i) => {
    const avg = rollingAvg(rawValues, i);
    if (avg !== null) {
      const cx = i * COL_W + COL_W / 2;
      const barH = (Math.min(avg, MAX_SCORE) / MAX_SCORE) * maxBarH;
      trendPoints.push({ x: cx, y: baseline - barH });
    }
  });
  const trendPath = monotoneCubicPath(trendPoints);

  function parseDateParts(dateKey: string): { day: string; month: string } {
    const [y, mo, d] = dateKey.split('-').map(Number);
    const date = new Date(y, mo - 1, d);
    return {
      day: String(d),
      month: date.toLocaleDateString(undefined, { month: 'short' }),
    };
  }

  const maxScroll = Math.max(0, contentW - SCREEN_WIDTH);
  const snapOffsets = reversed.map((_, i) =>
    Math.min(maxScroll, Math.max(0, i * COL_W + COL_W / 2 - SCREEN_WIDTH / 2))
  );

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      scrollEventThrottle={16}
      decelerationRate="fast"
      snapToOffsets={snapOffsets}
      disableIntervalMomentum
      onScroll={e => handleScroll(e.nativeEvent.contentOffset.x)}
    >
      <View style={{ width: contentW }}>
        {/* Date labels */}
        <View style={styles.labelsRow}>
          {reversed.map((d, i) => {
            const origIndex = reversed.length - 1 - i;
            const isSelected = origIndex === selectedIndex;
            return (
              <TouchableOpacity
                key={d.dateKey}
                style={styles.labelCell}
                onPress={() => onSelectDay(origIndex)}
                activeOpacity={0.7}
              >
                {(() => {
                  const { day, month } = parseDateParts(d.dateKey);
                  return (
                    <>
                      <Text style={[styles.labelDay, isSelected && styles.labelDaySelected]}>{day}</Text>
                      <Text style={[styles.labelMonth, isSelected && styles.labelMonthSelected]}>{month}</Text>
                    </>
                  );
                })()}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Bar chart + trendline */}
        <View style={{ width: contentW, height: CHART_H }}>
          <Svg width={contentW} height={CHART_H}>
            <G>
              {/* Dotted guide lines at 25 / 50 / 75 */}
              {[25, 50, 75].map(threshold => {
                const lineY = baseline - (threshold / MAX_SCORE) * maxBarH;
                return (
                  <Line
                    key={threshold}
                    x1={0} y1={lineY} x2={contentW} y2={lineY}
                    stroke="rgba(255,255,255,0.08)" strokeWidth={1}
                    strokeDasharray="3,4"
                  />
                );
              })}

              {/* Baseline */}
              <Line
                x1={0} y1={baseline} x2={contentW} y2={baseline}
                stroke="rgba(255,255,255,0.12)" strokeWidth={1}
              />

              {/* Bars + score labels inside */}
              {reversed.map((d, i) => {
                const v = rawValues[i];
                const barH = Math.max(3, (Math.min(v, MAX_SCORE) / MAX_SCORE) * maxBarH);
                const cx = i * COL_W + COL_W / 2;
                const x = cx - BAR_W / 2;
                const y = baseline - barH;
                const origIndex = reversed.length - 1 - i;
                const isSel = origIndex === selectedIndex;
                const showLabel = v > 0 && barH >= 24;
                return (
                  <G key={d.dateKey}>
                    <Path
                      d={roundedBar(x, y, BAR_W, barH, R_TOP, R_BOT)}
                      fill={isSel ? readinessColor(v) : 'rgba(255,255,255,0.4)'}
                    />
                    {showLabel && (
                      <SvgText
                        x={cx}
                        y={y + 10 + 9}
                        textAnchor="middle"
                        fontSize={12}
                        fontWeight="bold"
                        fill={isSel ? '#FFFFFF' : 'rgba(255,255,255,0.8)'}
                        fontFamily={fontFamily.demiBold}
                      >
                        {String(v)}
                      </SvgText>
                    )}
                  </G>
                );
              })}

              {/* Trendline */}
              {trendPath.length > 0 && (
                <Path
                  d={trendPath}
                  stroke="rgba(255,255,255,0.55)"
                  strokeWidth={1.5}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Tap targets */}
              {reversed.map((d, i) => {
                const origIndex = reversed.length - 1 - i;
                return (
                  <Rect
                    key={`t-${d.dateKey}`}
                    x={i * COL_W} y={0} width={COL_W} height={CHART_H}
                    fill="transparent"
                    onPress={() => onSelectDay(origIndex)}
                  />
                );
              })}
            </G>
          </Svg>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  labelsRow: {
    flexDirection: 'row',
    marginBottom: -15,
    marginTop: 12,
  },
  labelCell: {
    width: COL_W,
    alignItems: 'center',
    gap: 1,
  },
  labelDay: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 13,
    fontFamily: fontFamily.regular,
    lineHeight: 16,
  },
  labelDaySelected: {
    color: '#FFFFFF',
    fontFamily: fontFamily.demiBold,
  },
  labelMonth: {
    color: 'rgba(255,255,255,0.22)',
    fontSize: 9,
    fontFamily: fontFamily.regular,
    lineHeight: 11,
  },
  labelMonthSelected: {
    color: 'rgba(255,255,255,0.7)',
  },
});
