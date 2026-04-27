import React, { useMemo } from 'react';
import { View, Dimensions } from 'react-native';
import Svg, { Path, Rect, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { monotoneCubicPath } from '../../utils/chartMath';

const SCREEN_W = Dimensions.get('window').width;

interface TrendLineChartProps {
  data: { dateKey: string; value: number }[];
  height?: number;
  width?: number;
  color?: string;
  bandRange?: { min: number; max: number } | null;
  showEndDot?: boolean;
}

export function TrendLineChart({
  data,
  height = 110,
  width = SCREEN_W - 80,
  color = '#6B8EFF',
  bandRange,
  showEndDot = true,
}: TrendLineChartProps) {
  const computed = useMemo(() => {
    const valid = data.filter(d => d.value > 0);
    if (valid.length < 2) return null;

    const vals = valid.map(d => d.value);
    const dataMin = Math.min(...vals);
    const dataMax = Math.max(...vals);

    const yMin = Math.max(0, Math.min(dataMin, bandRange?.min ?? dataMin) * 0.88);
    const yMax = Math.max(dataMax, bandRange?.max ?? dataMax) * 1.12;
    const yRange = yMax - yMin || 1;

    const pad = 4;
    const chartH = height - pad * 2;

    function yPos(val: number) {
      return pad + chartH - ((val - yMin) / yRange) * chartH;
    }

    const pts = valid.map((d, i) => ({
      x: valid.length === 1 ? width / 2 : (i / (valid.length - 1)) * width,
      y: yPos(d.value),
    }));

    const linePath = monotoneCubicPath(pts);
    const last = pts[pts.length - 1];
    const areaPath = `${linePath} L ${last.x} ${height} L ${pts[0].x} ${height} Z`;

    const bandTopY = bandRange ? yPos(Math.min(bandRange.max, yMax)) : 0;
    const bandBotY = bandRange ? yPos(Math.max(bandRange.min, yMin)) : height;

    return { pts, linePath, areaPath, bandTopY, bandBotY, endPt: last };
  }, [data, bandRange, height, width]);

  if (!computed) return <View style={{ height }} />;

  const { linePath, areaPath, bandTopY, bandBotY, endPt } = computed;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <Stop offset="100%" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>

      {bandRange && (
        <Rect
          x={0}
          y={bandTopY}
          width={width}
          height={Math.max(0, bandBotY - bandTopY)}
          fill="rgba(255,255,255,0.06)"
          rx={2}
        />
      )}

      <Path d={areaPath} fill="url(#areaGrad)" />
      <Path
        d={linePath}
        stroke={color}
        strokeWidth={1.8}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {showEndDot && (
        <>
          <Circle cx={endPt.x} cy={endPt.y} r={4} fill={color} opacity={0.35} />
          <Circle cx={endPt.x} cy={endPt.y} r={2.5} fill={color} />
        </>
      )}
    </Svg>
  );
}
