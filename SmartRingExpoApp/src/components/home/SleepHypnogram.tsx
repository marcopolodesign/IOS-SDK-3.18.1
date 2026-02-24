import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, PanResponder } from 'react-native';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';
import { spacing, fontFamily } from '../../theme/colors';

export type SleepStage = 'awake' | 'rem' | 'core' | 'deep';

export interface SleepSegment {
  stage: SleepStage;
  startTime: Date;
  endTime: Date;
}

interface SleepHypnogramProps {
  segments: SleepSegment[];
  bedTime: Date;
  wakeTime: Date;
  onTouchStart?: () => void;
  onTouchEnd?: () => void;
}

const stages: SleepStage[] = ['awake', 'rem', 'core', 'deep'];

const stageColors: Record<SleepStage, string> = {
  awake: '#FF6B6B',
  rem:   '#81D4FA',
  core:  '#42A5F5',
  deep:  '#5C4DB1',
};

const stageLabels: Record<SleepStage, string> = {
  awake: 'Awake',
  rem:   'REM',
  core:  'Core',
  deep:  'Deep',
};

const stageTooltipLabel: Record<SleepStage, string> = {
  awake: 'AWAKE',
  rem:   'REM SLEEP',
  core:  'CORE SLEEP',
  deep:  'DEEP SLEEP',
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH   = SCREEN_WIDTH - spacing.lg * 4;
const CHART_HEIGHT  = 265;
const PADDING_LEFT  = 45;
const PADDING_RIGHT = 0;
const PADDING_TOP   = 15;
const PADDING_BOTTOM = 38;
const LANE_HEIGHT   = 40;
const LANE_GAP      = 10;
const BLOCK_RADIUS  = 8;
// Minimum SVG-unit gap between an hour-mark label and the bed/wake labels
const MIN_LABEL_GAP = 38;

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins  = Math.round(minutes % 60);
  if (hours === 0) return `${mins}'`;
  if (mins  === 0) return `${hours}h`;
  return `${hours}h ${mins}'`;
}

function formatTimeLabel(date: Date): string {
  const h    = date.getHours();
  const m    = date.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h % 12 || 12;
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
  svgX:        number;
  segment:     SleepSegment;
  durationMin: number;
} | null;

export function SleepHypnogram({ segments, bedTime, wakeTime, onTouchStart, onTouchEnd }: SleepHypnogramProps) {
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const layoutWidth    = useRef(0);
  const handleTouchRef = useRef<(x: number) => void>(() => {});
  const onTouchStartRef = useRef(onTouchStart);
  const onTouchEndRef   = useRef(onTouchEnd);
  onTouchStartRef.current = onTouchStart;
  onTouchEndRef.current   = onTouchEnd;

  const totalDuration  = wakeTime.getTime() - bedTime.getTime();
  const chartAreaWidth = CHART_WIDTH - PADDING_LEFT - PADDING_RIGHT;

  const getXPosition = (time: Date) => {
    const elapsed = time.getTime() - bedTime.getTime();
    return PADDING_LEFT + (elapsed / totalDuration) * chartAreaWidth;
  };

  const getLaneY       = (idx: number) => PADDING_TOP + idx * (LANE_HEIGHT + LANE_GAP);
  const getStageIndex  = (s: SleepStage) => stages.indexOf(s);
  const laneAreaBottom = PADDING_TOP + stages.length * (LANE_HEIGHT + LANE_GAP) - LANE_GAP;

  handleTouchRef.current = (touchPx: number) => {
    if (!layoutWidth.current) return;
    const svgX    = (touchPx / layoutWidth.current) * CHART_WIDTH;
    const timeMs  = bedTime.getTime() + ((svgX - PADDING_LEFT) / chartAreaWidth) * totalDuration;
    const clamped = new Date(Math.max(bedTime.getTime(), Math.min(wakeTime.getTime(), timeMs)));
    const seg     = segments.find(s => clamped >= s.startTime && clamped <= s.endTime);
    if (seg) {
      const durationMin = (seg.endTime.getTime() - seg.startTime.getTime()) / 60000;
      setTooltip({ svgX, segment: seg, durationMin });
    }
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder:        () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder:         () => true,
      onMoveShouldSetPanResponderCapture:  () => true,
      onPanResponderGrant:     evt => { onTouchStartRef.current?.(); handleTouchRef.current(evt.nativeEvent.locationX); },
      onPanResponderMove:      evt => handleTouchRef.current(evt.nativeEvent.locationX),
      onPanResponderRelease:   ()  => { setTooltip(null); onTouchEndRef.current?.(); },
      onPanResponderTerminate: ()  => { setTooltip(null); onTouchEndRef.current?.(); },
    })
  ).current;

  // Stage duration totals
  const stageDurations: Record<SleepStage, number> = { awake: 0, rem: 0, core: 0, deep: 0 };
  segments.forEach(seg => {
    stageDurations[seg.stage] += (seg.endTime.getTime() - seg.startTime.getTime()) / 60000;
  });

  // Transition connector lines
  const connectors: Array<{ x: number; y1: number; y2: number; color: string }> = [];
  for (let i = 0; i < segments.length - 1; i++) {
    const cur  = segments[i];
    const next = segments[i + 1];
    if (cur.stage !== next.stage) {
      const x      = getXPosition(cur.endTime);
      const curIdx = getStageIndex(cur.stage);
      const nxtIdx = getStageIndex(next.stage);
      connectors.push({
        x,
        y1:    getLaneY(curIdx) + LANE_HEIGHT / 2,
        y2:    getLaneY(nxtIdx) + LANE_HEIGHT / 2,
        color: curIdx > nxtIdx ? stageColors[cur.stage] : stageColors[next.stage],
      });
    }
  }

  // Hour marks — skip any that land too close to the bed/wake label positions
  const wakeX          = CHART_WIDTH - PADDING_RIGHT;
  const allHourMarks   = generateHourMarks(bedTime, wakeTime);
  const hourMarks      = allHourMarks.filter(mark => {
    const x = getXPosition(mark);
    return (x - PADDING_LEFT) > MIN_LABEL_GAP && (wakeX - x) > MIN_LABEL_GAP;
  });

  return (
    <View
      style={styles.container}
      {...pan.panHandlers}
      onLayout={e => { layoutWidth.current = e.nativeEvent.layout.width; }}
    >
      {/* ── Top row: summary chips OR tooltip (same vertical space) ── */}
      {tooltip ? (
        <View style={styles.tooltipReplacement}>
          <Text style={styles.tooltipStage}>
            {stageTooltipLabel[tooltip.segment.stage]}
          </Text>
          <View style={styles.tooltipDurRow}>
            <Text style={styles.tooltipDurNum}>{Math.round(tooltip.durationMin)}</Text>
            <Text style={styles.tooltipDurUnit}> min</Text>
          </View>
          <Text style={styles.tooltipTime}>
            {formatTimeLabel(tooltip.segment.startTime)}
            {' – '}
            {formatTimeLabel(tooltip.segment.endTime)}
          </Text>
        </View>
      ) : (
        <View style={styles.summaryRow}>
          {stages.map(stage => (
            <View
              key={stage}
              style={[styles.summaryChip, { borderColor: stageColors[stage] }]}
            >
              <Text style={styles.summaryLabel}>{stageLabels[stage]}</Text>
              <Text style={styles.summaryValue}>
                {formatDuration(stageDurations[stage])}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* ── Hypnogram chart ── */}
      <Svg
        width="100%"
        height={CHART_HEIGHT}
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      >
        {/* Hourly vertical grid lines */}
        {hourMarks.map((mark, i) => {
          const x = getXPosition(mark);
          return (
            <Line
              key={`vg-${i}`}
              x1={x} y1={PADDING_TOP} x2={x} y2={laneAreaBottom}
              stroke="rgba(255,255,255,0.12)"
              strokeWidth={1}
              strokeDasharray="4,4"
            />
          );
        })}

        {/* Horizontal lane separators */}
        {stages.map((stage, i) => {
          if (i === stages.length - 1) return null;
          const y = getLaneY(i) + LANE_HEIGHT + LANE_GAP / 2;
          return (
            <Line
              key={`hg-${stage}`}
              x1={PADDING_LEFT} y1={y} x2={CHART_WIDTH - PADDING_RIGHT} y2={y}
              stroke="rgba(255,255,255,0.10)"
              strokeWidth={1}
            />
          );
        })}

        {/* Y-axis labels */}
        {stages.map((stage, i) => {
          const y = getLaneY(i);
          return (
            <React.Fragment key={stage}>
              <SvgText x={5} y={y + 14} fill="rgba(255,255,255,0.9)" fontSize={12} fontWeight="600">
                {stageLabels[stage]}
              </SvgText>
              <SvgText x={5} y={y + 28} fill="rgba(255,255,255,0.5)" fontSize={10}>
                {formatDuration(stageDurations[stage])}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* Stage-transition connectors */}
        {connectors.map((c, i) => (
          <Line
            key={`cn-${i}`}
            x1={c.x} y1={c.y1} x2={c.x} y2={c.y2}
            stroke={c.color} strokeWidth={2.5} strokeOpacity={0.75} strokeLinecap="round"
          />
        ))}

        {/* Sleep segment blocks */}
        {segments.map((seg, i) => {
          const x = getXPosition(seg.startTime);
          const w = Math.max(4, getXPosition(seg.endTime) - x);
          const y = getLaneY(getStageIndex(seg.stage));
          return (
            <Rect
              key={`bl-${i}`}
              x={x} y={y} width={w} height={LANE_HEIGHT}
              rx={BLOCK_RADIUS} ry={BLOCK_RADIUS}
              fill={stageColors[seg.stage]}
              stroke={stageColors[seg.stage]}
              strokeWidth={3} strokeOpacity={0.5}
            />
          );
        })}

        {/* X-axis time labels */}
        <SvgText
          x={PADDING_LEFT} y={CHART_HEIGHT - 10}
          fill="rgba(255,255,255,0.55)" fontSize={10} textAnchor="middle"
        >
          {formatTimeLabel(bedTime)}
        </SvgText>
        {hourMarks.map((mark, i) => (
          <SvgText
            key={`tl-${i}`}
            x={getXPosition(mark)} y={CHART_HEIGHT - 10}
            fill="rgba(255,255,255,0.55)" fontSize={10} textAnchor="middle"
          >
            {formatTimeLabel(mark)}
          </SvgText>
        ))}
        <SvgText
          x={wakeX - 2} y={CHART_HEIGHT - 10}
          fill="rgba(255,255,255,0.55)" fontSize={10} textAnchor="end"
        >
          {formatTimeLabel(wakeTime)}
        </SvgText>

        {/* Touch cursor */}
        {tooltip && (
          <Line
            x1={tooltip.svgX} y1={PADDING_TOP} x2={tooltip.svgX} y2={laneAreaBottom}
            stroke="rgba(255,255,255,0.75)" strokeWidth={1.5} strokeDasharray="3,3"
          />
        )}
      </Svg>
    </View>
  );
}

const CHIP_ROW_HEIGHT = 72;

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.sm,
  },
  // ── Summary chips ──
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
    gap: 6,
    minHeight: CHIP_ROW_HEIGHT,
  },
  summaryChip: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderLeftWidth: 3,
  },
  summaryLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontFamily: fontFamily.regular,
    marginBottom: 2,
  },
  summaryValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: fontFamily.demiBold,
  },
  // ── Tooltip replacement (same height as chip row) ──
  tooltipReplacement: {
    minHeight: CHIP_ROW_HEIGHT,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tooltipStage: {
    color: 'rgba(255,255,255,0.60)',
    fontSize: 11,
    fontFamily: fontFamily.regular,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  tooltipDurRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  tooltipDurNum: {
    color: '#FFFFFF',
    fontSize: 30,
    fontFamily: fontFamily.demiBold,
    lineHeight: 36,
  },
  tooltipDurUnit: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 15,
    fontFamily: fontFamily.regular,
  },
  tooltipTime: {
    color: 'rgba(255,255,255,0.50)',
    fontSize: 11,
    fontFamily: fontFamily.regular,
    marginTop: 2,
  },
});

export default SleepHypnogram;
