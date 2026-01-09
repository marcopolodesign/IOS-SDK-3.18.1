import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';
import { GlassCard } from './GlassCard';
import { spacing, fontSize } from '../../theme/colors';

export type SleepStage = 'awake' | 'rem' | 'core' | 'deep';

export interface SleepSegment {
  stage: SleepStage;
  startTime: Date;
  endTime: Date;
}

interface SleepStagesChartProps {
  segments: SleepSegment[];
  bedTime: Date;
  wakeTime: Date;
}

const stageColors: Record<SleepStage, string> = {
  awake: '#FF6B6B',
  rem: '#4ECDC4',
  core: '#45B7D1',
  deep: '#6366F1',
};

const stageHeights: Record<SleepStage, number> = {
  awake: 0.25,
  rem: 0.5,
  core: 0.75,
  deep: 1,
};

const stageLabels: Record<SleepStage, string> = {
  awake: 'Awake',
  rem: 'REM',
  core: 'Core',
  deep: 'Deep',
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - spacing.lg * 4;
const CHART_HEIGHT = 120;
const PADDING_LEFT = 50;
const PADDING_RIGHT = 10;
const PADDING_TOP = 10;
const PADDING_BOTTOM = 30;

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function SleepStagesChart({
  segments,
  bedTime,
  wakeTime,
}: SleepStagesChartProps) {
  const totalDuration = wakeTime.getTime() - bedTime.getTime();
  const chartAreaWidth = CHART_WIDTH - PADDING_LEFT - PADDING_RIGHT;
  const chartAreaHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

  const getXPosition = (time: Date) => {
    const elapsed = time.getTime() - bedTime.getTime();
    return PADDING_LEFT + (elapsed / totalDuration) * chartAreaWidth;
  };

  // Generate time labels (every 2 hours)
  const timeLabels: Date[] = [];
  const startHour = new Date(bedTime);
  startHour.setMinutes(0);
  let current = startHour;
  while (current <= wakeTime) {
    if (current >= bedTime) {
      timeLabels.push(new Date(current));
    }
    current = new Date(current.getTime() + 2 * 60 * 60 * 1000);
  }

  return (
    <GlassCard style={styles.container}>
      <Text style={styles.title}>Sleep Stages</Text>
      
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
        {/* Y-axis stage labels */}
        {(['deep', 'core', 'rem', 'awake'] as SleepStage[]).map((stage, index) => (
          <SvgText
            key={stage}
            x={5}
            y={PADDING_TOP + (index + 0.5) * (chartAreaHeight / 4)}
            fill="rgba(255,255,255,0.6)"
            fontSize={10}
            alignmentBaseline="middle"
          >
            {stageLabels[stage]}
          </SvgText>
        ))}

        {/* Horizontal grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => (
          <Line
            key={index}
            x1={PADDING_LEFT}
            y1={PADDING_TOP + ratio * chartAreaHeight}
            x2={CHART_WIDTH - PADDING_RIGHT}
            y2={PADDING_TOP + ratio * chartAreaHeight}
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={1}
          />
        ))}

        {/* Sleep segments */}
        {segments.map((segment, index) => {
          const x = getXPosition(segment.startTime);
          const width = getXPosition(segment.endTime) - x;
          const height = stageHeights[segment.stage] * chartAreaHeight;
          const y = PADDING_TOP + chartAreaHeight - height;

          return (
            <Rect
              key={index}
              x={x}
              y={y}
              width={Math.max(2, width)}
              height={height}
              fill={stageColors[segment.stage]}
              rx={2}
            />
          );
        })}

        {/* Time labels */}
        {timeLabels.map((time, index) => {
          const x = getXPosition(time);
          if (x < PADDING_LEFT || x > CHART_WIDTH - PADDING_RIGHT) return null;
          
          return (
            <SvgText
              key={index}
              x={x}
              y={CHART_HEIGHT - 5}
              fill="rgba(255,255,255,0.6)"
              fontSize={10}
              textAnchor="middle"
            >
              {formatTime(time)}
            </SvgText>
          );
        })}
      </Svg>

      {/* Legend */}
      <View style={styles.legend}>
        {(['deep', 'core', 'rem', 'awake'] as SleepStage[]).map((stage) => (
          <View key={stage} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: stageColors[stage] }]} />
            <Text style={styles.legendText}>{stageLabels[stage]}</Text>
          </View>
        ))}
      </View>
    </GlassCard>
  );
}

// Generate mock sleep data for demonstration
export function generateMockSleepData(): {
  segments: SleepSegment[];
  bedTime: Date;
  wakeTime: Date;
} {
  const today = new Date();
  const bedTime = new Date(today);
  bedTime.setHours(23, 0, 0, 0);
  bedTime.setDate(today.getDate() - 1);

  const wakeTime = new Date(today);
  wakeTime.setHours(7, 0, 0, 0);

  const stages: SleepStage[] = ['awake', 'core', 'deep', 'core', 'rem', 'core', 'deep', 'core', 'rem', 'awake'];
  const durations = [10, 30, 60, 45, 30, 50, 70, 40, 25, 20]; // minutes

  const segments: SleepSegment[] = [];
  let currentTime = new Date(bedTime);

  stages.forEach((stage, index) => {
    const endTime = new Date(currentTime.getTime() + durations[index] * 60 * 1000);
    segments.push({
      stage,
      startTime: new Date(currentTime),
      endTime,
    });
    currentTime = endTime;
  });

  return { segments, bedTime, wakeTime };
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  title: {
    color: '#FFFFFF',
    fontSize: fontSize.md,
    fontWeight: '600',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: fontSize.xs,
  },
});

export default SleepStagesChart;


