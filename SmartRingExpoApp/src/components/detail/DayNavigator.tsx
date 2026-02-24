import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { fontFamily, fontSize, spacing } from '../../theme/colors';

interface DayNavigatorProps {
  days: string[];
  selectedIndex: number;
  onSelectDay: (index: number) => void;
}

export function DayNavigator({ days, selectedIndex, onSelectDay }: DayNavigatorProps) {
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Scroll selected pill into view
    scrollRef.current?.scrollTo({ x: Math.max(0, selectedIndex - 1) * 88, animated: true });
  }, [selectedIndex]);

  return (
    <View style={styles.wrapper}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.container}
        alwaysBounceVertical={false}
      >
        {days.map((day, index) => {
          const isSelected = index === selectedIndex;
          return (
            <TouchableOpacity
              key={day}
              style={[styles.pill, isSelected && styles.pillSelected]}
              onPress={() => onSelectDay(index)}
              activeOpacity={0.7}
            >
              <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                {day}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    height: 52,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  pill: {
    height: 36,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  pillSelected: {
    borderColor: 'rgba(255,255,255,0.7)',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  pillText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
  },
  pillTextSelected: {
    color: '#FFFFFF',
    fontFamily: fontFamily.demiBold,
  },
});

export default DayNavigator;
