import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useBaselineMode } from '../../context/BaselineModeContext';
import { spacing, fontSize, fontFamily, borderRadius } from '../../theme/colors';
import type { BaselineMetrics } from '../../types/baseline.types';

const RING_SIZE = 120;
const STROKE_WIDTH = 8;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const METRIC_CONFIG: { key: keyof BaselineMetrics; icon: string; colorFrom: string; colorTo: string }[] = [
  { key: 'sleep', icon: 'moon', colorFrom: '#6B8EFF', colorTo: '#8AAAFF' },
  { key: 'heartRate', icon: 'heart', colorFrom: '#FF6B6B', colorTo: '#FF8888' },
  { key: 'hrv', icon: 'pulse', colorFrom: '#C4FF6B', colorTo: '#D4FF8B' },
  { key: 'temperature', icon: 'thermometer', colorFrom: '#6BFFF5', colorTo: '#8BFFF8' },
  { key: 'spo2', icon: 'water', colorFrom: '#B16BFF', colorTo: '#C48BFF' },
  { key: 'activity', icon: 'footsteps', colorFrom: '#00D4AA', colorTo: '#33DDBB' },
];

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function BaselineProgressCard() {
  const { t } = useTranslation();
  const baseline = useBaselineMode();
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    progressAnimRef.current?.stop();
    progressAnimRef.current = Animated.timing(progressAnim, {
      toValue: baseline.overallProgress,
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    progressAnimRef.current.start();
  }, [baseline.overallProgress]);

  // Subtle pulse on the progress ring
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.03,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const strokeDashoffset = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [CIRCUMFERENCE, 0],
  });

  const daysCurrent = Math.min(baseline.daysWithData, 3);

  return (
    <View style={styles.card}>
      {/* Progress Ring */}
      <Animated.View style={[styles.ringContainer, { transform: [{ scale: pulseAnim }] }]}>
        <Svg width={RING_SIZE} height={RING_SIZE}>
          <Defs>
            <LinearGradient id="progressGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor="#00D4AA" />
              <Stop offset="100%" stopColor="#00A88A" />
            </LinearGradient>
          </Defs>
          {/* Background circle */}
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={STROKE_WIDTH}
            fill="none"
          />
          {/* Progress circle */}
          <AnimatedCircle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            stroke="url(#progressGrad)"
            strokeWidth={STROKE_WIDTH}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={strokeDashoffset}
            rotation={-90}
            origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
          />
        </Svg>
        <View style={styles.ringCenter}>
          <Text style={styles.dayNumber}>{daysCurrent}</Text>
          <Text style={styles.dayLabel}>{t('baseline.day_of', { required: 3 })}</Text>
        </View>
      </Animated.View>

      {/* Title */}
      <Text style={styles.title}>{t('baseline.title')}</Text>
      <Text style={styles.subtitle}>{t('baseline.subtitle')}</Text>

      {/* Per-metric progress rows */}
      <View style={styles.metricsContainer}>
        {METRIC_CONFIG.map(({ key, icon, colorFrom }) => {
          const metric = baseline.metrics[key];
          return (
            <View key={key} style={styles.metricRow}>
              <View style={[styles.metricIcon, { backgroundColor: `${colorFrom}15` }]}>
                <Ionicons name={icon as any} size={14} color={colorFrom} />
              </View>
              <Text style={styles.metricLabel}>{t(`baseline.metric_${key}`)}</Text>
              <View style={styles.metricProgress}>
                {Array.from({ length: metric.required }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.progressDot,
                      i < metric.current
                        ? { backgroundColor: colorFrom }
                        : { backgroundColor: 'rgba(255,255,255,0.08)' },
                    ]}
                  />
                ))}
              </View>
              {metric.ready && (
                <Ionicons name="checkmark-circle" size={16} color="#00D4AA" />
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  ringContainer: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  ringCenter: {
    position: 'absolute',
    alignItems: 'center',
  },
  dayNumber: {
    fontSize: 32,
    fontFamily: fontFamily.demiBold,
    color: '#FFFFFF',
    lineHeight: 36,
  },
  dayLabel: {
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  title: {
    fontSize: fontSize.xl,
    fontFamily: fontFamily.demiBold,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  metricsContainer: {
    width: '100%',
    gap: 10,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  metricIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: {
    flex: 1,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    color: 'rgba(255,255,255,0.7)',
  },
  metricProgress: {
    flexDirection: 'row',
    gap: 4,
  },
  progressDot: {
    width: 18,
    height: 5,
    borderRadius: 3,
  },
});
