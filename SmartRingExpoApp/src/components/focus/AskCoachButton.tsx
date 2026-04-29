import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, LayoutChangeEvent, ActionSheetIOS } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  interpolateColor,
} from 'react-native-reanimated';
import { fontFamily, fontSize } from '../../theme/colors';
import type { CoachMode } from '../../types/focus.types';
import { useTypewriter } from '../../hooks/useTypewriter';

const R = 20;
const BORDER_WIDTH = 2;
const SPIN_DURATION = 8000;
const FADE_START = 4000;
const FADE_DURATION = 1000;

// Violet → blue → pink, fading to transparent — creates a partial arc
// that sweeps around the border as the gradient layer rotates
const GRADIENT_COLORS: [string, string, string, string] = [
  '#7C3AED',
  '#3B82F6',
  '#EC4899',
  'rgba(236,72,153,0)',
];

function FocusIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 25 25" fill="none">
      <Path
        d="M20.8333 19.1667C20.3913 19.1667 19.9674 19.3423 19.6548 19.6548C19.3423 19.9674 19.1667 20.3913 19.1667 20.8334C19.1667 20.8967 19.1783 20.9575 19.1858 21.0192C17.2822 22.5229 14.9259 23.3384 12.5 23.3334C8.94833 23.3334 5.83333 20.0234 5.83333 16.25C5.83333 12.3442 9.01083 9.16669 12.9167 9.16669H13.3333V7.50002H12.9167C8.09167 7.50002 4.16667 11.425 4.16667 16.25C4.16667 17.82 4.60833 19.325 5.36417 20.6309C3.10333 18.6425 1.66667 15.7384 1.66667 12.5C1.66667 10.7375 2.07667 9.05586 2.885 7.50336L1.40667 6.73419C0.483232 8.51592 0.000837275 10.4932 0 12.5C0 19.3925 5.6075 25 12.5 25C15.3117 25 17.985 24.0667 20.1708 22.3617C20.398 22.4605 20.6444 22.5075 20.8921 22.4991C21.1397 22.4907 21.3823 22.4272 21.6023 22.3132C21.8223 22.1992 22.0142 22.0376 22.1638 21.8402C22.3135 21.6427 22.4173 21.4144 22.4676 21.1718C22.5179 20.9291 22.5135 20.6784 22.4547 20.4377C22.3958 20.197 22.2841 19.9724 22.1275 19.7804C21.971 19.5883 21.7736 19.4336 21.5497 19.3274C21.3258 19.2213 21.0811 19.1663 20.8333 19.1667Z"
        fill="rgba(255,255,255,0.7)"
      />
      <Path d="M10 15.8333V17.5H8.33337V15.8333H10ZM16.6667 7.5V9.16667H15V7.5H16.6667Z" fill="rgba(255,255,255,0.7)" />
      <Path
        d="M12.5 0C9.68833 0 7.015 0.933333 4.82917 2.63833C4.49998 2.49573 4.13356 2.46315 3.78438 2.54544C3.4352 2.62773 3.12189 2.82049 2.89101 3.09507C2.66013 3.36965 2.52402 3.7114 2.50289 4.06953C2.48177 4.42766 2.57676 4.78304 2.77376 5.08286C2.97075 5.38268 3.25923 5.61094 3.59631 5.73371C3.9334 5.85648 4.30111 5.8672 4.64478 5.76429C4.98845 5.66138 5.28974 5.45032 5.50387 5.16249C5.718 4.87466 5.83355 4.52541 5.83333 4.16667C5.83333 4.10333 5.82167 4.0425 5.81417 3.98083C7.71783 2.47716 10.0741 1.66158 12.5 1.66667C16.0517 1.66667 19.1667 4.97667 19.1667 8.75C19.1667 12.6558 15.9892 15.8333 12.0833 15.8333H11.6667V17.5H12.0833C16.9083 17.5 20.8333 13.575 20.8333 8.75C20.8333 7.17917 20.39 5.67333 19.6333 4.36667C21.8958 6.355 23.3333 9.26 23.3333 12.5C23.3333 14.2625 22.9233 15.9442 22.115 17.4967L23.5933 18.2658C24.5168 16.4841 24.9992 14.5068 25 12.5C25 5.6075 19.3925 0 12.5 0Z"
        fill="rgba(255,255,255,0.7)"
      />
    </Svg>
  );
}

function SendIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 19V5M5 12l7-7 7 7"
        stroke="#000000"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ChevronDownIcon() {
  return (
    <Svg width={11} height={11} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 9l6 6 6-6"
        stroke="rgba(255,255,255,0.55)"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function AskCoachButton() {
  const [text, setText] = useState('');
  const [dims, setDims] = useState<{ width: number; height: number } | null>(null);
  const [mode, setMode] = useState<CoachMode>('coach');
  const [tabFocused, setTabFocused] = useState(true);
  const placeholder = useTypewriter(!tabFocused || text.length > 0);

  function openModeSelector() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Cancel', 'Coach', 'Analyst'],
        cancelButtonIndex: 0,
        title: 'Response Mode',
        message: 'Coach is warm and concise. Analyst uses deep thinking for detailed data analysis.',
        userInterfaceStyle: 'dark',
      },
      (index) => {
        if (index === 1) setMode('coach');
        if (index === 2) setMode('analyst');
      }
    );
  }

  // borderRotation drives the spinning gradient (ae-r equivalent)
  // cardProgress drives the bg color transition: white 50% → full black (ae-c equivalent)
  // borderOpacity fades the gradient out (ae-f equivalent)
  const borderRotation = useSharedValue(135);
  const borderOpacity = useSharedValue(1);
  const cardProgress = useSharedValue(0);

  const dimsRef = useRef(dims);
  useEffect(() => { dimsRef.current = dims; }, [dims]);

  const runAnimation = useCallback(() => {
    borderRotation.value = 135;
    borderOpacity.value = 1;
    cardProgress.value = 0;

    // Spin the gradient arc just over one full rotation (like Google's ae-r: 135→565°)
    borderRotation.value = withTiming(565, {
      duration: SPIN_DURATION,
      easing: Easing.bezier(0.2, 0, 0, 1),
    });
    // Fade out the gradient border
    borderOpacity.value = withDelay(
      FADE_START,
      withTiming(0, { duration: FADE_DURATION, easing: Easing.out(Easing.quad) }),
    );
    // Transition card bg: white 50% → full black
    cardProgress.value = withDelay(
      FADE_START,
      withTiming(1, { duration: FADE_DURATION, easing: Easing.bezier(0.4, 0, 0.2, 1) }),
    );
  }, []);

  useEffect(() => {
    if (!dims) return;
    runAnimation();
  }, [dims?.width, dims?.height]);

  useFocusEffect(
    useCallback(() => {
      setTabFocused(true);
      if (dimsRef.current) runAnimation();
      return () => setTabFocused(false);
    }, [])
  );

  const rotateStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${borderRotation.value}deg` }],
  }));

  const borderOpacityStyle = useAnimatedStyle(() => ({
    opacity: borderOpacity.value,
  }));

  const cardBgStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      cardProgress.value,
      [0, 1],
      ['rgba(255,255,255,0.5)', 'rgba(0,0,0,0.95)'],
    ),
  }));

  // Oversized so the gradient fully covers the card at all rotation angles
  const gradientSize = dims
    ? Math.ceil(Math.sqrt(dims.width ** 2 + dims.height ** 2)) + 4
    : 600;

  function handleLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setDims(prev =>
      prev?.width === width && prev?.height === height ? prev : { width, height }
    );
  }

  function handleSend() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const q = text.trim();
    if (q) {
      setText('');
      router.push({ pathname: '/chat', params: { q, mode } });
    } else {
      router.push({ pathname: '/chat', params: { mode } });
    }
  }

  return (
    <View style={styles.wrapper} onLayout={handleLayout}>
      {/* Spinning gradient arc — oversized square, clipped by wrapper's overflow:hidden */}
      {dims && (
        <Reanimated.View
          style={[
            rotateStyle,
            borderOpacityStyle,
            {
              position: 'absolute',
              width: gradientSize,
              height: gradientSize,
              left: (dims.width - gradientSize) / 2,
              top: (dims.height - gradientSize) / 2,
            },
          ]}
          pointerEvents="none"
        >
          <LinearGradient
            colors={GRADIENT_COLORS}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Reanimated.View>
      )}

      {/* Inner fill — white 50% on entry, transitions to full black when spin ends */}
      <Reanimated.View style={[styles.innerFill, cardBgStyle]} />

      <View style={styles.content}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor="rgba(255,255,255,0.45)"
          returnKeyType="send"
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
        />
        <View style={styles.toolbar}>
          <View style={styles.modeGroup}>
            <FocusIcon />
            <TouchableOpacity style={styles.modeBtn} onPress={openModeSelector} activeOpacity={0.7}>
              <Text style={styles.modeBtnText}>{mode === 'coach' ? 'Coach' : 'Analyst'}</Text>
              <ChevronDownIcon />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.sendBtn} onPress={handleSend} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <SendIcon />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: R,
    overflow: 'hidden',
  },
  innerFill: {
    position: 'absolute',
    top: BORDER_WIDTH,
    left: BORDER_WIDTH,
    right: BORDER_WIDTH,
    bottom: BORDER_WIDTH,
    borderRadius: R - BORDER_WIDTH,
  },
  content: {
    paddingTop: 18,
    paddingBottom: 12,
    paddingHorizontal: 20,
  },
  input: {
    color: '#FFFFFF',
    fontSize: fontSize.lg,
    fontFamily: fontFamily.regular,
    padding: 0,
    marginBottom: 14,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modeBtnText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.lg,
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.1,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
