/**
 * SleepHypnogramContinuous — waterfall / filled-area sleep chart.
 *
 * Each sleep stage is rendered as a bar that hangs from the top of the
 * chart downward.  The deeper the stage, the taller the bar:
 *   Awake  →  thin white blip at the very top
 *   REM    →  light-blue bar extending ~40 % down
 *   Core   →  medium-blue bar extending ~65 % down
 *   Deep   →  dark-navy bar extending ~92 % down
 *
 * Touch / drag shows a floating tooltip (stage name, duration, time range).
 */

import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, PanResponder } from 'react-native';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';
import { SleepStage, SleepSegment } from './SleepHypnogram';
import { spacing, fontFamily } from '../../theme/colors';

interface Props {
  segments: SleepSegment[];
  bedTime: Date;
  wakeTime: Date;
}

// How far each stage's bar extends downward as a fraction of the bar area height.
const stageBarRatio: Record<SleepStage, number> = {
  awake: 0.10,
  rem:   0.42,
  core:  0.68,
  deep:  0.93,
};

const stageColors: Record<SleepStage, string> = {
  awake: 'rgba(240, 240, 255, 0.90)',
  rem:   '#81D4FA',
  core:  '#3B7DD8',
  deep:  '#1A2A6A',
};

const stageTooltipLabel: Record<SleepStage, string> = {
  awake: 'AWAKE',
  rem:   'REM SLEEP',
  core:  'CORE SLEEP',
  deep:  'DEEP SLEEP',
};

// SVG coordinate space — scaled to fill container via viewBox + width="100%"
const COORD_W      = 400;
const CHART_H      = 200;
const PAD_LEFT     = 4;
const PAD_RIGHT    = 4;
const PAD_TOP      = 6;
const PAD_BOTTOM   = 30;   // space for time-axis labels
const BAR_AREA_H   = CHART_H - PAD_TOP - PAD_BOTTOM;
const COORD_AREA_W = COORD_W - PAD_LEFT - PAD_RIGHT;
const TOOLTIP_W    = 160;  // rendered pixels

function formatTimeLabel(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  if (m === 0) return `${h12} ${ampm}`;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function generateHourMarks(bedTime: Date, wakeTime: Date): Date[] {
  const marks: Date[] = [];
  const t = new Date(bedTime);
  t.setMinutes(0, 0, 0);
  t.setHours(t.getHours() + 1);
  while (t < wakeTime) {
    marks.push(new Date(t));
    t.setHours(t.getHours() + 1);
  }
  return marks;
}

type TooltipState = {
  svgX: number;
  touchPx: number;
  segment: SleepSegment;
  durationMin: number;
} | null;

export function SleepHypnogramContinuous({ segments, bedTime, wakeTime }: Props) {
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const layoutWidth = useRef(0);
  const handleRef   = useRef<(x: number) => void>(() => {});

  const totalMs   = wakeTime.getTime() - bedTime.getTime();

  const toSvgX = (time: Date) => {
    const elapsed = time.getTime() - bedTime.getTime();
    return PAD_LEFT + (elapsed / totalMs) * COORD_AREA_W;
  };

  // Always-fresh touch handler (captures latest segments/bedTime/wakeTime)
  handleRef.current = (touchPx: number) => {
    if (!layoutWidth.current) return;
    const svgX    = (touchPx / layoutWidth.current) * COORD_W;
    const timeMs  = bedTime.getTime() + ((svgX - PAD_LEFT) / COORD_AREA_W) * totalMs;
    const clamped = new Date(Math.max(bedTime.getTime(), Math.min(wakeTime.getTime(), timeMs)));
    const seg     = segments.find(s => clamped >= s.startTime && clamped <= s.endTime);
    if (seg) {
      const durationMin = (seg.endTime.getTime() - seg.startTime.getTime()) / 60000;
      setTooltip({ svgX, touchPx, segment: seg, durationMin });
    }
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant:     evt => handleRef.current(evt.nativeEvent.locationX),
      onPanResponderMove:      evt => handleRef.current(evt.nativeEvent.locationX),
      onPanResponderRelease:   ()  => setTooltip(null),
      onPanResponderTerminate: ()  => setTooltip(null),
    })
  ).current;

  const hourMarks  = generateHourMarks(bedTime, wakeTime);
  const barBottom  = PAD_TOP + BAR_AREA_H; // y of the bar-area floor

  const tooltipLeft = tooltip
    ? Math.max(4, Math.min(layoutWidth.current - TOOLTIP_W - 4, tooltip.touchPx - TOOLTIP_W / 2))
    : 0;

  return (
    <View
      style={styles.container}
      {...pan.panHandlers}
      onLayout={e => { layoutWidth.current = e.nativeEvent.layout.width; }}
    >
      {/* Floating tooltip */}
      {tooltip && (
        <View style={[styles.tooltip, { left: tooltipLeft }]}>
          <Text style={styles.tooltipStage}>
            {stageTooltipLabel[tooltip.segment.stage]}
          </Text>
          <View style={styles.tooltipDurRow}>
            <Text style={styles.tooltipDurNum}>
              {Math.round(tooltip.durationMin)}
            </Text>
            <Text style={styles.tooltipDurUnit}> min</Text>
          </View>
          <Text style={styles.tooltipTime}>
            {formatTimeLabel(tooltip.segment.startTime)}
            {' – '}
            {formatTimeLabel(tooltip.segment.endTime)}
          </Text>
        </View>
      )}

      <Svg width="100%" height={CHART_H} viewBox={`0 0 ${COORD_W} ${CHART_H}`}>

        {/* Hourly dotted vertical guides */}
        {hourMarks.map((mark, i) => {
          const x = toSvgX(mark);
          return (
            <Line
              key={`vg-${i}`}
              x1={x} y1={PAD_TOP} x2={x} y2={barBottom}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth={1}
              strokeDasharray="3,4"
            />
          );
        })}

        {/* Baseline at the bottom of the bar area */}
        <Line
          x1={PAD_LEFT} y1={barBottom}
          x2={COORD_W - PAD_RIGHT} y2={barBottom}
          stroke="rgba(255,255,255,0.20)"
          strokeWidth={1}
        />

        {/* Continuous bars: each segment hangs from PAD_TOP downward */}
        {segments.map((seg, i) => {
          const x   = toSvgX(seg.startTime);
          const w   = Math.max(2, toSvgX(seg.endTime) - x);
          const barH = BAR_AREA_H * stageBarRatio[seg.stage];
          return (
            <Rect
              key={`bar-${i}`}
              x={x}
              y={PAD_TOP}
              width={w}
              height={barH}
              fill={stageColors[seg.stage]}
              rx={2}
              ry={2}
            />
          );
        })}

        {/* Touch cursor */}
        {tooltip && (
          <Line
            x1={tooltip.svgX} y1={PAD_TOP}
            x2={tooltip.svgX} y2={barBottom}
            stroke="rgba(255,255,255,0.80)"
            strokeWidth={1.5}
            strokeDasharray="3,3"
          />
        )}

        {/* X-axis time labels */}
        <SvgText
          x={PAD_LEFT} y={CHART_H - 8}
          fill="rgba(255,255,255,0.55)" fontSize={10} textAnchor="start"
        >
          {formatTimeLabel(bedTime)}
        </SvgText>
        {hourMarks.map((mark, i) => (
          <SvgText
            key={`tl-${i}`}
            x={toSvgX(mark)} y={CHART_H - 8}
            fill="rgba(255,255,255,0.55)" fontSize={10} textAnchor="middle"
          >
            {formatTimeLabel(mark)}
          </SvgText>
        ))}
        <SvgText
          x={COORD_W - PAD_RIGHT} y={CHART_H - 8}
          fill="rgba(255,255,255,0.55)" fontSize={10} textAnchor="end"
        >
          {formatTimeLabel(wakeTime)}
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.sm,
  },
  tooltip: {
    position: 'absolute',
    top: spacing.xs,
    width: TOOLTIP_W,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  tooltipStage: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 10,
    fontFamily: fontFamily.regular,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  tooltipDurRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  tooltipDurNum: {
    color: '#FFFFFF',
    fontSize: 28,
    fontFamily: fontFamily.demiBold,
    lineHeight: 34,
  },
  tooltipDurUnit: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 14,
    fontFamily: fontFamily.regular,
  },
  tooltipTime: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    fontFamily: fontFamily.regular,
    marginTop: 2,
  },
});

export default SleepHypnogramContinuous;
