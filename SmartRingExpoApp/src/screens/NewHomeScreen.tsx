import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Text,
  ScrollView,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HomeHeader } from '../components/home/HomeHeader';
import { AnimatedGradientBackground } from '../components/home/AnimatedGradientBackground';
import { OverviewTab, SleepTab, NutritionTab, ActivityTab } from './home';
import { TabType } from '../theme/gradients';
import { useHomeDataContext } from '../context/HomeDataContext';
import { useSmartRing } from '../hooks/useSmartRing';
import { spacing, fontFamily } from '../theme/colors';
import { OverviewIcon, SleepIcon, NutritionIcon, ActivityIcon } from '../assets/icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ICON_SIZE = 65;
const ICON_STROKE_WIDTH = 1.5;

// Tab configuration
const tabs = [
  { key: 'overview', title: 'Overview', Icon: OverviewIcon },
  { key: 'sleep', title: 'Sleep', Icon: SleepIcon },
  { key: 'activity', title: 'Activity', Icon: ActivityIcon },
  { key: 'nutrition', title: 'Nutrition', Icon: NutritionIcon },
] as const;

// Map tab index to TabType
const tabIndexMap: TabType[] = ['overview', 'sleep', 'activity', 'nutrition'];

function NewHomeScreenContent() {
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState(0);
  const headerAnim = useRef(new Animated.Value(0)).current;
  const homeData = useHomeDataContext();
  const scrollViewRef = useRef<ScrollView>(null);
  const { autoConnect, isAutoConnecting } = useSmartRing();
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [tabScrollEnabled, setTabScrollEnabled] = useState(true);

  // Use homeData.isRingConnected as the source of truth for connection status
  // This is set by useHomeData which calls isConnected() before fetching data
  const isConnected = homeData.isRingConnected;

  const activeTab = tabIndexMap[activeIndex];

  const collapseRange = 120;

  const onVerticalScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: headerAnim } } }],
    {
      useNativeDriver: false,
      listener: (event: any) => {
        const y = event?.nativeEvent?.contentOffset?.y ?? 0;
        if (!hasScrolled && y > 1) {
          setHasScrolled(true);
        } else if (hasScrolled && y <= 1) {
          setHasScrolled(false);
        }
      },
    },
  );

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

  const lockTabScroll   = useCallback(() => setTabScrollEnabled(false), []);
  const unlockTabScroll = useCallback(() => setTabScrollEnabled(true), []);

  const handleReconnect = useCallback(async () => {
    if (isReconnecting || isAutoConnecting) return;
    setIsReconnecting(true);
    try {
      await autoConnect();
    } catch (error) {
      console.log('Reconnect failed:', error);
    } finally {
      setIsReconnecting(false);
    }
  }, [autoConnect, isReconnecting, isAutoConnecting]);

  const iconScale = 1;
  const iconOpacity = headerAnim.interpolate({
    inputRange: [0, collapseRange],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const tabBarHeight = headerAnim.interpolate({
    inputRange: [0, collapseRange],
    outputRange: [86, 44],
    extrapolate: 'clamp',
  });

  const tabBarPaddingTop = headerAnim.interpolate({
    inputRange: [0, collapseRange],
    outputRange: [8, 4],
    extrapolate: 'clamp',
  });

  const tabBarPaddingBottom = headerAnim.interpolate({
    inputRange: [0, collapseRange],
    outputRange: [8, 4],
    extrapolate: 'clamp',
  });

  const tabBarTranslateY = headerAnim.interpolate({
    inputRange: [0, collapseRange],
    outputRange: [0, 0],
    extrapolate: 'clamp',
  });

  const labelTranslateY = headerAnim.interpolate({
    inputRange: [0, collapseRange],
    outputRange: [0, -50],
    extrapolate: 'clamp',
  });

  const backgroundFade = headerAnim.interpolate({
    inputRange: [0, collapseRange],
    outputRange: [0, 0.6],
    extrapolate: 'clamp',
  });

  return (
    <AnimatedGradientBackground activeTab={activeTab}>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, { backgroundColor: 'black', opacity: backgroundFade }]}
      />
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header (pinned) */}
        <HomeHeader
          userName={homeData.userName || 'there'}
          streakDays={homeData.streakDays}
          ringBattery={homeData.ringBattery}
          isConnected={isConnected}
          isReconnecting={isReconnecting || isAutoConnecting}
          onReconnect={handleReconnect}
          isSyncing={homeData.isSyncing}
          onRefresh={homeData.refresh}
        />

        <Animated.View style={styles.contentWrapper}>
          {/* Custom Tab Bar - collapses to text on scroll */}
          <Animated.View
            style={[
              styles.tabBarContainer,
              {
                height: tabBarHeight,
                paddingTop: tabBarPaddingTop,
                paddingBottom: 0,
                borderBottomWidth: hasScrolled ? 1 : 0,
                borderBottomColor: 'rgba(255, 255, 255, 0.4)',
                transform: [{ translateY: tabBarTranslateY }],
              },
            ]}
          >
            <View style={styles.tabBar}>
              {tabs.map((tab, index) => {
                const focused = index === activeIndex;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    style={styles.tabItem}
                    onPress={() => handleTabPress(index)}
                    activeOpacity={0.5}
                  >
                    <Animated.View
                      style={[
                        styles.iconCircle,
                        focused && styles.iconCircleFocused,
                        { transform: [{ scale: iconScale }], opacity: iconOpacity },
                      ]}
                    >
                      <tab.Icon focused={focused} />
                    </Animated.View>
                    
                    <Animated.View
                      style={[
                        styles.labelContainer,
                        { transform: [{ translateY: labelTranslateY }] },
                      ]}
                    >
                      <Text
                        style={[
                          styles.tabLabel,
                          focused && styles.tabLabelFocused,
                          focused && hasScrolled && styles.tabLabelFocusedScrolled,
                        ]}
                      >
                        {tab.title}
                      </Text>
                      {focused && <View style={styles.underline} />}
                    </Animated.View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>

          {/* Swipeable Content */}
          <Animated.ScrollView
            ref={scrollViewRef}
            horizontal
            pagingEnabled
            scrollEnabled={tabScrollEnabled}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleScroll}
            scrollEventThrottle={16}
            style={styles.contentScroll}
          >
            <View style={styles.page}>
              <OverviewTab onScroll={onVerticalScroll} />
            </View>
            <View style={styles.page}>
              <SleepTab
                onScroll={onVerticalScroll}
                onHypnogramTouchStart={lockTabScroll}
                onHypnogramTouchEnd={unlockTabScroll}
                isActive={activeIndex === 1}
              />
            </View>
            <View style={styles.page}>
              <ActivityTab onScroll={onVerticalScroll} isActive={activeIndex === 2} />
            </View>
            <View style={styles.page}>
              <NutritionTab />
            </View>
          </Animated.ScrollView>
        </Animated.View>
      </View>
    </AnimatedGradientBackground>
  );
}

export function NewHomeScreen() {
  return <NewHomeScreenContent />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentWrapper: {
    flex: 1,
  },
  tabBarContainer: {
    marginHorizontal: spacing.sm,
    marginTop: spacing.md,
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
  headerWrapper: {
    overflow: 'hidden',
  },
  labelContainer: {
    alignItems: 'center',
  },
  tabLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
    fontFamily: fontFamily.regular,
    // letterSpacing: 0.3,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tabLabelFocused: {
    color: 'rgba(255, 255, 255, 0.95)',
    fontFamily: fontFamily.demiBold,
  },
  tabLabelFocusedScrolled: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  underline: {
    // marginTop: 4,
    width: '100%',
    // height: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 1,
  },
  contentScroll: {
    flex: 1,
  },
  page: {
    width: SCREEN_WIDTH,
    flex: 1,
    // paddingTop: 30,
  },
});

export default NewHomeScreen;
