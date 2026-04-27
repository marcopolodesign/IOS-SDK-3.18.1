/**
 * FocusScreen -- Coach tab root screen.
 * Oura-style insight headline + explanation, inline chat bar, then metric cards.
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { SvgXml } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { fontFamily, fontSize, spacing } from '../theme/colors';
import { useFocusDataContext } from '../context/FocusDataContext';
import { FocusScoreRing } from '../components/focus/FocusScoreRing';
import { ReadinessCard } from '../components/focus/ReadinessCard';
import { IllnessWatchCard } from '../components/focus/IllnessWatchCard';
import { LastRunContextCard } from '../components/focus/LastRunContextCard';
import { AskCoachButton } from '../components/focus/AskCoachButton';
import { BaselineJourneyCard } from '../components/focus/BaselineJourneyCard';

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

function getTodayLabel(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FocusScreen() {
  const { t } = useTranslation();
  const focusData = useFocusDataContext();
  const hasStrava = focusData.lastRun != null || focusData.isLoading;
  const daysLogged = focusData.baselines?.daysLogged ?? 0;

  const blobFloat = useSharedValue(0);
  const overlayOpacity = useSharedValue(0);
  useEffect(() => {
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
  }, []);

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
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
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
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{t('focus.title')}</Text>
            <Text style={styles.headerDate}>{getTodayLabel()}</Text>
          </View>

          {/* Score Ring */}
          <FocusScoreRing
            score={focusData.readiness?.score ?? null}
            recommendation={focusData.readiness?.recommendation ?? null}
            isLoading={focusData.isLoading}
          />

          {/* Recovery timeline — inline, no card wrapper */}
          {!focusData.isLoading && (
            <View style={styles.inlineSection}>
              <BaselineJourneyCard
                daysLogged={daysLogged}
                baselines={focusData.baselines}
                readiness={focusData.readiness}
              />
            </View>
          )}

          {/* Loading skeleton */}
          {focusData.isLoading && (
            <View style={styles.inlineSection}>
              <View style={[styles.skeletonLine, { height: 24, width: '55%', marginBottom: 16 }]} />
              <View style={[styles.skeletonLine, { height: 10, borderRadius: 5, marginBottom: 8 }]} />
              <View style={[styles.skeletonLine, { height: 80, borderRadius: 12 }]} />
            </View>
          )}

          {/* ── Ask Coach button -- inline, above metric cards ── */}
          <View style={styles.cardWrap}>
            <AskCoachButton />
          </View>

          {/* Metric cards */}
          <View style={styles.cardWrap}>
            <ReadinessCard
              readiness={focusData.readiness}
              baselines={focusData.baselines}
              isLoading={focusData.isLoading}
            />
          </View>

          <View style={styles.cardWrap}>
            <IllnessWatchCard
              illness={focusData.illness}
              isLoading={focusData.isLoading}
            />
          </View>

          <View style={styles.cardWrap}>
            <LastRunContextCard
              lastRun={focusData.lastRun}
              isLoading={focusData.isLoading}
              hasStrava={hasStrava}
            />
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
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
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  headerTitle: {
    fontFamily: fontFamily.demiBold,
    fontSize: fontSize.xxl,
    color: '#FFFFFF',
  },
  headerDate: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.4)',
    paddingBottom: 3,
  },
  inlineSection: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  skeletonLine: {
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  cardWrap: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
});
