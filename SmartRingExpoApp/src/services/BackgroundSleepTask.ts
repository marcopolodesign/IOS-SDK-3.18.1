/**
 * Background Sleep Notification Task
 *
 * Uses expo-background-fetch to periodically wake the app in the background,
 * sync sleep data from the ring over BLE, detect the wake time (endTime),
 * and schedule a local notification for wakeTime + 30 minutes.
 *
 * Must be imported at the app root (before rendering) so the task is defined.
 */
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import smartRingService from './UnifiedSmartRingService';
import { reportError } from '../utils/sentry';
import { supabase } from './SupabaseService';

const TASK_NAME = 'BACKGROUND_SLEEP_CHECK';
const SCHEDULED_KEY = '@focus_sleep_notif_scheduled_v2';
const MIN_NIGHT_DURATION_MS = 180 * 60 * 1000; // 3 hours — minimum to count as a night
const NOTIFICATION_DELAY_MS = 30 * 60 * 1000; // 30 minutes after wake
const MIN_HOUR = 7; // Don't process wake times before 7 AM (fragmented sleep guard)

/**
 * Log an event to the background_logs table in Supabase.
 * Fire-and-forget — never throws.
 */
async function bgLog(event: string, details: Record<string, any> = {}): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('background_logs').insert({
      user_id: user?.id ?? null,
      task: TASK_NAME,
      event,
      details,
    });
  } catch {
    // Silently fail — logging should never break the task
  }
}

/**
 * Extract the latest wake time from raw sleep records.
 * Only considers night-length blocks (≥180 min) that ended after 7 AM today.
 */
function extractWakeTime(rawRecords: any[]): Date | null {
  if (!rawRecords || rawRecords.length === 0) return null;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  // Night sleep could start yesterday evening — look back to 6 PM yesterday
  const windowStart = todayStart - 6 * 60 * 60 * 1000;

  let latestEnd: number | null = null;

  for (const record of rawRecords) {
    // Extract start timestamp
    const startMs = (() => {
      const candidates = [
        record.startTimestamp,
        record.startTime,
      ].filter((v: any) => typeof v === 'number' && Number.isFinite(v) && v > 0);
      return candidates.length ? candidates[0] : undefined;
    })();

    if (typeof startMs !== 'number') continue;
    if (startMs < windowStart) continue; // Too old

    // Compute duration and end time
    const qualityArray: number[] = record.arraySleepQuality || [];
    const unitLength = Number(record.sleepUnitLength || 1);
    const durationMinutes = Number(record.totalSleepTime) || (qualityArray.length * unitLength);
    const durationMs = durationMinutes * 60 * 1000;

    if (durationMs < MIN_NIGHT_DURATION_MS) continue; // Too short — nap, not night

    const endMs = startMs + durationMs;
    const endHour = new Date(endMs).getHours();

    if (endHour < MIN_HOUR) continue; // Wake before 7 AM — likely fragmented, skip

    if (!latestEnd || endMs > latestEnd) {
      latestEnd = endMs;
    }
  }

  return latestEnd ? new Date(latestEnd) : null;
}

/**
 * Schedule a local notification for wakeTime + 30 min.
 * Cancels any previously scheduled sleep notification first.
 * Skips if the fire time is already in the past.
 */
async function scheduleSleepNotification(wakeTime: Date): Promise<boolean> {
  const fireAt = new Date(wakeTime.getTime() + NOTIFICATION_DELAY_MS);
  const now = new Date();

  if (fireAt <= now) {
    return false;
  }

  // Cancel any previously scheduled sleep notification
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if ((n.content.data as any)?.type === 'sleep_ready') {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }

  const secondsFromNow = Math.max(1, Math.round((fireAt.getTime() - now.getTime()) / 1000));

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Your Sleep Analysis is Ready 🌙',
      body: "Last night's sleep has been analyzed. Tap to see your insights.",
      sound: 'default' as any,
      data: { type: 'sleep_ready', url: 'smartring:///?tab=sleep' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: secondsFromNow,
    },
  });

  return true;
}

/**
 * The background task body. Called by iOS at its discretion (typically every 15-30 min).
 */
TaskManager.defineTask(TASK_NAME, async () => {
  try {
    const now = new Date();
    const hour = now.getHours();

    // Only run between 5 AM and 2 PM — no point checking outside this window
    if (hour < 5 || hour >= 14) {
      await bgLog('skipped_outside_window', { hour });
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // Check if we already scheduled today
    const today = now.toDateString();
    const lastScheduled = await AsyncStorage.getItem(SCHEDULED_KEY);
    if (lastScheduled === today) {
      await bgLog('skipped_already_scheduled');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // Check connection — BLE stays alive via bluetooth-central background mode
    const connStatus = await smartRingService.isConnected();
    if (!connStatus.connected) {
      // Try quick reconnect — ring should be on wrist and in range
      try {
        const reconResult = await smartRingService.autoReconnect();
        if (!reconResult.success) {
          await bgLog('reconnect_failed', { message: reconResult.message });
          return BackgroundFetch.BackgroundFetchResult.Failed;
        }
        await bgLog('reconnected');
      } catch (e: any) {
        await bgLog('reconnect_error', { error: e?.message });
        reportError(e, { op: 'backgroundTask.reconnect' });
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }
    }

    // Fetch sleep data from ring
    const rawResult = await smartRingService.getSleepDataRaw();
    const rawRecords: any[] = rawResult.records || [];

    if (rawRecords.length === 0) {
      await bgLog('no_sleep_records');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // Extract wake time (latest endTime from night-length blocks after 7 AM)
    const wakeTime = extractWakeTime(rawRecords);
    if (!wakeTime) {
      await bgLog('no_valid_wake_time', { recordCount: rawRecords.length });
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // Schedule notification for wakeTime + 30 min
    const didSchedule = await scheduleSleepNotification(wakeTime);

    await bgLog(didSchedule ? 'notification_scheduled' : 'notification_skipped_past', {
      wakeTime: wakeTime.toISOString(),
      fireAt: new Date(wakeTime.getTime() + NOTIFICATION_DELAY_MS).toISOString(),
      recordCount: rawRecords.length,
    });

    if (didSchedule) {
      await AsyncStorage.setItem(SCHEDULED_KEY, today);
      return BackgroundFetch.BackgroundFetchResult.NewData;
    }

    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error: any) {
    await bgLog('task_error', { error: error?.message, stack: error?.stack?.slice(0, 300) });
    reportError(error, { op: 'backgroundSleepTask.topLevel' }, 'fatal');
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/**
 * Register the background fetch task with iOS.
 * Safe to call multiple times — re-registration is a no-op.
 */
export async function registerBackgroundSleepTask(): Promise<void> {
  if (Platform.OS !== 'ios') return;

  const status = await BackgroundFetch.getStatusAsync();
  if (status === BackgroundFetch.BackgroundFetchStatus.Denied) {
    return;
  }

  const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
  if (isRegistered) return;

  await BackgroundFetch.registerTaskAsync(TASK_NAME, {
    minimumInterval: 15 * 60, // 15 min — iOS minimum
    stopOnTerminate: false,
    startOnBoot: true,
  });
}

/**
 * Foreground fallback: called when sync completes in the app.
 * If background task didn't fire, schedule notification from foreground data.
 */
export async function maybeSendSleepNotificationFromForeground(
  sleepEndTime: Date | undefined,
): Promise<void> {
  if (Platform.OS !== 'ios') return;
  if (!sleepEndTime) return;

  // Check if already scheduled today
  const today = new Date().toDateString();
  const lastScheduled = await AsyncStorage.getItem(SCHEDULED_KEY);
  if (lastScheduled === today) return;

  // Same 7 AM guard
  if (sleepEndTime.getHours() < MIN_HOUR) return;

  const didSchedule = await scheduleSleepNotification(sleepEndTime);
  if (didSchedule) {
    await AsyncStorage.setItem(SCHEDULED_KEY, today);
    await bgLog('notification_scheduled_foreground', {
      wakeTime: sleepEndTime.toISOString(),
      fireAt: new Date(sleepEndTime.getTime() + NOTIFICATION_DELAY_MS).toISOString(),
    });
  }
}
