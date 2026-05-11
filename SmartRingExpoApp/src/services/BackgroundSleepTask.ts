/**
 * Background Sleep Notification Task
 *
 * Uses expo-background-task (iOS processing mode) to periodically wake the app in the background,
 * sync sleep data from the ring over BLE, detect the wake time (endTime),
 * and schedule a local notification for wakeTime + 30 minutes.
 *
 * Must be imported at the app root (before rendering) so the task is defined.
 */
import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import smartRingService from './UnifiedSmartRingService';
import { reportError } from '../utils/sentry';
import { supabase } from './SupabaseService';
import dataSyncService from './DataSyncService';
import { extractWakeTime } from '../utils/ringData/sleep';
import { formatDurationHm } from '../utils/time';

const TASK_NAME = 'BACKGROUND_SLEEP_CHECK';
const SCHEDULED_KEY = '@focus_sleep_notif_scheduled_v2';
// In-memory flag prevents concurrent scheduling within the same app session.
// Resets on app restart; AsyncStorage SCHEDULED_KEY handles cross-session dedup.
let _schedulingInProgress = false;
const BG_SYNC_KEY = '@focus_bg_sync_last_at';
/** Per-day dedupe key for sleep-only sync — format: @focus_sleep_synced_for_YYYY-MM-DD */
const SLEEP_SYNCED_PREFIX = '@focus_sleep_synced_for_';
const NOTIFICATION_DELAY_MS = 30 * 60 * 1000; // 30 minutes after wake
const MIN_HOUR = 7; // Don't process wake times before 7 AM (fragmented sleep guard)
const HOME_CACHE_KEY = 'home_data_cache';

/** Returns the AsyncStorage key for the sleep-sync dedupe flag for a given date string (YYYY-MM-DD). */
export function sleepSyncedKey(dateStr: string): string {
  return `${SLEEP_SYNCED_PREFIX}${dateStr}`;
}

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
 * Schedule a local notification for wakeTime + 30 min.
 * Cancels any previously scheduled sleep notification first.
 * Skips if the fire time is already in the past.
 * If session data is provided, the body includes real sleep numbers.
 */
async function scheduleSleepNotification(
  wakeTime: Date,
  session?: { totalMin: number; sleepScore: number | null } | null,
): Promise<boolean> {
  const fireAt = new Date(wakeTime.getTime() + NOTIFICATION_DELAY_MS);
  const now = new Date();

  if (fireAt <= now) {
    return false;
  }

  const secondsFromNow = Math.max(1, Math.round((fireAt.getTime() - now.getTime()) / 1000));

  let body = "Last night's sleep has been analyzed. Tap to see your insights.";
  if (session && session.totalMin > 0) {
    const duration = formatDurationHm(session.totalMin);
    body = session.sleepScore != null
      ? `Slept ${duration} · Score ${session.sleepScore} · Tap for details`
      : `Slept ${duration} · Tap for your sleep insights`;
  }

  // Fixed identifier — re-scheduling replaces any pending notification, preventing duplicates.
  await Notifications.scheduleNotificationAsync({
    identifier: 'focus_sleep_ready',
    content: {
      title: 'Your Sleep Analysis is Ready 🌙',
      body,
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
 * After a successful background sync, read the freshly-synced sleep session from Supabase
 * and patch home_data_cache so the hero shows correct data on cold-start.
 * Only patches fields driven by the hero phase computation (bedTime, wakeTime, sleepScore).
 * Best-effort — never throws.
 */
async function patchHeroCache(userId: string): Promise<void> {
  try {
    const [sleepRes, dailyRes] = await Promise.all([
      supabase
        .from('sleep_sessions')
        .select('start_time, end_time, sleep_score, deep_min, light_min, rem_min, awake_min')
        .eq('user_id', userId)
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('daily_summaries')
        .select('hrv_avg, hr_min, total_steps')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const sleep = sleepRes.data;
    if (!sleep?.start_time || !sleep?.end_time) return;

    // Only apply if the sleep session ended within the last 24 hours
    const endedAt = new Date(sleep.end_time).getTime();
    if (Date.now() - endedAt > 24 * 60 * 60 * 1000) return;

    const existingRaw = await AsyncStorage.getItem(HOME_CACHE_KEY);
    const existing = existingRaw ? JSON.parse(existingRaw) : {};

    const sleepMin = (sleep.deep_min ?? 0) + (sleep.light_min ?? 0) + (sleep.rem_min ?? 0);

    const patched = {
      ...existing,
      sleepScore: sleep.sleep_score ?? existing.sleepScore ?? 0,
      lastNightSleep: {
        ...existing.lastNightSleep,
        score: sleep.sleep_score ?? existing.lastNightSleep?.score ?? 0,
        bedTime: sleep.start_time,
        wakeTime: sleep.end_time,
        timeAsleepMinutes: sleepMin,
        timeAsleep: formatDurationHm(sleepMin),
      },
      cachedAt: Date.now(),
      lastSyncedAt: Date.now(),
    };

    await AsyncStorage.setItem(HOME_CACHE_KEY, JSON.stringify(patched));
    await bgLog('hero_cache_patched', {
      sleepScore: patched.sleepScore,
      bedTime: sleep.start_time,
      wakeTime: sleep.end_time,
      sleepMin,
    });
  } catch (e: any) {
    await bgLog('hero_cache_patch_failed', { error: e?.message });
  }
}

/**
 * The background task body. Called by iOS at its discretion (typically every 15-30 min).
 */
/**
 * The full task body — runs whether called by the OS scheduler or manually from the debug button.
 * Returns a human-readable summary of what happened for the debug UI.
 */
export async function runBackgroundSleepCheck(): Promise<string> {
  const now = new Date();
  const hour = now.getHours();

  if (hour < 5 || hour >= 23) {
    await bgLog('skipped_outside_window', { hour });
    return `Skipped — outside window (hour ${hour}, runs 5–23)`;
  }

  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;
  if (!userId) {
    await bgLog('no_user');
    return 'Skipped — no authenticated user';
  }

  const today = now.toDateString();
  const todayDateStr = now.toISOString().split('T')[0];
  const lastScheduled = await AsyncStorage.getItem(SCHEDULED_KEY);
  const alreadyScheduledToday = lastScheduled === today;

  let didSleepSync = false;
  let didSchedule = false;
  const events: string[] = [];

  if (!alreadyScheduledToday) {
    const connStatus = await smartRingService.isConnected();
    if (!connStatus.connected) {
      try {
        const reconResult = await smartRingService.autoReconnect();
        if (!reconResult.success) {
          await bgLog('reconnect_failed', { message: reconResult.message });
          events.push('reconnect failed');
        } else {
          await bgLog('reconnected');
          events.push('reconnected');
        }
      } catch (e: any) {
        await bgLog('reconnect_error', { error: e?.message });
        reportError(e, { op: 'backgroundTask.reconnect' });
        events.push(`reconnect error: ${e?.message}`);
      }
    } else {
      events.push('ring connected');
    }

    const rawResult = await smartRingService.getSleepDataRaw();
    const rawRecords: any[] = rawResult.records || [];
    const wakeTime = rawRecords.length > 0 ? extractWakeTime(rawRecords) : null;

    if (!wakeTime) {
      await bgLog('no_valid_wake_time', { recordCount: rawRecords.length });
      events.push(`no wake time (${rawRecords.length} records)`);
    } else {
      const alreadySynced = await AsyncStorage.getItem(sleepSyncedKey(todayDateStr));
      let sessionForNotif: { totalMin: number; sleepScore: number | null } | null = null;

      if (!alreadySynced) {
        try {
          const syncResult = await dataSyncService.syncSleepOnly();
          if (syncResult.success) {
            await AsyncStorage.setItem(sleepSyncedKey(todayDateStr), '1');
            didSleepSync = true;
            sessionForNotif = syncResult.latestSession ?? null;
            await bgLog('sleep_only_sync_complete', {
              totalMin: sessionForNotif?.totalMin,
              score: sessionForNotif?.sleepScore,
            });
            await patchHeroCache(userId);
            events.push(`sleep synced (${sessionForNotif?.totalMin}min, score ${sessionForNotif?.sleepScore})`);
          } else {
            await bgLog('sleep_only_sync_failed', { error: syncResult.error });
            events.push(`sleep sync failed: ${syncResult.error}`);
          }
        } catch (e: any) {
          await bgLog('sleep_only_sync_error', { error: e?.message });
          events.push(`sleep sync error: ${e?.message}`);
        }
      } else {
        events.push('sleep already synced today');
      }

      didSchedule = await scheduleSleepNotification(wakeTime, sessionForNotif);
      await bgLog(didSchedule ? 'notification_scheduled' : 'notification_skipped_past', {
        wakeTime: wakeTime.toISOString(),
        fireAt: new Date(wakeTime.getTime() + NOTIFICATION_DELAY_MS).toISOString(),
        recordCount: rawRecords.length,
        enriched: !!sessionForNotif,
      });
      events.push(didSchedule ? 'notification scheduled' : 'notification skipped (fire time past)');
      if (didSchedule) await AsyncStorage.setItem(SCHEDULED_KEY, today);
    }
  } else {
    events.push('sleep check already done today');
  }

  if (!didSleepSync) {
    const lastBgSync = await AsyncStorage.getItem(BG_SYNC_KEY);
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    if (!lastBgSync || Number(lastBgSync) < twoHoursAgo) {
      try {
        const syncResult = await dataSyncService.syncAllData();
        await AsyncStorage.setItem(BG_SYNC_KEY, String(Date.now()));
        await bgLog('bg_sync_complete', { success: syncResult.success, error: syncResult.error });
        if (syncResult.success) await patchHeroCache(userId);
        events.push(`full sync ${syncResult.success ? 'ok' : `failed: ${syncResult.error}`}`);
      } catch (e: any) {
        await bgLog('bg_sync_error', { error: e?.message });
        events.push(`full sync error: ${e?.message}`);
      }
    } else {
      events.push('full sync skipped (ran < 2h ago)');
    }
  }

  return events.join('\n');
}

TaskManager.defineTask(TASK_NAME, async () => {
  try {
    await runBackgroundSleepCheck();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error: any) {
    await bgLog('task_error', { error: error?.message, stack: error?.stack?.slice(0, 300) });
    reportError(error, { op: 'backgroundSleepTask.topLevel' }, 'fatal');
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/**
 * Register the background fetch task with iOS.
 * Safe to call multiple times — re-registration is a no-op.
 */
export async function registerBackgroundSleepTask(): Promise<void> {
  if (Platform.OS !== 'ios') return;

  const status = await BackgroundTask.getStatusAsync();
  if (status === BackgroundTask.BackgroundTaskStatus.Restricted) {
    return;
  }

  const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
  if (isRegistered) return;

  await BackgroundTask.registerTaskAsync(TASK_NAME, {
    minimumInterval: 15, // 15 min — iOS minimum (unit: minutes)
  });
}

/**
 * Foreground fallback: called when sync completes in the app.
 * If background task didn't fire, schedule notification from foreground data.
 */
export async function maybeSendSleepNotificationFromForeground(
  sleepEndTime: Date | undefined,
  session?: { totalMin: number; sleepScore: number | null } | null,
): Promise<void> {
  if (Platform.OS !== 'ios') return;
  if (!sleepEndTime) return;
  // Fast synchronous guard — prevents concurrent calls from racing past the async AsyncStorage read.
  if (_schedulingInProgress) return;

  // Check if already scheduled today
  const today = new Date().toDateString();
  const lastScheduled = await AsyncStorage.getItem(SCHEDULED_KEY);
  if (lastScheduled === today) { _schedulingInProgress = true; return; }

  // Same 7 AM guard
  if (sleepEndTime.getHours() < MIN_HOUR) return;

  _schedulingInProgress = true;
  const didSchedule = await scheduleSleepNotification(sleepEndTime, session);
  if (didSchedule) {
    await AsyncStorage.setItem(SCHEDULED_KEY, today);
    await bgLog('notification_scheduled_foreground', {
      wakeTime: sleepEndTime.toISOString(),
      fireAt: new Date(sleepEndTime.getTime() + NOTIFICATION_DELAY_MS).toISOString(),
      enriched: !!session,
    });
  } else {
    // Fire time is past — don't lock out future attempts (e.g., next day)
    _schedulingInProgress = false;
  }
}
