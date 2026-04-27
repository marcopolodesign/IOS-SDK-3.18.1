import React, { useMemo, useRef } from 'react';
import { View, Dimensions, PanResponder } from 'react-native';
import Svg, {
  Path, Rect, Circle, Line, Text as SvgText,
} from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { fontFamily } from '../../theme/colors';

const SCREEN_W = Dimensions.get('window').width;
const Y_AXIS_W = 48;
const DATE_H = 28;

interface TrendLineChartProps {
  data: { dateKey: string; value: number }[];
  height?: number;
  width?: number;
  color?: string;
  bandRange?: { min: number; max: number } | null;
  showEndDot?: boolean;
  showAllDots?: boolean;
  showDateLabels?: boolean;
  showYAxis?: boolean;
  formatValue?: (v: number) => string;
  /** Fires with the dateKey of the hovered point, null when finger lifts. */
  onActiveChange?: (dateKey: string | null) => void;
}

export function TrendLineChart({
  data,
  height = 110,
  width = SCREEN_W - 80,
  color = '#6B8EFF',
  bandRange,
  showEndDot = true,
  showAllDots = false,
  showDateLabels = false,
  showYAxis = false,
  formatValue,
  onActiveChange,
}: TrendLineChartProps) {
  const lastHapticIdx = useRef<number | null>(null);
  const activeIdxRef = useRef<number | null>(null);
  // For rendering the active dot we use a ref + forceUpdate pattern via state
  const [activeIdx, setActiveIdx] = React.useState<number | null>(null);

  const svgH = height + (showDateLabels ? DATE_H : 0);
  const plotX = showYAxis ? Y_AXIS_W : 0;
  const plotW = width - plotX;

  const computed = useMemo(() => {
    const valid = data.filter(d => d.value > 0);
    if (valid.length < 2) return null;

    const vals = valid.map(d => d.value);
    const dataMin = Math.min(...vals);
    const dataMax = Math.max(...vals);

    const yMin = Math.max(0, dataMin * 0.94);
    const yMax = dataMax * 1.06;
    const yRange = yMax - yMin || 1;

    const pad = 4;
    const chartH = height - pad * 2;

    function yPos(val: number) {
      return pad + chartH - ((val - yMin) / yRange) * chartH;
    }

    const pts = valid.map((d, i) => ({
      x: plotX + (valid.length === 1 ? plotW / 2 : (i / (valid.length - 1)) * plotW),
      y: yPos(d.value),
    }));

    const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const last = pts[pts.length - 1];

    const bandTopY = bandRange ? yPos(Math.min(bandRange.max, yMax)) : 0;
    const bandBotY = bandRange ? yPos(Math.max(bandRange.min, yMin)) : height;

    const yTicks = Array.from({ length: 4 }, (_, i) => ({
      value: yMin + (yMax - yMin) * (i / 3),
      y: yPos(yMin + (yMax - yMin) * (i / 3)),
    }));

    const dateLabels = valid.map((d, i) => ({
      day: String(new Date(d.dateKey + 'T12:00:00').getDate()),
      month: new Date(d.dateKey + 'T12:00:00').toLocaleDateString(undefined, { month: 'short' }),
      x: pts[i].x,
    }));

    return { pts, valid, linePath, bandTopY, bandBotY, endPt: last, yTicks, dateLabels };
  }, [data, bandRange, height, plotX, plotW]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      if (!computed) return;
      const idx = snapToIdx(e.nativeEvent.locationX - plotX, computed.pts.length, plotW);
      activeIdxRef.current = idx;
      setActiveIdx(idx);
      if (idx !== lastHapticIdx.current) {
        lastHapticIdx.current = idx;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      onActiveChange?.(computed.valid[idx].dateKey);
    },
    onPanResponderMove: (e) => {
      if (!computed) return;
      const idx = snapToIdx(e.nativeEvent.locationX - plotX, computed.pts.length, plotW);
      activeIdxRef.current = idx;
      setActiveIdx(idx);
      if (idx !== lastHapticIdx.current) {
        lastHapticIdx.current = idx;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      onActiveChange?.(computed.valid[idx].dateKey);
    },
    onPanResponderRelease: () => {
      activeIdxRef.current = null;
      setActiveIdx(null);
      onActiveChange?.(null);
    },
    onPanResponderTerminate: () => {
      activeIdxRef.current = null;
      setActiveIdx(null);
      onActiveChange?.(null);
    },
  }), [computed, plotX, plotW, onActiveChange]);

  if (!computed) return <View style={{ width, height: svgH }} />;

  const { pts, linePath, bandTopY, bandBotY, endPt, yTicks, dateLabels } = computed;
  const activePt = activeIdx !== null ? pts[activeIdx] : null;

  return (
    <View style={{ width, height: svgH }} {...panResponder.panHandlers}>
      <Svg width={width} height={svgH}>
        {/* Y axis labels only */}
        {showYAxis && yTicks.map((tick, i) => (
          <SvgText
            key={i}
            x={plotX - 6} y={tick.y + 4}
            textAnchor="end" fontSize={10}
            fontFamily={fontFamily.regular}
            fill="rgba(255,255,255,0.35)"
          >
            {formatValue ? formatValue(tick.value) : String(Math.round(tick.value))}
          </SvgText>
        ))}

        {bandRange && (
          <Rect
            x={plotX} y={bandTopY} width={plotW}
            height={Math.max(0, bandBotY - bandTopY)}
            fill="rgba(255,255,255,0.06)" rx={2}
          />
        )}

        <Path
          d={linePath} stroke={color} strokeWidth={1.8}
          fill="none"
        />

        {/* All dots: black fill, white border */}
        {showAllDots && pts.map((pt, i) => (
          <Circle
            key={i}
            cx={pt.x} cy={pt.y} r={3.5}
            fill="black"
            stroke="#FFFFFF"
            strokeWidth={1.5}
          />
        ))}

        {showEndDot && !showAllDots && activeIdx === null && (
          <Circle
            cx={endPt.x} cy={endPt.y} r={4}
            fill="black" stroke="#FFFFFF" strokeWidth={1.5}
          />
        )}

        {/* Vertical dashed line + active dot on hover */}
        {activePt && (
          <>
            <Line
              x1={activePt.x} y1={0}
              x2={activePt.x} y2={height}
              stroke="rgba(255,255,255,0.3)"
              strokeWidth={1}
              strokeDasharray="3,4"
            />
            <Circle
              cx={activePt.x} cy={activePt.y} r={5.5}
              fill="black" stroke="#FFFFFF" strokeWidth={2}
            />
          </>
        )}

        {/* Date labels below chart */}
        {showDateLabels && dateLabels.map((dl, i) => (
          <React.Fragment key={i}>
            <SvgText
              x={dl.x} y={height + 13} textAnchor="middle"
              fontSize={12} fontFamily={fontFamily.regular}
              fill={activeIdx === i ? '#FFFFFF' : 'rgba(255,255,255,0.35)'}
            >
              {dl.day}
            </SvgText>
            <SvgText
              x={dl.x} y={height + 24} textAnchor="middle"
              fontSize={9} fontFamily={fontFamily.regular}
              fill={activeIdx === i ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.22)'}
            >
              {dl.month}
            </SvgText>
          </React.Fragment>
        ))}
      </Svg>
    </View>
  );
}

function snapToIdx(touchX: number, count: number, plotW: number): number {
  const idx = Math.round((touchX / plotW) * (count - 1));
  return Math.max(0, Math.min(count - 1, idx));
}
