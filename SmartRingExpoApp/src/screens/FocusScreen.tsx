/**
 * FocusScreen -- Coach tab root screen.
 * Oura-style insight headline + explanation, inline chat bar, then metric cards.
 */

import React, { useCallback } from 'react';
import {
  View,
  StyleSheet,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { SvgXml } from 'react-native-svg';
import { spacing } from '../theme/colors';
import { useFocusDataContext } from '../context/FocusDataContext';
import { FocusScoreRing } from '../components/focus/FocusScoreRing';
import { LastRunContextCard } from '../components/focus/LastRunContextCard';
import { AskCoachButton } from '../components/focus/AskCoachButton';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const BLOB_HEIGHT = SCREEN_HEIGHT * 0.9;
const BLOB_WIDTH = BLOB_HEIGHT * (440 / 754);

const BLOB_SVG = `<svg width="440" height="754" viewBox="0 0 440 754" fill="none" xmlns="http://www.w3.org/2000/svg">
<g filter="url(#filter0_fn_651_804)">
<path d="M345.107 323.133C544.278 499.688 532.54 593.437 472.568 629.881C412.595 666.325 254.887 682.14 151.534 512.063C125.092 176.01 9.56106 36.1783 69.5335 -0.26564C129.506 -36.7096 244.676 106.384 345.107 323.133Z" fill="#AC0D0D" fill-opacity="0.99"/>
<path d="M585.214 69.2671C626.648 211.09 551.427 357.851 417.201 397.066C282.976 436.281 140.575 353.101 99.1398 211.277C57.705 69.4542 132.927 -77.3064 267.152 -116.521C401.378 -155.737 543.779 -72.5562 585.214 69.2671Z" fill="#FF753F"/>
</g>
<defs>
<filter id="filter0_fn_651_804" x="-47.5071" y="-226.225" width="744.105" height="979.735" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<feFlood flood-opacity="0" result="BackgroundImageFix"/>
<feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
<feGaussianBlur stdDeviation="50" result="effect1_foregroundBlur_651_804"/>
</filter>
</defs>
</svg>`;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FocusScreen() {
  const focusData = useFocusDataContext();
  const hasStrava = focusData.lastRun != null || focusData.isLoading;
  const insets = useSafeAreaInsets();
  const tabBarHeight = 49 + insets.bottom;

  const blobFloat = useSharedValue(0);
  const overlayOpacity = useSharedValue(0);
  // Pause infinite animations when this tab is off-screen — sibling-mounted NativeTabs
  // would otherwise keep driving the blurred SVG blob while user is on Today.
  useFocusEffect(
    useCallback(() => {
      blobFloat.value = withRepeat(
        withTiming(1, { duration: 7200, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
      overlayOpacity.value = withRepeat(
        withTiming(0.55, { duration: 9800, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
      return () => {
        cancelAnimation(blobFloat);
        cancelAnimation(overlayOpacity);
      };
    }, []),
  );

  const blobAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: blobFloat.value * 22 },
      { translateY: blobFloat.value * -16 },
    ],
  }));
  const overlayAnimStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  return (
    <LinearGradient
      colors={['#000000', 'rgba(127,10,10,0.73)']}
      start={{ x: 0, y: 0.37 }}
      end={{ x: 1, y: 0.63 }}
      style={styles.container}
    >
      <Reanimated.View style={[StyleSheet.absoluteFill, overlayAnimStyle]} pointerEvents="none">
        <LinearGradient
          colors={['rgba(180,15,15,0.55)', '#000000', 'rgba(60,0,0,0.4)']}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Reanimated.View>
      <Reanimated.View style={[styles.blob, blobAnimStyle]} pointerEvents="none">
        <SvgXml xml={BLOB_SVG} width={BLOB_WIDTH} height={BLOB_HEIGHT} />
      </Reanimated.View>
      <Reanimated.ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={focusData.isLoading}
              onRefresh={focusData.refresh}
              tintColor="rgba(255,255,255,0.7)"
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <FocusScoreRing
            score={focusData.readiness?.score ?? null}
            recommendation={focusData.readiness?.recommendation ?? null}
            isLoading={focusData.isLoading}
            readiness={focusData.readiness}
          />

          <View style={styles.cardWrap}>
            <LastRunContextCard
              lastRun={focusData.lastRun}
              isLoading={focusData.isLoading}
              hasStrava={hasStrava}
            />
          </View>
        </Reanimated.ScrollView>

      {/* Fixed ask-coach bar — sits just above the tab bar */}
      <View style={[styles.fixedBottom, { bottom: tabBarHeight + 24 }]}>
        <AskCoachButton />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  blob: {
    position: 'absolute',
    top: 0,
    right: -BLOB_WIDTH * 0.18,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 160,
  },
  cardWrap: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  fixedBottom: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
  },
});
