import * as Notifications from 'expo-notifications';
import { Platform, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './SupabaseService';

const SLEEP_NOTIF_DATE_KEY = '@focus_sleep_notif_date_v1';
const EXPO_PROJECT_ID = '176a7f39-858f-4c21-97c5-7714f587c179';

/**
 * Request permission + get Expo push token + save it to Supabase push_tokens.
 * Safe to call on every authenticated app launch — Expo deduplications token fetches.
 */
async function setup(): Promise<void> {
  if (Platform.OS !== 'ios') return;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== 'granted') {
    const { status: requested } = await Notifications.requestPermissionsAsync();
    status = requested;
  }
  if (status !== 'granted') return;

  const { data: token } = await Notifications.getExpoPushTokenAsync({
    projectId: EXPO_PROJECT_ID,
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('push_tokens').upsert(
    { user_id: user.id, token, platform: 'ios' },
    { onConflict: 'user_id,token' },
  );
}

/**
 * Fire the "Sleep Analysis Ready" local notification at most once per calendar day,
 * only between 4 AM and 2 PM. Called after a sync that yields valid sleep data.
 */
async function maybeSendSleepReadyNotification(): Promise<void> {
  if (Platform.OS !== 'ios') return;

  const hour = new Date().getHours();
  if (hour < 4 || hour >= 14) return;

  const today = new Date().toDateString();
  const lastShown = await AsyncStorage.getItem(SLEEP_NOTIF_DATE_KEY);
  if (lastShown === today) return;

  await AsyncStorage.setItem(SLEEP_NOTIF_DATE_KEY, today);

  // Fire via native JstyleBridge so it works even when app is suspended
  await NativeModules.JstyleBridge.scheduleSleepAnalysisNotification();
}

export const NotificationService = { setup, maybeSendSleepReadyNotification };
