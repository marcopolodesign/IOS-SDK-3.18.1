import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

const { height } = Dimensions.get('window');
const RING_IMG = require('../../assets/connect-mock.png');
const BAND_IMG = require('../../assets/v8-mock-connect.png');

const CUSTOM_BEZIER = Easing.bezier(0.4, 0, 0, 1);
const STAGGER_DURATION = 600;

export default function DeviceSelectScreen() {
  const { t } = useTranslation();

  // Stagger animations
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(80);
  const ringOpacity = useSharedValue(0);
  const ringTranslateY = useSharedValue(80);
  const bandOpacity = useSharedValue(0);
  const bandTranslateY = useSharedValue(80);

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ translateY: ringTranslateY.value }],
  }));
  const bandStyle = useAnimatedStyle(() => ({
    opacity: bandOpacity.value,
    transform: [{ translateY: bandTranslateY.value }],
  }));

  useEffect(() => {
    const timingOpts = { duration: STAGGER_DURATION, easing: CUSTOM_BEZIER };
    titleOpacity.value = withDelay(200, withTiming(1, timingOpts));
    titleTranslateY.value = withDelay(200, withTiming(0, timingOpts));
    ringOpacity.value = withDelay(225, withTiming(1, timingOpts));
    ringTranslateY.value = withDelay(225, withTiming(0, timingOpts));
    bandOpacity.value = withDelay(235, withTiming(1, timingOpts));
    bandTranslateY.value = withDelay(235, withTiming(0, timingOpts));
  }, []);

  const handleSelect = (deviceType: 'ring' | 'band') => {
    router.push({
      pathname: '/(onboarding)/connect',
      params: { deviceType },
    });
  };

  return (
    <LinearGradient
      colors={['#000000', '#1A0A1E', '#0D0D0D']}
      locations={[0, 0.5, 1]}
      style={styles.container}
    >
      <View style={styles.content}>
        <Reanimated.View style={titleStyle}>
          <Text style={styles.title}>{t('onboarding.choose_device')}</Text>
          <Text style={styles.subtitle}>{t('onboarding.choose_device_subtitle')}</Text>
        </Reanimated.View>

        <View style={styles.cards}>
          <Reanimated.View style={ringStyle}>
            <TouchableOpacity
              style={styles.card}
              onPress={() => handleSelect('ring')}
              activeOpacity={0.85}
            >
              <Image source={RING_IMG} style={styles.deviceImage} resizeMode="contain" />
              <Text style={styles.cardLabel}>{t('onboarding.focus_ring')}</Text>
              <Text style={styles.cardDesc}>{t('onboarding.focus_ring_desc')}</Text>
            </TouchableOpacity>
          </Reanimated.View>

          <Reanimated.View style={bandStyle}>
            <TouchableOpacity
              style={styles.card}
              onPress={() => handleSelect('band')}
              activeOpacity={0.85}
            >
              <Image source={BAND_IMG} style={styles.deviceImage} resizeMode="contain" />
              <Text style={styles.cardLabel}>{t('onboarding.focus_band')}</Text>
              <Text style={styles.cardDesc}>{t('onboarding.focus_band_desc')}</Text>
            </TouchableOpacity>
          </Reanimated.View>
        </View>
      </View>

      {/* Step bars */}
      <View style={styles.stepBars}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={[styles.stepBar, i === 0 && styles.stepBarActive]}
          />
        ))}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: height * 0.12,
    paddingBottom: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: '500',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: -0.64,
    lineHeight: 38,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    letterSpacing: -0.32,
    lineHeight: 22,
    marginBottom: 40,
  },
  cards: {
    flex: 1,
    justifyContent: 'center',
    gap: 16,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  deviceImage: {
    width: 120,
    height: 100,
    marginBottom: 12,
  },
  cardLabel: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
  },
  stepBars: {
    position: 'absolute',
    top: 58,
    left: 20,
    right: 20,
    flexDirection: 'row',
    gap: 4,
  },
  stepBar: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  stepBarActive: {
    backgroundColor: '#fff',
  },
});
