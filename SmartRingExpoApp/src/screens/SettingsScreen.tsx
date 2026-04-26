import React, { useCallback, useState } from 'react';
import { reportError } from '../utils/sentry';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  TextInput,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, spacing, borderRadius, fontSize, fontFamily, shadows, getBatteryColor } from '../theme/colors';
const CONNECT_MOCK_IMG = require('../../assets/connect-mock.png');
const X6_MOCK_IMG = require('../../assets/x6-mock-connect.png');
const BAND_MOCK_IMG = require('../../assets/v8-mock-connect.png');
import { useSmartRing, useAuth } from '../hooks';
import { useOnboarding } from '../context/OnboardingContext';
import { useLanguage } from '../hooks/useLanguage';
import UnifiedSmartRingService from '../services/UnifiedSmartRingService';
import { stravaService } from '../services/StravaService';
import HealthKitService from '../services/HealthKitService';

interface SettingsScreenProps {}

export const SettingsScreen: React.FC<SettingsScreenProps> = () => {
  const { t } = useTranslation();
  const { isConnected, connectedDevice, battery, version, findDevice, disconnect, forgetDevice, isMockMode } = useSmartRing();
  const { user, profile: authProfile, signOut, isAuthenticated } = useAuth();
  const { clearDevicePairing, resetOnboarding } = useOnboarding();
  const { currentLanguage, changeLanguage } = useLanguage();

  const [profile, setProfile] = useState({
    height: 175,
    weight: 70,
    age: 30,
    gender: 'male' as 'male' | 'female',
  });
  const [goal, setGoal] = useState(10000);
  const [is24Hour, setIs24Hour] = useState(true);
  const [isMetric, setIsMetric] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [healthConnected, setHealthConnected] = useState(false);
  const [deviceBattery, setDeviceBattery] = useState<number | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      const connectedType = UnifiedSmartRingService.getConnectedSDKType();
      if (connectedType === 'jstyle' || connectedType === 'none') {
        const goalData = await UnifiedSmartRingService.getGoal();
        setGoal(goalData.goal);
        return;
      }
      const [profileData, goalData] = await Promise.all([
        UnifiedSmartRingService.getProfile(),
        UnifiedSmartRingService.getGoal(),
      ]);
      setProfile(profileData);
      setGoal(goalData.goal);
    } catch (e) { reportError(e, { op: 'settings.load' }, 'warning'); }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!isConnected) return;
      void loadSettings();
      UnifiedSmartRingService.getBattery()
        .then((b) => setDeviceBattery(b.battery))
        .catch(() => {});
    }, [isConnected, loadSettings])
  );

  useFocusEffect(
    useCallback(() => {
      HealthKitService.isConnected().then(setHealthConnected);
    }, [])
  );

  const handleSaveProfile = async () => {
    setIsLoading(true);
    try {
      await UnifiedSmartRingService.setProfile(profile);
      Alert.alert(t('profile.alerts.save_success'), t('profile.alerts.profile_saved'));
    } catch {
      Alert.alert(t('profile.alerts.save_error'), t('profile.alerts.profile_save_error'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveGoal = async () => {
    setIsLoading(true);
    try {
      await UnifiedSmartRingService.setGoal(goal);
      Alert.alert(t('profile.alerts.save_success'), t('profile.alerts.goal_saved'));
    } catch {
      Alert.alert(t('profile.alerts.save_error'), t('profile.alerts.goal_save_error'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleTimeFormatChange = async (value: boolean) => {
    setIs24Hour(value);
    try { await UnifiedSmartRingService.setTimeFormat(value); } catch {}
  };

  const handleUnitChange = async (value: boolean) => {
    setIsMetric(value);
    try { await UnifiedSmartRingService.setUnit(value); } catch {}
  };

  const handleFindDevice = () => {
    findDevice();
    Alert.alert(t('profile.alerts.find_device_title'), t('profile.alerts.find_device_body'));
  };

  const handleDisconnect = () => {
    Alert.alert(
      t('profile.alerts.disconnect_title'),
      t('profile.alerts.disconnect_body'),
      [
        { text: t('profile.alerts.cancel'), style: 'cancel' },
        { text: t('profile.alerts.disconnect_action'), style: 'destructive', onPress: disconnect },
      ]
    );
  };

  const handleForgetDevice = () => {
    Alert.alert(
      t('profile.alerts.forget_title'),
      t('profile.alerts.forget_body'),
      [
        { text: t('profile.alerts.cancel'), style: 'cancel' },
        {
          text: t('profile.alerts.forget_action'),
          style: 'destructive',
          onPress: async () => {
            await forgetDevice();
            await clearDevicePairing();
            router.replace('/(onboarding)/connect');
          },
        },
      ]
    );
  };

  const handleSignOut = () => {
    Alert.alert(
      t('profile.alerts.sign_out_title'),
      t('profile.alerts.sign_out_body'),
      [
        { text: t('profile.alerts.cancel'), style: 'cancel' },
        {
          text: t('profile.alerts.sign_out_action'),
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  const handleResetOnboarding = () => {
    Alert.alert(
      t('profile.alerts.reset_title'),
      t('profile.alerts.reset_body'),
      [
        { text: t('profile.alerts.cancel'), style: 'cancel' },
        {
          text: t('profile.alerts.reset_action'),
          style: 'destructive',
          onPress: async () => {
            await resetOnboarding();
            await signOut();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  const handleLanguagePicker = () => {
    Alert.alert(
      t('profile.language_picker.title'),
      undefined,
      [
        {
          text: t('profile.language_picker.english'),
          onPress: () => changeLanguage('en'),
        },
        {
          text: t('profile.language_picker.spanish'),
          onPress: () => changeLanguage('es'),
        },
        { text: t('profile.language_picker.cancel'), style: 'cancel' },
      ]
    );
  };

  const langLabel = currentLanguage === 'es' ? 'ES' : 'EN';
  const displayName = authProfile?.display_name || 'User';
  const initial = displayName[0]?.toUpperCase() ?? '?';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── Profile Header ───────────────────────────────────────── */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.displayName}>{displayName}</Text>
          {user?.email && (
            <Text style={styles.emailText}>{user.email}</Text>
          )}
          <TouchableOpacity>
            <Text style={styles.editProfileLink}>{t('profile.edit_profile')}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Account ─────────────────────────────────────────────── */}
        {isAuthenticated && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('profile.sections.account')}</Text>
            <View style={styles.glassCard}>
              <TouchableOpacity
                style={[styles.glassRow, styles.glassRowFirst]}
                onPress={() => router.push('/(tabs)/coach/strava')}
                activeOpacity={0.7}
              >
                <Text style={styles.rowLabel}>{t('profile.account.strava')}</Text>
                <View style={styles.accountRowRight}>
                  <Text style={[styles.rowValue, stravaService.isConnected && styles.rowValueConnected]}>
                    {stravaService.isConnected ? t('profile.account.connected') : t('profile.account.not_connected')}
                  </Text>
                  <ChevronIcon />
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.glassRow}
                onPress={() => router.push('/(tabs)/coach/apple-health')}
                activeOpacity={0.7}
              >
                <Text style={styles.rowLabel}>{t('profile.account.apple_health')}</Text>
                <View style={styles.accountRowRight}>
                  <Text style={[styles.rowValue, healthConnected && styles.rowValueConnected]}>
                    {healthConnected ? t('profile.account.connected') : t('profile.account.not_connected')}
                  </Text>
                  <ChevronIcon />
                </View>
              </TouchableOpacity>
              <View style={[styles.glassRow, styles.glassRowLast, { borderBottomWidth: 0 }]}>
                <Text style={styles.rowLabel}>{t('profile.account.smart_ring')}</Text>
                <Text style={[styles.rowValue, isConnected && styles.rowValueConnected]}>
                  {isConnected ? t('profile.account.connected') : t('profile.account.not_connected')}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Device ──────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.sections.device')}</Text>
          {isConnected ? (
            <>
              <View style={styles.profileDeviceCard}>
                {deviceBattery != null && (
                  <View style={styles.batteryCorner}>
                    <BatteryIcon />
                    <Text style={[styles.batteryCornerText, { color: getBatteryColor(deviceBattery) }]}>
                      {deviceBattery}%
                    </Text>
                  </View>
                )}
                <Image
                  source={
                    connectedDevice?.sdkType === 'v8' && connectedDevice?.deviceType === 'ring'
                      ? X6_MOCK_IMG
                      : connectedDevice?.sdkType === 'v8' || connectedDevice?.deviceType === 'band'
                      ? BAND_MOCK_IMG
                      : CONNECT_MOCK_IMG
                  }
                  style={styles.profileDeviceImg}
                  resizeMode="contain"
                />
                <Text style={styles.profileDeviceName}>
                  {connectedDevice?.localName || connectedDevice?.name ||
                    (connectedDevice?.sdkType === 'v8' && connectedDevice?.deviceType === 'ring'
                      ? 'FOCUS X6'
                      : connectedDevice?.sdkType === 'v8' || connectedDevice?.deviceType === 'band'
                      ? 'FOCUS BAND'
                      : 'FOCUS X3')}
                </Text>
                {connectedDevice?.mac ? (
                  <Text style={styles.profileDeviceMac}>{connectedDevice.mac}</Text>
                ) : null}
                <View style={styles.profileConnectedBadge}>
                  <Text style={styles.profileConnectedBadgeText}>{t('profile.account.connected')}</Text>
                </View>
                {isMockMode && (
                  <View style={styles.demoBadge}>
                    <Text style={styles.demoBadgeText}>{t('profile.device.demo')}</Text>
                  </View>
                )}
              </View>
            </>
          ) : (
            <View style={styles.glassCard}>
              <View style={[styles.glassRow, styles.glassRowFirst, styles.glassRowLast]}>
                <Text style={styles.rowValueMuted}>{t('profile.device.no_device')}</Text>
              </View>
            </View>
          )}

          {isConnected && (
            <View style={styles.deviceActions}>
              <Pressable style={styles.deviceActionBtn} onPress={handleFindDevice}>
                <FindIcon />
                <Text style={styles.deviceActionText}>{t('profile.device.find')}</Text>
              </Pressable>
              <Pressable style={[styles.deviceActionBtn, styles.deviceActionBtnDanger]} onPress={handleDisconnect}>
                <DisconnectIcon />
                <Text style={[styles.deviceActionText, styles.deviceActionTextDanger]}>{t('profile.device.disconnect')}</Text>
              </Pressable>
              <Pressable style={[styles.deviceActionBtn, styles.deviceActionBtnWarn]} onPress={handleForgetDevice}>
                <ForgetIcon />
                <Text style={[styles.deviceActionText, styles.deviceActionTextWarn]}>{t('profile.device.forget')}</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* ── Physical ─────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.sections.physical')}</Text>
          <View style={styles.glassCard}>
            <View style={[styles.glassRow, styles.glassRowFirst]}>
              <Text style={styles.rowLabel}>{t('profile.physical.height')}</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.textInput}
                  value={String(profile.height)}
                  onChangeText={(v) => setProfile({ ...profile, height: parseInt(v) || 0 })}
                  keyboardType="numeric"
                  placeholderTextColor={colors.textMuted}
                />
                <Text style={styles.inputUnit}>{t('profile.physical.cm')}</Text>
              </View>
            </View>
            <View style={styles.glassRow}>
              <Text style={styles.rowLabel}>{t('profile.physical.weight')}</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.textInput}
                  value={String(profile.weight)}
                  onChangeText={(v) => setProfile({ ...profile, weight: parseInt(v) || 0 })}
                  keyboardType="numeric"
                  placeholderTextColor={colors.textMuted}
                />
                <Text style={styles.inputUnit}>{t('profile.physical.kg')}</Text>
              </View>
            </View>
            <View style={styles.glassRow}>
              <Text style={styles.rowLabel}>{t('profile.physical.age')}</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.textInput}
                  value={String(profile.age)}
                  onChangeText={(v) => setProfile({ ...profile, age: parseInt(v) || 0 })}
                  keyboardType="numeric"
                  placeholderTextColor={colors.textMuted}
                />
                <Text style={styles.inputUnit}>{t('profile.physical.years')}</Text>
              </View>
            </View>
            <View style={[styles.glassRow, styles.glassRowLast, { borderBottomWidth: 0 }]}>
              <Text style={styles.rowLabel}>{t('profile.physical.gender')}</Text>
              <View style={styles.genderToggle}>
                <Pressable
                  style={[styles.genderBtn, profile.gender === 'male' && styles.genderBtnActive]}
                  onPress={() => setProfile({ ...profile, gender: 'male' })}
                >
                  <Text style={[styles.genderBtnText, profile.gender === 'male' && styles.genderBtnTextActive]}>
                    {t('profile.physical.male')}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.genderBtn, profile.gender === 'female' && styles.genderBtnActive]}
                  onPress={() => setProfile({ ...profile, gender: 'female' })}
                >
                  <Text style={[styles.genderBtnText, profile.gender === 'female' && styles.genderBtnTextActive]}>
                    {t('profile.physical.female')}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
          <Pressable
            style={[styles.saveBtn, isLoading && styles.saveBtnDisabled]}
            onPress={handleSaveProfile}
            disabled={isLoading}
          >
            {isLoading
              ? <ActivityIndicator color={colors.textInverse} size="small" />
              : <Text style={styles.saveBtnText}>{t('profile.physical.save_profile')}</Text>
            }
          </Pressable>
        </View>

        {/* ── Goals ─────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.sections.goals')}</Text>
          <View style={styles.glassCard}>
            <View style={[styles.glassRow, styles.glassRowFirst, styles.glassRowLast, { borderBottomWidth: 0 }]}>
              <Text style={styles.rowLabel}>{t('profile.goals.daily_steps')}</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.textInput}
                  value={String(goal)}
                  onChangeText={(v) => setGoal(parseInt(v) || 0)}
                  keyboardType="numeric"
                  placeholderTextColor={colors.textMuted}
                />
                <Text style={styles.inputUnit}>{t('profile.goals.steps')}</Text>
              </View>
            </View>
          </View>
          <View style={styles.goalPresets}>
            {[5000, 8000, 10000, 12000, 15000].map((preset) => (
              <Pressable
                key={preset}
                style={[styles.presetChip, goal === preset && styles.presetChipActive]}
                onPress={() => setGoal(preset)}
              >
                <Text style={[styles.presetChipText, goal === preset && styles.presetChipTextActive]}>
                  {(preset / 1000).toFixed(0)}k
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.saveBtn} onPress={handleSaveGoal}>
            <Text style={styles.saveBtnText}>{t('profile.goals.save_goal')}</Text>
          </Pressable>
        </View>

        {/* ── Preferences ──────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.sections.preferences')}</Text>
          <View style={styles.glassCard}>
            <View style={[styles.glassRow, styles.glassRowFirst]}>
              <Text style={styles.rowLabel}>{t('profile.preferences.time_24h')}</Text>
              <Switch
                value={is24Hour}
                onValueChange={handleTimeFormatChange}
                trackColor={{ false: colors.surfaceLight, true: colors.primaryDark }}
                thumbColor={is24Hour ? colors.primary : colors.textMuted}
              />
            </View>
            <View style={styles.glassRow}>
              <Text style={styles.rowLabel}>{t('profile.preferences.metric_units')}</Text>
              <Switch
                value={isMetric}
                onValueChange={handleUnitChange}
                trackColor={{ false: colors.surfaceLight, true: colors.primaryDark }}
                thumbColor={isMetric ? colors.primary : colors.textMuted}
              />
            </View>
            <TouchableOpacity style={[styles.glassRow, styles.glassRowLast, { borderBottomWidth: 0 }]} onPress={handleLanguagePicker}>
              <Text style={styles.rowLabel}>{t('profile.preferences.language')}</Text>
              <View style={styles.langChip}>
                <Text style={styles.langChipText}>{langLabel}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── About ────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.sections.about')}</Text>
          <View style={styles.glassCard}>
            <View style={[styles.glassRow, styles.glassRowFirst]}>
              <Text style={styles.rowLabel}>{t('profile.about.app_version')}</Text>
              <Text style={styles.rowValue}>{Constants.expoConfig?.version ?? '—'}</Text>
            </View>
            <View style={styles.glassRow}>
              <Text style={styles.rowLabel}>{t('profile.about.ota_version')}</Text>
              <Text style={[styles.rowValue, { maxWidth: 200, textAlign: 'right' }]} numberOfLines={1}>
                {Updates.isEmbeddedLaunch
                  ? t('profile.about.ota_embedded')
                  : (Updates.updateId?.slice(0, 8) ?? '—')}
              </Text>
            </View>
            <View style={[styles.glassRow, styles.glassRowLast, { borderBottomWidth: 0 }]}>
              <Text style={styles.rowLabel}>{t('profile.about.sdk_version')}</Text>
              <Text style={styles.rowValue}>3.18.1</Text>
            </View>
          </View>
        </View>

        {/* ── Developer ────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.sections.developer')}</Text>
          <View style={styles.glassCard}>
            <TouchableOpacity style={[styles.glassRow, styles.glassRowFirst, styles.glassRowLast, { borderBottomWidth: 0 }]} onPress={handleResetOnboarding}>
              <Text style={styles.rowLabel}>{t('profile.developer.reset_onboarding')}</Text>
              <ChevronIcon />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Sign Out ─────────────────────────────────────────────── */}
        {isAuthenticated && (
          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
            <SignOutIcon />
            <Text style={styles.signOutText}>{t('profile.sign_out')}</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Icons ────────────────────────────────────────────────────────────────────

const BatteryIcon = () => (
  <Svg width={12} height={12} viewBox="0 0 24 24">
    <Path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z" fill="rgba(255,255,255,0.5)" />
  </Svg>
);

const FindIcon = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24">
    <Path d="M18 11c0-3.87-3.13-7-7-7s-7 3.13-7 7c0 5.25 7 13 7 13s7-7.75 7-13zm-7 3c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z" fill={colors.primary} />
  </Svg>
);

const DisconnectIcon = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24">
    <Path d="M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42C17.99 7.86 19 9.81 19 12c0 3.87-3.13 7-7 7s-7-3.13-7-7c0-2.19 1.01-4.14 2.58-5.42L6.17 5.17C4.23 6.82 3 9.26 3 12c0 4.97 4.03 9 9 9s9-4.03 9-9c0-2.74-1.23-5.18-3.17-6.83z" fill={colors.error} />
  </Svg>
);

const ForgetIcon = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24">
    <Path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill={colors.warning} />
  </Svg>
);

const SignOutIcon = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24">
    <Path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" fill={colors.error} />
  </Svg>
);

const ChevronIcon = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24">
    <Path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" fill="rgba(255,255,255,0.3)" />
  </Svg>
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },

  // Profile header
  profileHeader: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    ...shadows.glow(colors.primary),
  },
  avatarText: {
    fontSize: 22,
    fontFamily: fontFamily.demiBold,
    color: colors.textInverse,
  },
  displayName: {
    fontSize: fontSize.xl,
    fontFamily: fontFamily.demiBold,
    color: colors.text,
    marginBottom: 4,
  },
  emailText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: spacing.sm,
  },
  editProfileLink: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.demiBold,
    color: colors.primary,
  },

  // Section
  section: {
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.demiBold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.md,
  },

  // Glass card
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },

  // Glass rows
  glassRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  glassRowFirst: {},
  glassRowLast: {
    borderBottomWidth: 0,
  },
  rowLabel: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.regular,
    color: colors.text,
  },
  rowValue: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.regular,
    color: colors.textSecondary,
  },
  rowValueConnected: {
    color: colors.success,
  },
  accountRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rowValueMuted: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.regular,
    color: colors.textMuted,
  },

  // Onboarding-style device card
  profileDeviceCard: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 28,
    paddingBottom: 24,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.md,
  },
  profileDeviceImg: {
    width: 244,
    height: 207,
    marginBottom: 13,
  },
  profileDeviceName: {
    fontSize: 22,
    fontWeight: '500',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: -0.44,
    lineHeight: 21,
    marginBottom: 13,
  },
  profileDeviceMac: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: -0.32,
    lineHeight: 21,
  },
  batteryCorner: {
    position: 'absolute',
    top: 12,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 1,
  },
  batteryCornerText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.demiBold,
  },
  profileConnectedBadge: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 15,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: 24,
  },
  profileConnectedBadgeText: {
    color: colors.success,
    fontSize: 16,
    fontFamily: fontFamily.demiBold,
    letterSpacing: -0.32,
  },

  // Demo badge
  demoBadge: {
    backgroundColor: colors.warning,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginTop: spacing.sm,
  },
  demoBadgeText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.demiBold,
    color: colors.textInverse,
  },

  // Device action buttons
  deviceActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  deviceActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderColor: `${colors.primary}50`,
    borderWidth: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  deviceActionBtnDanger: {
    borderColor: `${colors.error}50`,
  },
  deviceActionBtnWarn: {
    borderColor: `${colors.warning}50`,
  },
  deviceActionText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.demiBold,
    color: colors.primary,
  },
  deviceActionTextDanger: {
    color: colors.error,
  },
  deviceActionTextWarn: {
    color: colors.warning,
  },

  // Inputs
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    minWidth: 72,
    textAlign: 'right',
    color: colors.text,
    fontSize: fontSize.md,
    fontFamily: fontFamily.regular,
  },
  inputUnit: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    color: colors.textSecondary,
    width: 36,
  },

  // Gender toggle
  genderToggle: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  genderBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  genderBtnActive: {
    backgroundColor: colors.primary,
  },
  genderBtnText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    color: colors.textSecondary,
  },
  genderBtnTextActive: {
    color: colors.textInverse,
    fontFamily: fontFamily.demiBold,
  },

  // Save button
  saveBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.demiBold,
    color: colors.textInverse,
  },

  // Goal presets
  goalPresets: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  presetChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  presetChipActive: {
    backgroundColor: `${colors.primary}20`,
    borderColor: colors.primary,
  },
  presetChipText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    color: colors.textSecondary,
  },
  presetChipTextActive: {
    color: colors.primary,
    fontFamily: fontFamily.demiBold,
  },

  // Language chip
  langChip: {
    backgroundColor: `${colors.primary}20`,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: `${colors.primary}40`,
  },
  langChipText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.demiBold,
    color: colors.primary,
    letterSpacing: 0.5,
  },

  // Sign out
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    backgroundColor: 'rgba(255,107,107,0.08)',
    borderWidth: 1,
    borderColor: `${colors.error}40`,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.md,
  },
  signOutText: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.demiBold,
    color: colors.error,
  },
});

export default SettingsScreen;
