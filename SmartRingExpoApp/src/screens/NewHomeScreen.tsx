import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Text,
  ScrollView,
  Animated,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useURL } from 'expo-linking';
import { HomeHeader } from '../components/home/HomeHeader';
import { AnimatedGradientBackground } from '../components/home/AnimatedGradientBackground';
import { OverviewTab, SleepTab, ActivityTab } from './home';
import { TabType } from '../theme/gradients';
import { useHomeDataContext } from '../context/HomeDataContext';
import { useSmartRing } from '../hooks/useSmartRing';
import { spacing, fontFamily } from '../theme/colors';
import { OverviewIcon, SleepIcon, ActivityIcon } from '../assets/icons';
import { BatteryAlertStorage } from '../utils/storage';
import { SyncStatusSheet } from '../components/home/SyncStatusSheet';
import { DeviceSheet } from '../components/home/DeviceSheet';
import { BaselineCompleteOverlay } from '../components/home/BaselineCompleteOverlay';
import { NotificationService } from '../services/NotificationService';
import { maybeSendSleepNotificationFromForeground } from '../services/BackgroundSleepTask';
import { reportError } from '../utils/sentry';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ICON_SIZE = 65;
const ICON_STROKE_WIDTH = 1.5;

// Map tab index to TabType
const tabIndexMap: TabType[] = ['overview', 'sleep', 'activity'];

function NewHomeScreenContent() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  // Tab configuration — inside component so t() is available
  const tabs = [
    { key: 'overview', title: t('overview.title'), Icon: OverviewIcon },
    { key: 'sleep',    title: t('sleep.title'),    Icon: SleepIcon },
    { key: 'activity', title: t('activity.title'), Icon: ActivityIcon },
  ] as const;
  const [activeIndex, setActiveIndex] = useState(0);
  const headerAnim = useRef(new Animated.Value(0)).current;
  const borderAnim = useRef(new Animated.Value(0)).current;
  const wasFullyCollapsed = useRef(false);
  const homeData = useHomeDataContext();
  const scrollViewRef = useRef<ScrollView>(null);
  const { autoConnect, isAutoConnecting, connectedDevice } = useSmartRing();
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [tabScrollEnabled, setTabScrollEnabled] = useState(true);
  const [deviceSheetVisible, setDeviceSheetVisible] = useState(false);
  const previousBatteryRef = useRef<number | null>(null);
  const shownBatteryAlertsRef = useRef<Set<number>>(new Set());
  const prevSyncPhaseRef = useRef<string>('');
  const url = useURL();

  useEffect(() => {
    BatteryAlertStorage.getShownThresholds().then(stored => {
      shownBatteryAlertsRef.current = stored;
    });
  }, []);

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
        borderAnim.setValue(y > 0 ? 1 : 0);

        const isFullyCollapsed = y >= collapseRange;
        if (isFullyCollapsed && !wasFullyCollapsed.current) {
          wasFullyCollapsed.current = true;
        } else if (!isFullyCollapsed && wasFullyCollapsed.current) {
          wasFullyCollapsed.current = false;
        }
      },
    },
  );

  useEffect(() => {
    headerAnim.setValue(0);
    borderAnim.setValue(0);
    wasFullyCollapsed.current = false;
  }, [activeIndex]);

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
      // Trigger a full data sync so the SyncStatusSheet appears
      void homeData.refresh();
    } catch (error) {
      console.log('Reconnect failed:', error);
      reportError(error, { op: 'homeScreen.topLevel' });
    } finally {
      setIsReconnecting(false);
    }
  }, [autoConnect, homeData, isReconnecting, isAutoConnecting]);

  useEffect(() => {
    if (!isConnected) {
      previousBatteryRef.current = null;
      return;
    }

    const battery = homeData.ringBattery;
    if (!Number.isFinite(battery) || battery <= 0 || battery > 100) {
      return;
    }

    const thresholds = [20, 10, 5];
    const shown = shownBatteryAlertsRef.current;

    // Re-arm alerts after recovery above a threshold.
    for (const threshold of thresholds) {
      if (battery >= threshold) {
        shown.delete(threshold);
      }
    }
    BatteryAlertStorage.saveShownThresholds(shown);

    const previous = previousBatteryRef.current;
    previousBatteryRef.current = battery;

    const crossedThresholds = thresholds.filter(
      threshold =>
        previous !== null &&
        previous >= threshold &&
        battery < threshold &&
        !shown.has(threshold)
    );

    const initialThresholds = thresholds.filter(
      threshold =>
        previous === null &&
        battery < threshold &&
        !shown.has(threshold)
    );

    const thresholdToAlert =
      crossedThresholds.length > 0
        ? Math.min(...crossedThresholds)
        : initialThresholds.length > 0
        ? Math.min(...initialThresholds)
        : null;

    if (thresholdToAlert === null) {
      return;
    }

    shown.add(thresholdToAlert);
    BatteryAlertStorage.saveShownThresholds(shown);

    if (thresholdToAlert === 5) {
      Alert.alert(t('battery.alert_critical_title'), t('battery.alert_critical_body', { battery }));
      return;
    }

    if (thresholdToAlert === 10) {
      Alert.alert(t('battery.alert_low_title'), t('battery.alert_low_10_body', { battery }));
      return;
    }

    Alert.alert(t('battery.alert_low_title'), t('battery.alert_low_20_body', { battery }));
  }, [isConnected, homeData.ringBattery]);

  // Register for push notifications on first authenticated mount (permission + Expo token → Supabase)
  useEffect(() => {
    NotificationService.setup().catch(e => { reportError(e, { op: 'homeScreen.notificationSetup' }); });
  }, []);

  // Deeplink: ?tab=sleep|activity navigates to the correct sub-tab
  useEffect(() => {
    if (!url) return;
    try {
      const parsed = new URL(url);
      const tab = parsed.searchParams.get('tab');
      if (tab === 'sleep')     handleTabPress(1);
      else if (tab === 'activity')   handleTabPress(2);
    } catch {}
  }, [url]);

  // Schedule "Sleep Analysis Ready" notification for wakeTime + 30 min (foreground fallback)
  useEffect(() => {
    const phase = homeData.syncProgress?.phase;
    if (phase === 'complete' && prevSyncPhaseRef.current !== 'complete') {
      if (homeData.sleepScore && homeData.sleepScore > 0 && homeData.lastNightSleep?.wakeTime) {
        maybeSendSleepNotificationFromForeground(homeData.lastNightSleep.wakeTime).catch(e => { reportError(e, { op: 'homeScreen.sleepNotification' }, 'warning'); });
      }
    }
    if (phase) prevSyncPhaseRef.current = phase;
  }, [homeData.syncProgress?.phase, homeData.sleepScore]);

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
    outputRange: [0, 1],
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
          avatarUrl={homeData.avatarUrl || undefined}
          streakDays={homeData.streakDays}
          ringBattery={homeData.ringBattery}
          isCharging={homeData.isRingCharging}
          isConnected={isConnected}
          isReconnecting={isReconnecting || isAutoConnecting}
          onReconnect={handleReconnect}
          isSyncing={homeData.isSyncing}
          onRefresh={homeData.refresh}
          onAvatarPress={() => router.push('/profile')}
          onBatteryPress={() => setDeviceSheetVisible(true)}
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
                transform: [{ translateY: tabBarTranslateY }],
              },
            ]}
          >
            <Animated.View style={[styles.tabBarBorder, { opacity: borderAnim }]} />
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
                        styles.tabItemContent,
                        { transform: [{ translateY: labelTranslateY }] },
                      ]}
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
                      <View style={styles.labelContainer}>
                        <Animated.View
                          style={focused ? [
                            styles.pillWrapper,
                            {
                              backgroundColor: borderAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: ['rgba(255,255,255,0)', 'rgba(255,255,255,0.4)'],
                              }),
                              borderColor: borderAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: ['rgba(255,255,255,0)', 'rgba(255,255,255,0.4)'],
                              }),
                            },
                          ] : undefined}
                        >
                          <Text style={[styles.tabLabel, focused && styles.tabLabelFocused]}>
                            {tab.title}
                          </Text>
                        </Animated.View>
                        {focused && <View style={styles.underline} />}
                      </View>
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
              <OverviewTab onScroll={onVerticalScroll} onChartTouchStart={lockTabScroll} onChartTouchEnd={unlockTabScroll} onSleepPress={() => handleTabPress(1)} isActive={activeIndex === 0} />
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
          </Animated.ScrollView>
        </Animated.View>
      </View>

      <SyncStatusSheet
        syncProgress={homeData.syncProgress}
        isSyncing={homeData.isSyncing}
        onFindRings={() => router.push('/(onboarding)/connect')}
      />
      <BaselineCompleteOverlay />
      <DeviceSheet
        visible={deviceSheetVisible}
        onDismiss={() => setDeviceSheetVisible(false)}
        connectedDevice={connectedDevice}
        battery={homeData.ringBattery}
        isConnected={isConnected}
        lastSyncedAt={homeData.lastSyncedAt}
      />
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
  tabBarBorder: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
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
  tabItemContent: {
    alignItems: 'center',
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
  pillWrapper: {
    borderWidth: 1,
    borderRadius: 100,
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
