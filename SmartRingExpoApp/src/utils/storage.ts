import AsyncStorage from '@react-native-async-storage/async-storage';

export const STORAGE_KEYS = {
  ONBOARDING_COMPLETE: '@onboarding_complete_v2',
  AUTH_COMPLETED: '@auth_completed',
  DEVICE_CONNECTED: '@device_connected',
  PAIRED_DEVICE_MAC: '@paired_device_mac',
  BATTERY_ALERTS_SHOWN: '@battery_alerts_shown',
  FIRMWARE_UPDATE_DISMISSED_AT: '@firmware_update_dismissed_at',
  // Multi-device support
  PAIRED_RING_DEVICE: '@paired_ring_device',
  PAIRED_BAND_DEVICE: '@paired_band_device',
  ACTIVE_DEVICE_TYPE: '@active_device_type',
} as const;

export const FIRMWARE_UPDATE_DISMISSED_AT = '@firmware_update_dismissed_at';

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

export const BatteryAlertStorage = {
  async getShownThresholds(): Promise<Set<number>> {
    try {
      const value = await AsyncStorage.getItem(STORAGE_KEYS.BATTERY_ALERTS_SHOWN);
      if (value === null) return new Set();
      return new Set(JSON.parse(value) as number[]);
    } catch {
      return new Set();
    }
  },

  async saveShownThresholds(shown: Set<number>): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.BATTERY_ALERTS_SHOWN, JSON.stringify(Array.from(shown)));
  },
};

export default OnboardingStorage;
