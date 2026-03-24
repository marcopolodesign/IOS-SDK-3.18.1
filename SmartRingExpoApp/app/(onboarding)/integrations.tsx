import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useOnboarding } from '../../src/context/OnboardingContext';
import { stravaService } from '../../src/services/StravaService';
import HealthKitService from '../../src/services/HealthKitService';

const { height } = Dimensions.get('window');
const TOTAL_STEPS = 5;
const CURRENT_STEP = 5; // Last step — all bars active

export default function IntegrationsScreen() {
  const { completeOnboarding } = useOnboarding();
  const { t } = useTranslation();

  const [stravaConnected, setStravaConnected] = useState(false);
  const [stravaLoading, setStravaLoading] = useState(true);
  const [stravaConnecting, setStravaConnecting] = useState(false);
  const [healthConnected, setHealthConnected] = useState(false);
  const [healthConnecting, setHealthConnecting] = useState(false);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    stravaService.reload().then(() => {
      setStravaConnected(stravaService.isConnected);
      setStravaLoading(false);
    });
    if (Platform.OS === 'ios') {
      HealthKitService.isConnected().then(setHealthConnected);
    }
  }, []);

  const handleStravaConnect = async () => {
    if (stravaConnected || stravaConnecting) return;
    setStravaConnecting(true);
    const result = await stravaService.connect();
    if (result.success) {
      setStravaConnected(true);
    }
    setStravaConnecting(false);
  };

  const handleHealthConnect = async () => {
    if (healthConnected || healthConnecting) return;
    setHealthConnecting(true);
    const success = await HealthKitService.initialize();
    if (success) setHealthConnected(true);
    setHealthConnecting(false);
  };

  const handleContinue = async () => {
    setFinishing(true);
    await completeOnboarding();
    router.replace('/(tabs)');
  };

  return (
    <LinearGradient
      colors={['#000000', '#5A112A']}
      locations={[0.0872, 0.6282]}
      style={styles.container}
    >
      {/* Step bars */}
      <View style={styles.stepBars}>
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <View
            key={i}
            style={[
              styles.stepBar,
              i < CURRENT_STEP && styles.stepBarActive,
            ]}
          />
        ))}
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>{t('integrations.title')}</Text>
        <Text style={styles.subtitle}>{t('integrations.subtitle')}</Text>

        {/* Strava card */}
        <TouchableOpacity
          style={[styles.integrationCard, stravaConnected && styles.integrationCardConnected]}
          onPress={handleStravaConnect}
          activeOpacity={stravaConnected ? 1 : 0.75}
          disabled={stravaConnected || stravaConnecting}
        >
          <View style={[styles.integrationIconWrap, styles.stravaIconBg]}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="#fff">
              <Path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.599h4.172L10.463 0l-7 13.828h4.169" />
            </Svg>
          </View>

          <View style={styles.integrationInfo}>
            <Text style={styles.integrationName}>{t('integrations.strava_name')}</Text>
            <Text style={styles.integrationDesc}>
              {stravaConnected ? t('integrations.strava_connected') : t('integrations.strava_desc')}
            </Text>
          </View>

          <View style={styles.integrationStatus}>
            {stravaLoading ? (
              <ActivityIndicator size="small" color="rgba(255,255,255,0.3)" />
            ) : stravaConnecting ? (
              <ActivityIndicator size="small" color="#FC4C02" />
            ) : stravaConnected ? (
              <View style={styles.connectedBadge}>
                <Ionicons name="checkmark" size={14} color="#000" />
              </View>
            ) : (
              <View style={styles.connectChip}>
                <Text style={styles.connectChipText}>{t('integrations.button_connect')}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        {/* Apple Health card */}
        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={[styles.integrationCard, healthConnected && styles.integrationCardConnected]}
            onPress={handleHealthConnect}
            activeOpacity={healthConnected ? 1 : 0.75}
            disabled={healthConnected || healthConnecting}
          >
            <View style={[styles.integrationIconWrap, styles.appleHealthIconBg]}>
              <Ionicons name="heart" size={20} color="#fff" />
            </View>

            <View style={styles.integrationInfo}>
              <Text style={styles.integrationName}>{t('integrations.apple_health_name')}</Text>
              <Text style={styles.integrationDesc}>
                {healthConnected ? t('integrations.apple_health_connected') : t('integrations.apple_health_desc')}
              </Text>
            </View>

            <View style={styles.integrationStatus}>
              {healthConnecting ? (
                <ActivityIndicator size="small" color="#FF375F" />
              ) : healthConnected ? (
                <View style={styles.connectedBadge}>
                  <Ionicons name="checkmark" size={14} color="#000" />
                </View>
              ) : (
                <View style={[styles.connectChip, styles.connectChipHealth]}>
                  <Text style={[styles.connectChipText, styles.connectChipTextHealth]}>
                    {t('integrations.button_connect')}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.continueButton, finishing && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={finishing}
          activeOpacity={0.85}
        >
          {finishing ? (
            <ActivityIndicator color="#5a112a" />
          ) : (
            <Text style={styles.continueButtonText}>{t('integrations.button_continue')}</Text>
          )}
        </TouchableOpacity>

        {!stravaConnected && (
          <TouchableOpacity onPress={handleContinue} style={styles.skipLink} disabled={finishing}>
            <Text style={styles.skipText}>{t('integrations.button_skip')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Step bars
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
    paddingHorizontal: 40,
    paddingTop: height * 0.12,
  },
  title: {
    fontSize: 32,
    fontWeight: '500',
    color: '#fff',
    letterSpacing: -0.64,
    lineHeight: 38,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#fff',
    letterSpacing: -0.36,
    lineHeight: 24,
    maxWidth: 280,
    marginBottom: 32,
  },

  // Integration cards
  integrationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  integrationCardConnected: {
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  integrationIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  stravaIconBg: { backgroundColor: '#FC4C02' },
  appleHealthIconBg: { backgroundColor: '#FF375F' },
  integrationInfo: { flex: 1 },
  integrationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 3,
  },
  integrationDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 18,
  },
  integrationStatus: {
    marginLeft: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
  },
  connectedBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FC4C02',
  },
  connectChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FC4C02',
  },
  connectChipHealth: { borderColor: '#FF375F' },
  connectChipTextHealth: { color: '#FF375F' },

  // Footer
  footer: {
    paddingHorizontal: 40,
    paddingBottom: 60,
    alignItems: 'center',
    gap: 16,
  },
  continueButton: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  buttonDisabled: { opacity: 0.45 },
  continueButtonText: {
    color: '#5a112a',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.32,
  },
  skipLink: { paddingVertical: 4 },
  skipText: {
    fontSize: 16,
    color: '#fff',
    textDecorationLine: 'underline',
    letterSpacing: -0.32,
  },
});
