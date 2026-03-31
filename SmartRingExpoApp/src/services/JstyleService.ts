/**
 * JstyleService - JavaScript wrapper for Jstyle X3 BleSDK native module
 *
 * This service provides access to the Jstyle smart ring SDK (Focus X3).
 * It handles connection, data retrieval, and real-time monitoring.
 *
 * BLE protocol: Service FFF0, Send FFF6, Receive FFF7
 * - Async delegate-based communication (command → write → delegate → parse)
 * - Paginated data retrieval (mode 0=start, 2=continue, dataEnd flag)
 * - Gender: 0=female, 1=male
 * - Distance returned in km (multiplied to meters for normalization)
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import { SportType } from '../types/sdk.types';
import type {
  DeviceInfo,
  StepsData,
  SleepData,
  HeartRateData,
  BloodPressureData,
  SpO2Data,
  HRVData,
  TemperatureData,
  BatteryData,
  ConnectionState,
  BluetoothState,
  SportData,
  X3ActivitySession,
  X3SleepBreathingMetrics,
} from '../types/sdk.types';

// Safely get native module
let JstyleBridge: any = null;
let eventEmitter: NativeEventEmitter | null = null;

try {
  JstyleBridge = NativeModules.JstyleBridge;
  if (JstyleBridge) {
    eventEmitter = new NativeEventEmitter(JstyleBridge);
  }
} catch (error) {
  console.log('JstyleBridge native module not available');
}

/**
 * Wraps a native bridge promise with a timeout to prevent indefinite hangs.
 *
 * Native bridge calls can hang indefinitely if the iOS SDK fails to invoke
 * resolve/reject callbacks. This wrapper ensures promises always settle within
 * the specified timeout, allowing Promise.allSettled() to complete and the UI
 * to update even if some native calls fail.
 *
 * @param promise - The native bridge promise to wrap
 * @param timeoutMs - Timeout in milliseconds (default: 5000ms)
 * @param operationName - Name of the operation for error messages
 * @returns Promise that resolves/rejects within the timeout period
 */
function withNativeTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 5000,
  operationName: string = 'native call'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${operationName} timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
    ),
  ]);
}

class JstyleService {
  private nativeCallQueue: Promise<void> = Promise.resolve();
  private readonly busyRetryableOperations = new Set<string>([
    'getDeviceTime',
    'getStepGoal',
    'getBatteryLevel',
    'getFirmwareVersion',
    'getStepsData',
    'getSleepData',
    'getHeartRateData',
    'getHRVData',
    'getSpO2Data',
    'getTemperatureData',
    'getActivityModeData',
    'getSleepHRVData',
    'getOSAData',
    'getEOVData',
    'getPPIData',
    'getMacAddress',
  ]);
  private readonly pendingResolverOperations = new Set<string>([
    'syncTime',
    'getDeviceTime',
    'getStepGoal',
    'setStepGoal',
    'getBatteryLevel',
    'getFirmwareVersion',
    'getStepsData',
    'getSleepData',
    'getHeartRateData',
    'getHRVData',
    'getSpO2Data',
    'getTemperatureData',
    'getActivityModeData',
    'getSleepHRVData',
    'getOSAData',
    'getEOVData',
    'getPPIData',
    'getMacAddress',
    'factoryReset',
  ]);

  private normalizeNativeError(operationName: string, error: any): Error {
    const code = error?.code;
    const message =
      typeof error?.message === 'string'
        ? error.message
        : typeof error === 'string'
        ? error
        : `${operationName} failed`;

    if (code === 'BUSY' || message.includes('BUSY')) {
      return new Error(`BUSY: ${message}`);
    }
    if (code === 'NOT_CONNECTED' || message.includes('No device connected')) {
      return new Error(`NOT_CONNECTED: ${message}`);
    }
    return error instanceof Error ? error : new Error(message);
  }

  private isBusyError(error: Error): boolean {
    return error.message.includes('BUSY');
  }

  private isTimeoutError(error: Error): boolean {
    return error.message.includes('timed out');
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  private async cancelPendingNativeRequest(operationName: string, reason: string): Promise<void> {
    if (!JstyleBridge || typeof JstyleBridge.cancelPendingDataRequest !== 'function') {
      return;
    }

    try {
      await withNativeTimeout(
        Promise.resolve(JstyleBridge.cancelPendingDataRequest()),
        1500,
        'cancelPendingDataRequest'
      );
      await this.sleep(150);
    } catch (error) {
      console.log(`[JstyleService] cancelPendingDataRequest failed after ${operationName} ${reason}:`, error);
    }
  }

  private async enqueueNativeCall<T>(
    operationName: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const run = async () => {
      const maxBusyRetries = this.busyRetryableOperations.has(operationName) ? 1 : 0;
      let attempt = 0;

      while (true) {
        try {
          return await operation();
        } catch (rawError: any) {
          const normalized = this.normalizeNativeError(operationName, rawError);
          const isBusy = this.isBusyError(normalized);
          const isTimeout = this.isTimeoutError(normalized);
          const canCancelPending = this.pendingResolverOperations.has(operationName);

          if (canCancelPending && (isBusy || isTimeout)) {
            await this.cancelPendingNativeRequest(
              operationName,
              isTimeout ? 'timeout' : 'busy'
            );
          }

          if (isBusy && attempt < maxBusyRetries) {
            attempt += 1;
            await this.sleep(250 * attempt);
            continue;
          }

          throw normalized;
        }
      }
    };

    const resultPromise = this.nativeCallQueue.then(run, run);
    this.nativeCallQueue = resultPromise.then(
      () => undefined,
      () => undefined
    );
    return resultPromise;
  }

  // Parse SDK date string ("YYYY.MM.DD HH:mm:ss" or "YYYY.MM.DD") to local timestamp (ms)
  private parseX3DateTime(value?: string): number | undefined {
    if (!value || typeof value !== 'string') return undefined;
    const [datePart, timePart] = value.trim().split(/\s+/);
    if (!datePart) return undefined;
    const [y, m, d] = datePart.split('.').map(Number);
    if ([y, m, d].some(n => Number.isNaN(n))) return undefined;

    const [hh, mm, ss] = (timePart || '00:00:00').split(':').map(Number);
    if ([hh, mm, ss].some(n => Number.isNaN(n))) return undefined;

    const ts = new Date(y, m - 1, d, hh, mm, ss).getTime();
    return Number.isFinite(ts) && ts > 0 ? ts : undefined;
  }

  private pickNumber(record: Record<string, any>, keys: string[]): number | undefined {
    for (const key of keys) {
      const value = Number(record?.[key]);
      if (Number.isFinite(value)) return value;
    }
    return undefined;
  }

  private toSportType(value: number): SportType {
    switch (value) {
      case 0: return SportType.Running;
      case 1: return SportType.Cycling;
      case 9: return SportType.Walking;
      case 10: return SportType.Gym;
      case 12: return SportType.Hiking;
      case 5: return SportType.Yoga;
      default: return SportType.Other;
    }
  }

  /**
   * Check if Jstyle SDK is available
   */
  isAvailable(): boolean {
    return JstyleBridge !== null && Platform.OS === 'ios';
  }

  // ========== Initialization ==========

  async initialize(): Promise<{ success: boolean; message: string }> {
    if (!JstyleBridge) throw new Error('Jstyle SDK not available');
    return await JstyleBridge.initialize();
  }

  // ========== Connection Methods ==========

  async scan(duration: number = 30): Promise<{ success: boolean; message: string }> {
    if (!JstyleBridge) throw new Error('Jstyle SDK not available');
    return await JstyleBridge.startScan();
  }

  async stopScan(): Promise<{ success: boolean; message: string }> {
    if (!JstyleBridge) throw new Error('Jstyle SDK not available');
    return await JstyleBridge.stopScan();
  }

  async getDiscoveredDevices(): Promise<DeviceInfo[]> {
    // Devices are discovered via onDeviceFound events, not stored in bridge
    return [];
  }

  async connect(peripheralId: string): Promise<{ success: boolean; message: string }> {
    if (!JstyleBridge) throw new Error('Jstyle SDK not available');
    this._sleepRecordsCache = null; // clear cache so new connection fetches fresh sleep data

    // Race the native promise against the connection event.
    // When iOS CoreBluetooth skips the didConnectPeripheral callback (e.g. peripheral
    // already connected from background autoReconnect), pendingConnectResolver is never
    // called and the promise hangs forever. The event listener catches that case.
    let unsub: (() => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let settled = false;

    try {
      return await Promise.race([
        JstyleBridge.connectToDevice(peripheralId),
        new Promise<{ success: boolean; message: string }>((resolve, reject) => {
          timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            reject(new Error('Jstyle connect timed out after 15000ms'));
          }, 15000);

          unsub = this.onConnectionStateChanged((state) => {
            if (settled) return;
            if (state === 'connected') {
              settled = true;
              resolve({ success: true, message: 'Connected' });
            } else if (state === 'disconnected') {
              settled = true;
              reject(new Error('Connection failed - device disconnected'));
            }
          });
        }),
      ]);
    } finally {
      // Always clean up timer and listener regardless of which promise won
      if (timer !== null) clearTimeout(timer);
      unsub?.();
    }
  }

  async disconnect(): Promise<{ success: boolean; message: string }> {
    if (!JstyleBridge) throw new Error('Jstyle SDK not available');
    this._sleepRecordsCache = null; // clear cache on disconnect so next connect gets fresh data
    return await JstyleBridge.disconnect();
  }

  async isConnected(): Promise<{
    connected: boolean;
    state: string;
    deviceName: string | null;
    deviceId: string | null;
  }> {
    if (!JstyleBridge) throw new Error('Jstyle SDK not available');
    const devices = await JstyleBridge.getConnectedDevices();
    if (devices && devices.length > 0) {
      const device = devices[0];
      return {
        connected: true,
        state: 'connected',
        deviceName: device.name,
        deviceId: device.id,
      };
    }
    return {
      connected: false,
      state: 'disconnected',
      deviceName: null,
      deviceId: null,
    };
  }

  // ========== Paired Device Management ==========

  async hasPairedDevice(): Promise<{ hasPairedDevice: boolean; deviceId?: string; deviceName?: string }> {
    if (!JstyleBridge) throw new Error('Jstyle SDK not available');
    return await JstyleBridge.hasPairedDevice();
  }

  async getPairedDevice(): Promise<{
    hasPairedDevice: boolean;
    device: DeviceInfo | null;
  }> {
    if (!JstyleBridge) throw new Error('Jstyle SDK not available');
    const devices = await JstyleBridge.getConnectedDevices();
    if (devices && devices.length > 0) {
      return {
        hasPairedDevice: true,
        device: devices[0],
      };
    }
    return {
      hasPairedDevice: false,
      device: null,
    };
  }

  async autoReconnect(): Promise<{ success: boolean; message: string; deviceId?: string; deviceName?: string }> {
    if (!JstyleBridge) throw new Error('Jstyle SDK not available');
    return await withNativeTimeout(JstyleBridge.autoReconnect(), 12000, 'autoReconnect')
      .catch(() => ({ success: false, message: 'autoReconnect timed out' }));
  }

  async forgetPairedDevice(): Promise<{ success: boolean; message: string }> {
    if (!JstyleBridge) throw new Error('Jstyle SDK not available');
    return await JstyleBridge.forgetPairedDevice();
  }

  // ========== Time & Settings ==========

  async setTime(): Promise<{ success: boolean }> {
    if (!JstyleBridge) throw new Error('Jstyle SDK not available');
    return await this.enqueueNativeCall<{ success: boolean }>('syncTime', async () =>
      withNativeTimeout(JstyleBridge.syncTime(), 5000, 'syncTime')
    );
  }

  async getDeviceTime(): Promise<{ time: string }> {
    if (!JstyleBridge) throw new Error('Jstyle SDK not available');
    return await this.enqueueNativeCall<{ time: string }>('getDeviceTime', async () =>
      withNativeTimeout(JstyleBridge.getDeviceTime(), 5000, 'getDeviceTime')
    );
  }

  async setProfile(profile: {
    gender: 'male' | 'female';
    age: number;
    height: number;
    weight: number;
    stride?: number;
  }): Promise<{ success: boolean }> {
    if (!JstyleBridge) throw new Error('Jstyle SDK not available');
    
    // Convert gender to numeric (0=male, 1=female for JS layer)
    const userInfo = {
      gender: profile.gender === 'male' ? 0 : 1,
      age: profile.age,
      height: profile.height,
      weight: profile.weight,
      stride: profile.stride || 70,
    };
    
    return await JstyleBridge.setUserInfo(userInfo);
  }

  async getProfile(): Promise<{
    gender: 'male' | 'female';
    age: number;
    height: number;
    weight: number;
    stride: number;
  }> {
    // X3 SDK doesn't support reading profile back
    throw new Error('Get profile not supported on X3');
  }

  async getGoal(): Promise<{ goal: number }> {
    if (!JstyleBridge) throw new Error('Jstyle SDK not available');
    return await this.enqueueNativeCall<{ goal: number }>('getStepGoal', async () =>
      withNativeTimeout(JstyleBridge.getStepGoal(), 5000, 'getStepGoal')
    );
  }

  async setGoal(goal: number): Promise<{ success: boolean }> {
    if (!JstyleBridge) throw new Error('Jstyle SDK not available');
    return await this.enqueueNativeCall<{ success: boolean }>('setStepGoal', async () =>
      withNativeTimeout(JstyleBridge.setStepGoal(goal), 5000, 'setStepGoal')
    );
  }

  // ========== Battery & Firmware ==========

  async getBattery(): Promise<BatteryData> {
    if (!JstyleBridge) throw new Error('Jstyle SDK not available');
    const result: any = await this.enqueueNativeCall<any>('getBatteryLevel', async () =>
      withNativeTimeout(JstyleBridge.getBatteryLevel(), 5000, 'getBatteryLevel')
    );
    const batteryValue = Number(result?.battery ?? result?.batteryLevel ?? 0);
    const isCharging = Boolean(result?.isCharging ?? result?.charging ?? false);
    return { battery: batteryValue, isCharging };
  }

  async getFirmwareInfo(): Promise<{ hardwareVersion: string; softwareVersion: string }> {
    if (!JstyleBridge) throw new Error('Jstyle SDK not available');
    const result: any = await this.enqueueNativeCall<any>('getFirmwareVersion', async () =>
      withNativeTimeout(JstyleBridge.getFirmwareVersion(), 5000, 'getFirmwareVersion')
    );
    return {
      hardwareVersion: result.version || 'Unknown',
      softwareVersion: result.version || 'Unknown',
    };
  }

  async getVersion(): Promise<{ hardwareVersion: string; softwareVersion: string }> {
    return await this.getFirmwareInfo();
  }

  // ========== Steps ==========

  async getSteps(): Promise<StepsData> {
    if (!JstyleBridge) throw new Error('Jstyle SDK not available');
    const result: any = await this.enqueueNativeCall<any>('getStepsData', async () =>
      withNativeTimeout(JstyleBridge.getStepsData(), 5000, 'getStepsData')
    );

    // X3 returns paginated records; each record has an arrayTotalActivityData[] with daily entries
    const records: any[] = result.data || [];
    if (records.length === 0) {
      return { steps: 0, distance: 0, calories: 0, time: 0 };
    }

    // Flatten all daily activity entries from all paginated records
    const allEntries: any[] = [];
    for (const rec of records) {
      const arr: any[] = Array.isArray(rec.arrayTotalActivityData) ? rec.arrayTotalActivityData : [];
      allEntries.push(...arr);
    }

    if (allEntries.length === 0) {
      return { steps: 0, distance: 0, calories: 0, time: 0 };
    }

    // Find today's entry by date field ("YYYY.MM.DD"), fallback to first
    const now = new Date();
    const todayStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
    const todayEntry = allEntries.find(e => e.date === todayStr) || allEntries[0];

    return {
      steps: Number(todayEntry?.step ?? todayEntry?.steps ?? 0),
      distance: Number(todayEntry?.distance ?? 0) * 1000, // SDK returns km, convert to meters
      calories: Number(todayEntry?.calories ?? 0),
      time: Number(todayEntry?.exerciseMinutes ?? todayEntry?.activeMinutes ?? 0) * 60,
    };
  }

  async getCurrentSteps(): Promise<StepsData> {
    return await this.getSteps();
  }

  // ========== Sleep ==========

  // Cache for all sleep records — populated once per app session to avoid re-hitting native SDK
  private _sleepRecordsCache: any[] | null = null;

  // Parse SDK date string ("YYYY.MM.DD HH:mm:ss") to timestamp (ms)
  private parseSleepStart(value?: string): number | undefined {
    return this.parseX3DateTime(value);
  }

  async getSleepData(): Promise<{
    records: any[];
    timestamp: number;
  }> {
    if (!JstyleBridge) throw new Error('Jstyle SDK not available');
    const result: any = await this.enqueueNativeCall<any>('getSleepData', async () =>
      withNativeTimeout(
        JstyleBridge.getSleepData(),
        10000, // Sleep data can take longer due to pagination
        'getSleepData'
      )
    );
    return {
      records: result.data || [],
      timestamp: Date.now(),
    };
  }

  async getSleepByDay(dayIndex: number = 0): Promise<SleepData> {
    // Fetch all records once and cache — the SDK returns 0 records on subsequent calls
    if (!this._sleepRecordsCache) {
      const result = await this.getSleepData();
      this._sleepRecordsCache = result.records || [];
      const allDates = this._sleepRecordsCache.map(r => {
        const ms = r.startTimestamp || r.startTime || this.parseSleepStart(r.startTime_SleepData);
        return ms ? new Date(ms).toISOString().split('T')[0] : '(no-ts)';
      });
    }
    const allRecords = this._sleepRecordsCache;

    if (allRecords.length === 0) {
      return { deep: 0, light: 0, awake: 0, rem: 0, detail: '' };
    }

    // Filter records to the target date (today - dayIndex days)
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - dayIndex);
    // Use local date string (YYYY-MM-DD) to avoid UTC/local mismatch in non-UTC timezones
    const localDateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;

    const records = allRecords.filter(record => {
      const startMs = (() => {
        const candidates = [
          record.startTimestamp,
          record.startTime,
          this.parseSleepStart(record.startTime_SleepData),
        ].filter((v: any) => typeof v === 'number' && Number.isFinite(v) && v > 0);
        return candidates.length ? candidates[0] : undefined;
      })();
      if (typeof startMs !== 'number') return dayIndex === 0; // no timestamp → only include for today
      const d = new Date(startMs);
      const recordDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return recordDateStr === localDateStr;
    });

    if (records.length === 0) {
      return { deep: 0, light: 0, awake: 0, rem: 0, detail: '' };
    }

    // X3 SDK SLEEPTYPE (from Ble SDK Demo docs):
    // 1 = Deep, 2 = Light, 3 = REM, other = Awake/Unwear
    let deepMinutes = 0;
    let lightMinutes = 0;
    let awakeMinutes = 0;
    let remMinutes = 0;

    let earliestStart: number | undefined;
    let latestEnd: number | undefined;

    // Build raw quality records for hypnogram segment generation
    const rawQualityRecords: SleepData['rawQualityRecords'] = [];

    for (const record of records) {
      const qualityArray: number[] = record.arraySleepQuality || [];
      const unitLength = Number(record.sleepUnitLength || 1); // minutes per unit

      const startMs = (() => {
        const candidates = [
          record.startTimestamp,
          record.startTime,
          this.parseSleepStart(record.startTime_SleepData),
        ].filter((v: any) => typeof v === 'number' && Number.isFinite(v) && v > 0);
        return candidates.length ? candidates[0] : undefined;
      })();

      if (typeof startMs === 'number') {
        const durationMinutes = Number(record.totalSleepTime) || (qualityArray.length * unitLength);
        const durationMs = Math.max(0, durationMinutes) * 60 * 1000;
        const endMs = startMs + durationMs;
        earliestStart = earliestStart ? Math.min(earliestStart, startMs) : startMs;
        latestEnd = latestEnd ? Math.max(latestEnd, endMs) : endMs;
      }

      rawQualityRecords!.push({
        arraySleepQuality: qualityArray,
        sleepUnitLength: unitLength,
        startTimestamp: startMs,
      });

      for (const quality of qualityArray) {
        switch (quality) {
          case 1:
            deepMinutes += unitLength;
            break;
          case 2:
            lightMinutes += unitLength;
            break;
          case 3:
            remMinutes += unitLength;
            break;
          default:
            // Includes 0/4/5 → treat as awake / not wearing
            awakeMinutes += unitLength;
            break;
        }
      }
    }

    return {
      deep: deepMinutes,
      light: lightMinutes,
      awake: awakeMinutes,
      rem: remMinutes,
      detail: `Deep: ${deepMinutes}min, Light: ${lightMinutes}min, REM: ${remMinutes}min, Awake: ${awakeMinutes}min`,
      rawQualityRecords,
      startTime: earliestStart,
      endTime: latestEnd,
    };
  }

  // ========== Heart Rate ==========

  async startHeartRateMeasuring(): Promise<{ success: boolean; message: string }> {
    if (!JstyleBridge) throw new Error('Jstyle SDK not available');
    return await this.enqueueNativeCall<{ success: boolean; message: string }>('startHeartRateMeasurement', async () =>
      withNativeTimeout(JstyleBridge.startHeartRateMeasurement(), 5000, 'startHeartRateMeasurement')
    );
  }

  async stopHeartRateMeasuring(): Promise<{ success: boolean; message: string }> {
    if (!JstyleBridge) throw new Error('Jstyle SDK not available');
    return await this.enqueueNativeCall<{ success: boolean; message: string }>('stopMeasurement', async () =>
      withNativeTimeout(JstyleBridge.stopMeasurement(), 5000, 'stopMeasurement')
    );
  }

  async getContinuousHeartRate(): Promise<{ records: any[]; timestamp: number }> {
    if (!JstyleBridge) throw new Error('Jstyle SDK not available');
    const result: any = await this.enqueueNativeCall<any>('getHeartRateData', async () =>
      withNativeTimeout(JstyleBridge.getHeartRateData(), 10000, 'getHeartRateData')
    );
    const requestTimestamp = Date.now();
    const normalizedRecords: any[] = [];

    for (const rec of (result.data || [])) {
      const existingDynamic = Array.isArray(rec?.arrayDynamicHR)
        ? rec.arrayDynamicHR
            .map((v: any) => Number(v))
            .filter((v: number) => Number.isFinite(v))
        : [];

      if (existingDynamic.length > 0) {
        const parsedDateTs = this.parseX3DateTime(rec?.date);
        const startTs =
          typeof rec?.startTimestamp === 'number' && Number.isFinite(rec.startTimestamp) && rec.startTimestamp > 0
            ? rec.startTimestamp
            : parsedDateTs ?? requestTimestamp;
        normalizedRecords.push({
          ...rec,
          arrayDynamicHR: existingDynamic,
          startTimestamp: startTs,
        });
        continue;
      }

      const segments: any[] = Array.isArray(rec?.arrayContinuousHR) ? rec.arrayContinuousHR : [];
      if (segments.length === 0) {
        normalizedRecords.push({ ...rec, arrayDynamicHR: [] });
        continue;
      }

      for (const seg of segments) {
        const values = Array.isArray(seg?.arrayHR)
          ? seg.arrayHR
              .map((v: any) => Number(v))
              .filter((v: number) => Number.isFinite(v))
          : [];
        const segDate = typeof seg?.date === 'string' ? seg.date : undefined;
        const segTs = this.parseX3DateTime(segDate);
        const fallbackTs =
          typeof rec?.startTimestamp === 'number' && Number.isFinite(rec.startTimestamp) && rec.startTimestamp > 0
            ? rec.startTimestamp
            : requestTimestamp;

        normalizedRecords.push({
          ...rec,
          date: segDate ?? rec?.date,
          startTimestamp: segTs ?? fallbackTs,
          arrayDynamicHR: values,
        });
      }
    }

    return {
      records: normalizedRecords,
      timestamp: requestTimestamp,
    };
  }

  async getSingleHeartRate(): Promise<{ records: any[]; timestamp: number }> {
    if (!JstyleBridge) throw new Error('Jstyle SDK not available');
    const result: any = await this.enqueueNativeCall<any>('getSingleHeartRateData', async () =>
      withNativeTimeout(JstyleBridge.getSingleHeartRateData(), 10000, 'getSingleHeartRateData')
    );
    const requestTimestamp = Date.now();
    const normalizedRecords: any[] = [];

    for (const rec of (result.data || [])) {
      // Single HR data uses arraySingleHR: [{date, singleHR}]
      const singles: any[] = Array.isArray(rec?.arraySingleHR) ? rec.arraySingleHR : [];
      for (const entry of singles) {
        const hr = Number(entry?.singleHR);
        const dateStr = typeof entry?.date === 'string' ? entry.date : undefined;
        const ts = this.parseX3DateTime(dateStr);
        if (Number.isFinite(hr) && hr > 0) {
          normalizedRecords.push({
            date: dateStr ?? rec?.date,
            startTimestamp: ts ?? requestTimestamp,
            arrayDynamicHR: [hr], // wrap single value for unified consumption
          });
        }
      }
    }

    return {
      records: normalizedRecords,
      timestamp: requestTimestamp,
    };
  }

  async enableAutoHRMonitoring(): Promise<void> {
    if (!JstyleBridge) throw new Error('Jstyle SDK not available');
    try {
      await withNativeTimeout(JstyleBridge.enableAutoHRMonitoring(), 5000, 'enableAutoHRMonitoring');
    } catch (e) {
      console.log('⚠️ [JstyleService] enableAutoHRMonitoring failed:', e);
    }
  }

  async getScheduledHeartRate(_dayIndexes: number[] = [0]): Promise<HeartRateData[]> {
    // X3 uses continuous HR instead of scheduled. Map to the same interface.
    const result = await this.getContinuousHeartRate();
    const hrData: HeartRateData[] = [];

    for (const record of (result.records || [])) {
      const hrArray: number[] = record.arrayDynamicHR || [];
      const baseTimestamp =
        typeof record?.startTimestamp === 'number' && Number.isFinite(record.startTimestamp)
          ? record.startTimestamp
          : result.timestamp;
      for (const hr of hrArray) {
        if (hr > 0) {
          hrData.push({
            heartRate: hr,
            timestamp: baseTimestamp,
          });
        }
      }
    }

    return hrData;
  }

  // ========== Real-Time Data ==========

  async startRealTimeData(): Promise<{ success: boolean; message: string }> {
    if (!JstyleBridge) throw new Error('Jstyle SDK not available');
    return await this.enqueueNativeCall<{ success: boolean; message: string }>('startRealTimeData', async () =>
      withNativeTimeout(JstyleBridge.startRealTimeData(), 5000, 'startRealTimeData')
    );
  }

  async stopRealTimeData(): Promise<{ success: boolean; message: string }> {
    if (!JstyleBridge) throw new Error('Jstyle SDK not available');
    return await this.enqueueNativeCall<{ success: boolean; message: string }>('stopRealTimeData', async () =>
      withNativeTimeout(JstyleBridge.stopRealTimeData(), 5000, 'stopRealTimeData')
    );
  }

  // Use startRealTimeData as the equivalent of real-time HR
  async startRealTimeHeartRate(): Promise<{ success: boolean; message: string }> {
    return await this.startRealTimeData();
  }

  async stopRealTimeHeartRate(): Promise<{ success: boolean; message: string }> {
    return await this.stopRealTimeData();
  }

  // ========== HRV ==========

  async getHRVData(): Promise<{ records: any[]; timestamp: number }> {
    if (!JstyleBridge) throw new Error('Jstyle SDK not available');
    const result: any = await this.enqueueNativeCall<any>('getHRVData', async () =>
      withNativeTimeout(JstyleBridge.getHRVData(), 10000, 'getHRVData')
    );
    return {
      records: result.data || [],
      timestamp: Date.now(),
    };
  }

  async getHRVDataNormalized(): Promise<HRVData[]> {
    const result = await this.getHRVData();
    const hrvData: HRVData[] = [];

    const pushRecord = (rec: any, fallbackTs: number) => {
      const rawDate = rec.date as string | undefined;
      const ts = rawDate ? Date.parse(rawDate.replace(/\./g, '-')) : undefined;
      const hrvVal = Number(rec.hrv ?? rec.hrvValue ?? 0);
      const hrVal = Number(rec.heartRate ?? 0);
      const stressVal = Number(rec.stress ?? 0);
      hrvData.push({
        sdnn: hrvVal,
        heartRate: hrVal,
        stress: stressVal,
        timestamp: ts && !Number.isNaN(ts) ? ts : fallbackTs,
      });
    };

    for (const record of (result.records || [])) {
      // Demo returns arrayHrvData per packet
      if (Array.isArray(record.arrayHrvData)) {
        record.arrayHrvData.forEach((entry: any) => pushRecord(entry, result.timestamp));
        continue;
      }
      // Fallback: single record fields
      pushRecord(record, result.timestamp);
    }

    return hrvData;
  }

  // X3 HRV includes blood pressure data
  async getBloodPressureFromHRV(): Promise<BloodPressureData[]> {
    const result = await this.getHRVData();
    const bpData: BloodPressureData[] = [];

    for (const record of (result.records || [])) {
      const sbp = Number(record.HighPressure ?? 0);
      const dbp = Number(record.LowPressure ?? 0);
      if (sbp > 0 && dbp > 0) {
        bpData.push({
          systolic: sbp,
          diastolic: dbp,
          heartRate: Number(record.heartRate ?? 0),
          timestamp: result.timestamp,
        });
      }
    }

    return bpData;
  }

  // ========== SpO2 ==========

  async getSpO2Data(): Promise<{ records: any[]; timestamp: number }> {
    if (!JstyleBridge) throw new Error('Jstyle SDK not available');
    const result: any = await this.enqueueNativeCall<any>('getSpO2Data', async () =>
      withNativeTimeout(JstyleBridge.getSpO2Data(), 10000, 'getSpO2Data')
    );
    return {
      records: result.data || [],
      timestamp: Date.now(),
    };
  }

  async getSpO2DataNormalized(): Promise<SpO2Data[]> {
    const result = await this.getSpO2Data();
    const spo2Data: SpO2Data[] = [];

    for (const record of (result.records || [])) {
      // X3 SDK returns paginated packets, each with arrayAutomaticSpo2Data[]
      const entries: any[] = record.arrayAutomaticSpo2Data || [];
      if (entries.length > 0) {
        for (const entry of entries) {
          // Key is automaticSpo2Data (not spo2)
          const spo2 = Number(entry.automaticSpo2Data ?? entry.spo2 ?? 0);
          if (spo2 > 0) {
            const ts = entry.date ? Date.parse(entry.date.replace(/\./g, '-').replace(' ', 'T')) : result.timestamp;
            spo2Data.push({ spo2, timestamp: isNaN(ts) ? result.timestamp : ts });
          }
        }
        continue;
      }
      // Fallback: flat record with spo2 key
      const spo2 = Number(record.spo2 ?? 0);
      if (spo2 > 0) {
        spo2Data.push({ spo2, timestamp: result.timestamp });
      }
    }

    return spo2Data;
  }

  async startSpO2Measuring(): Promise<{ success: boolean; message: string }> {
    if (!JstyleBridge) throw new Error('Jstyle SDK not available');
    return await JstyleBridge.startSpO2Measurement();
  }

  async stopSpO2Measuring(): Promise<{ success: boolean; message: string }> {
    if (!JstyleBridge) throw new Error('Jstyle SDK not available');
    return await JstyleBridge.stopMeasurement();
  }

  async getManualBloodOxygen(_dayIndex: number = 0): Promise<SpO2Data[]> {
    return await this.getSpO2DataNormalized();
  }

  // ========== Temperature ==========

  async getTemperatureData(): Promise<{ records: any[]; timestamp: number }> {
    if (!JstyleBridge) throw new Error('Jstyle SDK not available');
    const result: any = await this.enqueueNativeCall<any>('getTemperatureData', async () =>
      withNativeTimeout(JstyleBridge.getTemperatureData(), 10000, 'getTemperatureData')
    );
    return {
      records: result.data || [],
      timestamp: Date.now(),
    };
  }

  async getTemperatureDataNormalized(): Promise<TemperatureData[]> {
    const result = await this.getTemperatureData();
    const tempData: TemperatureData[] = [];

    for (const record of (result.records || [])) {
      // X3 SDK returns paginated packets, each with arrayemperatureData[] (SDK typo — missing capital T)
      const entries: any[] = record.arrayemperatureData || record.arrayTemperatureData || [];
      if (entries.length > 0) {
        for (const entry of entries) {
          const temp = Number(entry.temperature ?? 0);
          // Filter to human body temperature range (34–42°C) — SDK returns corrupted values outside this range
          if (temp >= 34 && temp <= 42) {
            const ts = entry.date ? Date.parse(entry.date.replace(/\./g, '-').replace(' ', 'T')) : result.timestamp;
            tempData.push({ temperature: temp, timestamp: isNaN(ts) ? result.timestamp : ts });
          }
        }
        continue;
      }
      // Fallback: flat record
      const temp = Number(record.temperature ?? 0);
      if (temp >= 34 && temp <= 42) {
        tempData.push({ temperature: temp, timestamp: result.timestamp });
      }
    }

    return tempData;
  }

  // ========== Mac Address ==========

  async getMacAddress(): Promise<{ mac: string }> {
    if (!JstyleBridge) throw new Error('Jstyle SDK not available');
    return await this.enqueueNativeCall<{ mac: string }>('getMacAddress', async () =>
      withNativeTimeout(JstyleBridge.getMacAddress(), 5000, 'getMacAddress')
    );
  }

  async factoryReset(): Promise<{ success: boolean }> {
    if (!JstyleBridge) throw new Error('Jstyle SDK not available');
    return await this.enqueueNativeCall<{ success: boolean }>('factoryReset', async () =>
      withNativeTimeout(JstyleBridge.factoryReset(), 5000, 'factoryReset')
    );
  }

  // ========== Activity / Sport Mode ==========

  async getActivityModeData(): Promise<{ records: any[]; timestamp: number }> {
    if (!JstyleBridge) throw new Error('Jstyle SDK not available');
    const result: any = await this.enqueueNativeCall<any>('getActivityModeData', async () =>
      withNativeTimeout(JstyleBridge.getActivityModeData(), 10000, 'getActivityModeData')
    );
    return {
      records: result.data || [],
      timestamp: Date.now(),
    };
  }

  async getActivityModeDataNormalized(): Promise<X3ActivitySession[]> {
    const result = await this.getActivityModeData();
    const sessions: X3ActivitySession[] = [];

    for (const record of (result.records || [])) {
      const entries = Array.isArray(record?.arrayActivityModeData)
        ? record.arrayActivityModeData
        : [record];

      for (const entry of entries) {
        const raw = entry || {};
        const mode = Math.round(this.pickNumber(raw, ['activityMode', 'sportType', 'mode', 'type']) ?? -1);
        const durationMin = this.pickNumber(raw, ['activityTime', 'duration', 'exerciseMinutes']) ?? 0;
        const durationSec = Math.max(0, Math.round(durationMin > 1000 ? durationMin : durationMin * 60));

        const parsedStart = this.parseX3DateTime(
          raw.startDate || raw.startTime || raw.date || raw.startTime_ActivityModeData
        );
        const parsedEnd = this.parseX3DateTime(raw.endDate || raw.endTime);
        const startTime = parsedStart ?? result.timestamp;
        const endTime = parsedEnd ?? (durationSec > 0 ? startTime + durationSec * 1000 : startTime);

        const steps = Math.max(0, Math.round(this.pickNumber(raw, ['step', 'steps']) ?? 0));
        const distanceKm = this.pickNumber(raw, ['distance', 'distanceKm']) ?? 0;
        const calories = Math.max(0, Math.round(this.pickNumber(raw, ['calories', 'kcal']) ?? 0));
        const heartRateAvg = this.pickNumber(raw, ['averageHeartRate', 'avgHeartRate', 'heartRateAvg']);
        const heartRateMax = this.pickNumber(raw, ['maxHeartRate', 'heartRateMax']);

        sessions.push({
          type: this.toSportType(mode),
          typeLabel: raw.sportName || raw.modeName || `Sport ${mode >= 0 ? mode : 'Unknown'}`,
          startTime,
          endTime,
          duration: Math.max(0, Math.round((endTime - startTime) / 1000)),
          steps,
          distance: Math.max(0, Math.round(distanceKm * 1000)),
          calories,
          heartRateAvg: heartRateAvg && heartRateAvg > 0 ? Math.round(heartRateAvg) : undefined,
          heartRateMax: heartRateMax && heartRateMax > 0 ? Math.round(heartRateMax) : undefined,
        });
      }
    }

    return sessions
      .filter(session => session.duration > 0 || session.steps > 0 || session.calories > 0)
      .sort((a, b) => b.startTime - a.startTime);
  }

  async getSleepHRVData(): Promise<{ records: any[]; timestamp: number }> {
    if (!JstyleBridge) throw new Error('Jstyle SDK not available');
    const result: any = await this.enqueueNativeCall<any>('getSleepHRVData', async () =>
      withNativeTimeout(JstyleBridge.getSleepHRVData(), 10000, 'getSleepHRVData')
    );
    return {
      records: result.data || [],
      timestamp: Date.now(),
    };
  }

  async getSleepHrvDataNormalized(): Promise<X3SleepBreathingMetrics[]> {
    const result = await this.getSleepHRVData();
    const metrics: X3SleepBreathingMetrics[] = [];

    for (const record of (result.records || [])) {
      const entries = Array.isArray(record?.arraySleepHrvData)
        ? record.arraySleepHrvData
        : [record];

      for (const entry of entries) {
        const timestamp =
          this.parseX3DateTime(entry?.date || entry?.startDate || entry?.startTime) ?? result.timestamp;
        const respiratoryRate = this.pickNumber(entry || {}, [
          'respiratoryRate',
          'respRate',
          'breathRate',
          'sleepRespiratoryRate',
        ]);
        const oxygenDropIndex = this.pickNumber(entry || {}, ['oxygenDropIndex', 'odi']);

        metrics.push({
          timestamp,
          respiratoryRate:
            respiratoryRate && respiratoryRate >= 8 && respiratoryRate <= 40
              ? Math.round(respiratoryRate)
              : undefined,
          oxygenDropIndex: oxygenDropIndex && oxygenDropIndex >= 0 ? oxygenDropIndex : undefined,
        });
      }
    }

    return metrics;
  }

  async getOSAData(): Promise<{ records: any[]; timestamp: number }> {
    if (!JstyleBridge) throw new Error('Jstyle SDK not available');
    const result: any = await this.enqueueNativeCall<any>('getOSAData', async () =>
      withNativeTimeout(JstyleBridge.getOSAData(), 10000, 'getOSAData')
    );
    return {
      records: result.data || [],
      timestamp: Date.now(),
    };
  }

  async getEOVData(): Promise<{ records: any[]; timestamp: number }> {
    if (!JstyleBridge) throw new Error('Jstyle SDK not available');
    const result: any = await this.enqueueNativeCall<any>('getEOVData', async () =>
      withNativeTimeout(JstyleBridge.getEOVData(), 10000, 'getEOVData')
    );
    return {
      records: result.data || [],
      timestamp: Date.now(),
    };
  }

  async getOsaEovDataNormalized(): Promise<X3SleepBreathingMetrics[]> {
    const [osa, eov] = await Promise.allSettled([this.getOSAData(), this.getEOVData()]);
    const combined: X3SleepBreathingMetrics[] = [];

    const append = (records: any[], key: 'apnoeaEvents' | 'eovEvents') => {
      for (const record of records) {
        const entries = Array.isArray(record?.arrayOSAData) || Array.isArray(record?.arrayEOVData)
          ? [...(record.arrayOSAData || []), ...(record.arrayEOVData || [])]
          : [record];
        for (const entry of entries) {
          const value = this.pickNumber(entry || {}, ['eventCount', 'count', 'events', 'value']);
          if (!value || value < 0) continue;
          const metric: X3SleepBreathingMetrics = {
            timestamp: this.parseX3DateTime(entry?.date || entry?.startDate || entry?.startTime) ?? Date.now(),
          };
          metric[key] = Math.round(value);
          combined.push(metric);
        }
      }
    };

    if (osa.status === 'fulfilled') append(osa.value.records || [], 'apnoeaEvents');
    if (eov.status === 'fulfilled') append(eov.value.records || [], 'eovEvents');
    return combined;
  }

  async getPPIData(): Promise<{ records: any[]; timestamp: number }> {
    if (!JstyleBridge) throw new Error('Jstyle SDK not available');
    const result: any = await this.enqueueNativeCall<any>('getPPIData', async () =>
      withNativeTimeout(JstyleBridge.getPPIData(), 10000, 'getPPIData')
    );
    return {
      records: result.data || [],
      timestamp: Date.now(),
    };
  }

  async getPpiDataNormalized(): Promise<Array<{ timestamp: number; ppi: number }>> {
    const result = await this.getPPIData();
    const ppiData: Array<{ timestamp: number; ppi: number }> = [];

    for (const record of (result.records || [])) {
      const entries = Array.isArray(record?.arrayPpiData) ? record.arrayPpiData : [record];
      for (const entry of entries) {
        const ppi = this.pickNumber(entry || {}, ['ppi', 'rrInterval', 'rri']);
        if (!ppi || ppi <= 0) continue;
        ppiData.push({
          timestamp: this.parseX3DateTime(entry?.date || entry?.startDate || entry?.startTime) ?? result.timestamp,
          ppi,
        });
      }
    }

    return ppiData;
  }

  async getSportData(): Promise<SportData[]> {
    const sessions = await this.getActivityModeDataNormalized();
    return sessions.map(session => ({
      type: session.type,
      startTime: session.startTime,
      endTime: session.endTime,
      duration: session.duration,
      steps: session.steps,
      distance: session.distance,
      calories: session.calories,
      heartRateAvg: session.heartRateAvg,
      heartRateMax: session.heartRateMax,
    }));
  }

  // ========== Event Listeners ==========

  onConnectionStateChanged(callback: (state: ConnectionState) => void): () => void {
    if (!eventEmitter) return () => {};
    const subscription = eventEmitter.addListener('onConnectionStateChanged', (event) => {
      callback(event.state);
    });
    return () => subscription.remove();
  }

  onBluetoothStateChanged(callback: (state: BluetoothState) => void): () => void {
    if (!eventEmitter) return () => {};
    const subscription = eventEmitter.addListener('onBluetoothStateChanged', (event) => {
      callback(event.state);
    });
    return () => subscription.remove();
  }

  onDeviceDiscovered(callback: (device: DeviceInfo) => void): () => void {
    if (!eventEmitter) return () => {};
    const subscription = eventEmitter.addListener('onDeviceFound', (device) => {
      callback({ ...device, sdkType: 'jstyle' as const });
    });
    return () => subscription.remove();
  }

  onHeartRateData(callback: (data: { heartRate: number; timestamp: number; isRealTime?: boolean; isMeasuring?: boolean }) => void): () => void {
    if (!eventEmitter) return () => {};
    // Primary source: onRealTimeData. Fallback: onMeasurementResult.
    const realtimeSub = eventEmitter.addListener('onRealTimeData', (data) => {
      const hr = Number(data?.heartRate ?? 0);
      if (hr > 0) {
        callback({
          heartRate: hr,
          timestamp: data?.timestamp || Date.now(),
          isRealTime: true,
        });
      }
    });
    const measurementSub = eventEmitter.addListener('onMeasurementResult', (data) => {
      const hr = Number(data?.heartRate ?? data?.singleHR ?? data?.hr ?? 0);
      if (hr > 0) {
        callback({
          heartRate: hr,
          timestamp: data?.timestamp || Date.now(),
          isMeasuring: true,
        });
      }
    });
    return () => {
      realtimeSub.remove();
      measurementSub.remove();
    };
  }

  onCurrentStepInfo(callback: (data: { steps: number; calories: number; distance: number }) => void): () => void {
    if (!eventEmitter) return () => {};
    // Step info comes through onRealTimeData
    const subscription = eventEmitter.addListener('onRealTimeData', (data) => {
      if (data.steps !== undefined) {
        callback({
          steps: data.steps || 0,
          calories: data.calories || 0,
          distance: data.distance || 0,
        });
      }
    });
    return () => subscription.remove();
  }

  onBatteryChanged(callback: (data: BatteryData) => void): () => void {
    if (!eventEmitter) return () => {};
    const subscription = eventEmitter.addListener('onBatteryData', (data) => {
      callback({
        battery: Number(data.battery ?? 0),
        isCharging: Boolean(data.isCharging),
      });
    });
    return () => subscription.remove();
  }

  onSpO2Received(callback: (data: SpO2Data) => void): () => void {
    if (!eventEmitter) return () => {};
    // SpO2 data comes through onMeasurementResult
    const subscription = eventEmitter.addListener('onMeasurementResult', (data) => {
      if (data.spo2 !== undefined) {
        callback({
          spo2: data.spo2,
          timestamp: data.timestamp || Date.now(),
        });
      }
    });
    return () => subscription.remove();
  }

  onTemperatureData(callback: (data: { temperature: number; timestamp: number }) => void): () => void {
    if (!eventEmitter) return () => {};
    // Temperature data comes through onMeasurementResult or onRealTimeData
    const subscription = eventEmitter.addListener('onRealTimeData', (data) => {
      if (data.temperature !== undefined) {
        callback({
          temperature: data.temperature,
          timestamp: data.timestamp || Date.now(),
        });
      }
    });
    return () => subscription.remove();
  }

  onError(callback: (error: any) => void): () => void {
    if (!eventEmitter) return () => {};
    const subscription = eventEmitter.addListener('onError', (error) => {
      callback(error);
    });
    return () => subscription.remove();
  }

  onScanFinished(callback: (devices: DeviceInfo[]) => void): () => void {
    if (!eventEmitter) return () => {};
    // X3 SDK doesn't emit a scan finished event, return empty subscription
    // Devices are discovered via onDeviceFound events
    return () => {};
  }

  onDebugLog(callback: (message: string, timestamp: number) => void): () => void {
    if (!eventEmitter) return () => {};
    const subscription = eventEmitter.addListener('onDebugLog', (event) => {
      callback(event.message, event.timestamp);
    });
    return () => subscription.remove();
  }
}

export default new JstyleService();
