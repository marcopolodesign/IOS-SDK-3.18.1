import React, { useEffect } from 'react';
import { View, Text, type TextStyle } from 'react-native';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const BEZIER = Easing.bezier(0.4, 0, 0, 1);
const DURATION = 600;
const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

// Returns true when value can be displayed as a rolling integer.
export function isNumericInt(value: number | string): boolean {
  if (typeof value === 'number') return isFinite(value);
  const n = Number(value);
  return !isNaN(n) && isFinite(n);
}

// ─── Single digit slot ────────────────────────────────────────────────────────
const RollingDigit = React.memo(function RollingDigit({
  digit,
  digitHeight,
  textStyle,
  delay,
  gap,
}: {
  digit: number;
  digitHeight: number;
  textStyle: TextStyle;
  delay: number;
  gap: number;
}) {
  // Start at 0 so digits slot in from the top on mount — that's the entrance animation.
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withTiming(-digit * digitHeight, { duration: DURATION, easing: BEZIER }),
    );
  }, [digit, digitHeight, delay]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <View style={{ height: digitHeight, overflow: 'hidden', marginRight: gap }}>
      <Reanimated.View style={animStyle}>
        {DIGITS.map(d => (
          <Text
            key={d}
            style={[
              textStyle,
              {
                height: digitHeight,
                lineHeight: digitHeight,
                // @ts-ignore — Android-only prop, suppresses extra font padding for precise clipping
                includeFontPadding: false,
              },
            ]}
          >
            {d}
          </Text>
        ))}
      </Reanimated.View>
    </View>
  );
});

// ─── Rolling number ───────────────────────────────────────────────────────────
export function RollingNumber({
  value,
  style,
  digitHeight,
  staggerMs = 40,
  gap = 0,
}: {
  value: number;
  style: TextStyle;
  digitHeight: number;
  staggerMs?: number;
  /** Horizontal gap between digit slots — use negative values to tighten spacing. */
  gap?: number;
}) {
  const rounded = Math.max(0, Math.round(value));
  const str = String(rounded);
  const len = str.length;
  const digits = str.split('').map(Number);

  // Strip only lineHeight — each slot enforces it via digitHeight.
  const { lineHeight: _lh, ...digitStyle } = style as any;

  return (
    <View style={{ flexDirection: 'row' }}>
      {digits.map((digit, idxFromLeft) => {
        const posFromRight = len - 1 - idxFromLeft;
        return (
          <RollingDigit
            key={`pos-${posFromRight}`}
            digit={digit}
            digitHeight={digitHeight}
            textStyle={digitStyle}
            delay={posFromRight * staggerMs}
            gap={gap}
          />
        );
      })}
    </View>
  );
}
