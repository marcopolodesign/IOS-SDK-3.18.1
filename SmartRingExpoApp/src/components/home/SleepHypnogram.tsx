import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';
import { GlassCard } from './GlassCard';
import { spacing, fontSize, fontFamily } from '../../theme/colors';

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
}

// Stage configuration - order from top to bottom: Awake, REM, Core, Deep
const stages: SleepStage[] = ['awake', 'rem', 'core', 'deep'];

// Apple-style colors
const stageColors: Record<SleepStage, string> = {
  awake: '#FF6B6B',   // Orange-red for awake
  rem: '#81D4FA',     // Light cyan for REM
  core: '#42A5F5',    // Blue for Core
  deep: '#5C4DB1',    // Deep purple for Deep
};

const stageLabels: Record<SleepStage, string> = {
  awake: 'Awake',
  rem: 'REM',
  core: 'Core',
  deep: 'Deep',
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - spacing.lg * 4;
const CHART_HEIGHT = 250;
const PADDING_LEFT = 45;
const PADDING_RIGHT = 0;
const PADDING_TOP = 15;
const PADDING_BOTTOM = 30;
const LANE_HEIGHT = 40;
const LANE_GAP = 10;
const BLOCK_RADIUS = 8;

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours === 0) return `${mins}'`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}'`;
}

export function SleepHypnogram({
  segments,
  bedTime,
  wakeTime,
}: SleepHypnogramProps) {
  const totalDuration = wakeTime.getTime() - bedTime.getTime();
  const chartAreaWidth = CHART_WIDTH - PADDING_LEFT - PADDING_RIGHT;

  const getXPosition = (time: Date) => {
    const elapsed = time.getTime() - bedTime.getTime();
    return PADDING_LEFT + (elapsed / totalDuration) * chartAreaWidth;
  };

  // Get Y position for each stage lane (center of the lane)
  const getLaneY = (stageIndex: number) => {
    return PADDING_TOP + stageIndex * (LANE_HEIGHT + LANE_GAP);
  };

  const getStageIndex = (stage: SleepStage) => stages.indexOf(stage);

  // Calculate duration for each stage
  const stageDurations: Record<SleepStage, number> = {
    awake: 0,
    rem: 0,
    core: 0,
    deep: 0,
  };

  segments.forEach((segment) => {
    const durationMs = segment.endTime.getTime() - segment.startTime.getTime();
    const durationMinutes = durationMs / (1000 * 60);
    stageDurations[segment.stage] += durationMinutes;
  });

  // Build connector lines between segments
  const buildConnectors = () => {
    const connectors: Array<{
      x: number;
      y1: number;
      y2: number;
      color: string;
    }> = [];

    for (let i = 0; i < segments.length - 1; i++) {
      const currentSegment = segments[i];
      const nextSegment = segments[i + 1];

      if (currentSegment.stage !== nextSegment.stage) {
        const x = getXPosition(currentSegment.endTime);
        const currentLaneIndex = getStageIndex(currentSegment.stage);
        const nextLaneIndex = getStageIndex(nextSegment.stage);

        const y1 = getLaneY(currentLaneIndex) + LANE_HEIGHT / 2;
        const y2 = getLaneY(nextLaneIndex) + LANE_HEIGHT / 2;

        // Use a gradient-like effect by using the "deeper" stage's color
        const color = currentLaneIndex > nextLaneIndex
          ? stageColors[currentSegment.stage]
          : stageColors[nextSegment.stage];

        connectors.push({ x, y1, y2, color });
      }
    }

    return connectors;
  };

  const connectors = buildConnectors();

  return (
    <GlassCard style={styles.container}>
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
        {/* Vertical dotted grid lines */}
        {[0.25, 0.5, 0.75].map((ratio, index) => {
          const x = PADDING_LEFT + ratio * chartAreaWidth;
          return (
            <Line
              key={`vgrid-${index}`}
              x1={x}
              y1={PADDING_TOP}
              x2={x}
              y2={PADDING_TOP + stages.length * (LANE_HEIGHT + LANE_GAP) - LANE_GAP}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth={1}
              strokeDasharray="4,4"
            />
          );
        })}

        {/* Horizontal grid lines (lane separators) */}
        {stages.map((stage, index) => {
          const y = getLaneY(index) + LANE_HEIGHT + LANE_GAP / 2;
          if (index === stages.length - 1) return null;
          return (
            <Line
              key={`hgrid-${stage}`}
              x1={PADDING_LEFT}
              y1={y}
              x2={CHART_WIDTH - PADDING_RIGHT}
              y2={y}
              stroke="rgba(255,255,255,0.1)"
              strokeWidth={1}
            />
          );
        })}

        {/* Y-axis stage labels with durations */}
        {stages.map((stage, index) => {
          const y = getLaneY(index);
          return (
            <React.Fragment key={stage}>
              <SvgText
                x={5}
                y={y + 14}
                fill="rgba(255,255,255,0.9)"
                fontSize={12}
                fontWeight="600"
              >
                {stageLabels[stage]}
              </SvgText>
              <SvgText
                x={5}
                y={y + 28}
                fill="rgba(255,255,255,0.5)"
                fontSize={10}
              >
                {formatDuration(stageDurations[stage])}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* Vertical connectors between stages */}
        {connectors.map((connector, index) => (
          <Line
            key={`connector-${index}`}
            x1={connector.x}
            y1={connector.y1}
            x2={connector.x}
            y2={connector.y2}
            stroke={connector.color}
            strokeWidth={2.5}
            strokeOpacity={0.75}
            strokeLinecap="round"
          />
        ))}

        {/* Sleep segment blocks (rounded rectangles) */}
        {segments.map((segment, index) => {
          const x = getXPosition(segment.startTime);
          const width = Math.max(4, getXPosition(segment.endTime) - x);
          const laneIndex = getStageIndex(segment.stage);
          const y = getLaneY(laneIndex);

          return (
            <Rect
              key={`block-${index}`}
              x={x}
              y={y}
              width={width}
              height={LANE_HEIGHT}
              rx={BLOCK_RADIUS}
              ry={BLOCK_RADIUS}
              fill={stageColors[segment.stage]}
              stroke={stageColors[segment.stage]}
              strokeWidth={3}
              strokeOpacity={0.5}
      
            />
          );
        })}
      </Svg>

      {/* Stage duration summary chips */}
      <View style={styles.summaryRow}>
        {stages.map((stage) => (
          <View
            key={stage}
            style={[
              styles.summaryChip,
              { borderColor: stageColors[stage] },
            ]}
          >
            <Text style={styles.summaryLabel}>{stageLabels[stage]}</Text>
            <Text style={styles.summaryValue}>
              {formatDuration(stageDurations[stage])}
            </Text>
          </View>
        ))}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xs,
    gap: 6,
  },
  summaryChip: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderLeftWidth: 3,
  },
  summaryLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    fontFamily: fontFamily.regular,
    marginBottom: 2,
  },
  summaryValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: fontFamily.demiBold,
  },
});

export default SleepHypnogram;
