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
  console.log('V8Bridge native module not available');
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

// Serialized native call queue (one-at-a-time)
let callQueue: Promise<any> = Promise.resolve();

function enqueueNativeCall<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  const next = callQueue.then(
    () => withNativeTimeout(fn(), timeoutMs, label),
    () => withNativeTimeout(fn(), timeoutMs, label)
  );
  callQueue = next.catch(() => {});
  return next;
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
    setTimeout(() => V8Bridge.stopScan().catch(() => {}), duration * 1000);
  },

  stopScan(): void {
    V8Bridge?.stopScan().catch(() => {});
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
    V8Bridge?.disconnect().catch(() => {});
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
      const result = await V8Bridge.getSleepData();
      const items: any[] = result.data || [];
      if (items.length === 0) {
        return { deep: 0, light: 0, awake: 0, rem: 0, detail: '' };
      }

      // Get the session at dayIndex (0 = most recent)
      const session = items[dayIndex] || items[0];
      const qualityArray: number[] = session.arraySleepQuality || [];
      const unitLength = Number(session.sleepUnitLength) || 1;
      const totalMinutes = Number(session.totalSleepTime) || 0;
      const startTimestamp = parseV8Date(session.startTime_SleepData);

      // V8 sleep quality: 1=deep, 2=light, 3=REM, other=awake
      let deep = 0, light = 0, rem = 0, awake = 0;
      for (const q of qualityArray) {
        switch (q) {
          case 1: deep += unitLength; break;
          case 2: light += unitLength; break;
          case 3: rem += unitLength; break;
          default: awake += unitLength; break;
        }
      }

      const endTimestamp = startTimestamp > 0 ? startTimestamp + totalMinutes * 60000 : 0;

      const rawQualityRecords: SleepQualityRecord[] = [{
        arraySleepQuality: qualityArray,
        sleepUnitLength: unitLength,
        startTimestamp,
      }];

      return {
        deep,
        light,
        awake,
        rem,
        detail: `${deep}m deep, ${light}m light, ${rem}m REM, ${awake}m awake`,
        startTime: startTimestamp || undefined,
        endTime: endTimestamp || undefined,
        rawQualityRecords,
      };
    }, 10000, 'getSleepData');
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
    }, 10000, 'getContinuousHR');
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
    if (V8Bridge) await V8Bridge.cancelPendingDataRequest().catch(() => {});
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
      callback({
        id: event.id,
        mac: event.mac || event.id,
        name: event.name || 'V8 Band',
        localName: event.localName,
        rssi: event.rssi || -50,
        sdkType: 'v8',
        deviceType: 'band',
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
