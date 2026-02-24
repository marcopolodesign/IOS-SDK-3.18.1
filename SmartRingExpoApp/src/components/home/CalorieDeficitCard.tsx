import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { GradientInfoCard } from '../common/GradientInfoCard';
import { spacing, fontSize, fontFamily } from '../../theme/colors';

// TODO: replace consumedCalories default with meal log sum when available
const CONSUMED_PLACEHOLDER = 1800;

type Props = {
  activeCalories: number;
  consumedCalories?: number;
};

export function CalorieDeficitCard({ activeCalories, consumedCalories = CONSUMED_PLACEHOLDER }: Props) {
  const active = Math.round(activeCalories);
  const consumed = Math.round(consumedCalories);

  // Deficit: negative = burned more than consumed (deficit), positive = surplus
  const deficit = consumed - active;
  const sign = deficit > 0 ? '+' : '';
  const deficitDisplay = `${sign}${Math.round(deficit)}`;
  const message =
    Math.abs(deficit) < 100 ? 'Balanced'
    : deficit < 0 ? "You're on deficit"
    : "You're on surplus";

  // SVG donut arc math
  const radius = 68;
  const strokeWidth = 14;
  const cx = 90;
  const cy = 90;
  const circumference = 2 * Math.PI * radius;
  const maxVal = Math.max(active, consumed, 1) * 1.2;

  // Both arcs start at 210° (7 o'clock), go clockwise
  // strokeDashoffset shifts the start: offset = circumference * (1 - startFraction)
  // where startFraction = 210/360 = 7/12
  const startFraction = 210 / 360;
  const startOffset = circumference * (1 - startFraction);

  const activeFill = Math.min(1, active / maxVal);
  const consumedFill = Math.min(1, consumed / maxVal);

  const activeDash = activeFill * circumference;
  const consumedDash = consumedFill * circumference;

  return (
    <GradientInfoCard
      icon={<Text style={styles.icon}>⚖</Text>}
      title="Caloric Deficit"
      headerValue={deficitDisplay}
      headerSubtitle={message}
      gradientStops={[
        { offset: 0, color: 'rgba(20, 80, 30, 0.99)' },
        { offset: 0.75, color: 'rgba(0, 0, 0, 0.27)' },
      ]}
      gradientCenter={{ x: 0.51, y: -0.86 }}
      gradientRadii={{ rx: '80%', ry: '300%' }}
      showArrow={false}
    >
      <View style={styles.body}>
        {/* Donut chart */}
        <View style={styles.donutWrapper}>
          <Svg width={cx * 2} height={cy * 2}>
            {/* Background ring */}
            <Circle
              cx={cx}
              cy={cy}
              r={radius}
              stroke="rgba(255,255,255,0.1)"
              strokeWidth={strokeWidth}
              fill="none"
            />
            {/* Orange arc — active calories */}
            <Circle
              cx={cx}
              cy={cy}
              r={radius}
              stroke="#F5A623"
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={`${activeDash} ${circumference}`}
              strokeDashoffset={startOffset}
              strokeLinecap="round"
              rotation={-90}
              origin={`${cx}, ${cy}`}
            />
            {/* Blue arc — consumed calories */}
            <Circle
              cx={cx}
              cy={cy}
              r={radius}
              stroke="#4AACF5"
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={`${consumedDash} ${circumference}`}
              strokeDashoffset={startOffset}
              strokeLinecap="round"
              rotation={-90}
              origin={`${cx}, ${cy}`}
              opacity={0.85}
            />
          </Svg>
          {/* Center text */}
          <View style={styles.centerLabel} pointerEvents="none">
            <Text style={styles.centerTop}>{active}</Text>
            <Text style={styles.centerSep}>/</Text>
            <Text style={styles.centerBottom}>{consumed}</Text>
          </View>
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: '#F5A623' }]} />
            <Text style={[styles.legendText, { color: '#F5A623' }]}>
              {active} Active{'\n'}Calories
            </Text>
          </View>
          <View style={[styles.legendRow, { marginTop: spacing.md }]}>
            <View style={[styles.legendDot, { backgroundColor: '#4AACF5' }]} />
            <Text style={[styles.legendText, { color: '#4AACF5' }]}>
              {consumed} Consumed{'\n'}Calories
            </Text>
          </View>
        </View>
      </View>
    </GradientInfoCard>
  );
}

const styles = StyleSheet.create({
  icon: {
    color: '#FFFFFF',
    fontSize: 18,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  donutWrapper: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerLabel: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerTop: {
    color: '#FFFFFF',
    fontSize: fontSize.lg,
    fontFamily: fontFamily.bold,
    lineHeight: 28,
  },
  centerSep: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: fontSize.md,
    fontFamily: fontFamily.regular,
    lineHeight: 20,
  },
  centerBottom: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: fontSize.lg,
    fontFamily: fontFamily.regular,
    lineHeight: 28,
  },
  legend: {
    flex: 1,
    paddingLeft: spacing.md,
    justifyContent: 'center',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 3,
  },
  legendText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    lineHeight: 18,
  },
});

export default CalorieDeficitCard;
