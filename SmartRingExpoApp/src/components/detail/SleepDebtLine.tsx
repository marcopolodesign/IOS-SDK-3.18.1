import React, { useState, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, PanResponder } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Path, Line, Circle, Text as SvgText } from 'react-native-svg';
import { monotoneCubicPath, parseLocalDate } from '../../utils/chartMath';
import { formatSleepTime } from '../../utils/time';
import { fontFamily, spacing } from '../../theme/colors';
import { useTranslation } from 'react-i18next';
import type { NightlyPoint } from '../../types/sleepDebt.types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_H = 190;
const PAD_LEFT = 40;
const PAD_RIGHT = 8;
const PAD_V = 18;
const TOOLTIP_W = 110;

function fmtDate(date: string): string {
  const d = parseLocalDate(date);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface Props {
  points: NightlyPoint[];
}

export function SleepDebtLine({ points }: Props) {
  const { t } = useTranslation();
  const [tooltip, setTooltip] = useState<{ svgX: number; point: NightlyPoint } | null>(null);
  const layoutWidthRef = useRef(0);
  const handleTouchRef = useRef<(x: number) => void>(() => {});

  const chartW = SCREEN_WIDTH - spacing.md * 2 - spacing.sm * 2;
  const bodyW = chartW - PAD_LEFT - PAD_RIGHT;
  const graphTop = PAD_V;
  const graphBottom = CHART_H - PAD_V;
  const graphH = graphBottom - graphTop;

  const maxDebt = useMemo(() => {
    if (points.length === 0) return 120;
    const raw = Math.max(...points.map(p => p.runningDebtMin));
    return Math.max(60, Math.ceil(raw / 60) * 60);
  }, [points]);

  const toX = (i: number) =>
    PAD_LEFT + (points.length > 1 ? (i / (points.length - 1)) * bodyW : bodyW / 2);
  const toY = (val: number) =>
    graphTop + (1 - Math.min(val, maxDebt) / maxDebt) * graphH;

  const { linePath, linePts } = useMemo(() => {
    if (points.length < 2) return { linePath: '', linePts: [] };
    const pts = points.map((p, i) => ({ x: toX(i), y: toY(p.runningDebtMin) }));
    return { linePath: monotoneCubicPath(pts), linePts: pts };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, chartW, maxDebt]);

  const yTicks = useMemo(() => {
    const step = maxDebt <= 120 ? 30 : maxDebt <= 300 ? 60 : 120;
    const ticks: number[] = [];
    for (let v = 0; v <= maxDebt; v += step) ticks.push(v);
    return ticks;
  }, [maxDebt]);

  handleTouchRef.current = (touchPx: number) => {
    if (!layoutWidthRef.current || points.length === 0) return;
    const svgX = Math.max(PAD_LEFT, Math.min(chartW - PAD_RIGHT, touchPx * (chartW / layoutWidthRef.current)));
    let nearest = 0;
    let nearestDist = Infinity;
    points.forEach((_, i) => {
      const dist = Math.abs(toX(i) - svgX);
      if (dist < nearestDist) { nearestDist = dist; nearest = i; }
    });
    setTooltip({ svgX: toX(nearest), point: points[nearest] });
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder:        () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder:         () => true,
      onMoveShouldSetPanResponderCapture:  () => true,
      onPanResponderGrant:     e => handleTouchRef.current(e.nativeEvent.locationX),
      onPanResponderMove:      e => handleTouchRef.current(e.nativeEvent.locationX),
      onPanResponderRelease:   () => setTooltip(null),
      onPanResponderTerminate: () => setTooltip(null),
    })
  ).current;

  if (points.length < 2) {
    return (
      <View style={[styles.wrapper, { height: CHART_H, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.empty}>{t('sleep_debt.not_enough_data', { count: 2 })}</Text>
      </View>
    );
  }

  const firstX = linePts[0].x;
  const lastX  = linePts[linePts.length - 1].x;
  const baselineY = graphBottom;
  const areaPath = `${linePath} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z`;

  const tooltipLeft = tooltip
    ? Math.max(0, Math.min(chartW - TOOLTIP_W, tooltip.svgX - TOOLTIP_W / 2))
    : 0;

  return (
    <View
      style={[styles.wrapper, { height: CHART_H }]}
      onLayout={e => { layoutWidthRef.current = e.nativeEvent.layout.width; }}
      {...pan.panHandlers}
    >
      {tooltip && (
        <View style={[styles.tooltip, { left: tooltipLeft }]}>
          <Text style={styles.tooltipDebt}>{formatSleepTime(tooltip.point.runningDebtMin)}</Text>
          <Text style={styles.tooltipDate}>{fmtDate(tooltip.point.date)}</Text>
          <Text style={styles.tooltipSlept}>{formatSleepTime(tooltip.point.actualMin)} slept</Text>
        </View>
      )}
      <Svg width="100%" height={CHART_H} viewBox={`0 0 ${chartW} ${CHART_H}`}>
        <Defs>
          {/* Vertical gradient: red at top (high debt) → amber mid → green at bottom (low debt) */}
          <LinearGradient id="debtLineGrad" gradientUnits="userSpaceOnUse" x1="0" y1={graphTop} x2="0" y2={graphBottom}>
            <Stop offset="0%"   stopColor="#EF4444" stopOpacity={1} />
            <Stop offset="50%"  stopColor="#FFD700" stopOpacity={1} />
            <Stop offset="100%" stopColor="#4ADE80" stopOpacity={1} />
          </LinearGradient>
          <LinearGradient id="debtAreaGrad" gradientUnits="userSpaceOnUse" x1="0" y1={graphTop} x2="0" y2={baselineY}>
            <Stop offset="0%"   stopColor="#EF4444" stopOpacity={0.3} />
            <Stop offset="60%"  stopColor="#FFD700" stopOpacity={0.1} />
            <Stop offset="100%" stopColor="#4ADE80" stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {/* Y-axis guide lines */}
        {yTicks.map(tick => {
          const y = toY(tick);
          return (
            <React.Fragment key={tick}>
              <Line
                x1={PAD_LEFT} y1={y} x2={chartW - PAD_RIGHT} y2={y}
                stroke="rgba(255,255,255,0.07)" strokeWidth={1}
                strokeDasharray={tick === 0 ? '0' : '3,4'}
              />
              <SvgText
                x={PAD_LEFT - 4} y={y + 4}
                textAnchor="end" fontSize={9}
                fill="rgba(255,255,255,0.3)"
                fontFamily={fontFamily.regular}
              >
                {tick < 60 ? `${tick}m` : `${tick / 60}h`}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* Area fill */}
        <Path d={areaPath} fill="url(#debtAreaGrad)" />

        {/* Gradient line */}
        <Path
          d={linePath}
          stroke="url(#debtLineGrad)"
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Scrub indicator */}
        {tooltip && (
          <>
            <Line
              x1={tooltip.svgX} y1={graphTop} x2={tooltip.svgX} y2={graphBottom}
              stroke="rgba(255,255,255,0.35)" strokeWidth={1}
            />
            <Circle
              cx={tooltip.svgX}
              cy={toY(tooltip.point.runningDebtMin)}
              r={4}
              fill="#FFFFFF"
              strokeWidth={0}
            />
          </>
        )}

        {/* X-axis date labels */}
        {[0, Math.floor((points.length - 1) / 2), points.length - 1]
          .filter((v, i, a) => a.indexOf(v) === i)
          .map(i => (
            <SvgText
              key={i}
              x={toX(i)}
              y={CHART_H - 4}
              textAnchor="middle" fontSize={9}
              fill="rgba(255,255,255,0.3)"
              fontFamily={fontFamily.regular}
            >
              {fmtDate(points[i].date)}
            </SvgText>
          ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'relative' },
  empty: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 13,
    fontFamily: fontFamily.regular,
  },
  tooltip: {
    position: 'absolute',
    top: 4,
    width: TOOLTIP_W,
    backgroundColor: 'rgba(20,20,30,0.92)',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 8,
    alignItems: 'center',
    zIndex: 10,
    gap: 2,
  },
  tooltipDebt: { color: '#FFFFFF', fontSize: 14, fontFamily: fontFamily.demiBold },
  tooltipDate: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontFamily: fontFamily.regular },
  tooltipSlept: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: fontFamily.regular },
});
