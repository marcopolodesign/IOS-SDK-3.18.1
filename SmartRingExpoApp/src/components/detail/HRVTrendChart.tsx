import React, { useRef, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import Svg, { Rect, Path, G, Line } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { spacing, fontSize, fontFamily } from '../../theme/colors';

const SCREEN_WIDTH = Dimensions.get('window').width;
const COL_W = 32;
const BAR_W = 22;
const CHART_H = 100;
const PAD_V = 8;
const GHOST_COLS = Math.ceil(SCREEN_WIDTH / COL_W / 2) + 1;

// SDNN thresholds: >=50 optimal (green), >=30 moderate (yellow), <30 low (red)
function sdnnColor(val: number): string {
  if (val >= 50) return '#4ADE80';
  if (val >= 30) return '#FBBF24';
  if (val > 0) return '#EF4444';
  return '#222233';
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

interface HRVTrendChartProps {
  dayEntries: Array<{ label: string; dateKey: string }>;
  values: Array<{ dateKey: string; sdnn: number }>;
  selectedIndex: number;
  onSelectDay: (index: number) => void;
}

export function HRVTrendChart({ dayEntries, values, selectedIndex, onSelectDay }: HRVTrendChartProps) {
  const scrollRef = useRef<ScrollView>(null);
  const lastHapticColRef = useRef<number>(-1);

  const reversed = [...dayEntries].reverse();
  const todayColIndex = reversed.length - 1;
  const totalCols = reversed.length + GHOST_COLS;
  const contentW = totalCols * COL_W;
  const maxBarH = CHART_H - PAD_V * 2;
  const baseline = CHART_H - PAD_V;

  // SDNN values are 0-100+, normalize bar heights relative to 80 (anything above still fills full bar)
  const MAX_SDNN = 80;

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

  const rawValues = reversed.map(d => values.find(v => v.dateKey === d.dateKey)?.sdnn ?? 0);

  // Rolling average trendline
  const trendPoints: Array<{ x: number; y: number }> = [];
  reversed.forEach((_, i) => {
    const avg = rollingAvg(rawValues, i);
    if (avg !== null) {
      const cx = i * COL_W + COL_W / 2;
      const barH = (Math.min(avg, MAX_SDNN) / MAX_SDNN) * maxBarH;
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
              <Line
                x1={0} y1={baseline} x2={contentW} y2={baseline}
                stroke="rgba(255,255,255,0.12)" strokeWidth={1}
              />

              {/* Bars */}
              {reversed.map((d, i) => {
                const v = rawValues[i];
                const barH = Math.max(3, (Math.min(v, MAX_SDNN) / MAX_SDNN) * maxBarH);
                const cx = i * COL_W + COL_W / 2;
                const x = cx - BAR_W / 2;
                const y = baseline - barH;
                const origIndex = reversed.length - 1 - i;
                const isSel = origIndex === selectedIndex;
                return (
                  <Rect
                    key={d.dateKey}
                    x={x} y={y} width={BAR_W} height={barH}
                    fill={sdnnColor(v)}
                    opacity={isSel ? 1 : 0.28}
                  />
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
    marginBottom: 4,
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
