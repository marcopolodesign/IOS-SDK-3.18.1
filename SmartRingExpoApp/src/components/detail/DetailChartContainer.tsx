import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fontFamily, fontSize, spacing } from '../../theme/colors';

interface DetailChartContainerProps {
  children: React.ReactNode;
  timeLabels?: string[];
  height?: number;
  yMin?: string;
  yMax?: string;
}

/**
 * Standardized wrapper for detail screen charts.
 * Provides a consistent dark background, time axis labels, and optional Y-axis.
 */
export function DetailChartContainer({
  children,
  timeLabels = ['12 AM', '6 AM', '12 PM', '6 PM', '12 AM'],
  height = 200,
  yMin,
  yMax,
}: DetailChartContainerProps) {
  return (
    <View style={styles.wrapper}>
      <View style={[styles.chartArea, { height }]}>
        {yMax && <Text style={[styles.yLabel, styles.yTop]}>{yMax}</Text>}
        {yMin && <Text style={[styles.yLabel, styles.yBottom]}>{yMin}</Text>}
        {children}
      </View>
      <View style={styles.timeAxis}>
        {timeLabels.map((label, i) => (
          <Text key={i} style={styles.timeLabel}>{label}</Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    overflow: 'hidden',
  },
  chartArea: {
    position: 'relative',
  },
  yLabel: {
    position: 'absolute',
    right: spacing.sm,
    color: 'rgba(255,255,255,0.3)',
    fontSize: 10,
    fontFamily: fontFamily.regular,
  },
  yTop: {
    top: spacing.sm,
  },
  yBottom: {
    bottom: spacing.sm,
  },
  timeAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  timeLabel: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 10,
    fontFamily: fontFamily.regular,
  },
});

export default DetailChartContainer;
