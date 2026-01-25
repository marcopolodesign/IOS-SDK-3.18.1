import AsyncStorage from '@react-native-async-storage/async-storage';

export const STORAGE_KEYS = {
  ONBOARDING_COMPLETE: '@onboarding_complete_v2',
  AUTH_COMPLETED: '@auth_completed',
  DEVICE_CONNECTED: '@device_connected',
  PAIRED_DEVICE_MAC: '@paired_device_mac',
} as const;

export const OnboardingStorage = {
  async getOnboardingComplete(): Promise<boolean> {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETE);
    return value === 'true';
  },

  async setOnboardingComplete(): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETE, 'true');
  },

  async getDeviceConnected(): Promise<boolean> {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_CONNECTED);
    return value === 'true';
  },

  async setDeviceConnected(connected: boolean): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_CONNECTED, connected ? 'true' : 'false');
  },

  async getPairedDeviceMac(): Promise<string | null> {
    return AsyncStorage.getItem(STORAGE_KEYS.PAIRED_DEVICE_MAC);
  },

  async setPairedDeviceMac(mac: string): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.PAIRED_DEVICE_MAC, mac);
  },

  async clearDevicePairing(): Promise<void> {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.DEVICE_CONNECTED,
      STORAGE_KEYS.PAIRED_DEVICE_MAC,
    ]);
  },

  async reset(): Promise<void> {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.ONBOARDING_COMPLETE,
      STORAGE_KEYS.AUTH_COMPLETED,
      STORAGE_KEYS.DEVICE_CONNECTED,
      STORAGE_KEYS.PAIRED_DEVICE_MAC,
    ]);
  },
};

export default OnboardingStorage;
