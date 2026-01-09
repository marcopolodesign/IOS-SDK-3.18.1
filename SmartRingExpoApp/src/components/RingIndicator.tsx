import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors, fontSize, fontWeight } from '../theme/colors';

interface RingIndicatorProps {
  value: number;
  maxValue: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  gradientColors?: string[];
  label?: string;
  unit?: string;
  showPercentage?: boolean;
}

export const RingIndicator: React.FC<RingIndicatorProps> = ({
  value,
  maxValue,
  size = 120,
  strokeWidth = 12,
  color = colors.primary,
  gradientColors,
  label,
  unit,
  showPercentage = false,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.min((value / maxValue) * 100, 100);
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  const center = size / 2;

  const displayValue = showPercentage ? Math.round(percentage) : value;
  const displayUnit = showPercentage ? '%' : unit;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={gradientColors?.[0] || color} />
            <Stop offset="100%" stopColor={gradientColors?.[1] || color} />
          </LinearGradient>
        </Defs>
        
        {/* Background circle */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={colors.surfaceLight}
          strokeWidth={strokeWidth}
          fill="none"
        />
        
        {/* Progress circle */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke="url(#ringGradient)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      
      <View style={styles.content}>
        <Text style={[styles.value, { color }]}>{displayValue}</Text>
        {displayUnit && <Text style={[styles.unit, { color }]}>{displayUnit}</Text>}
        {label && <Text style={styles.label}>{label}</Text>}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    position: 'absolute',
    alignItems: 'center',
  },
  value: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
  },
  unit: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    marginTop: -4,
  },
  label: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 4,
  },
});

export default RingIndicator;





