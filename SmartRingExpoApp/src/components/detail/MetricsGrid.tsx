import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { fontFamily, fontSize, spacing } from '../../theme/colors';

export interface MetricCell {
  label: string;
  value: string;
  unit?: string;
  accent?: string;
  onPress?: () => void;
}

interface MetricsGridProps {
  metrics: [MetricCell, MetricCell, MetricCell, MetricCell];
  style?: ViewStyle;
}

function Cell({ cell }: { cell: MetricCell }) {
  const content = (
    <View style={styles.cell}>
      <Text style={styles.label} numberOfLines={1}>{cell.label}</Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, cell.accent ? { color: cell.accent } : undefined]} numberOfLines={1} adjustsFontSizeToFit>
          {cell.value}
        </Text>
        {cell.unit ? <Text style={styles.unit}>{cell.unit}</Text> : null}
      </View>
    </View>
  );
  if (cell.onPress) {
    return <TouchableOpacity onPress={cell.onPress} activeOpacity={0.7} style={styles.touchableCell}>{content}</TouchableOpacity>;
  }
  return content;
}

export function MetricsGrid({ metrics, style }: MetricsGridProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.row}>
        <Cell cell={metrics[0]} />
        <View style={styles.verticalDivider} />
        <Cell cell={metrics[1]} />
      </View>
      <View style={styles.horizontalDivider} />
      <View style={styles.row}>
        <Cell cell={metrics[2]} />
        <View style={styles.verticalDivider} />
        <Cell cell={metrics[3]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: 4,
  },
  label: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontFamily: fontFamily.regular,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
    flexWrap: 'nowrap',
  },
  value: {
    color: '#FFFFFF',
    fontSize: 24,
    fontFamily: fontFamily.demiBold,
  },
  unit: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
  },
  touchableCell: {
    flex: 1,
  },
  verticalDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  horizontalDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
});
