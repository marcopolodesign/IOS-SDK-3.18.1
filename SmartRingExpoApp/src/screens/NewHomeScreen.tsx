import React, { useState, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  Dimensions, 
  TouchableOpacity, 
  Text, 
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect, Line, Polyline } from 'react-native-svg';

import { HomeHeader } from '../components/home/HomeHeader';
import { AnimatedGradientBackground } from '../components/home/AnimatedGradientBackground';
import { OverviewTab, SleepTab, NutritionTab, ActivityTab } from './home';
import { TabType } from '../theme/gradients';
import { useHomeData } from '../hooks/useHomeData';
import { fontSize, spacing } from '../theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ICON_SIZE = 65;
const ICON_STROKE_WIDTH = 1.5;

// Binoculars icon for Overview
function OverviewIcon({ focused }: { focused: boolean }) {
  const color = focused ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.5)';
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
      {/* Left lens */}
      <Circle cx={7} cy={14} r={4} stroke={color} strokeWidth={1.5} />
      {/* Right lens */}
      <Circle cx={17} cy={14} r={4} stroke={color} strokeWidth={1.5} />
      {/* Bridge */}
      <Path d="M11 14h2" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      {/* Left eyepiece */}
      <Path d="M4 10V8a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" stroke={color} strokeWidth={1.5} />
      {/* Right eyepiece */}
      <Path d="M14 10V8a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" stroke={color} strokeWidth={1.5} />
    </Svg>
  );
}

// Bed icon for Sleep
function SleepIcon({ focused }: { focused: boolean }) {
  const color = focused ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.5)';
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
      {/* Bed frame */}
      <Path d="M3 18V12a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      {/* Legs */}
      <Path d="M3 18v2M21 18v2" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      {/* Pillow */}
      <Rect x={5} y={7} width={4} height={3} rx={1} stroke={color} strokeWidth={1.5} />
      {/* Headboard */}
      <Path d="M3 10V7a2 2 0 0 1 2-2h2" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

// Lightning bolt for Nutrition
function NutritionIcon({ focused }: { focused: boolean }) {
  const color = focused ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.5)';
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
      <Path
        d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Circular arrow for Activity
function ActivityIcon({ focused }: { focused: boolean }) {
  const color = focused ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.5)';
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
      {/* Circular path */}
      <Path
        d="M21 12a9 9 0 1 1-9-9"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      {/* Arrow head */}
      <Path
        d="M12 3l3 0 0 3"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Tab configuration
const tabs = [
  { key: 'overview', title: 'Overview', Icon: OverviewIcon },
  { key: 'sleep', title: 'Sleep', Icon: SleepIcon },
  { key: 'nutrition', title: 'Nutrition', Icon: NutritionIcon },
  { key: 'activity', title: 'Activity', Icon: ActivityIcon },
] as const;

// Map tab index to TabType
const tabIndexMap: TabType[] = ['overview', 'sleep', 'nutrition', 'activity'];

export function NewHomeScreen() {
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState(0);
  const homeData = useHomeData();
  const scrollViewRef = useRef<ScrollView>(null);

  const activeTab = tabIndexMap[activeIndex];

  const handleTabPress = (index: number) => {
    setActiveIndex(index);
    scrollViewRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
  };

  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    if (index !== activeIndex && index >= 0 && index < tabs.length) {
      setActiveIndex(index);
    }
  };

  return (
    <AnimatedGradientBackground activeTab={activeTab}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <HomeHeader
          userName="there"
          streakDays={homeData.streakDays}
          ringBattery={homeData.ringBattery}
        />

        {/* Custom Tab Bar - Circular Frosted Glass Design */}
        <View style={styles.tabBarContainer}>
          <View style={styles.tabBar}>
            {tabs.map((tab, index) => {
              const focused = index === activeIndex;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={styles.tabItem}
                  onPress={() => handleTabPress(index)}
                  activeOpacity={0.7}
                >
                  {/* Circular Icon Container */}
                  <View style={[
                    styles.iconCircle,
                    focused && styles.iconCircleFocused,
                  ]}>
                    <tab.Icon focused={focused} />
                  </View>
                  
                  {/* Label with underline for active */}
                  <View style={styles.labelContainer}>
                    <Text style={[styles.tabLabel, focused && styles.tabLabelFocused]}>
                      {tab.title}
                    </Text>
                    {focused && <View style={styles.underline} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Swipeable Content */}
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          scrollEventThrottle={16}
          style={styles.contentScroll}
        >
          <View style={styles.page}>
            <OverviewTab />
          </View>
          <View style={styles.page}>
            <SleepTab />
          </View>
          <View style={styles.page}>
            <NutritionTab />
          </View>
          <View style={styles.page}>
            <ActivityTab />
          </View>
        </ScrollView>
      </View>
    </AnimatedGradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBarContainer: {
    marginHorizontal: spacing.sm,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 8,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  iconCircle: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: ICON_STROKE_WIDTH,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  iconCircleFocused: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  labelContainer: {
    alignItems: 'center',
  },
  tabLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  tabLabelFocused: {
    color: 'rgba(255, 255, 255, 0.95)',
    fontWeight: '600',
  },
  underline: {
    marginTop: 4,
    width: '100%',
    height: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 1,
  },
  contentScroll: {
    flex: 1,
  },
  page: {
    width: SCREEN_WIDTH,
    flex: 1,
  },
});

export default NewHomeScreen;
