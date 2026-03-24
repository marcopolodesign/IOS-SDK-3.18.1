import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './SupabaseService';
import { FIRMWARE_UPDATE_DISMISSED_AT } from '../utils/storage';

const FALLBACK_LATEST_VERSION = '1.0.0';
const DISMISS_COOLDOWN_MS = 72 * 60 * 60 * 1000; // 72 hours

async function getLatestVersionFromSupabase(): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'latest_firmware_version')
      .single();

    if (error || !data) return FALLBACK_LATEST_VERSION;
    return data.value;
  } catch {
    return FALLBACK_LATEST_VERSION;
  }
}

/** Returns -1 if a < b, 0 if equal, 1 if a > b */
function compareVersions(a: string, b: string): number {
  const parse = (v: string) => v.split('.').map(n => parseInt(n, 10) || 0);
  const [aMaj, aMin, aPatch] = parse(a);
  const [bMaj, bMin, bPatch] = parse(b);

  if (aMaj !== bMaj) return aMaj < bMaj ? -1 : 1;
  if (aMin !== bMin) return aMin < bMin ? -1 : 1;
  if (aPatch !== bPatch) return aPatch < bPatch ? -1 : 1;
  return 0;
}

export const FirmwareUpdateService = {
  async checkShouldShow(currentVersion: string): Promise<{ shouldShow: boolean; latestVersion: string }> {
    const latestVersion = await getLatestVersionFromSupabase();

    // No update available
    if (compareVersions(currentVersion, latestVersion) >= 0) {
      return { shouldShow: false, latestVersion };
    }

    // Check 72h cooldown
    try {
      const dismissedAt = await AsyncStorage.getItem(FIRMWARE_UPDATE_DISMISSED_AT);
      if (dismissedAt) {
        const elapsed = Date.now() - parseInt(dismissedAt, 10);
        if (elapsed < DISMISS_COOLDOWN_MS) {
          return { shouldShow: false, latestVersion };
        }
      }
    } catch {
      // If storage read fails, show the prompt
    }

    return { shouldShow: true, latestVersion };
  },

  async markDismissed(): Promise<void> {
    await AsyncStorage.setItem(FIRMWARE_UPDATE_DISMISSED_AT, String(Date.now()));
  },
};
