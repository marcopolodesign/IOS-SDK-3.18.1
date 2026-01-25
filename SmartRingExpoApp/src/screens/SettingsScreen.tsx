import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { router } from 'expo-router';
import { colors, spacing, borderRadius, fontSize, fontFamily, shadows } from '../theme/colors';
import { BatteryIndicator } from '../components';
import { useSmartRing, useAuth } from '../hooks';
import { useOnboarding } from '../context/OnboardingContext';
import UnifiedSmartRingService from '../services/UnifiedSmartRingService';
import { stravaService } from '../services/StravaService';

interface SettingsScreenProps {}

export const SettingsScreen: React.FC<SettingsScreenProps> = () => {
  const { isConnected, connectedDevice, battery, version, findDevice, disconnect, forgetDevice, isMockMode } = useSmartRing();
  const { user, profile: authProfile, signOut, isAuthenticated } = useAuth();
  const { clearDevicePairing, resetOnboarding } = useOnboarding();
  
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

  useEffect(() => {
    if (isConnected) {
      loadSettings();
    }
  }, [isConnected]);

  const loadSettings = async () => {
    try {
      const [profileData, goalData] = await Promise.all([
        UnifiedSmartRingService.getProfile(),
        UnifiedSmartRingService.getGoal(),
      ]);
      setProfile(profileData);
      setGoal(goalData.goal);
    } catch (error) {
      console.log('Failed to load settings');
    }
  };

  const handleSaveProfile = async () => {
    setIsLoading(true);
    try {
      await UnifiedSmartRingService.setProfile(profile);
      Alert.alert('Success', 'Profile saved successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to save profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveGoal = async () => {
    setIsLoading(true);
    try {
      await UnifiedSmartRingService.setGoal(goal);
      Alert.alert('Success', 'Goal saved successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to save goal');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTimeFormatChange = async (value: boolean) => {
    setIs24Hour(value);
    try {
      await UnifiedSmartRingService.setTimeFormat(value);
    } catch (error) {
      console.log('Failed to set time format');
    }
  };

  const handleUnitChange = async (value: boolean) => {
    setIsMetric(value);
    try {
      await UnifiedSmartRingService.setUnit(value);
    } catch (error) {
      console.log('Failed to set unit');
    }
  };

  const handleFindDevice = () => {
    findDevice();
    Alert.alert('Find Device', 'Your ring will vibrate if connected');
  };

  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect Device',
      'Are you sure you want to disconnect from the Smart Ring?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Disconnect', style: 'destructive', onPress: disconnect },
      ]
    );
  };

  const handleForgetDevice = () => {
    Alert.alert(
      'Forget Device',
      'This will remove the paired device from the app. You\'ll need to scan and reconnect.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Forget',
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
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
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
      'Reset Onboarding',
      'This will sign you out and reset all onboarding data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Account Section */}
        {isAuthenticated && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <View style={styles.accountCard}>
              <View style={styles.accountAvatar}>
                <Text style={styles.accountAvatarText}>
                  {authProfile?.display_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
                </Text>
              </View>
              <View style={styles.accountInfo}>
                <Text style={styles.accountName}>
                  {authProfile?.display_name || 'User'}
                </Text>
                <Text style={styles.accountEmail}>{user?.email}</Text>
              </View>
            </View>

            {/* Connected Services */}
            <View style={styles.connectedServices}>
              <View style={styles.serviceRow}>
                <Text style={styles.serviceLabel}>Strava</Text>
                <Text style={[styles.serviceStatus, stravaService.isConnected && styles.serviceStatusConnected]}>
                  {stravaService.isConnected ? 'Connected' : 'Not connected'}
                </Text>
              </View>
              <View style={styles.serviceRow}>
                <Text style={styles.serviceLabel}>Smart Ring</Text>
                <Text style={[styles.serviceStatus, isConnected && styles.serviceStatusConnected]}>
                  {isConnected ? 'Connected' : 'Not connected'}
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
              <SignOutIcon />
              <Text style={styles.signOutButtonText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Device Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Device</Text>
          {isConnected && connectedDevice ? (
            <View style={styles.deviceCard}>
              <View style={styles.deviceIcon}>
                <Svg width={48} height={48} viewBox="0 0 48 48">
                  <Circle cx="24" cy="24" r="20" fill={`${colors.primary}20`} />
                  <Circle cx="24" cy="24" r="14" fill="none" stroke={colors.primary} strokeWidth="2" />
                  <Circle cx="24" cy="24" r="6" fill={colors.primary} />
                </Svg>
              </View>
              <View style={styles.deviceInfo}>
                <Text style={styles.deviceName}>{connectedDevice.localName}</Text>
                <Text style={styles.deviceMac}>{connectedDevice.mac}</Text>
                <View style={styles.deviceStats}>
                  <BatteryIndicator level={battery || 0} size="small" />
                  <Text style={styles.deviceVersion}>v{version || connectedDevice.ver}</Text>
                </View>
              </View>
              {isMockMode && (
                <View style={styles.mockBadge}>
                  <Text style={styles.mockBadgeText}>DEMO</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.noDeviceCard}>
              <Text style={styles.noDeviceText}>No device connected</Text>
            </View>
          )}

          {isConnected && (
            <>
              <View style={styles.deviceActions}>
                <Pressable style={styles.actionButton} onPress={handleFindDevice}>
                  <FindIcon />
                  <Text style={styles.actionButtonText}>Find Device</Text>
                </Pressable>
                <Pressable style={[styles.actionButton, styles.actionButtonDanger]} onPress={handleDisconnect}>
                  <DisconnectIcon />
                  <Text style={[styles.actionButtonText, styles.actionButtonTextDanger]}>Disconnect</Text>
                </Pressable>
              </View>
              <Pressable style={[styles.forgetButton]} onPress={handleForgetDevice}>
                <ForgetIcon />
                <Text style={styles.forgetButtonText}>Forget Device</Text>
              </Pressable>
            </>
          )}
        </View>

        {/* Profile */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile</Text>
          <View style={styles.card}>
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Height</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  value={String(profile.height)}
                  onChangeText={(v) => setProfile({ ...profile, height: parseInt(v) || 0 })}
                  keyboardType="numeric"
                  placeholderTextColor={colors.textMuted}
                />
                <Text style={styles.inputUnit}>cm</Text>
              </View>
            </View>

            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Weight</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  value={String(profile.weight)}
                  onChangeText={(v) => setProfile({ ...profile, weight: parseInt(v) || 0 })}
                  keyboardType="numeric"
                  placeholderTextColor={colors.textMuted}
                />
                <Text style={styles.inputUnit}>kg</Text>
              </View>
            </View>

            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Age</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  value={String(profile.age)}
                  onChangeText={(v) => setProfile({ ...profile, age: parseInt(v) || 0 })}
                  keyboardType="numeric"
                  placeholderTextColor={colors.textMuted}
                />
                <Text style={styles.inputUnit}>years</Text>
              </View>
            </View>

            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Gender</Text>
              <View style={styles.genderButtons}>
                <Pressable
                  style={[styles.genderButton, profile.gender === 'male' && styles.genderButtonActive]}
                  onPress={() => setProfile({ ...profile, gender: 'male' })}
                >
                  <Text style={[styles.genderButtonText, profile.gender === 'male' && styles.genderButtonTextActive]}>
                    Male
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.genderButton, profile.gender === 'female' && styles.genderButtonActive]}
                  onPress={() => setProfile({ ...profile, gender: 'female' })}
                >
                  <Text style={[styles.genderButtonText, profile.gender === 'female' && styles.genderButtonTextActive]}>
                    Female
                  </Text>
                </Pressable>
              </View>
            </View>

            <Pressable
              style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
              onPress={handleSaveProfile}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.textInverse} size="small" />
              ) : (
                <Text style={styles.saveButtonText}>Save Profile</Text>
              )}
            </Pressable>
          </View>
        </View>

        {/* Goals */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Goals</Text>
          <View style={styles.card}>
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Daily Steps</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  value={String(goal)}
                  onChangeText={(v) => setGoal(parseInt(v) || 0)}
                  keyboardType="numeric"
                  placeholderTextColor={colors.textMuted}
                />
                <Text style={styles.inputUnit}>steps</Text>
              </View>
            </View>

            <View style={styles.goalPresets}>
              {[5000, 8000, 10000, 12000, 15000].map((preset) => (
                <Pressable
                  key={preset}
                  style={[styles.presetButton, goal === preset && styles.presetButtonActive]}
                  onPress={() => setGoal(preset)}
                >
                  <Text style={[styles.presetButtonText, goal === preset && styles.presetButtonTextActive]}>
                    {(preset / 1000).toFixed(0)}k
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable style={styles.saveButton} onPress={handleSaveGoal}>
              <Text style={styles.saveButtonText}>Save Goal</Text>
            </Pressable>
          </View>
        </View>

        {/* Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>24-Hour Time</Text>
              <Switch
                value={is24Hour}
                onValueChange={handleTimeFormatChange}
                trackColor={{ false: colors.surfaceLight, true: colors.primaryDark }}
                thumbColor={is24Hour ? colors.primary : colors.textMuted}
              />
            </View>

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Metric Units</Text>
              <Switch
                value={isMetric}
                onValueChange={handleUnitChange}
                trackColor={{ false: colors.surfaceLight, true: colors.primaryDark }}
                thumbColor={isMetric ? colors.primary : colors.textMuted}
              />
            </View>
          </View>
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.card}>
            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>App Version</Text>
              <Text style={styles.aboutValue}>1.0.0</Text>
            </View>
            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>SDK Version</Text>
              <Text style={styles.aboutValue}>3.18.1</Text>
            </View>
          </View>
        </View>

        {/* Developer Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Developer</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.devButton} onPress={handleResetOnboarding}>
              <Text style={styles.devButtonText}>Reset Onboarding</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// Icons
const FindIcon = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24">
    <Path
      d="M18 11c0-3.87-3.13-7-7-7s-7 3.13-7 7c0 5.25 7 13 7 13s7-7.75 7-13zm-7 3c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"
      fill={colors.primary}
    />
  </Svg>
);

const DisconnectIcon = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24">
    <Path
      d="M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42C17.99 7.86 19 9.81 19 12c0 3.87-3.13 7-7 7s-7-3.13-7-7c0-2.19 1.01-4.14 2.58-5.42L6.17 5.17C4.23 6.82 3 9.26 3 12c0 4.97 4.03 9 9 9s9-4.03 9-9c0-2.74-1.23-5.18-3.17-6.83z"
      fill={colors.error}
    />
  </Svg>
);

const ForgetIcon = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24">
    <Path
      d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
      fill={colors.warning}
    />
  </Svg>
);

const SignOutIcon = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24">
    <Path
      d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"
      fill={colors.error}
    />
  </Svg>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: {
    fontSize: fontSize.xxl,
    fontFamily: fontFamily.demiBold,
    color: colors.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.demiBold,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  deviceIcon: {
    marginRight: spacing.md,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: fontSize.lg,
    fontFamily: fontFamily.demiBold,
    color: colors.text,
  },
  deviceMac: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontFamily: fontFamily.regular,
    marginBottom: spacing.xs,
  },
  deviceStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  deviceVersion: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    color: colors.textSecondary,
  },
  mockBadge: {
    backgroundColor: colors.warning,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  mockBadgeText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.demiBold,
    color: colors.textInverse,
  },
  noDeviceCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  noDeviceText: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.regular,
    color: colors.textSecondary,
  },
  deviceActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  actionButtonDanger: {
    borderColor: colors.error,
  },
  actionButtonText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.demiBold,
    color: colors.primary,
  },
  actionButtonTextDanger: {
    color: colors.error,
  },
  forgetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.warning,
    marginTop: spacing.sm,
  },
  forgetButtonText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.demiBold,
    color: colors.warning,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  inputLabel: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.regular,
    color: colors.text,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  input: {
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minWidth: 80,
    textAlign: 'right',
    color: colors.text,
    fontSize: fontSize.md,
    fontFamily: fontFamily.regular,
  },
  inputUnit: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    color: colors.textSecondary,
    width: 40,
  },
  genderButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  genderButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceLight,
  },
  genderButtonActive: {
    backgroundColor: colors.primary,
  },
  genderButtonText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    color: colors.textSecondary,
  },
  genderButtonTextActive: {
    color: colors.textInverse,
    fontFamily: fontFamily.demiBold,
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.demiBold,
    color: colors.textInverse,
  },
  goalPresets: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  presetButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceLight,
  },
  presetButtonActive: {
    backgroundColor: colors.primary,
  },
  presetButtonText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    color: colors.textSecondary,
  },
  presetButtonTextActive: {
    color: colors.textInverse,
    fontFamily: fontFamily.demiBold,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  settingLabel: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.regular,
    color: colors.text,
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  aboutLabel: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.regular,
    color: colors.textSecondary,
  },
  aboutValue: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.regular,
    color: colors.text,
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  accountAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  accountAvatarText: {
    fontSize: fontSize.xl,
    fontFamily: fontFamily.demiBold,
    color: colors.textInverse,
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: fontSize.lg,
    fontFamily: fontFamily.demiBold,
    color: colors.text,
  },
  accountEmail: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    color: colors.textSecondary,
  },
  connectedServices: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  serviceLabel: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.regular,
    color: colors.text,
  },
  serviceStatus: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    color: colors.textMuted,
  },
  serviceStatusConnected: {
    color: colors.success,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.error,
  },
  signOutButtonText: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.demiBold,
    color: colors.error,
  },
  devButton: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  devButtonText: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.regular,
    color: colors.primary,
  },
});

export default SettingsScreen;



