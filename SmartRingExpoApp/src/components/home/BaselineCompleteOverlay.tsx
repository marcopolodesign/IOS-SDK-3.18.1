import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Ellipse } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useBaselineMode } from '../../context/BaselineModeContext';
import { fontFamily } from '../../theme/colors';

const AUTO_DISMISS_MS = 4000;

export function BaselineCompleteOverlay() {
  const { t } = useTranslation();
  const { justCompleted, dismissCompletion } = useBaselineMode();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  const checkScale = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!justCompleted) return;

    // Reset to initial values for clean entry animation
    opacity.setValue(0);
    scale.setValue(0.8);
    checkScale.setValue(0);

    // Animate in
    const entryAnim = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),
    ]);
    animRef.current = entryAnim;

    entryAnim.start(() => {
      const checkAnim = Animated.spring(checkScale, {
        toValue: 1,
        friction: 5,
        tension: 100,
        useNativeDriver: true,
      });
      animRef.current = checkAnim;
      checkAnim.start();
    });

    // Auto-dismiss
    const timer = setTimeout(() => {
      const dismissAnim = Animated.timing(opacity, {
        toValue: 0,
        duration: 500,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      });
      animRef.current = dismissAnim;
      dismissAnim.start(() => {
        dismissCompletion();
      });
    }, AUTO_DISMISS_MS);

    return () => {
      clearTimeout(timer);
      animRef.current?.stop();
    };
  }, [justCompleted, dismissCompletion]);

  if (!justCompleted) return null;

  return (
    <Animated.View style={[styles.overlay, { opacity }]} pointerEvents="none">
      <Animated.View style={[styles.content, { transform: [{ scale }] }]}>
        {/* Radial glow */}
        <Svg width={300} height={300} style={styles.glow} pointerEvents="none">
          <Defs>
            <RadialGradient id="celebrationGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#00D4AA" stopOpacity="0.3" />
              <Stop offset="60%" stopColor="#00D4AA" stopOpacity="0.08" />
              <Stop offset="100%" stopColor="#00D4AA" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Ellipse cx="150" cy="150" rx="150" ry="150" fill="url(#celebrationGlow)" />
        </Svg>

        {/* Check circle */}
        <Animated.View style={[styles.checkWrapper, { transform: [{ scale: checkScale }] }]}>
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={36} color="#000" />
          </View>
        </Animated.View>

        <Text style={styles.title}>{t('baseline.complete_title')}</Text>
        <Text style={styles.subtitle}>{t('baseline.complete_subtitle')}</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  glow: {
    position: 'absolute',
    top: -50,
  },
  checkWrapper: {
    marginBottom: 24,
  },
  checkCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#00D4AA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontFamily: fontFamily.demiBold,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
});
