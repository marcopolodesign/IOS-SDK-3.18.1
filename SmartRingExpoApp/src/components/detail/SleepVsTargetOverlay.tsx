import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Path, Line, Circle, Text as SvgText } from 'react-native-svg';
import { monotoneCubicPath, parseLocalDate } from '../../utils/chartMath';
import { fontFamily, spacing } from '../../theme/colors';
import type { NightlyPoint } from '../../types/sleepDebt.types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_H = 160;
const PAD_LEFT = 40;
const PAD_RIGHT = 8;
const PAD_V = 16;
const REC_COLOR = 'rgba(107,142,255,0.8)';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface Props {
  nights: NightlyPoint[];
  height?: number;
}

export function SleepVsTargetOverlay({ nights, height = CHART_H }: Props) {
  const chartW = SCREEN_WIDTH - spacing.md * 2 - spacing.sm * 2;
  const bodyW = chartW - PAD_LEFT - PAD_RIGHT;
  const graphTop = PAD_V;
  const graphBottom = height - PAD_V - 18;
  const graphH = graphBottom - graphTop;

  const domainMax = useMemo(() => {
    if (nights.length === 0) return 540;
    const maxActual = Math.max(...nights.map(n => n.actualMin));
    const maxRec = Math.max(...nights.map(n => n.recommendedMin ?? n.targetMin));
    return Math.max(maxActual, maxRec, 60) * 1.1;
  }, [nights]);

  const toX = (i: number) =>
    PAD_LEFT + (nights.length > 1 ? (i / (nights.length - 1)) * bodyW : bodyW / 2);
  const toY = (val: number) =>
    graphTop + (1 - Math.min(val, domainMax) / domainMax) * graphH;

  const { actualPath, recPath, actualPts } = useMemo(() => {
    if (nights.length < 2) return { actualPath: '', recPath: '', actualPts: [] };
    const aPts = nights.map((n, i) => ({ x: toX(i), y: toY(n.actualMin) }));
    const rPts = nights.map((n, i) => ({ x: toX(i), y: toY(n.recommendedMin ?? n.targetMin) }));
    return {
      actualPath: monotoneCubicPath(aPts),
      recPath: monotoneCubicPath(rPts),
      actualPts: aPts,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nights, chartW, domainMax]);

  const areaPath = actualPts.length >= 2
    ? `${actualPath} L ${actualPts[actualPts.length - 1].x} ${graphBottom} L ${actualPts[0].x} ${graphBottom} Z`
    : '';

  const yTickStep = domainMax > 480 ? 120 : 60;
  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let v = 0; v <= domainMax; v += yTickStep) ticks.push(v);
    return ticks;
  }, [domainMax, yTickStep]);

  if (nights.length < 2) return null;

  return (
    <View>
      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: 'rgba(255,255,255,0.8)' }]} />
          <Text style={styles.legendLabel}>Actual</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={styles.legendDash} />
          <Text style={styles.legendLabel}>Recommended</Text>
        </View>
      </View>

      <View style={{ height }}>
        <Svg width="100%" height={height} viewBox={`0 0 ${chartW} ${height}`}>
          <Defs>
            <LinearGradient id="actualAreaGrad" gradientUnits="userSpaceOnUse" x1="0" y1={graphTop} x2="0" y2={graphBottom}>
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.12} />
              <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
            </LinearGradient>
          </Defs>

          {/* Y-axis ticks */}
          {yTicks.map(tick => (
            <React.Fragment key={tick}>
              <Line
                x1={PAD_LEFT} y1={toY(tick)} x2={chartW - PAD_RIGHT} y2={toY(tick)}
                stroke="rgba(255,255,255,0.06)" strokeWidth={1}
              />
              <SvgText
                x={PAD_LEFT - 4} y={toY(tick) + 4}
                textAnchor="end"
                fontSize={9}
                fill="rgba(255,255,255,0.3)"
                fontFamily={fontFamily.regular}
              >
                {tick < 60 ? `${tick}m` : `${tick / 60}h`}
              </SvgText>
            </React.Fragment>
          ))}

          {/* Area under actual */}
          {areaPath.length > 0 && <Path d={areaPath} fill="url(#actualAreaGrad)" />}

          {/* Recommended line (dashed) */}
          <Path
            d={recPath}
            stroke={REC_COLOR}
            strokeWidth={1}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="5,4"
          />

          {/* Actual line — white, fine */}
          <Path
            d={actualPath}
            stroke="rgba(255,255,255,0.85)"
            strokeWidth={1.5}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data point circles — green if actual met the recommendation */}
          {nights.map((n, i) => (
            <Circle
              key={n.date}
              cx={toX(i)}
              cy={toY(n.actualMin)}
              r={3.5}
              fill={n.actualMin >= (n.recommendedMin ?? n.targetMin) ? '#4ADE80' : 'rgba(255,255,255,0.6)'}
              stroke="rgba(10,10,15,0.8)"
              strokeWidth={1.5}
            />
          ))}

          {/* Day labels */}
          {nights.map((n, i) => {
            const d = parseLocalDate(n.date);
            const label = DAY_LABELS[d.getDay()];
            return (
              <SvgText
                key={n.date}
                x={toX(i)}
                y={height - 4}
                textAnchor="middle"
                fontSize={10}
                fill="rgba(255,255,255,0.4)"
                fontFamily={fontFamily.regular}
              >
                {label}
              </SvgText>
            );
          })}
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: {
    flexDirection: 'row',
    gap: spacing.lg,
    paddingHorizontal: spacing.xs,
    marginBottom: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendDash: {
    width: 16,
    height: 2,
    borderRadius: 1,
    backgroundColor: REC_COLOR,
    opacity: 0.8,
  },
  legendLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontFamily: fontFamily.regular,
  },
});
