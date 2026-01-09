import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Dimensions, ImageBackground, Image } from 'react-native';
import { TabType } from '../../theme/gradients';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface AnimatedGradientBackgroundProps {
  activeTab: TabType;
  children: React.ReactNode;
}

// Background images - update paths once you add images
const backgroundImages: Record<TabType, any> = {
  overview: require('../../assets/backgrounds/overview.jpg'),
  sleep: require('../../assets/backgrounds/sleep.jpg'),
  nutrition: require('../../assets/backgrounds/nutrition.jpg'),
  activity: require('../../assets/backgrounds/activity.jpg'),
};

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
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (activeTab !== previousTab) {
      // Reset opacity to 0 for the new image
      fadeAnim.setValue(0);
      
      // Fade in the new image
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        // After animation completes, update the previous tab
        setPreviousTab(activeTab);
      });
    }
  }, [activeTab, previousTab]);

  return (
    <View style={styles.container}>
      {/* Background layer (previous/current image) */}
      <ImageBackground
        source={backgroundImages[previousTab]}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        {/* Overlay for darkening */}
        <View style={styles.darkOverlay} />
      </ImageBackground>

      {/* Foreground layer (new image fading in) */}
      {activeTab !== previousTab && (
        <Animated.View style={[styles.foregroundContainer, { opacity: fadeAnim }]}>
          <ImageBackground
            source={backgroundImages[activeTab]}
            style={styles.backgroundImage}
            resizeMode="cover"
          >
            <View style={styles.darkOverlay} />
          </ImageBackground>
        </Animated.View>
      )}

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
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  foregroundContainer: {
    ...StyleSheet.absoluteFillObject,
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
