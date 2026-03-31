import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, TouchableOpacity } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { useBaselineMode } from '../../context/BaselineModeContext';
import { spacing, fontSize, fontFamily, borderRadius } from '../../theme/colors';

const RING_SIZE = 120;
const STROKE_WIDTH = 8;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

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
              <Stop offset="0%" stopColor="#6B8EFF" />
              <Stop offset="100%" stopColor="#5070E0" />
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

      {/* View Baseline button */}
      <TouchableOpacity
        style={styles.viewButton}
        activeOpacity={0.7}
        onPress={() => router.push('/detail/baseline-detail')}
      >
        <Text style={styles.viewButtonText}>{t('baseline.view_baseline')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.xl,
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
    fontSize: fontSize.xxl,
    fontFamily: fontFamily.demiBold,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  viewButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 50,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  viewButtonText: {
    color: '#000000',
    fontSize: fontSize.md,
    fontFamily: fontFamily.demiBold,
  },
});
