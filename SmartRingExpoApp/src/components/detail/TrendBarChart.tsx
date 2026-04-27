import React, { useRef, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import Svg, { Rect, Path, G, Line, Text as SvgText } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { fontFamily } from '../../theme/colors';
import { roundedBar, rollingAvg, monotoneCubicPath, parseLocalDate } from '../../utils/chartMath';

const SCREEN_WIDTH = Dimensions.get('window').width;

const R_TOP = 8;
const R_BOT = 2;


export interface TrendBarChartProps {
  dayEntries: Array<{ label: string; dateKey: string }>;
  /** Numeric value per day. 0 = no data. */
  values: Array<{ dateKey: string; value: number }>;
  selectedIndex: number;
  onSelectDay: (index: number) => void;
  /** Maps a value to a bar fill color for the selected bar. */
  colorFn: (value: number) => string;
  /** Upper bound of the display range. Bars clamp to this. */
  maxValue: number;
  /** Lower bound of the display range. Default: 0. Useful for narrow-range metrics like temperature. */
  minValue?: number;
  /** Show numeric value label inside tall bars. Default: true. */
  showValueLabels?: boolean;
  /** Column width in px. Default: 38. */
  colWidth?: number;
  /** Bar width in px. Default: 28. */
  barWidth?: number;
  /** Chart height in px. Default: 130. */
  chartHeight?: number;
  /** Vertical padding inside chart. Default: 20. */
  padV?: number;
  /** Optional dashed horizontal guide lines at these raw values. */
  guideLines?: number[];
  /** Use rounded-corner Path bars (true) or plain Rect bars (false). Default: true. */
  roundedBars?: boolean;
  /** When roundedBars=false, opacity for unselected bars. Default: 0.28. */
  unselectedOpacity?: number;
  /** Shaded baseline band drawn behind bars. Color defaults to rgba(255,255,255,0.07). */
  bandRange?: { min: number; max: number; color?: string };
  /** Render date labels below bars (after the SVG). Default: false (legacy overlap). */
  labelsBelow?: boolean;
}

export function TrendBarChart({
  dayEntries,
  values,
  selectedIndex,
  onSelectDay,
  colorFn,
  maxValue,
  minValue = 0,
  showValueLabels = true,
  colWidth = 38,
  barWidth = 28,
  chartHeight = 130,
  padV = 20,
  guideLines,
  roundedBars = true,
  unselectedOpacity = 0.28,
  bandRange,
  labelsBelow = false,
}: TrendBarChartProps) {
  const scrollRef = useRef<ScrollView>(null);
  const lastHapticColRef = useRef<number>(-1);

  const ghostCols = Math.ceil(SCREEN_WIDTH / colWidth / 2) + 1;

  const reversed = useMemo(() => [...dayEntries].reverse(), [dayEntries]);

  const todayColIndex = reversed.length - 1;
  const totalCols = reversed.length + ghostCols;
  const contentW = totalCols * colWidth;
  const maxBarH = chartHeight - padV * 2;
  const baseline = chartHeight - padV;

  const denom = Math.max(1, maxValue - minValue);

  const { rawValues, dateLabels, trendPath, snapOffsets } = useMemo(() => {
    const rv = reversed.map(d => values.find(s => s.dateKey === d.dateKey)?.value ?? 0);

    const dl = reversed.map(d => {
      const date = parseLocalDate(d.dateKey);
      return { day: String(date.getDate()), month: date.toLocaleDateString(undefined, { month: 'short' }) };
    });

    const trendPts: Array<{ x: number; y: number }> = [];
    rv.forEach((_, i) => {
      const avg = rollingAvg(rv, i);
      if (avg !== null) {
        const cx = i * colWidth + colWidth / 2;
        const clamped = Math.max(minValue, Math.min(avg, maxValue));
        const barH = ((clamped - minValue) / denom) * maxBarH;
        trendPts.push({ x: cx, y: baseline - barH });
      }
    });

    const maxScroll = Math.max(0, contentW - SCREEN_WIDTH);
    const snaps = reversed.map((_, i) =>
      Math.min(maxScroll, Math.max(0, i * colWidth + colWidth / 2 - SCREEN_WIDTH / 2))
    );

    return { rawValues: rv, dateLabels: dl, trendPath: monotoneCubicPath(trendPts), snapOffsets: snaps };
  }, [reversed, values, colWidth, minValue, maxValue, denom, maxBarH, baseline, contentW]);

  useEffect(() => {
    const todayCenterX = todayColIndex * colWidth + colWidth / 2;
    const offset = todayCenterX - SCREEN_WIDTH / 2;
    scrollRef.current?.scrollTo({ x: Math.max(0, offset), animated: false });
    lastHapticColRef.current = todayColIndex;
  }, []);

  function handleScroll(scrollX: number) {
    const centeredCol = Math.round((scrollX + SCREEN_WIDTH / 2 - colWidth / 2) / colWidth);
    const clamped = Math.max(0, Math.min(reversed.length - 1, centeredCol));
    const origIndex = reversed.length - 1 - clamped;
    if (clamped !== lastHapticColRef.current) {
      lastHapticColRef.current = clamped;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onSelectDay(origIndex);
    }
  }

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
        {/* Legacy: labels overlap-positioned above bars (default for detail screens) */}
        {!labelsBelow && (
          <View style={[styles.labelsRow, { marginBottom: -15, marginTop: 12 }]}>
            {reversed.map((d, i) => {
              const origIndex = reversed.length - 1 - i;
              const isSelected = origIndex === selectedIndex;
              const { day, month } = dateLabels[i];
              return (
                <TouchableOpacity
                  key={d.dateKey}
                  style={[styles.labelCell, { width: colWidth }]}
                  onPress={() => onSelectDay(origIndex)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.labelDay, isSelected && styles.labelDaySelected]}>{day}</Text>
                  <Text style={[styles.labelMonth, isSelected && styles.labelMonthSelected]}>{month}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Bar chart + trendline */}
        <View style={{ width: contentW, height: chartHeight }}>
          <Svg width={contentW} height={chartHeight}>
            <G>
              {/* Baseline band */}
              {bandRange && (() => {
                const clampedMax = Math.min(bandRange.max, maxValue);
                const clampedMin = Math.max(bandRange.min, minValue);
                if (clampedMin >= clampedMax) return null;
                const bandTopY = baseline - ((clampedMax - minValue) / denom) * maxBarH;
                const bandBotY = baseline - ((clampedMin - minValue) / denom) * maxBarH;
                return (
                  <Rect
                    x={0} y={bandTopY}
                    width={contentW}
                    height={Math.max(0, bandBotY - bandTopY)}
                    fill={bandRange.color ?? 'rgba(255,255,255,0.07)'}
                    rx={2}
                  />
                );
              })()}

              {/* Optional guide lines */}
              {guideLines?.map(threshold => {
                const lineY = baseline - ((threshold - minValue) / denom) * maxBarH;
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
              <Line x1={0} y1={baseline} x2={contentW} y2={baseline}
                stroke="rgba(255,255,255,0.12)" strokeWidth={1} />

              {/* Bars */}
              {reversed.map((d, i) => {
                const v = rawValues[i];
                const clamped = v <= 0 ? minValue : Math.max(minValue, Math.min(v, maxValue));
                const barH = Math.max(3, ((clamped - minValue) / denom) * maxBarH);
                const cx = i * colWidth + colWidth / 2;
                const x = cx - barWidth / 2;
                const y = baseline - barH;
                const origIndex = reversed.length - 1 - i;
                const isSel = origIndex === selectedIndex;
                const barColor = isSel ? colorFn(v) : 'rgba(255,255,255,0.4)';

                return (
                  <G key={d.dateKey}>
                    {roundedBars ? (
                      <Path
                        d={roundedBar(x, y, barWidth, barH, R_TOP, R_BOT)}
                        fill={barColor}
                      />
                    ) : (
                      <Rect
                        x={x} y={y} width={barWidth} height={barH}
                        rx={2} ry={2}
                        fill={colorFn(v)}
                        opacity={isSel ? 1 : unselectedOpacity}
                      />
                    )}
                    {showValueLabels && v > 0 && barH >= 24 && (
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

            </G>
          </Svg>
        </View>

        {/* Labels below bars */}
        {labelsBelow && (
          <View style={[styles.labelsRow, { marginTop: 6 }]}>
            {reversed.map((d, i) => {
              const origIndex = reversed.length - 1 - i;
              const isSelected = origIndex === selectedIndex;
              const { day, month } = dateLabels[i];
              return (
                <TouchableOpacity
                  key={d.dateKey}
                  style={[styles.labelCell, { width: colWidth }]}
                  onPress={() => onSelectDay(origIndex)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.labelDay, isSelected && styles.labelDaySelected]}>{day}</Text>
                  <Text style={[styles.labelMonth, isSelected && styles.labelMonthSelected]}>{month}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  labelsRow: {
    flexDirection: 'row',
  },
  labelCell: {
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
