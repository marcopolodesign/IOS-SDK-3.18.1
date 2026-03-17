import React, { useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, PanResponder } from 'react-native';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';
import { spacing, fontFamily } from '../../theme/colors';

export type SleepStage = 'awake' | 'rem' | 'core' | 'deep';

export interface SleepSegment {
  stage: SleepStage;
  startTime: Date;
  endTime: Date;
}

export interface SleepSession {
  segments: SleepSegment[];
  bedTime: Date;
  wakeTime: Date;
  label?: string; // 'Night' | 'Nap'
}

interface SleepHypnogramProps {
  segments: SleepSegment[];
  bedTime: Date;
  wakeTime: Date;
  sessions?: SleepSession[];
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
const PADDING_LEFT  = 45;
const PADDING_RIGHT = 0;
const PADDING_TOP   = 15;
const PADDING_BOTTOM = 38;
const LANE_HEIGHT   = 40;
const LANE_GAP      = 10;
const BLOCK_RADIUS  = 4;
const CHART_HEIGHT  = PADDING_TOP + stages.length * (LANE_HEIGHT + LANE_GAP) - LANE_GAP + PADDING_BOTTOM;
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
  sessionLabel?: string;
} | null;

export function SleepHypnogram({ segments, bedTime, wakeTime, sessions, onTouchStart, onTouchEnd }: SleepHypnogramProps) {
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const layoutWidth    = useRef(0);
  const handleTouchRef = useRef<(x: number) => void>(() => {});
  const onTouchStartRef = useRef(onTouchStart);
  const onTouchEndRef   = useRef(onTouchEnd);
  onTouchStartRef.current = onTouchStart;
  onTouchEndRef.current   = onTouchEnd;

  // Build resolved sessions: use `sessions` prop if provided, otherwise wrap legacy single-session props
  const resolvedSessions = useMemo<SleepSession[]>(() => {
    if (sessions && sessions.length > 0) return sessions;
    return [{ segments, bedTime, wakeTime, label: 'Night' }];
  }, [sessions, segments, bedTime, wakeTime]);

  // Compute unified timeline bounds
  const timelineBed = useMemo(() => {
    return new Date(Math.min(...resolvedSessions.map(s => s.bedTime.getTime())));
  }, [resolvedSessions]);
  const timelineWake = useMemo(() => {
    return new Date(Math.max(...resolvedSessions.map(s => s.wakeTime.getTime())));
  }, [resolvedSessions]);

  // All segments flattened for duration totals
  const allSegments = useMemo(() => resolvedSessions.flatMap(s => s.segments), [resolvedSessions]);

  const totalDuration  = timelineWake.getTime() - timelineBed.getTime();
  const chartAreaWidth = CHART_WIDTH - PADDING_LEFT - PADDING_RIGHT;

  const getXPosition = (time: Date) => {
    const elapsed = time.getTime() - timelineBed.getTime();
    return PADDING_LEFT + (elapsed / totalDuration) * chartAreaWidth;
  };

  const getLaneY       = (idx: number) => PADDING_TOP + idx * (LANE_HEIGHT + LANE_GAP);
  const getStageIndex  = (s: SleepStage) => stages.indexOf(s);
  const laneAreaBottom = PADDING_TOP + stages.length * (LANE_HEIGHT + LANE_GAP) - LANE_GAP;

  handleTouchRef.current = (touchPx: number) => {
    if (!layoutWidth.current) return;
    const svgX    = (touchPx / layoutWidth.current) * CHART_WIDTH;
    const timeMs  = timelineBed.getTime() + ((svgX - PADDING_LEFT) / chartAreaWidth) * totalDuration;
    const clamped = new Date(Math.max(timelineBed.getTime(), Math.min(timelineWake.getTime(), timeMs)));

    // Search across all sessions for the touched segment
    for (const session of resolvedSessions) {
      const seg = session.segments.find(s => clamped >= s.startTime && clamped <= s.endTime);
      if (seg) {
        const durationMin = (seg.endTime.getTime() - seg.startTime.getTime()) / 60000;
        setTooltip({ svgX, segment: seg, durationMin, sessionLabel: session.label });
        return;
      }
    }
    // Touch landed in a gap — clear tooltip
    setTooltip(null);
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

  // Stage duration totals across all sessions
  const stageDurations: Record<SleepStage, number> = { awake: 0, rem: 0, core: 0, deep: 0 };
  allSegments.forEach(seg => {
    stageDurations[seg.stage] += (seg.endTime.getTime() - seg.startTime.getTime()) / 60000;
  });

  // Transition connector lines — within each session only, not across gaps
  const connectors: Array<{ x: number; y1: number; y2: number; color: string }> = [];
  for (const session of resolvedSessions) {
    for (let i = 0; i < session.segments.length - 1; i++) {
      const cur  = session.segments[i];
      const next = session.segments[i + 1];
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
  }

  // Gaps between sessions — render a dashed separator line
  const gaps = useMemo(() => {
    if (resolvedSessions.length <= 1) return [];
    const sorted = [...resolvedSessions].sort((a, b) => a.bedTime.getTime() - b.bedTime.getTime());
    const result: Array<{ midX: number; label: string }> = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const gapStart = sorted[i].wakeTime.getTime();
      const gapEnd = sorted[i + 1].bedTime.getTime();
      const midMs = (gapStart + gapEnd) / 2;
      const midX = getXPosition(new Date(midMs));
      result.push({ midX, label: sorted[i + 1].label || 'Nap' });
    }
    return result;
  }, [resolvedSessions, getXPosition]);

  // Hour marks — skip any that land too close to the bed/wake label positions
  const wakeX          = CHART_WIDTH - PADDING_RIGHT;
  const allHourMarks   = generateHourMarks(timelineBed, timelineWake);
  const hourMarks      = allHourMarks.filter(mark => {
    const x = getXPosition(mark);
    return (x - PADDING_LEFT) > MIN_LABEL_GAP && (wakeX - x) > MIN_LABEL_GAP;
  });

  // Build x-axis labels: bed/wake for each session
  const xAxisLabels = useMemo(() => {
    if (resolvedSessions.length <= 1) return null; // Use default bed/wake labels
    const labels: Array<{ x: number; text: string; anchor: string }> = [];
    const sorted = [...resolvedSessions].sort((a, b) => a.bedTime.getTime() - b.bedTime.getTime());
    for (const session of sorted) {
      const bedX = getXPosition(session.bedTime);
      const wkX = getXPosition(session.wakeTime);
      labels.push({ x: bedX, text: formatTimeLabel(session.bedTime), anchor: 'middle' });
      labels.push({ x: wkX, text: formatTimeLabel(session.wakeTime), anchor: 'middle' });
    }
    return labels;
  }, [resolvedSessions, getXPosition]);

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
            {tooltip.sessionLabel === 'Nap' ? '  ·  NAP' : ''}
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

        {/* Gap separators between sessions */}
        {gaps.map((gap, i) => (
          <React.Fragment key={`gap-${i}`}>
            <Line
              x1={gap.midX} y1={PADDING_TOP} x2={gap.midX} y2={laneAreaBottom}
              stroke="rgba(255,255,255,0.20)"
              strokeWidth={1}
              strokeDasharray="2,4"
            />
            <SvgText
              x={gap.midX} y={PADDING_TOP - 3}
              fill="rgba(255,255,255,0.40)" fontSize={8} textAnchor="middle"
              fontWeight="600"
            >
              {gap.label}
            </SvgText>
          </React.Fragment>
        ))}

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
            stroke={c.color} strokeWidth={2} strokeOpacity={0.7} strokeLinecap="round"
          />
        ))}

        {/* Sleep segment blocks — rendered per session */}
        {allSegments.map((seg, i) => {
          const x = getXPosition(seg.startTime);
          const w = Math.max(2, getXPosition(seg.endTime) - x);
          const y = getLaneY(getStageIndex(seg.stage));
          const r = Math.min(BLOCK_RADIUS, w / 2);
          return (
            <Rect
              key={`bl-${i}`}
              x={x} y={y} width={w} height={LANE_HEIGHT}
              rx={r} ry={r}
              fill={stageColors[seg.stage]}
              opacity={0.9}
            />
          );
        })}

        {/* X-axis time labels */}
        {xAxisLabels ? (
          // Multi-session: show bed/wake for each session
          xAxisLabels.map((lbl, i) => (
            <SvgText
              key={`xl-${i}`}
              x={lbl.x} y={CHART_HEIGHT - 10}
              fill="rgba(255,255,255,0.55)" fontSize={10} textAnchor={lbl.anchor as any}
            >
              {lbl.text}
            </SvgText>
          ))
        ) : (
          // Single session: original bed + hourMarks + wake
          <>
            <SvgText
              x={PADDING_LEFT} y={CHART_HEIGHT - 10}
              fill="rgba(255,255,255,0.55)" fontSize={10} textAnchor="middle"
            >
              {formatTimeLabel(timelineBed)}
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
              {formatTimeLabel(timelineWake)}
            </SvgText>
          </>
        )}

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
    height: 64,
  },
  summaryChip: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
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
    height: 64,
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
    marginBottom: 1,
  },
  tooltipDurRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  tooltipDurNum: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: fontFamily.demiBold,
    lineHeight: 22,
  },
  tooltipDurUnit: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    fontFamily: fontFamily.regular,
  },
  tooltipTime: {
    color: 'rgba(255,255,255,0.50)',
    fontSize: 11,
    fontFamily: fontFamily.regular,
    marginTop: 1,
  },
});

export default SleepHypnogram;
