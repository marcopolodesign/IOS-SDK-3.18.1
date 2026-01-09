import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Platform } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { fontSize } from '../../theme/colors';

interface SemiCircularGaugeProps {
  score: number; // 0-100
  size?: number;
  strokeWidth?: number;
  label?: string;
  animated?: boolean;
}

export function SemiCircularGauge({
  score,
  size = 280,
  strokeWidth = 12,
  label = 'OVERALL SCORE',
  animated = true,
}: SemiCircularGaugeProps) {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const [displayScore, setDisplayScore] = React.useState(0);

  const radius = (size - strokeWidth) / 2;
  const circumference = Math.PI * radius; // Half circle
  const center = size / 2;

  useEffect(() => {
    if (animated) {
      animatedValue.setValue(0);
      Animated.timing(animatedValue, {
        toValue: score,
        duration: 1500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();

      // Animate the display number
      const listener = animatedValue.addListener(({ value }) => {
        setDisplayScore(Math.round(value));
      });

      return () => {
        animatedValue.removeListener(listener);
      };
    } else {
      setDisplayScore(score);
    }
  }, [score, animated]);

  // Create the arc path for the background
  const createArc = (startAngle: number, endAngle: number) => {
    const start = polarToCartesian(center, center, radius, endAngle);
    const end = polarToCartesian(center, center, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

    return [
      'M', start.x, start.y,
      'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y,
    ].join(' ');
  };

  const polarToCartesian = (cx: number, cy: number, r: number, angleInDegrees: number) => {
    const angleInRadians = (angleInDegrees - 180) * Math.PI / 180;
    return {
      x: cx + r * Math.cos(angleInRadians),
      y: cy + r * Math.sin(angleInRadians),
    };
  };

  // Background arc (full semicircle)
  const bgArc = createArc(0, 180);

  // Calculate the progress arc based on score
  const progressAngle = (score / 100) * 180;
  const progressArc = createArc(0, progressAngle);

  // Animated stroke dash
  const strokeDashoffset = animatedValue.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0],
  });

  return (
    <View style={[styles.container, { width: size, height: size / 2 + 60 }]}>
      <Text style={styles.label}>{label}</Text>
      
      <View style={styles.gaugeContainer}>
        <Svg width={size} height={size / 2 + strokeWidth}>
          <Defs>
            <LinearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor="rgba(255, 255, 255, 0.3)" />
              <Stop offset="100%" stopColor="rgba(255, 255, 255, 0.8)" />
            </LinearGradient>
          </Defs>

          {/* Background arc */}
          <Path
            d={bgArc}
            stroke="rgba(255, 255, 255, 0.2)"
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
          />

          {/* Progress arc */}
          <Path
            d={bgArc}
            stroke="url(#gaugeGradient)"
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - (circumference * score / 100)}
          />
        </Svg>

        {/* Score display */}
        <View style={[styles.scoreContainer, { top: size / 4 }]}>
          <View style={styles.scoreRow}>
            <Text style={styles.scoreText}>{displayScore}</Text>
            <Text style={styles.percentText}>%</Text>
          </View>
        </View>

        {/* Min/Max labels */}
        <View style={[styles.minMaxContainer, { width: size }]}>
          <Text style={styles.minMaxText}>0</Text>
          <Text style={styles.minMaxText}>100</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  label: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: fontSize.sm,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: 16,
  },
  gaugeContainer: {
    position: 'relative',
    alignItems: 'center',
  },
  scoreContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  scoreText: {
    color: '#FFFFFF',
    fontSize: 72,
    fontWeight: '200',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-thin',
  },
  percentText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '300',
    marginTop: 12,
    marginLeft: 4,
  },
  minMaxContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: -10,
  },
  minMaxText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: fontSize.sm,
  },
});

export default SemiCircularGauge;

