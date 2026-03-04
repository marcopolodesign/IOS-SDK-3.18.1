import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { ArcZone } from '../../../data/metricExplanations';

interface ScoreArcChartProps {
  zones: ArcZone[];
}

const STROKE_WIDTH = 16;
const START_ANGLE = -180; // left
const END_ANGLE = 0;      // right (semi-circle)

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polarToCartesian(cx, cy, r, startDeg);
  const end = polarToCartesian(cx, cy, r, endDeg);
  const largeArcFlag = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

export function ScoreArcChart({ zones }: ScoreArcChartProps) {
  const { width: screenWidth } = useWindowDimensions();
  const svgWidth = Math.min(screenWidth - 80, 280);
  const svgHeight = svgWidth / 2 + STROKE_WIDTH;
  const cx = svgWidth / 2;
  const cy = svgHeight - STROKE_WIDTH / 2;
  const r = (svgWidth - STROKE_WIDTH * 2) / 2;

  const globalMin = zones[0].min;
  const globalMax = zones[zones.length - 1].max;
  const totalSpan = globalMax - globalMin;
  const arcSpan = END_ANGLE - START_ANGLE; // 180

  return (
    <View style={styles.container}>
      <Svg width={svgWidth} height={svgHeight}>
        {zones.map((zone, i) => {
          const zoneStart = START_ANGLE + ((zone.min - globalMin) / totalSpan) * arcSpan;
          const zoneEnd = START_ANGLE + ((zone.max - globalMin) / totalSpan) * arcSpan;
          return (
            <Path
              key={i}
              d={describeArc(cx, cy, r, zoneStart, zoneEnd)}
              stroke={zone.color}
              strokeWidth={STROKE_WIDTH}
              strokeLinecap="butt"
              fill="none"
              opacity={0.85}
            />
          );
        })}
      </Svg>

      {/* Zone labels */}
      <View style={styles.labelsRow}>
        {zones.map((zone, i) => (
          <View key={i} style={styles.labelItem}>
            <View style={[styles.dot, { backgroundColor: zone.color }]} />
            <Text style={styles.labelText}>{zone.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  labelsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 8,
  },
  labelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  labelText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
  },
});

export default ScoreArcChart;
