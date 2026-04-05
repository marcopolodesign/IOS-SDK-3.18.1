import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, G } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, fontFamily, fontSize, spacing } from '../../theme/colors';
import type { SyncProgressState, MetricKey, SyncPhase } from '../../types/syncStatus.types';

const CONNECTION_TIMEOUT_MS = 40_000;

// ─── Constants ────────────────────────────────────────────────────────────────

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_CONTENT_HEIGHT = 160; // ring row + padding, fixed

const RING_SIZE = 96;
const RING_STROKE = 8;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ─── Status message derivation (uses translation keys) ───────────────────────

type TFunction = (key: string) => string;

function deriveMessage(syncProgress: SyncProgressState, t: TFunction, timedOut: boolean): string {
  if (timedOut) return t('sync.connection_timeout');
  const { phase, metrics } = syncProgress;
  if (phase === 'connecting') return t('sync.connecting');
  if (phase === 'connected')  return t('sync.connected');
  if (phase === 'complete')   return t('sync.complete');
  const loading = metrics.find(m => m.status === 'loading');
  if (loading) return t(`sync.${loading.key}`);
  return t('sync.syncing_generic');
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface SyncStatusSheetProps {
  syncProgress: SyncProgressState;
  isSyncing: boolean;
  onFindRings?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SyncStatusSheet({ syncProgress, isSyncing, onFindRings }: SyncStatusSheetProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { phase, metrics } = syncProgress;

  // ── Connection timeout ──
  const [connectionTimedOut, setConnectionTimedOut] = useState(false);

  // ── Modal visibility ──
  const [modalVisible, setModalVisible] = useState(false);
  const isVisibleRef = useRef(false);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseRef = useRef<SyncPhase>(phase); // always current, safe in callbacks

  const translateY = useSharedValue(SHEET_CONTENT_HEIGHT + 100);
  const backdropOpacity = useSharedValue(0);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const hideModalOnJS = useCallback(() => {
    isVisibleRef.current = false;
    setModalVisible(false);
  }, []);

  const hide = useCallback(() => {
    translateY.value = withTiming(
      SHEET_CONTENT_HEIGHT + 100,
      { duration: 320, easing: Easing.in(Easing.cubic) },
    );
    backdropOpacity.value = withTiming(0, { duration: 260 }, finished => {
      if (finished) {
        runOnJS(hideModalOnJS)();
      }
    });
  }, [hideModalOnJS]);

  const show = useCallback(() => {
    // Cancel any pending auto-dismiss so it can't kill the new sync
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    if (!isVisibleRef.current) {
      // First appearance — mount the Modal then slide up
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      isVisibleRef.current = true;
      translateY.value = SHEET_CONTENT_HEIGHT + 100;
      setModalVisible(true);
    }
    // If a hide animation is mid-flight this cancels it and slides back up
    translateY.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) });
    backdropOpacity.value = withTiming(0.55, { duration: 300 });
  }, []);

  // Allow backdrop/back-button dismiss when sync is finished or timed out
  const handleUserDismiss = useCallback(() => {
    if (phaseRef.current === 'complete' || phaseRef.current === 'idle' || connectionTimedOut) {
      hide();
    }
  }, [hide, connectionTimedOut]);

  // ── Primary show trigger: isSyncing false→true ──
  // isSyncing is set in the same setData call as phase:'connecting', making it
  // a reliable trigger regardless of when the component mounts relative to the sync.
  const prevIsSyncing = useRef(false);
  useEffect(() => {
    const wasSync = prevIsSyncing.current;
    prevIsSyncing.current = isSyncing;
    if (isSyncing && !wasSync) {
      show();
    }
  }, [isSyncing, show]);

  // ── Phase effect: keep phaseRef current + drive auto-dismiss + error hide ──
  useEffect(() => {
    phaseRef.current = phase;
    if (phase === 'complete') {
      dismissTimerRef.current = setTimeout(() => {
        dismissTimerRef.current = null;
        hide();
      }, 1000);
      return () => {
        if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      };
    }
    if (phase === 'idle' && isVisibleRef.current) {
      hide();
    }
  }, [phase, hide]);

  // ── Connection timeout: 40s while stuck on 'connecting' ──
  useEffect(() => {
    if (phase !== 'connecting') {
      setConnectionTimedOut(prev => prev ? false : prev);
      return;
    }
    setConnectionTimedOut(false);
    const id = setTimeout(() => {
      if (phaseRef.current === 'connecting') setConnectionTimedOut(true);
    }, CONNECTION_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [phase]);

  const handleFindRings = useCallback(() => {
    hide();
    onFindRings?.();
  }, [hide, onFindRings]);

  // ── Progress arc ──
  const progress = useSharedValue(0.05);

  const completedCount = metrics.filter(
    m => m.status === 'done' || m.status === 'error',
  ).length;

  useEffect(() => {
    if (phase === 'connecting') {
      progress.value = withRepeat(
        withSequence(
          withTiming(0.12, { duration: 600, easing: Easing.out(Easing.cubic) }),
          withTiming(0.05, { duration: 600, easing: Easing.in(Easing.cubic) }),
        ),
        -1,
        false,
      );
    } else if (phase === 'connected') {
      progress.value = withTiming(0.12, { duration: 600, easing: Easing.out(Easing.cubic) });
    } else if (phase === 'syncing') {
      progress.value = withTiming(Math.max(0.12, completedCount / 7), {
        duration: 600,
        easing: Easing.out(Easing.cubic),
      });
    } else if (phase === 'complete') {
      progress.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.exp) });
    }
  }, [phase, completedCount]);

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }));

  // ── Arc colour flash on complete ──
  const [arcColor, setArcColor] = useState<string>(colors.primary);
  const arcFlashOpacity = useSharedValue(1);
  const arcFlashStyle = useAnimatedStyle(() => ({ opacity: arcFlashOpacity.value }));

  useEffect(() => {
    if (phase === 'complete') {
      runOnJS(setArcColor)('#FFFFFF');
      arcFlashOpacity.value = withSequence(
        withTiming(1, { duration: 0 }),
        withTiming(0.6, { duration: 400 }),
        withTiming(1, { duration: 300 }),
      );
      const t = setTimeout(() => setArcColor(colors.primary), 750);
      return () => clearTimeout(t);
    }
  }, [phase]);

  // ── Percentage inside ring ──
  const pct = phase === 'complete'
    ? 100
    : phase === 'syncing'
    ? Math.round((completedCount / 7) * 100)
    : phase === 'connected'
    ? 12
    : 0;

  // ── Morphing status line (Claude-style slide-up crossfade) ──
  const currentMessage = deriveMessage(syncProgress, t, connectionTimedOut);
  const msgOpacity   = useSharedValue(1);
  const msgTranslate = useSharedValue(0);
  const [displayedMessage, setDisplayedMessage] = useState(currentMessage);
  const prevMessage = useRef(currentMessage);

  useEffect(() => {
    if (currentMessage === prevMessage.current) return;
    prevMessage.current = currentMessage;

    msgOpacity.value   = withTiming(0,   { duration: 170, easing: Easing.in(Easing.quad) });
    msgTranslate.value = withTiming(-10, { duration: 170, easing: Easing.in(Easing.quad) },
      finished => {
        if (!finished) return;
        runOnJS(setDisplayedMessage)(currentMessage);
        msgTranslate.value = 10;
        msgOpacity.value   = 0;
        msgTranslate.value = withTiming(0, { duration: 230, easing: Easing.out(Easing.quad) });
        msgOpacity.value   = withTiming(1, { duration: 230, easing: Easing.out(Easing.quad) });
      },
    );
  }, [currentMessage]);

  const msgAnimStyle = useAnimatedStyle(() => ({
    opacity:   msgOpacity.value,
    transform: [{ translateY: msgTranslate.value }],
  }));

  // ── Sub-line (metric count) ──
  const subOpacity = useSharedValue(0);
  const [showSub, setShowSub] = useState(false);

  useEffect(() => {
    if (phase === 'syncing') {
      setShowSub(true);
      subOpacity.value = withTiming(1, { duration: 300 });
    } else {
      subOpacity.value = withTiming(0, { duration: 200 }, finished => {
        if (finished) runOnJS(setShowSub)(false);
      });
    }
  }, [phase]);

  const subAnimStyle = useAnimatedStyle(() => ({ opacity: subOpacity.value }));

  // ── Sheet height animates to accommodate timeout button ──
  const sheetHeightSV = useSharedValue(SHEET_CONTENT_HEIGHT + insets.bottom);
  const buttonOpacity = useSharedValue(0);

  useEffect(() => {
    const target = (connectionTimedOut ? SHEET_CONTENT_HEIGHT + 44 : SHEET_CONTENT_HEIGHT) + insets.bottom;
    sheetHeightSV.value = withTiming(target, { duration: 250, easing: Easing.out(Easing.cubic) });
    buttonOpacity.value = withTiming(connectionTimedOut ? 1 : 0, { duration: 200 });
  }, [connectionTimedOut, insets.bottom]);

  const sheetHeightStyle = useAnimatedStyle(() => ({ height: sheetHeightSV.value }));
  const buttonAnimStyle = useAnimatedStyle(() => ({ opacity: buttonOpacity.value }));

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleUserDismiss}
    >
      {/* Backdrop */}
      <Animated.View
        style={[StyleSheet.absoluteFillObject, styles.backdrop, backdropStyle]}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={handleUserDismiss}
        />
      </Animated.View>

      {/* Sheet — slides up from bottom */}
      <Animated.View
        style={[
          styles.sheetContainer,
          sheetHeightStyle,
          sheetStyle,
        ]}
      >
        <BlurView intensity={80} tint="dark" style={styles.blurFill}>
          {/* Content */}
          <View style={[styles.content, { paddingBottom: insets.bottom + spacing.md }]}>
            {/* Ring */}
            <View style={styles.ringWrapper}>
              <Animated.View style={arcFlashStyle}>
                <Svg width={RING_SIZE} height={RING_SIZE}>
                  <G rotation="-90" origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}>
                    <Circle
                      cx={RING_SIZE / 2}
                      cy={RING_SIZE / 2}
                      r={RING_RADIUS}
                      stroke="rgba(255,255,255,0.10)"
                      strokeWidth={RING_STROKE}
                      fill="none"
                    />
                    <AnimatedCircle
                      cx={RING_SIZE / 2}
                      cy={RING_SIZE / 2}
                      r={RING_RADIUS}
                      stroke={arcColor}
                      strokeWidth={RING_STROKE}
                      fill="none"
                      strokeDasharray={CIRCUMFERENCE}
                      animatedProps={arcProps}
                      strokeLinecap="round"
                    />
                  </G>
                </Svg>
              </Animated.View>

              {pct > 0 && (
                <View style={styles.ringCenter} pointerEvents="none">
                  <Text style={styles.pctText}>{pct}%</Text>
                </View>
              )}
            </View>

            {/* Text block */}
            <View style={styles.textBlock}>
              <Animated.Text style={[styles.statusText, msgAnimStyle]} numberOfLines={1}>
                {displayedMessage}
              </Animated.Text>

              {showSub && (
                <Animated.Text style={[styles.subText, subAnimStyle]}>
                  {t('sync.metrics_count', { done: completedCount })}
                </Animated.Text>
              )}

              {connectionTimedOut && (
                <Animated.View style={buttonAnimStyle}>
                  <TouchableOpacity
                    style={styles.findRingsButton}
                    onPress={handleFindRings}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="search-outline" size={14} color="#00D4AA" />
                    <Text style={styles.findRingsText}>{t('sync.find_rings')}</Text>
                  </TouchableOpacity>
                </Animated.View>
              )}
            </View>
          </View>
        </BlurView>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0,0,0,1)',
  },
  sheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  blurFill: {
    flex: 1,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.xl,
  },
  ringWrapper: {
    width: RING_SIZE,
    height: RING_SIZE,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pctText: {
    fontFamily: fontFamily.demiBold,
    fontSize: fontSize.xl,
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 0.5,
  },
  textBlock: {
    flex: 1,
    gap: 6,
    overflow: 'hidden',
  },
  statusText: {
    fontFamily: fontFamily.demiBold,
    fontSize: fontSize.lg,
    color: colors.text,
    lineHeight: 22,
  },
  subText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  findRingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 170, 0.4)',
    backgroundColor: 'rgba(0, 212, 170, 0.08)',
  },
  findRingsText: {
    fontFamily: fontFamily.demiBold,
    fontSize: fontSize.sm,
    color: '#00D4AA',
  },
});

export default SyncStatusSheet;
