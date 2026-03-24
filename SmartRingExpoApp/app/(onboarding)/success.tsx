import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useOnboarding } from '../../src/context/OnboardingContext';

const { height } = Dimensions.get('window');
const ALL_SET_IMG = require('../../assets/all-set-mock.png');

export default function SuccessScreen() {
  const { deviceName, deviceMac } = useLocalSearchParams<{ deviceName: string; deviceMac: string }>();
  const { completeDeviceSetup } = useOnboarding();
  const { t } = useTranslation();

  // Register the device immediately so the app recognizes it as paired
  useEffect(() => {
    if (deviceMac) {
      completeDeviceSetup(deviceMac);
    }
  }, [deviceMac]);

  const handleContinue = () => {
    // No manual refresh needed — useHomeData auto-fetches when enabled flips to true
    router.replace('/(onboarding)/integrations');
  };

  const handleReset = () => {
    Alert.alert(
      t('onboarding.button_reset'),
      t('onboarding.alert_failed_message'),
      [
        { text: t('onboarding.button_back'), style: 'cancel' },
        {
          text: t('onboarding.button_reset'),
          style: 'destructive',
          onPress: () => router.replace('/(onboarding)/connect'),
        },
      ]
    );
  };

  const name = deviceName || 'Focus X3';

  return (
    <LinearGradient
      colors={['#000000', '#5A112A']}
      locations={[0.0872, 0.6282]}
      style={styles.container}
    >
      <Image source={ALL_SET_IMG} style={styles.ringImage} resizeMode="contain" />

      {/* Step bars — step 5 of 5 (all active) */}
      <View style={styles.stepBars}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={[styles.stepBar, styles.stepBarActive]} />
        ))}
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>{t('onboarding.title_all_set')}</Text>
        <Text style={styles.subtitle}>
          {t('onboarding.subtitle_all_set', { name })}
        </Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.continueButton} onPress={handleContinue} activeOpacity={0.85}>
          <Text style={styles.continueButtonText}>{t('onboarding.button_continue')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleReset} activeOpacity={0.7}>
          <Text style={styles.resetText}>{t('onboarding.button_reset')}</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  stepBars: {
    position: 'absolute',
    top: 58,
    left: 20,
    right: 20,
    flexDirection: 'row',
    gap: 4,
    zIndex: 1,
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
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 40,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '500',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: -0.64,
    lineHeight: 30,
    marginBottom: 18,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: -0.36,
    lineHeight: 21,
    maxWidth: 300,
  },
  ringImage: {
    position: 'absolute',
    bottom: 0,
    alignSelf: 'center',
    width: '100%',
    height: height * 0.55,
  },
  footer: {
    paddingHorizontal: 40,
    paddingBottom: 60,
    alignItems: 'center',
    gap: 16,
  },
  continueButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  continueButtonText: {
    color: '#5a112a',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.32,
  },
  resetText: {
    fontSize: 16,
    color: '#fff',
    textDecorationLine: 'underline',
    letterSpacing: -0.32,
    lineHeight: 18,
  },
});
