import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Dimensions, ImageBackground, Image } from 'react-native';
import { TabType } from '../../theme/gradients';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface AnimatedGradientBackgroundProps {
  activeTab: TabType;
  children: React.ReactNode;
}

// Background images - update paths once you add images
const overviewVariants = {
  dusk: require('../../assets/backgrounds/dusk.jpg'), // 05:30-09:00
  mid: require('../../assets/backgrounds/mid.jpg'), // 09:00-13:00
  afternoon: require('../../assets/backgrounds/afternoon.jpg'), // 13:00-17:00
  dawn: require('../../assets/backgrounds/dawn.jpg'), // 17:00-20:00
  night: require('../../assets/backgrounds/night.jpg'), // 20:00-05:30
};

const backgroundImages: Record<TabType, any> = {
  overview: overviewVariants.mid, // default fallback
  sleep: require('../../assets/backgrounds/sleep.jpg'),
  nutrition: require('../../assets/backgrounds/nutrition.jpg'),
  activity: require('../../assets/backgrounds/activity.jpg'),
};

// Prefetch all backgrounds once to avoid flash on first load (iOS shows previous image while decoding)
const backgroundsToPrefetch = Array.from(
  new Set([...Object.values(overviewVariants), ...Object.values(backgroundImages)]),
);

// Fallback colors if images aren't loaded
const fallbackColors: Record<TabType, string> = {
  overview: '#1a1a2e',
  sleep: '#200C77',
  nutrition: '#2D0015',
  activity: '#1a0a00',
};

export function AnimatedGradientBackground({
  activeTab,
  children,
}: AnimatedGradientBackgroundProps) {
  const [previousTab, setPreviousTab] = useState<TabType>(activeTab);
  const fadeAnim = useRef(new Animated.Value(1)).current; // drives crossfade: prev = 1->0, next = 0->1

  // Preload all background assets so the first render of each tab doesn't flash the prior image
  useEffect(() => {
    backgroundsToPrefetch.forEach((asset) => {
      const uri = Image.resolveAssetSource(asset)?.uri;
      if (uri) {
        Image.prefetch(uri).catch(() => {
          // best-effort; ignore failures
        });
      }
    });
  }, []);

  useEffect(() => {
    if (activeTab !== previousTab) {
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start(() => setPreviousTab(activeTab));
    }
  }, [activeTab, previousTab]);

  const prevOpacity =
    activeTab === previousTab
      ? 1
      : fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const nextOpacity =
    activeTab === previousTab
      ? 0
      : fadeAnim;

  const getOverviewBackground = () => {
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    // Night: 20:00 - 05:30
    if (minutes >= 20 * 60 || minutes < 5 * 60 + 30) return overviewVariants.night;
    if (minutes < 9 * 60) return overviewVariants.dusk; // 05:30 - 09:00
    if (minutes < 13 * 60) return overviewVariants.mid; // 09:00 - 13:00
    if (minutes < 17 * 60) return overviewVariants.afternoon; // 13:00 - 17:00
    return overviewVariants.dawn; // 17:00 - 20:00
  };

  const getBackgroundForTab = (tab: TabType) => {
    if (tab === 'overview') return getOverviewBackground();
    return backgroundImages[tab];
  };

  return (
    <View style={styles.container}>
      {/* Previous/current layer */}
      <Animated.View pointerEvents="none" style={[styles.backgroundLayer, { opacity: prevOpacity }]}>
        <ImageBackground
          source={getBackgroundForTab(previousTab)}
          style={styles.backgroundImage}
          resizeMode="cover"
          defaultSource={getBackgroundForTab(previousTab)}
        >
          <View style={styles.darkOverlay} />
        </ImageBackground>
      </Animated.View>

      {/* Incoming layer */}
      <Animated.View pointerEvents="none" style={[styles.backgroundLayer, { opacity: nextOpacity }]}>
        <ImageBackground
          source={getBackgroundForTab(activeTab)}
          style={styles.backgroundImage}
          resizeMode="cover"
          defaultSource={getBackgroundForTab(activeTab)}
        >
          <View style={styles.darkOverlay} />
        </ImageBackground>
      </Animated.View>

      {/* Content */}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

// Simple version without animation
export function SimpleGradientBackground({
  activeTab,
  children,
}: AnimatedGradientBackgroundProps) {
  return (
    <View style={styles.container}>
      <ImageBackground
        source={backgroundImages[activeTab]}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={styles.darkOverlay} />
        <View style={styles.content}>{children}</View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  content: {
    flex: 1,
  },
});

export default AnimatedGradientBackground;
