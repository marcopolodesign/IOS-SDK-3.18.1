import React from 'react';
import { useSharedValue, useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

const SCROLL_THRESHOLD = 10;
const COLLAPSE_END = 160;

interface TabScroll {
  scrollRef: React.RefObject<any>;
  scrollY: SharedValue<number>;
  handleScroll: (event: any) => void;
  isScrolled: boolean;
  firstCardStyle: ReturnType<typeof useAnimatedStyle>;
}

/**
 * Shared scroll tracking for home tabs.
 * Resets position when the tab becomes active and exposes scrollY
 * so components like MetricInsightCard can animate against it.
 * isScrolled is a plain JS boolean — safe to pass as a prop.
 */
export function useTabScroll(isActive: boolean, onScroll?: (event: any) => void): TabScroll {
  const scrollRef = React.useRef<any>(null);
  const scrollY = useSharedValue(0);
  const [isScrolled, setIsScrolled] = React.useState(false);

  React.useEffect(() => {
    if (isActive) {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      scrollY.value = 0;
      setIsScrolled(false);
    }
  }, [isActive]);

  const firstCardStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [SCROLL_THRESHOLD, COLLAPSE_END],
      [0.3, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const handleScroll = React.useCallback((event: any) => {
    const y = event?.nativeEvent?.contentOffset?.y ?? 0;
    scrollY.value = y;
    setIsScrolled(y > SCROLL_THRESHOLD);
    onScroll?.(event);
  }, [onScroll]);

  return { scrollRef, scrollY, handleScroll, isScrolled, firstCardStyle };
}
