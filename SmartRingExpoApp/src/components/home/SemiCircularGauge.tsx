import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { fontSize, fontFamily } from '../../theme/colors';

const BASE_WIDTH = 368;
const BASE_HEIGHT = 80;
const ELLIPSE_PATH =
  'M1.1756 78.3006C10.9415 64.8218 23.9784 52.3905 39.9412 41.5716C78.104 15.7064 129.864 1.17553 183.834 1.17554C237.804 1.17554 289.564 15.7064 327.727 41.5716C343.69 52.3905 356.727 64.8218 366.493 78.3006';

interface SemiCircularGaugeProps {
  score: number; // 0-100
  size?: number;
  strokeWidth?: number;
  backgroundStrokeWidth?: number;
  label?: string;
  animated?: boolean;
}

export function SemiCircularGauge({
  score,
  size = 360,
  strokeWidth = 6,
  backgroundStrokeWidth,
  label = 'FOCUS SCORE',
  animated = true,
}: SemiCircularGaugeProps) {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const [displayScore, setDisplayScore] = React.useState(0);
  const [pathLength, setPathLength] = React.useState(0);
  const lengthPathRef = useRef<Path>(null);
  const AnimatedPath = Animated.createAnimatedComponent(Path);

  const scaledHeight = (size / BASE_WIDTH) * BASE_HEIGHT;
  const bgStroke = backgroundStrokeWidth ?? Math.max(2, strokeWidth * 0.45);
  const glowStroke = strokeWidth * 1.8;

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

  useEffect(() => {
    // Measure path length once mounted; guard if getTotalLength is unavailable
    const measure = () => {
      if (lengthPathRef.current && typeof lengthPathRef.current.getTotalLength === 'function') {
        const length = lengthPathRef.current.getTotalLength();
        if (length) {
          setPathLength(length);
        }
      }
    };
    const timer = setTimeout(measure, 0);
    return () => clearTimeout(timer);
  }, [size, strokeWidth]);

  const strokeDashoffset =
    pathLength &&
    animatedValue.interpolate({
      inputRange: [0, 100],
      outputRange: [pathLength, 0],
    });

  return (
    <View style={[styles.container, { width: size, height: scaledHeight + 80 }]}>
      <Text style={styles.label}>{label}</Text>
      
      <View style={styles.gaugeContainer}>
        <Svg
          width={size}
          height={scaledHeight + strokeWidth}
          viewBox={`0 0 ${BASE_WIDTH} ${BASE_HEIGHT}`}
        >
          <Defs>
            <LinearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor="rgba(255, 255, 255, 0.3)" />
              <Stop offset="100%" stopColor="rgba(255, 255, 255, 0.8)" />
            </LinearGradient>
            <LinearGradient id="gaugeGlow" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor="rgba(255, 255, 255, 0.2)" />
              <Stop offset="100%" stopColor="rgba(255, 255, 255, 0.5)" />
            </LinearGradient>
          </Defs>

          {/* Hidden path to measure total length safely */}
          <Path
            ref={lengthPathRef}
            d={ELLIPSE_PATH}
            stroke="transparent"
            strokeWidth={strokeWidth}
            fill="none"
          />

          {/* Background arc */}
          <Path
            d={ELLIPSE_PATH}
            stroke="rgba(255, 255, 255, 0.15)"
            strokeWidth={bgStroke}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Soft glow to fake blur */}
          <AnimatedPath
            d={ELLIPSE_PATH}
            stroke="url(#gaugeGlow)"
            strokeWidth={glowStroke}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={pathLength ? [pathLength, pathLength] : undefined}
            strokeDashoffset={
              animated && pathLength
                ? strokeDashoffset
                : pathLength
                ? pathLength - (pathLength * score) / 100
                : 0
            }
            opacity={0.25}
          />

          {/* Progress arc */}
          <AnimatedPath
            d={ELLIPSE_PATH}
            stroke="url(#gaugeGradient)"
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={pathLength ? [pathLength, pathLength] : undefined}
            strokeDashoffset={
              animated && pathLength
                ? strokeDashoffset
                : pathLength
                ? pathLength - (pathLength * score) / 100
                : 0
            }
          />
        </Svg>

        {/* Score display */}
        <View style={[styles.scoreContainer, { top: size / 10 }]}>
          <View style={styles.scoreRow}>
            <Text style={styles.scoreText}>{displayScore}</Text>
            <Text style={styles.percentText}>%</Text>
          </View>
        </View>

        {/* Min/Max labels */}
        <View style={[styles.minMaxContainer, { width: size / 2 + 100 }]}>
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
    fontFamily: fontFamily.demiBold,
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
    alignItems: 'center',
  },
  scoreText: {
    color: '#FFFFFF',
    fontSize: 72,
    fontFamily: fontFamily.regular,
  },
  percentText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontFamily: fontFamily.regular,
    marginTop: 12,
    marginLeft: 4,
  },
  minMaxContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 10,
  },
  minMaxText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
  },
});

export default SemiCircularGauge;
