import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { fontFamily, fontSize } from '../../theme/colors';

type HeroLinearGaugeProps = {
  label: string;
  value: number;
  goal: number;
  message: string;
  minLabel?: string | number;
  maxLabel?: string | number;
};

/**
 * A horizontal hero gauge with a glowing progress bar and large numeric value.
 * Animates progress on mount/updates.
 */
export function HeroLinearGauge({
  label,
  value,
  goal,
  message,
  minLabel = 0,
  maxLabel = goal,
}: HeroLinearGaugeProps) {
  const progress = Math.max(0, Math.min(1, goal > 0 ? value / goal : 0));
  const displayValue = Math.round(value);
  const animated = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animated, {
      toValue: progress,
      duration: 1200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const barWidth = animated.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>

      <View style={styles.heroArea}>
        <View style={styles.barRow}>
          <Text style={styles.minMax}>{minLabel}</Text>
          <View style={styles.barContainer}>
            <Animated.View style={[styles.barFill, { width: barWidth }]} />
            <Animated.View style={[styles.barGlow, { width: barWidth }]} />
          </View>
          <Text style={styles.minMax}>{maxLabel}</Text>
        </View>

        <View style={styles.valueWrapper}>
          <Text style={styles.value}>{displayValue.toLocaleString()}</Text>
        </View>
      </View>

      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 10,
  },
  label: {
    color: 'rgba(255,255,255,0.8)',
    fontFamily: fontFamily.demiBold,
    letterSpacing: 2,
    fontSize: fontSize.sm,
  },
  barRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 12,
  },
  minMax: {
    color: 'rgba(255,255,255,0.6)',
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
  },
  barContainer: {
    flex: 1,
    height: 1,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.08)',
    // overflow: 'hidden',
    position: 'relative',
  },
  barFill: {
    height: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,1 )',
  },
  barGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.4)',
    opacity: 0.5,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 12,
  },
  value: {
    color: '#FFFFFF',
    fontFamily: fontFamily.regular,
    fontSize: 120,
    opacity: 0.3,
  },
  valueWrapper: {
    alignItems: 'center',
  },
  message: {
    color: 'rgba(255,255,255,0.85)',
    fontFamily: fontFamily.regular,
    fontSize: fontSize.lg,
    textAlign: 'center',
  },
  heroArea: {
    width: '100%',
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
});

export default HeroLinearGauge;
