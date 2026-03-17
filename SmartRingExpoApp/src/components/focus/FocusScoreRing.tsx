import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { colors, fontFamily, fontSize } from '../../theme/colors';
import type { ReadinessRecommendation } from '../../types/focus.types';

interface FocusScoreRingProps {
  score: number | null;
  recommendation: ReadinessRecommendation | null;
  isLoading: boolean;
}

const SIZE = 200;
const STROKE_WIDTH = 16;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function ringColor(score: number | null): string {
  if (score == null) return 'rgba(255,255,255,0.15)';
  if (score >= 70) return colors.success;
  if (score >= 45) return colors.warning;
  return colors.error;
}

function pillColors(rec: ReadinessRecommendation | null): { bg: string; text: string } {
  if (rec === 'GO') return { bg: colors.success, text: colors.textInverse };
  if (rec === 'EASY') return { bg: colors.warning, text: colors.textInverse };
  if (rec === 'REST') return { bg: colors.error, text: colors.textInverse };
  return { bg: 'rgba(255,255,255,0.15)', text: colors.textSecondary };
}

export function FocusScoreRing({ score, recommendation, isLoading }: FocusScoreRingProps) {
  const progress = score != null ? score / 100 : 0;
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);
  const color = isLoading ? 'rgba(255,255,255,0.15)' : ringColor(score);
  const pill = pillColors(recommendation);

  return (
    <View style={styles.container}>
      <Svg width={SIZE} height={SIZE}>
        <G rotation="-90" origin={`${SIZE / 2}, ${SIZE / 2}`}>
          {/* Track */}
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={STROKE_WIDTH}
            fill="none"
          />
          {/* Progress arc */}
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={color}
            strokeWidth={STROKE_WIDTH}
            fill="none"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </G>
      </Svg>

      {/* Centered content */}
      <View style={styles.center}>
        <Text style={[styles.score, { color: isLoading ? colors.textMuted : colors.text }]}>
          {isLoading ? '--' : score != null ? String(score) : '--'}
        </Text>
        {recommendation != null && !isLoading && (
          <View style={[styles.pill, { backgroundColor: pill.bg }]}>
            <Text style={[styles.pillText, { color: pill.text }]}>{recommendation}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SIZE,
    height: SIZE,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 8,
  },
  center: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  score: {
    fontFamily: fontFamily.demiBold,
    fontSize: 52,
    lineHeight: 56,
  },
  pill: {
    marginTop: 6,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pillText: {
    fontFamily: fontFamily.demiBold,
    fontSize: fontSize.sm,
    letterSpacing: 1,
  },
});
