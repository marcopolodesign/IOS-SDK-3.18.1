import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { fontFamily, fontSize, spacing } from '../../theme/colors';
import { useTypewriter } from '../../hooks/useTypewriter';

type Metric = {
  label: string;
  value: number | string;
  onPress?: () => void;
};

const formatValue = (value: number | string) => {
  if (typeof value === 'number') {
    return Math.round(value).toLocaleString();
  }
  const num = Number(value);
  if (!Number.isNaN(num)) {
    return Math.round(num).toLocaleString();
  }
  return value;
};

function FocusIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 25 25" fill="none">
      <Path
        d="M20.8333 19.1667C20.3913 19.1667 19.9674 19.3423 19.6548 19.6548C19.3423 19.9674 19.1667 20.3913 19.1667 20.8334C19.1667 20.8967 19.1783 20.9575 19.1858 21.0192C17.2822 22.5229 14.9259 23.3384 12.5 23.3334C8.94833 23.3334 5.83333 20.0234 5.83333 16.25C5.83333 12.3442 9.01083 9.16669 12.9167 9.16669H13.3333V7.50002H12.9167C8.09167 7.50002 4.16667 11.425 4.16667 16.25C4.16667 17.82 4.60833 19.325 5.36417 20.6309C3.10333 18.6425 1.66667 15.7384 1.66667 12.5C1.66667 10.7375 2.07667 9.05586 2.885 7.50336L1.40667 6.73419C0.483232 8.51592 0.000837275 10.4932 0 12.5C0 19.3925 5.6075 25 12.5 25C15.3117 25 17.985 24.0667 20.1708 22.3617C20.398 22.4605 20.6444 22.5075 20.8921 22.4991C21.1397 22.4907 21.3823 22.4272 21.6023 22.3132C21.8223 22.1992 22.0142 22.0376 22.1638 21.8402C22.3135 21.6427 22.4173 21.4144 22.4676 21.1718C22.5179 20.9291 22.5135 20.6784 22.4547 20.4377C22.3958 20.197 22.2841 19.9724 22.1275 19.7804C21.971 19.5883 21.7736 19.4336 21.5497 19.3274C21.3258 19.2213 21.0811 19.1663 20.8333 19.1667Z"
        fill="black"
      />
      <Path d="M10 15.8333V17.5H8.33337V15.8333H10ZM16.6667 7.5V9.16667H15V7.5H16.6667Z" fill="black" />
      <Path
        d="M12.5 0C9.68833 0 7.015 0.933333 4.82917 2.63833C4.49998 2.49573 4.13356 2.46315 3.78438 2.54544C3.4352 2.62773 3.12189 2.82049 2.89101 3.09507C2.66013 3.36965 2.52402 3.7114 2.50289 4.06953C2.48177 4.42766 2.57676 4.78304 2.77376 5.08286C2.97075 5.38268 3.25923 5.61094 3.59631 5.73371C3.9334 5.85648 4.30111 5.8672 4.64478 5.76429C4.98845 5.66138 5.28974 5.45032 5.50387 5.16249C5.718 4.87466 5.83355 4.52541 5.83333 4.16667C5.83333 4.10333 5.82167 4.0425 5.81417 3.98083C7.71783 2.47716 10.0741 1.66158 12.5 1.66667C16.0517 1.66667 19.1667 4.97667 19.1667 8.75C19.1667 12.6558 15.9892 15.8333 12.0833 15.8333H11.6667V17.5H12.0833C16.9083 17.5 20.8333 13.575 20.8333 8.75C20.8333 7.17917 20.39 5.67333 19.6333 4.36667C21.8958 6.355 23.3333 9.26 23.3333 12.5C23.3333 14.2625 22.9233 15.9442 22.115 17.4967L23.5933 18.2658C24.5168 16.4841 24.9992 14.5068 25 12.5C25 5.6075 19.3925 0 12.5 0Z"
        fill="black"
      />
    </Svg>
  );
}

function SendIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 12H19M19 12L13 6M19 12L13 18"
        stroke="black"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

// Scroll range over which the button collapses — wider range = slower feel
const COLLAPSE_START = 10;
const COLLAPSE_END = 160;

interface MetricInsightCardProps {
  metrics: Metric[];
  insight?: string;
  scrollY?: SharedValue<number>;
  isScrolled?: boolean;
}

export function MetricInsightCard({ metrics, insight, scrollY, isScrolled = false }: MetricInsightCardProps) {
  const { t } = useTranslation();
  const [containerWidth, setContainerWidth] = useState(0);
  const typewriterText = useTypewriter();
  // Fallback when no scrollY is provided (SleepTab / ActivityTab) — stays expanded
  const fallbackScrollY = useSharedValue(0);
  const activeScrollY = scrollY ?? fallbackScrollY;

  const animatedBtnStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      activeScrollY.value,
      [COLLAPSE_START, COLLAPSE_END],
      [1, 0],
      Extrapolation.CLAMP,
    );
    return {
      width: interpolate(progress, [0, 1], [150, containerWidth * 0.9]),
      paddingHorizontal: interpolate(progress, [0, 1], [16, 20]),
      paddingVertical: interpolate(progress, [0, 1], [14, 22]),
      borderRadius: interpolate(progress, [0, 1], [50, 12]),
    };
  });

  const rightGroupStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      activeScrollY.value,
      [COLLAPSE_START, COLLAPSE_END],
      [1, 0],
      Extrapolation.CLAMP,
    );
    return {
      opacity: progress,
      maxWidth: interpolate(progress, [0, 1], [0, 120]),
      overflow: 'hidden',
    };
  });

  const handleOpenChat = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/chat');
  }, []);

  return (
    <View style={styles.card}>
      {insight ? (
        <Text style={styles.insightText}>{insight}</Text>
      ) : null}

      <View style={styles.metricsRow}>
        {metrics.map((metric, index) => (
          <React.Fragment key={`${metric.label}-${index}`}>
            <TouchableOpacity
              style={styles.metric}
              onPress={metric.onPress}
              activeOpacity={metric.onPress ? 0.7 : 1}
              disabled={!metric.onPress}
            >
              <Text style={styles.metricLabel}>{metric.label}</Text>
              <Text style={styles.metricValue}>{formatValue(metric.value)}</Text>
            </TouchableOpacity>
            {index < metrics.length - 1 && <View style={styles.divider} />}
          </React.Fragment>
        ))}
      </View>

      <View
        style={styles.askCoachRow}
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      >
        <View style={styles.askCoachLine} />
        <AnimatedTouchableOpacity
          style={[styles.askCoachBtn, animatedBtnStyle]}
          activeOpacity={0.8}
          onPress={handleOpenChat}
        >
          <View style={styles.askCoachLeft}>
            <FocusIcon />
          </View>
          <Text style={styles.askCoachText} numberOfLines={1}>
            {isScrolled ? t('overview.ask_coach') : typewriterText}
          </Text>
          <Animated.View style={[styles.askCoachRight, rightGroupStyle]}>
            <SendIcon />
          </Animated.View>
        </AnimatedTouchableOpacity>
        <View style={styles.askCoachLine} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {},
  insightText: {
    color: '#FFFFFF',
    fontSize: fontSize.lg,
    fontFamily: fontFamily.regular,
    lineHeight: 28,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  metric: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: fontSize.md,
    fontFamily: fontFamily.regular,
    marginBottom: 6,
  },
  metricValue: {
    color: '#FFFFFF',
    fontSize: 32,
    fontFamily: fontFamily.regular,
  },
  divider: {
    width: 1,
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  askCoachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  askCoachLine: {
    flex: 1,
    width: 1,
    height: 1,
    backgroundColor: '#FFFFFF',
  },
  askCoachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  askCoachLeft: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  askCoachRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  askCoachText: {
    color: '#000000',
    fontSize: fontSize.md,
    fontFamily: fontFamily.demiBold,
    flex: 1,
    textAlign: 'left',
  },
});

export default MetricInsightCard;
