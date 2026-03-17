import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { SleepDebtCategory } from '../../types/sleepDebt.types';
import { fontFamily, fontSize } from '../../theme/colors';

const SEGMENTS = [
  { key: 'none', color: '#4ADE80', widthPct: 10 },
  { key: 'low', color: '#FFD700', widthPct: 25 },
  { key: 'moderate', color: '#FF6B35', widthPct: 35 },
  { key: 'high', color: '#FF4444', widthPct: 30 },
] as const;

const CATEGORY_COLORS: Record<SleepDebtCategory, string> = {
  none: '#4ADE80',
  low: '#FFD700',
  moderate: '#FF6B35',
  high: '#FF4444',
};

// Maps totalDebtMin to a percentage across the gauge track
function debtToPercent(totalDebtMin: number): number {
  if (totalDebtMin <= 0) return 0;
  if (totalDebtMin <= 30) {
    // 0–30 → 0%–10%
    return (totalDebtMin / 30) * 10;
  }
  if (totalDebtMin <= 120) {
    // 30–120 → 10%–35%
    return 10 + ((totalDebtMin - 30) / 90) * 25;
  }
  if (totalDebtMin <= 300) {
    // 120–300 → 35%–70%
    return 35 + ((totalDebtMin - 120) / 180) * 35;
  }
  // 300–420 → 70%–100% (capped)
  return Math.min(70 + ((totalDebtMin - 300) / 120) * 30, 100);
}

interface SleepDebtGaugeProps {
  totalDebtMin: number;
  category: SleepDebtCategory;
  showLabels?: boolean;
}

export function SleepDebtGauge({ totalDebtMin, category, showLabels = true }: SleepDebtGaugeProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const pct = debtToPercent(totalDebtMin);
  const dotLeft = trackWidth * (pct / 100);
  const dotColor = CATEGORY_COLORS[category];

  return (
    <View style={styles.container}>
      <View
        style={styles.track}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      >
        {SEGMENTS.map((seg, i) => (
          <View
            key={seg.key}
            style={[
              styles.segment,
              {
                backgroundColor: seg.color,
                flex: seg.widthPct,
              },
              i === 0 && styles.segmentFirst,
              i === SEGMENTS.length - 1 && styles.segmentLast,
            ]}
          />
        ))}
        {trackWidth > 0 && (
          <View
            style={[
              styles.dot,
              {
                left: Math.max(0, Math.min(dotLeft - 8, trackWidth - 16)),
                borderColor: dotColor,
              },
            ]}
          />
        )}
      </View>
      {showLabels && (
        <View style={styles.labelsRow}>
          <Text style={styles.label}>None</Text>
          <Text style={styles.label}>High</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  track: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'visible',
    position: 'relative',
  },
  segment: {
    height: 6,
  },
  segmentFirst: {
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
  },
  segmentLast: {
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  dot: {
    position: 'absolute',
    top: -5,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    // shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontFamily: fontFamily.regular,
  },
});

export default SleepDebtGauge;
