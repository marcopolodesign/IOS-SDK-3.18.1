/**
 * V8Service - JavaScript wrapper for V8 BleSDK native module
 *
 * This service provides access to the V8 smart band SDK (Focus Band).
 * Mirrors JstyleService patterns: timeout wrappers, serialized queue, normalized types.
 *
 * BLE protocol: Service FFF0, Send FFF6, Receive FFF7
 * - Async delegate-based communication (command -> write -> delegate -> parse)
 * - Paginated data retrieval (mode 0=start, 2=continue, dataEnd flag)
 * - Sleep quality: 1=deep, 2=light, 3=REM, other=awake
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import { SportType } from '../types/sdk.types';
import { reportError } from '../utils/sentry';
import type {
  DeviceInfo,
  StepsData,
  SleepData,
  HeartRateData,
  SpO2Data,
  HRVData,
  TemperatureData,
  BatteryData,
  ConnectionState,
  BluetoothState,
  SportData,
  SleepQualityRecord,
} from '../types/sdk.types';

let V8Bridge: any = null;
let eventEmitter: NativeEventEmitter | null = null;

try {
  V8Bridge = NativeModules.V8Bridge;
  if (V8Bridge) {
    eventEmitter = new NativeEventEmitter(V8Bridge);
  }
} catch (error) {
}

/**
 * Wraps a native bridge promise with a timeout to prevent indefinite hangs.
 */
function withNativeTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`V8 ${label} timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
    ),
  ]);
}

function isBusyOrTimeout(error: any): boolean {
  const msg = error?.message || '';
  return msg.includes('BUSY') || msg.includes('busy') || msg.includes('timed out');
}

/**
 * Cancel the native bridge's pending resolver so the next call can proceed.
 * Mirrors JstyleService.cancelPendingNativeRequest().
 */
async function cancelPendingNativeRequest(label: string): Promise<void> {
  if (!V8Bridge || typeof V8Bridge.cancelPendingDataRequest !== 'function') return;
  try {
    await withNativeTimeout(
      Promise.resolve(V8Bridge.cancelPendingDataRequest()),
      1500,
      'cancelPendingDataRequest'
    );
    await new Promise(r => setTimeout(r, 150));
  } catch (e) {
  }
}

// Serialized native call queue (one-at-a-time)
let callQueue: Promise<any> = Promise.resolve();

// Cache raw sleep records so the SDK is only called once per sync cycle
let _sleepRecordsCache: any[] | null = null;

function enqueueNativeCall<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  const run = async (): Promise<T> => {
    try {
      return await withNativeTimeout(fn(), timeoutMs, label);
    } catch (error: any) {
      // On BUSY or timeout, clear the native pending resolver so subsequent calls work
      if (isBusyOrTimeout(error)) {
        await cancelPendingNativeRequest(label);
      }
      throw error;
    }
  };
  const next = callQueue.then(run, run);
  callQueue = next.catch(() => {});
  return next;
}

/**
 * Merge overlapping 4-hour sleep windows returned by getSleepDetailsAndActivityWithMode.
 *
 * The V8 band stores sleep in 240-min windows, each starting ~120 min after the previous.
 * Crucially: each window has REAL sleep data in the FIRST ~120 entries and ZERO-PADDING
 * in the second ~120 entries. Taking the overlap-skipped tail (old approach) discarded
 * all the real data and kept only zeros.
 *
 * Correct approach: take entries 0..stride from each non-last window (stride = time to
 * next window's start), then append the last window in full.
 */
function mergeV8SleepWindows(records: Array<{
  arraySleepQuality: number[];
  sleepUnitLength: number;
  startTimestamp: number;
  totalSleepTime: number;
}>): Array<{
  arraySleepQuality: number[];
  sleepUnitLength: number;
  startTimestamp: number;
  totalSleepTime: number;
}> {
  if (records.length <= 1) return records;

  const sorted = [...records].sort((a, b) => a.startTimestamp - b.startTimestamp);

  // Group into sessions: within-night windows start ~2h apart (< 3h gap).
  // Gap >= 3h = separate session (e.g. afternoon nap vs. night).
  const sessions: typeof sorted[] = [];
  let current: typeof sorted = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const gapHours = (sorted[i].startTimestamp - sorted[i - 1].startTimestamp) / 3600000;
    if (gapHours < 3) {
      current.push(sorted[i]);
    } else {
      sessions.push(current);
      current = [sorted[i]];
    }
  }
  sessions.push(current);

  return sessions.map(windows => {
    if (windows.length === 1) return windows[0];

    let mergedQuality: number[] = [];

    for (let i = 0; i < windows.length; i++) {
      const w = windows[i];
      const unitMs = (w.sleepUnitLength || 1) * 60000;

      if (i < windows.length - 1) {
        // Take entries from this window's start up to the next window's start.
        // This is exactly the unique (non-zero-padded) portion of this window.
        const strideMs = windows[i + 1].startTimestamp - w.startTimestamp;
        const entriesToTake = Math.min(
          Math.round(strideMs / unitMs),
          w.arraySleepQuality.length
        );
        mergedQuality = mergedQuality.concat(w.arraySleepQuality.slice(0, entriesToTake));
      } else {
        // Last window: take all entries (trailing zeros = awake/still in bed).
        mergedQuality = mergedQuality.concat(w.arraySleepQuality);
      }
    }

    return {
      arraySleepQuality: mergedQuality,
      sleepUnitLength: windows[0].sleepUnitLength || 1,
      startTimestamp: windows[0].startTimestamp,
      totalSleepTime: mergedQuality.length * (windows[0].sleepUnitLength || 1),
    };
  });
}

/**
 * Parse V8 date string "YYYY.MM.dd HH:mm:ss" to timestamp
 */
function parseV8Date(dateStr: string): number {
  if (!dateStr) return 0;
  // Handle both "YYYY.MM.dd HH:mm:ss" and "YYYY-MM-dd HH:mm:ss"
  const normalized = dateStr.replace(/\./g, '-');
  const ts = new Date(normalized).getTime();
  return isNaN(ts) ? 0 : ts;
}

/**
 * Map V8 activity mode enum to SportType
 */
const V8_ACTIVITY_MODE_MAP: Record<number, SportType> = {
  0: SportType.Running,
  1: SportType.Cycling,
  2: SportType.Badminton,
  3: SportType.Football,
  4: SportType.Tennis,
  5: SportType.Yoga,
  6: SportType.Breath,
  7: SportType.Dance,
  8: SportType.Basketball,
  9: SportType.Walking,
  10: SportType.Workout,
  11: SportType.Cricket,
  12: SportType.Hiking,
  13: SportType.Aerobics,
  14: SportType.PingPong,
  15: SportType.RopeJump,
  16: SportType.SitUps,
  17: SportType.Volleyball,
};

function mapV8ActivityMode(mode: number): SportType {
  return V8_ACTIVITY_MODE_MAP[mode] ?? SportType.Other;
}

const V8Service = {
  isAvailable(): boolean {
    return Platform.OS === 'ios' && V8Bridge != null;
  },

  // ========== Connection ==========

  async scan(duration: number = 10): Promise<void> {
    if (!V8Bridge) throw new Error('V8Bridge not available');
    await V8Bridge.startScan();
    setTimeout(() => V8Bridge.stopScan().catch((e: any) => reportError(e, { op: 'v8.stopScan' }, 'warning')), duration * 1000);
  },

  stopScan(): void {
    V8Bridge?.stopScan().catch((e: any) => reportError(e, { op: 'v8.stopScan' }, 'warning'));
  },

  async connect(deviceId: string): Promise<{ success: boolean; message: string }> {
    if (!V8Bridge) throw new Error('V8Bridge not available');
    return await withNativeTimeout(
      V8Bridge.connectToDevice(deviceId),
      15000,
      'connect'
    );
  },

  disconnect(): void {
    _sleepRecordsCache = null;
    V8Bridge?.disconnect().catch((e: any) => reportError(e, { op: 'v8.disconnect' }, 'warning'));
  },

  async isConnected(): Promise<{
    connected: boolean;
    state: string;
    deviceName: string | null;
    deviceId: string | null;
  }> {
    if (!V8Bridge) return { connected: false, state: 'unavailable', deviceName: null, deviceId: null };
    return await V8Bridge.isConnected();
  },

  async hasPairedDevice(): Promise<{ hasPairedDevice: boolean; deviceId?: string; deviceName?: string }> {
    if (!V8Bridge) return { hasPairedDevice: false };
    return await V8Bridge.hasPairedDevice();
  },

  async getPairedDevice(): Promise<{ hasPairedDevice: boolean; device: DeviceInfo | null }> {
    if (!V8Bridge) return { hasPairedDevice: false, device: null };
    const result = await V8Bridge.getPairedDevice();
    if (result.hasPairedDevice && result.device && result.device !== null) {
      return { hasPairedDevice: true, device: result.device as DeviceInfo };
    }
    return { hasPairedDevice: false, device: null };
  },

  async forgetPairedDevice(): Promise<{ success: boolean; message: string }> {
    if (!V8Bridge) return { success: false, message: 'V8Bridge not available' };
    return await V8Bridge.forgetPairedDevice();
  },

  async autoReconnect(): Promise<{ success: boolean; message: string; deviceId?: string; deviceName?: string }> {
    if (!V8Bridge) return { success: false, message: 'V8Bridge not available' };
    return await withNativeTimeout(V8Bridge.autoReconnect(), 15000, 'autoReconnect');
  },

  // ========== Data Retrieval ==========

  async getBattery(): Promise<BatteryData> {
    return enqueueNativeCall(async () => {
      const result = await V8Bridge.getBatteryLevel();
      return {
        battery: Number(result.batteryLevel) || 0,
        isCharging: result.isCharging === true,
      };
    }, 5000, 'getBattery');
  },

  async getVersion(): Promise<{ softwareVersion: string }> {
    return enqueueNativeCall(async () => {
      const result = await V8Bridge.getFirmwareVersion();
      return { softwareVersion: result.deviceVersion || 'unknown' };
    }, 5000, 'getVersion');
  },

  async syncTime(): Promise<{ success: boolean }> {
    return enqueueNativeCall(async () => {
      return await V8Bridge.syncTime();
    }, 5000, 'syncTime');
  },

  async getSteps(): Promise<StepsData> {
    return enqueueNativeCall(async () => {
      const result = await V8Bridge.getStepsData();
      const items: any[] = result.data || [];
      // Get today's data (first item is most recent)
      const today = items[0];
      if (!today) return { steps: 0, distance: 0, calories: 0, time: 0 };
      return {
        steps: Number(today.step) || 0,
        distance: (Number(today.distance) || 0) * 1000, // km -> meters
        calories: Number(today.calories) || 0,
        time: (Number(today.exerciseMinutes) || 0) * 60, // minutes -> seconds
      };
    }, 5000, 'getSteps');
  },

  async getSleepByDay(dayIndex: number = 0): Promise<SleepData> {
    return enqueueNativeCall(async () => {
      // Fetch once and cache — use getSleepWithActivity (type 81), merge overlapping windows
      if (!_sleepRecordsCache) {
        const result = await V8Bridge.getSleepWithActivity();
        const raw = (result.data || []).map((session: any) => ({
          arraySleepQuality: session.arraySleepQuality || [],
          sleepUnitLength: Number(session.sleepUnitLength) || 1,
          totalSleepTime: Number(session.totalSleepTime) || 0,
          startTimestamp: parseV8Date(session.startTime_SleepData),
        }));
        _sleepRecordsCache = mergeV8SleepWindows(raw);
      }

      if (_sleepRecordsCache.length === 0) {
        return { deep: 0, light: 0, awake: 0, rem: 0, detail: '' };
      }

      // Target calendar date using local time (mirrors JstyleService logic)
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - dayIndex);
      const localDateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;

      // Filter sessions that start on the target date
      const records = _sleepRecordsCache.filter(r => {
        if (!r.startTimestamp) return dayIndex === 0;
        const d = new Date(r.startTimestamp);
        const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return s === localDateStr;
      });

      if (records.length === 0) {
        return { deep: 0, light: 0, awake: 0, rem: 0, detail: '' };
      }

      // Aggregate all same-day sessions — V8 quality: 1=deep, 2=light, 3=REM, other=awake
      let deep = 0, light = 0, rem = 0, awake = 0;
      let earliestStart: number | undefined;
      let latestEnd: number | undefined;
      const rawQualityRecords: SleepQualityRecord[] = [];

      for (const r of records) {
        const unitLength = r.sleepUnitLength;
        for (const q of r.arraySleepQuality as number[]) {
          switch (q) {
            case 1: deep += unitLength; break;
            case 2: light += unitLength; break;
            case 3: rem += unitLength; break;
            default: awake += unitLength; break;
          }
        }

        if (r.startTimestamp > 0) {
          const durationMs = r.totalSleepTime * 60000;
          const endMs = r.startTimestamp + durationMs;
          earliestStart = earliestStart !== undefined ? Math.min(earliestStart, r.startTimestamp) : r.startTimestamp;
          latestEnd = latestEnd !== undefined ? Math.max(latestEnd, endMs) : endMs;
        }

        rawQualityRecords.push({
          arraySleepQuality: r.arraySleepQuality,
          sleepUnitLength: unitLength,
          startTimestamp: r.startTimestamp,
        });
      }

      return {
        deep,
        light,
        awake,
        rem,
        detail: `${deep}m deep, ${light}m light, ${rem}m REM, ${awake}m awake`,
        startTime: earliestStart || undefined,
        endTime: latestEnd || undefined,
        rawQualityRecords,
      };
    }, 30000, 'getSleepData');
  },

  /**
   * Returns ALL raw sleep sessions in the format deriveFromRaw() expects:
   * { arraySleepQuality, sleepUnitLength, startTimestamp, totalSleepTime }
   */
  async getSleepDataRaw(): Promise<{ records: any[]; timestamp?: number }> {
    return enqueueNativeCall(async () => {
      if (!_sleepRecordsCache) {
        // Use getSleepWithActivity (type 81) — returns all 4-hour overlapping windows
        const result = await V8Bridge.getSleepWithActivity();
        const rawRecords = (result.data || []).map((session: any) => ({
          arraySleepQuality: session.arraySleepQuality || [],
          sleepUnitLength: Number(session.sleepUnitLength) || 1,
          startTimestamp: parseV8Date(session.startTime_SleepData),
          totalSleepTime: Number(session.totalSleepTime) || 0,
        }));
        _sleepRecordsCache = mergeV8SleepWindows(rawRecords);
      }
      return { records: _sleepRecordsCache, timestamp: Date.now() };
    }, 30000, 'getSleepDataRaw');
  },

  clearSleepCache(): void {
    _sleepRecordsCache = null;
  },

  async getSleepWithActivityRaw(): Promise<any[]> {
    return enqueueNativeCall(async () => {
      const result = await V8Bridge.getSleepWithActivity();
      return result?.data ?? [];
    }, 30000, 'getSleepWithActivityRaw');
  },

  async getPPIDataRaw(): Promise<any[]> {
    return enqueueNativeCall(async () => {
      const result = await V8Bridge.getPPIData();
      return result?.data ?? [];
    }, 20000, 'getPPIDataRaw');
  },

  async getContinuousHeartRate(): Promise<HeartRateData[]> {
    return enqueueNativeCall(async () => {
      const result = await V8Bridge.getContinuousHR();
      const items: any[] = result.data || [];
      const records: HeartRateData[] = [];
      for (const item of items) {
        const baseTimestamp = parseV8Date(item.date);
        const hrArray: number[] = item.arrayHR || [];
        for (let i = 0; i < hrArray.length; i++) {
          if (hrArray[i] > 0) {
            records.push({
              heartRate: hrArray[i],
              timestamp: baseTimestamp > 0 ? baseTimestamp + i * 60000 : undefined,
            });
          }
        }
      }
      return records;
    }, 30000, 'getContinuousHR');
  },

  async getHRVDataNormalized(): Promise<HRVData[]> {
    return enqueueNativeCall(async () => {
      const result = await V8Bridge.getHRVData();
      const items: any[] = result.data || [];
      return items.map((item: any) => ({
        sdnn: Number(item.hrv) || undefined,
        heartRate: Number(item.heartRate) || undefined,
        stress: Number(item.stress) || undefined,
        timestamp: parseV8Date(item.date) || undefined,
      }));
    }, 10000, 'getHRVData');
  },

  async getSpO2DataNormalized(): Promise<SpO2Data[]> {
    return enqueueNativeCall(async () => {
      const result = await V8Bridge.getAutoSpO2();
      const items: any[] = result.data || [];
      return items.map((item: any) => ({
        spo2: Number(item.automaticSpo2Data) || 0,
        timestamp: parseV8Date(item.date) || undefined,
      }));
    }, 10000, 'getAutoSpO2');
  },

  async getTemperatureDataNormalized(): Promise<TemperatureData[]> {
    return enqueueNativeCall(async () => {
      const result = await V8Bridge.getTemperature();
      const items: any[] = result.data || [];
      return items.map((item: any) => ({
        temperature: Number(item.temperature) || 0,
        timestamp: parseV8Date(item.date) || undefined,
      }));
    }, 10000, 'getTemperature');
  },

  async getSportData(): Promise<SportData[]> {
    return enqueueNativeCall(async () => {
      const result = await V8Bridge.getActivityModeData();
      const items: any[] = result.data || [];
      const activityMode = Number(result.activityMode) || -1;
      return items.map((item: any) => {
        const startTime = parseV8Date(item.date);
        const durationSec = Number(item.activeMinutes) || 0; // actually seconds despite name
        return {
          type: mapV8ActivityMode(activityMode),
          startTime,
          endTime: startTime + durationSec * 1000,
          duration: durationSec,
          steps: Number(item.step) || 0,
          distance: (Number(item.distance) || 0) * 1000, // km -> m
          calories: Number(item.calories) || 0,
          heartRateAvg: Number(item.heartRate) || undefined,
        };
      });
    }, 10000, 'getActivityModeData');
  },

  async getGoal(): Promise<{ goal: number }> {
    return enqueueNativeCall(async () => {
      const result = await V8Bridge.getStepGoal();
      return { goal: Number(result.goal) || 8000 };
    }, 5000, 'getStepGoal');
  },

  async setGoal(goal: number): Promise<{ success: boolean }> {
    return enqueueNativeCall(async () => {
      return await V8Bridge.setStepGoal(goal);
    }, 5000, 'setStepGoal');
  },

  async setProfile(profile: { gender: string; age: number; height: number; weight: number }): Promise<{ success: boolean }> {
    if (!V8Bridge) return { success: false };
    return await V8Bridge.setUserInfo({
      gender: profile.gender === 'male' ? 0 : 1,
      age: profile.age,
      height: profile.height,
      weight: profile.weight,
    });
  },

  async factoryReset(): Promise<{ success: boolean }> {
    if (!V8Bridge) return { success: false };
    return await V8Bridge.factoryReset();
  },

  async cancelPendingDataRequest(): Promise<void> {
    if (V8Bridge) await V8Bridge.cancelPendingDataRequest().catch((e: any) => reportError(e, { op: 'v8.cancelPendingDataRequest' }, 'warning'));
  },

  // ========== Real-Time Data Stream ==========

  async startRealTimeData(): Promise<{ success: boolean }> {
    if (!V8Bridge) return { success: false };
    return await V8Bridge.startRealTimeData();
  },

  async stopRealTimeData(): Promise<{ success: boolean }> {
    if (!V8Bridge) return { success: false };
    return await V8Bridge.stopRealTimeData();
  },

  // ========== Manual Measurement ==========

  async startHeartRateMeasuring(): Promise<{ success: boolean }> {
    if (!V8Bridge) return { success: false };
    // dataType 2 = heartRate, measurementTime 30s
    return await V8Bridge.startManualMeasurement(2, 30);
  },

  async startSpO2Measuring(): Promise<{ success: boolean }> {
    if (!V8Bridge) return { success: false };
    // dataType 3 = spo2, measurementTime 30s
    return await V8Bridge.startManualMeasurement(3, 30);
  },

  async stopSpO2Measuring(): Promise<{ success: boolean }> {
    if (!V8Bridge) return { success: false };
    return await V8Bridge.stopManualMeasurement(3);
  },

  // ========== Event Listeners ==========

  onConnectionStateChanged(callback: (state: ConnectionState) => void): () => void {
    if (!eventEmitter) return () => {};
    const sub = eventEmitter.addListener('V8ConnectionStateChanged', (event: any) => {
      callback(event.state as ConnectionState);
    });
    return () => sub.remove();
  },

  onBluetoothStateChanged(callback: (state: BluetoothState) => void): () => void {
    if (!eventEmitter) return () => {};
    const sub = eventEmitter.addListener('V8BluetoothStateChanged', (event: any) => {
      callback(event.state as BluetoothState);
    });
    return () => sub.remove();
  },

  onDeviceDiscovered(callback: (device: DeviceInfo) => void): () => void {
    if (!eventEmitter) return () => {};
    const sub = eventEmitter.addListener('V8DeviceDiscovered', (event: any) => {
      const rawName: string = event.name || event.localName || '';
      const isRing = /x6/i.test(rawName);
      callback({
        id: event.id,
        mac: event.mac || event.id,
        name: rawName || 'V8 Band',
        localName: event.localName,
        rssi: event.rssi || -50,
        sdkType: 'v8',
        deviceType: isRing ? 'ring' : 'band',
      });
    });
    return () => sub.remove();
  },

  onBatteryChanged(callback: (data: BatteryData) => void): () => void {
    if (!eventEmitter) return () => {};
    const sub = eventEmitter.addListener('V8BatteryData', (event: any) => {
      callback({
        battery: Number(event.batteryLevel) || 0,
        isCharging: event.isCharging === true,
      });
    });
    return () => sub.remove();
  },

  onHeartRateData(callback: (data: HeartRateData) => void): () => void {
    if (!eventEmitter) return () => {};
    const sub = eventEmitter.addListener('V8MeasurementResult', (event: any) => {
      if (event.type === 'heartRate' && Number(event.heartRate) > 0) {
        callback({
          heartRate: Number(event.heartRate),
          timestamp: Date.now(),
        });
      }
    });
    return () => sub.remove();
  },

  onSpO2Received(callback: (data: SpO2Data) => void): () => void {
    if (!eventEmitter) return () => {};
    const sub = eventEmitter.addListener('V8MeasurementResult', (event: any) => {
      if (event.type === 'spo2' && Number(event.spo2) > 0) {
        callback({
          spo2: Number(event.spo2),
          timestamp: Date.now(),
        });
      }
    });
    return () => sub.remove();
  },

  onRealTimeData(callback: (data: any) => void): () => void {
    if (!eventEmitter) return () => {};
    const sub = eventEmitter.addListener('V8RealTimeData', callback);
    return () => sub.remove();
  },

  onError(callback: (error: any) => void): () => void {
    if (!eventEmitter) return () => {};
    const sub = eventEmitter.addListener('V8Error', callback);
    return () => sub.remove();
  },
};

export default V8Service;
