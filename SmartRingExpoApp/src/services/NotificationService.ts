import { Platform, NativeModules, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './SupabaseService';
import { registerBackgroundSleepTask } from './BackgroundSleepTask';
import { reportError } from '../utils/sentry';

async function saveTokenToSupabase(token: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase.from('push_tokens').upsert(
    { user_id: user.id, token, platform: 'ios' },
    { onConflict: 'user_id,token' },
  );

  if (error) {
    console.error('[PushToken] Supabase upsert failed:', error);
    return false;
  }

  const { data: saved } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('token', token)
    .single();

  console.log('[PushToken] verification:', saved ? 'saved ✓' : 'not found ✗');
  return !!saved;
}

/**
 * Request permission + get Expo push token + save it to Supabase push_tokens.
 * Also registers the background sleep notification task.
 * Lazy-loads expo-notifications to avoid native module crash in dev builds.
 * Safe to call on every authenticated app launch.
 */
async function setup(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  if (__DEV__) return; // ExpoPushTokenManager not registered in dev builds

  // Lazy import — avoids ExpoPushTokenManager crash if native module not compiled in
  const Notifications = await import('expo-notifications');
  const Constants = (await import('expo-constants')).default;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== 'granted') {
    const { status: requested } = await Notifications.requestPermissionsAsync();
    status = requested;
  }
  if (status !== 'granted') return;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

  console.log('[PushToken] token:', token);

  // Register background sleep notification task
  registerBackgroundSleepTask().catch(e => {
    console.warn('[BackgroundSleep] Registration failed:', e);
    reportError(e, { op: 'notification.registerBackgroundTask' });
  });

  const saved = await saveTokenToSupabase(token);
  if (saved) return;

  await new Promise<void>((resolve) => {
    Alert.alert(
      'Notifications',
      "We couldn't enable notifications. Try again?",
      [
        {
          text: 'Try Again',
          onPress: async () => {
            const retried = await saveTokenToSupabase(token);
            if (!retried) {
              Alert.alert('Notifications', 'Failed to enable notifications. You can try again later.');
            }
            resolve();
          },
        },
        {
          text: 'Dismiss',
          style: 'cancel',
          onPress: () => resolve(),
        },
      ],
    );
  });
}

export const NotificationService = { setup };
