import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import type { RangeEntry } from '../../../data/metricExplanations';

interface RangeBarChartProps {
  ranges: RangeEntry[];
  unit: string;
}

const BAR_HEIGHT = 18;

export function RangeBarChart({ ranges, unit }: RangeBarChartProps) {
  const globalMin = ranges[0].min;
  const globalMax = ranges[ranges.length - 1].max;
  const totalSpan = globalMax - globalMin;

  return (
    <View style={styles.container}>
      <Svg width="100%" height={BAR_HEIGHT} style={styles.svg}>
        {ranges.map((r, i) => {
          const leftPct = ((r.min - globalMin) / totalSpan) * 100;
          const widthPct = ((r.max - r.min) / totalSpan) * 100;
          return (
            <Rect
              key={i}
              x={`${leftPct}%`}
              y={0}
              width={`${widthPct}%`}
              height={BAR_HEIGHT}
              fill={r.color}
              rx={i === 0 ? 4 : 0}
              ry={i === 0 ? 4 : 0}
              opacity={r.isNormal ? 1 : 0.65}
            />
          );
        })}
        {/* Normal zone outline */}
        {ranges.map((r, i) => {
          if (!r.isNormal) return null;
          const leftPct = ((r.min - globalMin) / totalSpan) * 100;
          const widthPct = ((r.max - r.min) / totalSpan) * 100;
          return (
            <Rect
              key={`outline-${i}`}
              x={`${leftPct}%`}
              y={0}
              width={`${widthPct}%`}
              height={BAR_HEIGHT}
              fill="none"
              stroke="rgba(255,255,255,0.55)"
              strokeWidth={1.5}
            />
          );
        })}
      </Svg>

      {/* Labels row */}
      <View style={styles.labelsRow}>
        {ranges.map((r, i) => {
          const leftPct = ((r.min - globalMin) / totalSpan) * 100;
          const widthPct = ((r.max - r.min) / totalSpan) * 100;
          return (
            <View
              key={i}
              style={[styles.labelCell, { left: `${leftPct}%` as any, width: `${widthPct}%` as any }]}
            >
              <Text style={[styles.labelText, { color: r.color }]} numberOfLines={1}>
                {r.label}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Min/max values */}
      <View style={styles.scaleRow}>
        <Text style={styles.scaleText}>{globalMin} {unit}</Text>
        <Text style={styles.scaleText}>{globalMax} {unit}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  svg: {
    borderRadius: 4,
    overflow: 'hidden',
  },
  labelsRow: {
    position: 'relative',
    height: 18,
    marginTop: 4,
  },
  labelCell: {
    position: 'absolute',
    alignItems: 'center',
  },
  labelText: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  scaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  scaleText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 10,
  },
});

export default RangeBarChart;
