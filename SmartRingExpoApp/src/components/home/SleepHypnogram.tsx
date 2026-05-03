import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, PanResponder } from 'react-native';
import Svg, { Defs, Line, LinearGradient, Pattern, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { BedtimeIcon, SleptIcon, WakeTimeIcon } from '../../assets/icons';
import { spacing, fontFamily } from '../../theme/colors';

export type SleepStage = 'awake' | 'rem' | 'core' | 'deep';

export interface SleepSegment {
  stage: SleepStage;
  startTime: Date;
  endTime: Date;
  isInferred?: boolean;
  isInBed?: boolean;
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
const LABEL_COL_W    = 38;
const MARGIN_RIGHT   = 20;
const CHART_WIDTH    = SCREEN_WIDTH - spacing.lg * 4 - LABEL_COL_W - MARGIN_RIGHT;
const PADDING_LEFT   = 0;
const PADDING_RIGHT  = 0;
const PADDING_TOP    = 15;
const PADDING_BOTTOM = 38;
const LANE_HEIGHT    = 40;
const LANE_GAP       = 10;
const CHART_HEIGHT   = PADDING_TOP + stages.length * (LANE_HEIGHT + LANE_GAP) - LANE_GAP + PADDING_BOTTOM;
const MIN_LABEL_GAP  = 38;

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

  const resolvedSessions = useMemo<SleepSession[]>(() => {
    if (sessions && sessions.length > 0) return sessions;
    return [{ segments, bedTime, wakeTime, label: 'Night' }];
  }, [sessions, segments, bedTime, wakeTime]);

  const timelineBed = useMemo(() => {
    return new Date(Math.min(...resolvedSessions.map(s => s.bedTime.getTime())));
  }, [resolvedSessions]);
  const timelineWake = useMemo(() => {
    return new Date(Math.max(...resolvedSessions.map(s => s.wakeTime.getTime())));
  }, [resolvedSessions]);

  const allSegments = useMemo(() => resolvedSessions.flatMap(s => s.segments), [resolvedSessions]);

  const totalDuration  = timelineWake.getTime() - timelineBed.getTime();
  const chartAreaWidth = CHART_WIDTH - PADDING_LEFT - PADDING_RIGHT;

  const getXPosition = useCallback((time: Date) => {
    const elapsed = time.getTime() - timelineBed.getTime();
    return PADDING_LEFT + (elapsed / totalDuration) * chartAreaWidth;
  }, [timelineBed, totalDuration, chartAreaWidth]);

  const inferredBoundaryX = useMemo(() => {
    const firstReal = allSegments.find(s => !s.isInferred);
    const hasInferred = allSegments.some(s => s.isInferred);
    if (!hasInferred || !firstReal) return null;
    return getXPosition(firstReal.startTime);
  }, [allSegments, getXPosition]);

  const getLaneY       = (idx: number) => PADDING_TOP + idx * (LANE_HEIGHT + LANE_GAP);
  const getStageIndex  = (s: SleepStage) => stages.indexOf(s);
  const laneAreaBottom = PADDING_TOP + stages.length * (LANE_HEIGHT + LANE_GAP) - LANE_GAP;

  handleTouchRef.current = (touchPx: number) => {
    if (!layoutWidth.current) return;
    const svgX    = (touchPx / layoutWidth.current) * CHART_WIDTH;
    const timeMs  = timelineBed.getTime() + ((svgX - PADDING_LEFT) / chartAreaWidth) * totalDuration;
    const clamped = new Date(Math.max(timelineBed.getTime(), Math.min(timelineWake.getTime(), timeMs)));

    for (const session of resolvedSessions) {
      const seg = session.segments.find(s => clamped >= s.startTime && clamped <= s.endTime);
      if (seg) {
        const durationMin = (seg.endTime.getTime() - seg.startTime.getTime()) / 60000;
        setTooltip({ svgX, segment: seg, durationMin, sessionLabel: session.label });
        return;
      }
    }
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

  // Stage duration totals — exclude in-bed awake period
  const stageDurations: Record<SleepStage, number> = { awake: 0, rem: 0, core: 0, deep: 0 };
  allSegments.forEach(seg => {
    if (seg.isInBed) return;
    stageDurations[seg.stage] += (seg.endTime.getTime() - seg.startTime.getTime()) / 60000;
  });

  const CONNECTOR_W = 0.75;
  const stepPaths = useMemo(() => {
    return resolvedSessions.map(session => {
      if (session.segments.length === 0) return null;
      const rects: Array<{ x: number; width: number; stage: SleepStage; isInferred?: boolean; isInBed?: boolean }> = [];
      const connectors: Array<{ x: number; y: number; height: number; isInferred?: boolean }> = [];
      for (let i = 0; i < session.segments.length; i++) {
        const seg = session.segments[i];
        const x1 = getXPosition(seg.startTime);
        const x2 = getXPosition(seg.endTime);
        rects.push({ x: x1, width: Math.max(2, x2 - x1), stage: seg.stage, isInferred: seg.isInferred, isInBed: seg.isInBed });
        if (i < session.segments.length - 1) {
          const next = session.segments[i + 1];
          if (seg.stage !== next.stage) {
            const y1 = getLaneY(getStageIndex(seg.stage));
            const y2 = getLaneY(getStageIndex(next.stage));
            const connY = Math.min(y1, y2);
            const connBottom = Math.max(y1, y2) + LANE_HEIGHT;
            connectors.push({ x: x2 - CONNECTOR_W / 2, y: connY, height: connBottom - connY, isInferred: seg.isInferred });
          }
        }
      }
      return { rects, connectors };
    });
  }, [resolvedSessions, getXPosition]);

  const gaps = useMemo(() => {
    if (resolvedSessions.length <= 1) return [];
    const sorted = [...resolvedSessions].sort((a, b) => a.bedTime.getTime() - b.bedTime.getTime());
    const result: Array<{ midX: number; label: string }> = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const gapStart = sorted[i].wakeTime.getTime();
      const gapEnd = sorted[i + 1].bedTime.getTime();
      const midX = getXPosition(new Date((gapStart + gapEnd) / 2));
      result.push({ midX, label: sorted[i + 1].label || 'Nap' });
    }
    return result;
  }, [resolvedSessions, getXPosition]);

  const wakeX        = CHART_WIDTH - PADDING_RIGHT;
  const allHourMarks = generateHourMarks(timelineBed, timelineWake);
  // Filter hour marks too close to either edge (accounts for bedtime label width ~55px start-anchored)
  const allFilteredHourMarks = allHourMarks.filter(mark => {
    const x = getXPosition(mark);
    return x > 55 && (wakeX - x) > MIN_LABEL_GAP;
  });
  const midnightMark = (() => {
    const m = new Date(timelineBed);
    m.setHours(0, 0, 0, 0);
    m.setDate(m.getDate() + 1);
    return m > timelineBed && m < timelineWake ? m : null;
  })();
  // Exclude midnight from regular hour marks — it's rendered separately as a divider
  const hourMarks = midnightMark
    ? allFilteredHourMarks.filter(m => m.getTime() !== midnightMark.getTime())
    : allFilteredHourMarks;

  const xAxisLabels = useMemo(() => {
    if (resolvedSessions.length <= 1) return null;
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

  const totalSlept = stageDurations.rem + stageDurations.core + stageDurations.deep;

  return (
    <View
      style={styles.container}
      {...pan.panHandlers}
      onLayout={e => { layoutWidth.current = e.nativeEvent.layout.width; }}
    >
      {/* ── Top row: summary stats OR tooltip (same vertical space) ── */}
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
          <View style={styles.statItem}>
            <View style={styles.iconWrap}><BedtimeIcon /></View>
            <Text style={styles.statLabel}>Bedtime</Text>
            <Text style={styles.statValue}>{inferredBoundaryX ? '~' : ''}{formatTimeLabel(timelineBed)}</Text>
          </View>
          <View style={styles.statItem}>
            <View style={styles.iconWrap}><SleptIcon /></View>
            <Text style={styles.statLabel}>Slept</Text>
            <Text style={styles.statValue}>{formatDuration(totalSlept)}</Text>
          </View>
          <View style={styles.statItem}>
            <View style={styles.iconWrap}><WakeTimeIcon /></View>
            <Text style={styles.statLabel}>Wake Up</Text>
            <Text style={styles.statValue}>{formatTimeLabel(timelineWake)}</Text>
          </View>
        </View>
      )}

      {/* ── Hypnogram chart ── */}
      <View style={styles.chartRow}>
        {/* Stage label column — aligned to lane rows */}
        <View style={[styles.labelCol, { paddingTop: PADDING_TOP }]}>
          {stages.map((stage, i) => (
            <View
              key={stage}
              style={{
                height: i < stages.length - 1 ? LANE_HEIGHT + LANE_GAP : LANE_HEIGHT,
                justifyContent: 'center',
              }}
            >
              <Text style={styles.stageName}>{stageLabels[stage]}</Text>
              <Text style={styles.stageDur}>{formatDuration(stageDurations[stage])}</Text>
            </View>
          ))}
        </View>

      <Svg
        width="100%"
        height={CHART_HEIGHT}
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      >
        <Defs>
          <LinearGradient
            id="sleepGradient"
            x1="0" y1={PADDING_TOP}
            x2="0" y2={laneAreaBottom}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0%"   stopColor="#FFFFFF" />
            <Stop offset="33%"  stopColor="#F5DEDE" />
            <Stop offset="66%"  stopColor="#CC3535" />
            <Stop offset="100%" stopColor="#8C0B0B" />
          </LinearGradient>
          <Pattern id="inBedHatch" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
            <Line x1="0" y1="8" x2="8" y2="0" stroke="rgba(160,160,160,0.35)" strokeWidth="1.5" />
          </Pattern>
        </Defs>

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

        {/* Midnight divider — solid, brighter than hourly guides */}
        {midnightMark && (() => {
          const x = getXPosition(midnightMark);
          return (
            <>
              <Line
                x1={x} y1={PADDING_TOP} x2={x} y2={laneAreaBottom}
                stroke="rgba(255,255,255,0.45)"
                strokeWidth={1.5}
              />
              <SvgText
                x={x} y={CHART_HEIGHT - 10}
                fill="rgba(255,255,255,0.75)" fontSize={10} textAnchor="middle"
                fontWeight="600"
              >
                12 AM
              </SvgText>
            </>
          );
        })()}

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

        {/* Step-line figure — single gradient across blocks + connectors */}
        {stepPaths.map((p, i) =>
          p ? (
            <React.Fragment key={`sl-${i}`}>
              {p.rects.map((r, j) => {
                const y = getLaneY(getStageIndex(r.stage));
                return (
                  <React.Fragment key={`bl-${i}-${j}`}>
                    <Rect
                      x={r.x} y={y} width={r.width} height={LANE_HEIGHT}
                      fill="url(#sleepGradient)"
                      opacity={r.isInferred ? 0.4 : 1}
                    />
                    {r.isInBed && (
                      <Rect
                        x={r.x} y={y} width={r.width} height={LANE_HEIGHT}
                        fill="url(#inBedHatch)"
                      />
                    )}
                  </React.Fragment>
                );
              })}
              {p.connectors.map((c, j) => (
                <Rect
                  key={`cn-${i}-${j}`}
                  x={c.x}
                  y={c.y}
                  width={CONNECTOR_W}
                  height={c.height}
                  fill="url(#sleepGradient)"
                  opacity={c.isInferred ? 0.4 : 1}
                />
              ))}
            </React.Fragment>
          ) : null
        )}

        {/* Boundary between estimated and real ring data */}
        {inferredBoundaryX !== null && (
          <React.Fragment>
            <Line
              x1={inferredBoundaryX} y1={PADDING_TOP}
              x2={inferredBoundaryX} y2={laneAreaBottom}
              stroke="rgba(255,255,255,0.35)"
              strokeWidth={1}
              strokeDasharray="3,3"
            />
            <SvgText x={inferredBoundaryX - 4} y={PADDING_TOP + 10} fill="rgba(255,255,255,0.35)" fontSize={8} textAnchor="end">
              Estimated
            </SvgText>
            <SvgText x={inferredBoundaryX + 4} y={PADDING_TOP + 10} fill="rgba(255,255,255,0.35)" fontSize={8} textAnchor="start">
              Recorded data
            </SvgText>
          </React.Fragment>
        )}

        {/* X-axis time labels */}
        {xAxisLabels ? (
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
          <>
            <SvgText
              x={PADDING_LEFT} y={CHART_HEIGHT - 10}
              fill="rgba(255,255,255,0.55)" fontSize={10} textAnchor="start"
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

        {/* Horizontal lane separator lines */}
        {stages.map((stage, i) => {
          if (i === stages.length - 1) return null;
          const y = getLaneY(i) + LANE_HEIGHT + LANE_GAP / 2;
          return (
            <Line
              key={`hl-${stage}`}
              x1={0} y1={y} x2={CHART_WIDTH} y2={y}
              stroke="rgba(255,255,255,0.10)"
              strokeWidth={1}
            />
          );
        })}

        {/* Touch cursor */}
        {tooltip && (
          <Line
            x1={tooltip.svgX} y1={PADDING_TOP} x2={tooltip.svgX} y2={laneAreaBottom}
            stroke="rgba(255,255,255,0.75)" strokeWidth={1.5} strokeDasharray="3,3"
          />
        )}
      </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.sm,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingRight: MARGIN_RIGHT,
  },
  labelCol: {
    width: LABEL_COL_W,
    marginLeft: 0,
  },
  stageName: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    fontFamily: fontFamily.demiBold,
  },
  stageDur: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontFamily: fontFamily.regular,
  },
  // HEIGHT MUST match tooltipReplacement.height — they occupy the same vertical slot.
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
    height: 68,
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    gap: 3,
  },
  iconWrap: {
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
  statLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10,
    fontFamily: fontFamily.regular,
    letterSpacing: 0.5,
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: fontFamily.demiBold,
  },
  // HEIGHT MUST match summaryRow.height above.
  tooltipReplacement: {
    height: 68,
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
