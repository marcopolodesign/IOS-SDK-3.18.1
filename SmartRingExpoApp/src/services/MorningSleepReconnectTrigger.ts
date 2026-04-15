/**
 * MorningSleepReconnectTrigger
 *
 * Listens for BLE reconnect events from the ring. When the ring reconnects
 * between 05:00–10:00 and today's sleep hasn't been synced yet, fires a
 * targeted sleep-only Supabase sync and schedules the "Sleep Ready" notification.
 *
 * This path typically fires within seconds of the user putting the ring back on
 * after waking — beating iOS's background-fetch scheduler.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import dataSyncService from './DataSyncService';
import { sleepSyncedKey, maybeSendSleepNotificationFromForeground } from './BackgroundSleepTask';
import smartRingService from './UnifiedSmartRingService';
import { reportError } from '../utils/sentry';
import type { ConnectionState } from '../types/sdk.types';

const MORNING_START_HOUR = 5;
const MORNING_END_HOUR = 10;
// Brief delay after reconnect before querying the ring — gives BLE stack time to settle
const SETTLE_DELAY_MS = 30_000;

let _unsub: (() => void) | null = null;
let _pendingTimer: ReturnType<typeof setTimeout> | null = null;

function isMorningWindow(): boolean {
  const h = new Date().getHours();
  return h >= MORNING_START_HOUR && h < MORNING_END_HOUR;
}

async function isSleepSyncedToday(): Promise<boolean> {
  const dateStr = new Date().toISOString().split('T')[0];
  const val = await AsyncStorage.getItem(sleepSyncedKey(dateStr));
  return val === '1';
}

async function runMorningSleepSync(): Promise<void> {
  try {
    if (!isMorningWindow()) return;
    if (await isSleepSyncedToday()) return;

    const syncResult = await dataSyncService.syncSleepOnly();
    if (!syncResult.success) {
      console.warn('[MorningSleepReconnect] syncSleepOnly failed:', syncResult.error);
      return;
    }

    if (!syncResult.latestSession) return; // No qualifying night found

    const dateStr = new Date().toISOString().split('T')[0];
    await AsyncStorage.setItem(sleepSyncedKey(dateStr), '1');

    await maybeSendSleepNotificationFromForeground(
      syncResult.latestSession.wakeTime,
      syncResult.latestSession,
    );

    console.log('[MorningSleepReconnect] sleep sync complete on ring reconnect', {
      totalMin: syncResult.latestSession.totalMin,
      score: syncResult.latestSession.sleepScore,
    });
  } catch (e) {
    reportError(e, { op: 'morningSleepReconnect.runSync' });
  }
}

/**
 * Call once at app startup (after ring service is initialized).
 * Safe to call multiple times — de-duplicates via the _unsub guard.
 */
export function initMorningSleepReconnectTrigger(): void {
  if (Platform.OS !== 'ios') return;
  if (_unsub) return; // Already registered

  _unsub = smartRingService.onConnectionStateChanged((state: ConnectionState) => {
    if (state !== 'connected') return;
    if (!isMorningWindow()) return;

    // Debounce — cancel any pending timer from a rapid reconnect loop
    if (_pendingTimer) clearTimeout(_pendingTimer);
    _pendingTimer = setTimeout(() => {
      _pendingTimer = null;
      runMorningSleepSync();
    }, SETTLE_DELAY_MS);
  });
}

/**
 * Tear down the listener (useful in tests or when the user logs out).
 */
export function destroyMorningSleepReconnectTrigger(): void {
  if (_pendingTimer) { clearTimeout(_pendingTimer); _pendingTimer = null; }
  if (_unsub) { _unsub(); _unsub = null; }
}
