/**
 * UnifiedSmartRingService - Multi-SDK Device Interface
 *
 * Routes commands to either Jstyle (X3 ring) or V8 (band) SDK
 * based on the connected device's SDK type. Supports one device at a time.
 * Both SDKs share the same NewBle singleton — delegate is switched per operation.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import JstyleService from './JstyleService';
import V8Service from './V8Service';
import { reportError, addBreadcrumb, setRingContext } from '../utils/sentry';
import type {
  DeviceInfo,
  DeviceType,
  StepsData,
  SleepData,
  HeartRateData,
  BloodPressureData,
  SpO2Data,
  HRVData,
  StressData,
  TemperatureData,
  BatteryData,
  ProfileData,
  ConnectionState,
  BluetoothState,
  SportData,
  FeatureAvailability,
  RecoveryContributors,
} from '../types/sdk.types';

export type SDKType = 'jstyle' | 'v8' | 'none';

class UnifiedSmartRingService {
  private activeSDK: SDKType = 'none';
  private connectedSDKType: SDKType = 'none';
  private connectedDeviceType: DeviceType | null = null;
  private autoReconnectInFlight: Promise<{ success: boolean; message: string; deviceId?: string; deviceName?: string }> | null = null;

  private async getPersistedSDKType(): Promise<SDKType> {
    try {
      const stored = await AsyncStorage.getItem('connectedSDKType');
      if (stored === 'jstyle' || stored === 'v8') return stored;
    } catch (e) { reportError(e, { op: 'getPersistedSDKType' }, 'warning'); }
    return 'none';
  }

  // JavaScript-side connection state listeners (for manual state notifications)
  private jsConnectionListeners: Set<(state: ConnectionState) => void> = new Set();

  constructor() {
    this.detectSDK();
  }

  /**
   * Manually emit a connection state change to all JS listeners
   * Used when the native SDK doesn't emit events (e.g., after autoReconnect)
   */
  emitConnectionState(state: ConnectionState): void {
    console.log('📱 [UnifiedService] Emitting connection state:', state);
    this.jsConnectionListeners.forEach(callback => {
      try {
        callback(state);
      } catch (e) {
        console.error('Error in connection state listener:', e);
      }
    });
  }

  /**
   * Detect which SDKs are available
   */
  private detectSDK(): void {
    if (Platform.OS !== 'ios') {
      this.activeSDK = 'none';
      return;
    }

    // Both SDKs may be available simultaneously
    if (JstyleService.isAvailable()) {
      this.activeSDK = 'jstyle';
      return;
    }

    if (V8Service.isAvailable()) {
      this.activeSDK = 'v8';
      return;
    }

    this.activeSDK = 'none';
  }

  /**
   * Get the currently active SDK type
   */
  getActiveSDK(): SDKType {
    return this.activeSDK;
  }

  /**
   * Get the SDK type of the currently connected device
   */
  getConnectedSDKType(): SDKType {
    return this.connectedSDKType;
  }

  /**
   * Set which SDK type is being used for the current connection
   * Called by useSmartRing when connecting to a device with a known sdkType
   */
  setConnectedSDKType(type: SDKType, deviceType?: DeviceType): void {
    console.log('📱 [UnifiedService] Setting connected SDK type:', type);
    this.connectedSDKType = type;
    this.connectedDeviceType = deviceType ?? (type === 'v8' ? 'band' : type === 'jstyle' ? 'ring' : null);
    if (type === 'jstyle' || type === 'v8') {
      AsyncStorage.setItem('connectedSDKType', type).catch(e => reportError(e, { op: 'persistSDKType.setItem' }, 'warning'));
    } else {
      AsyncStorage.removeItem('connectedSDKType').catch(e => reportError(e, { op: 'persistSDKType.removeItem' }, 'warning'));
    }
  }

  /**
   * Get the device type (ring or band) of the currently connected device
   */
  getConnectedDeviceType(): DeviceType | null {
    return this.connectedDeviceType;
  }

  /**
   * Check if using mock data (always false - mock data removed)
   */
  isUsingMockData(): boolean {
    return false;
  }

  /**
   * Check if any SDK is available
   */
  isSDKAvailable(): boolean {
    return JstyleService.isAvailable() || V8Service.isAvailable();
  }

  private ensureSDKAvailable(): void {
    if (!this.isSDKAvailable()) {
      throw new Error('No Smart Ring SDK available - requires native iOS build with connected device');
    }
  }

  private ensureConnected(): void {
    if (this.connectedSDKType === 'none') {
      throw new Error('No device connected');
    }
  }

  // ========== Connection Methods ==========

  async scan(duration: number = 10): Promise<DeviceInfo[]> {
    this.ensureSDKAvailable();

    // Fire both SDK scans in parallel — devices arrive via onDeviceDiscovered
    const scanPromises: Promise<void>[] = [];

    if (JstyleService.isAvailable()) {
      scanPromises.push(
        JstyleService.scan(duration).catch(err => {
          console.log('⚠️ Jstyle scan error:', err.message);
        })
      );
    }

    if (V8Service.isAvailable()) {
      scanPromises.push(
        V8Service.scan(duration).catch(err => {
          console.log('⚠️ V8 scan error:', err.message);
        })
      );
    }

    await Promise.all(scanPromises);
    return []; // Devices will come through onDeviceDiscovered callbacks
  }

  stopScan(): void {
    if (JstyleService.isAvailable()) {
      JstyleService.stopScan();
    }
    if (V8Service.isAvailable()) {
      V8Service.stopScan();
    }
  }

  async connect(mac: string, sdkType?: SDKType, deviceType?: DeviceType): Promise<{ success: boolean; message: string }> {
    this.ensureSDKAvailable();

    const type = sdkType || 'jstyle';
    this.setConnectedSDKType(type, deviceType);

    if (type === 'v8') {
      return await V8Service.connect(mac);
    }
    return await JstyleService.connect(mac);
  }

  disconnect(): void {
    addBreadcrumb('ble', 'disconnect called', { sdkType: this.connectedSDKType });
    if (this.connectedSDKType === 'v8') {
      V8Service.disconnect();
    } else if (this.connectedSDKType === 'jstyle') {
      JstyleService.disconnect();
    }
    this.connectedSDKType = 'none';
    this.connectedDeviceType = null;
  }

  async isConnected(): Promise<{
    connected: boolean;
    state: string;
    deviceName: string | null;
    deviceMac: string | null;
  }> {
    const svc = this.connectedSDKType === 'v8' ? V8Service
      : (this.connectedSDKType === 'jstyle' || JstyleService.isAvailable()) ? JstyleService
      : null;
    if (!svc) return { connected: false, state: 'unavailable', deviceName: null, deviceMac: null };
    const status = await svc.isConnected();
    return {
      connected: status.connected,
      state: status.state,
      deviceName: status.deviceName,
      deviceMac: status.deviceId,
    };
  }

  async getFullConnectionStatus(): Promise<{
    managerState: string;
    managerStateCode: number;
    cachedState: string;
    cachedStateCode: number;
    isConnected: boolean;
    deviceName: string | null;
    deviceMac: string | null;
  }> {
    const buildStatus = async (svc: typeof JstyleService | typeof V8Service) => {
      const status = await svc.isConnected();
      return {
        managerState: status.state,
        managerStateCode: status.connected ? 3 : 0,
        cachedState: status.state,
        cachedStateCode: status.connected ? 3 : 0,
        isConnected: status.connected,
        deviceName: status.deviceName,
        deviceMac: status.deviceId,
      };
    };
    if (this.connectedSDKType === 'v8') return buildStatus(V8Service);
    if (this.connectedSDKType === 'jstyle' || JstyleService.isAvailable()) return buildStatus(JstyleService);
    return {
      managerState: 'unavailable',
      managerStateCode: -1,
      cachedState: 'unavailable',
      cachedStateCode: -1,
      isConnected: false,
      deviceName: null,
      deviceMac: null,
    };
  }

  async getPairedDevice(): Promise<{
    hasPairedDevice: boolean;
    device: DeviceInfo | null;
  }> {
    const persistedSDKType = await this.getPersistedSDKType();

    // Check Jstyle first (uses NSUserDefaults, not active connection)
    if (JstyleService.isAvailable() && persistedSDKType !== 'v8') {
      const jResult = await JstyleService.hasPairedDevice();
      if (jResult.hasPairedDevice) {
        return {
          hasPairedDevice: true,
          device: {
            id: jResult.deviceId ?? 'jstyle-paired',
            mac: jResult.deviceId ?? 'jstyle-paired',
            name: jResult.deviceName ?? 'Focus X3',
            rssi: -50,
            sdkType: 'jstyle',
            deviceType: 'ring',
          },
        };
      }
    }

    // Check V8 (uses NSUserDefaults)
    if (V8Service.isAvailable() && persistedSDKType !== 'jstyle') {
      const vResult = await V8Service.getPairedDevice();
      if (vResult.hasPairedDevice && vResult.device) {
        return {
          hasPairedDevice: true,
          device: { ...vResult.device, sdkType: 'v8', deviceType: /x6/i.test(vResult.device.name ?? '') ? 'ring' : 'band' },
        };
      }
    }

    return { hasPairedDevice: false, device: null };
  }

  async forgetPairedDevice(): Promise<{ success: boolean; message: string }> {
    // Always clear both SDKs to avoid stale NSUserDefaults causing misdetection
    await Promise.allSettled([
      JstyleService.isAvailable() ? JstyleService.forgetPairedDevice() : Promise.resolve(),
      V8Service.isAvailable() ? V8Service.forgetPairedDevice() : Promise.resolve(),
    ]);
    this.setConnectedSDKType('none');
    return { success: true, message: 'All paired devices forgotten' };
  }

  async autoReconnect(): Promise<{ success: boolean; message: string; deviceId?: string; deviceName?: string }> {
    if (this.autoReconnectInFlight) {
      return this.autoReconnectInFlight;
    }

    this.autoReconnectInFlight = (async () => {
      const persistedSDKType = await this.getPersistedSDKType();
      addBreadcrumb('ble', 'autoReconnect started', { sdkType: persistedSDKType });

      // Check Jstyle already connected
      if (JstyleService.isAvailable()) {
        try {
          const jStatus = await JstyleService.isConnected();
          if (jStatus.connected) {
            this.setConnectedSDKType('jstyle');
            if (jStatus.deviceId) setRingContext(jStatus.deviceId, 'jstyle');
            V8Service.forgetPairedDevice().catch(() => {});
            return {
              success: true,
              message: 'Already connected',
              deviceId: jStatus.deviceId ?? undefined,
              deviceName: jStatus.deviceName ?? undefined,
            };
          }
        } catch (e) {
          console.log('⚠️ Jstyle isConnected check failed:', e);
        }
      }

      // Check V8 already connected
      if (V8Service.isAvailable()) {
        try {
          const vStatus = await V8Service.isConnected();
          if (vStatus.connected) {
            const vDevType = /x6/i.test(vStatus.deviceName ?? '') ? 'ring' : 'band';
            this.setConnectedSDKType('v8', vDevType);
            JstyleService.forgetPairedDevice().catch(() => {});
            return {
              success: true,
              message: 'Already connected',
              deviceId: vStatus.deviceId ?? undefined,
              deviceName: vStatus.deviceName ?? undefined,
            };
          }
        } catch (e) {
          console.log('⚠️ V8 isConnected check failed:', e);
        }
      }

      // Try Jstyle reconnect — skip if persisted type is v8 (avoids misdetection from stale NSUserDefaults)
      if (JstyleService.isAvailable() && persistedSDKType !== 'v8') {
        try {
          const jPaired = await JstyleService.hasPairedDevice();
          if (jPaired.hasPairedDevice) {
            this.setConnectedSDKType('jstyle');
            const result = await JstyleService.autoReconnect();
            if (result.success) {
              addBreadcrumb('ble', 'autoReconnect succeeded', { sdkType: 'jstyle' });
              if (result.deviceId) setRingContext(result.deviceId, 'jstyle');
              setTimeout(() => this.emitConnectionState('connected'), 50);
              JstyleService.setTime().catch(e => console.log('[Unified] setTime on reconnect failed:', e));
              V8Service.forgetPairedDevice().catch(() => {});
              return result;
            }
            reportError(new Error('autoReconnect.jstyle returned failure'), { op: 'autoReconnect.jstyle', reason: result?.message ?? 'unknown' });
            this.connectedSDKType = 'none';
          }
        } catch (e) {
          console.log('⚠️ Jstyle autoReconnect failed:', e);
          reportError(e, { op: 'autoReconnect.jstyle' });
        }
      }

      // Try V8 reconnect — skip if persisted type is jstyle (avoids misdetection from stale NSUserDefaults)
      if (V8Service.isAvailable() && persistedSDKType !== 'jstyle') {
        try {
          const vPaired = await V8Service.hasPairedDevice();
          if (vPaired.hasPairedDevice) {
            const vPairedDev = await V8Service.getPairedDevice().catch(() => null);
            const vDevType = /x6/i.test(vPairedDev?.device?.name ?? '') ? 'ring' : 'band';
            this.setConnectedSDKType('v8', vDevType);
            const result = await V8Service.autoReconnect();
            if (result.success) {
              addBreadcrumb('ble', 'autoReconnect succeeded', { sdkType: 'v8' });
              if (result.deviceId) setRingContext(result.deviceId, 'v8');
              setTimeout(() => this.emitConnectionState('connected'), 50);
              JstyleService.forgetPairedDevice().catch(() => {});
              return result;
            }
            reportError(new Error('autoReconnect.v8 returned failure'), { op: 'autoReconnect.v8', reason: result?.message ?? 'unknown' });
            this.connectedSDKType = 'none';
          }
        } catch (e) {
          console.log('⚠️ V8 autoReconnect failed:', e);
          reportError(e, { op: 'autoReconnect.v8' });
        }
      }

      return { success: false, message: 'No paired device found' };
    })();

    try {
      return await this.autoReconnectInFlight;
    } finally {
      this.autoReconnectInFlight = null;
    }
  }

  private isV8(): boolean {
    return this.connectedSDKType === 'v8';
  }

  // ========== Data Retrieval ==========

  async getSteps(): Promise<StepsData> {
    this.ensureConnected();
    if (this.isV8()) return await V8Service.getSteps();
    return await JstyleService.getSteps();
  }

  async getAllDailyStepsHistory(): Promise<Array<{ dateKey: string; steps: number; distanceM: number; calories: number }>> {
    this.ensureConnected();
    return await JstyleService.getAllDailyStepsHistory();
  }

  async getSleepData(): Promise<SleepData> {
    this.ensureConnected();
    if (this.isV8()) return await V8Service.getSleepByDay(0);
    return await JstyleService.getSleepByDay(0);
  }

  async getBattery(): Promise<BatteryData> {
    this.ensureConnected();
    if (this.isV8()) return await V8Service.getBattery();
    return await JstyleService.getBattery();
  }

  async getVersion(): Promise<{ version: string }> {
    this.ensureConnected();
    const info = this.isV8()
      ? await V8Service.getVersion()
      : await JstyleService.getVersion();
    return { version: info.softwareVersion };
  }

  async get24HourHeartRate(): Promise<number[]> {
    this.ensureConnected();
    if (this.isV8()) {
      const data = await V8Service.getContinuousHeartRate();
      return data.map(d => d.heartRate);
    }
    const data = await JstyleService.getScheduledHeartRate([0]);
    return data.map(d => d.heartRate);
  }

  async getScheduledHeartRateRaw(days: number[] = [0]) {
    this.ensureConnected();

    if (this.isV8()) {
      // V8 continuous HR has per-record timestamps
      const hrData = await V8Service.getContinuousHeartRate();
      return hrData
        .filter(h => h.heartRate > 0 && h.timestamp)
        .map(h => {
          const d = new Date(h.timestamp!);
          return {
            heartRate: h.heartRate,
            timeMinutes: d.getHours() * 60 + d.getMinutes(),
          };
        });
    }

    // X3: use HRV data which has timestamps
    const hrvData = await JstyleService.getHRVDataNormalized();
    return hrvData
      .filter(h => (h.heartRate ?? 0) > 0 && h.timestamp)
      .map(h => {
        const d = new Date(h.timestamp!);
        return {
          heartRate: h.heartRate!,
          timeMinutes: d.getHours() * 60 + d.getMinutes(),
        };
      });
  }

  async get24HourSteps(): Promise<number[]> {
    this.ensureConnected();
    return [];
  }

  async getHRVData(): Promise<HRVData> {
    const data = await this.getHRVDataNormalizedArray();
    return data[0] || {};
  }

  async getStressData(): Promise<StressData> {
    this.ensureConnected();
    if (this.isV8()) {
      const data = await V8Service.getHRVDataNormalized();
      return { level: data[0]?.stress ?? 0 };
    }
    return { level: 0 };
  }

  async getTemperature(): Promise<TemperatureData> {
    const data = await this.getTemperatureDataNormalizedArray();
    return data[0] || { temperature: 0 };
  }

  async getHeartRate(): Promise<HeartRateData> {
    this.ensureConnected();
    if (this.isV8()) {
      const data = await V8Service.getContinuousHeartRate();
      return data[0] || { heartRate: 0 };
    }
    const data = await JstyleService.getScheduledHeartRate([0]);
    return data[0] || { heartRate: 0 };
  }

  async getSleepByDay(dayIndex: number = 0): Promise<SleepData | null> {
    try {
      this.ensureConnected();
      if (this.isV8()) return await V8Service.getSleepByDay(dayIndex);
      return await JstyleService.getSleepByDay(dayIndex);
    } catch (e) {
      console.log('getSleepByDay error', e);
      return null;
    }
  }

  async getSpO2(): Promise<SpO2Data> {
    const data = await this.getSpO2DataNormalizedArray();
    return data[0] || { spo2: 0 };
  }

  async getBloodPressure(): Promise<BloodPressureData> {
    this.ensureConnected();
    if (this.isV8()) {
      // V8 doesn't support blood pressure — return zeros without a BLE call
      return { systolic: 0, diastolic: 0, heartRate: 0 };
    }
    const data = await JstyleService.getBloodPressureFromHRV();
    return data[0] || { systolic: 0, diastolic: 0, heartRate: 0 };
  }

  async getSportData(): Promise<SportData[]> {
    this.ensureConnected();
    if (this.isV8()) return await V8Service.getSportData();
    return await JstyleService.getSportData();
  }

  async getRespiratoryRateNightly(dayIndex: number = 0): Promise<number | null> {
    this.ensureConnected();

    // V8 band doesn't support respiratory rate — only available on Jstyle ring
    if (this.isV8()) return null;

    try {
      const sleepHrv = await JstyleService.getSleepHrvDataNormalized();
      const values = sleepHrv
        .map(item => Number(item.respiratoryRate))
        .filter(v => Number.isFinite(v) && v >= 8 && v <= 40);
      if (values.length > 0) {
        return Math.round(values[values.length - 1]);
      }
    } catch (error) {
      console.log('⚠️ getRespiratoryRateNightly sleepHRV failed:', error);
    }

    try {
      const breathing = await JstyleService.getOsaEovDataNormalized();
      const values = breathing
        .map(item => Number(item.respiratoryRate))
        .filter(v => Number.isFinite(v) && v >= 8 && v <= 40);
      if (values.length > 0) {
        return Math.round(values[values.length - 1]);
      }
    } catch (error) {
      console.log('⚠️ getRespiratoryRateNightly OSA/EOV failed:', error);
    }

    try {
      const sleep = await this.getSleepByDay(dayIndex);
      const value = Number((sleep as any)?.respiratoryRate ?? 0);
      return Number.isFinite(value) && value >= 8 && value <= 40 ? Math.round(value) : null;
    } catch {
      return null;
    }
  }

  getFeatureAvailability(): FeatureAvailability {
    const isX3 = this.connectedSDKType === 'jstyle';
    const isV8 = this.connectedSDKType === 'v8';
    return {
      respiratoryRate: isX3,
      activitySessions: isX3 || isV8,
      stressIndex: isX3 || isV8,
      sleepHrv: isX3,
      osaEov: isX3,
      ppi: isX3 || isV8,
    };
  }

  async getRecoveryContributors(dayIndex: number = 0): Promise<RecoveryContributors> {
    const [hrv, sleep, temp, spo2] = await Promise.all([
      this.getHRVData().catch(() => ({} as HRVData)),
      this.getSleepByDay(dayIndex).catch(() => null),
      this.getTemperature().catch(() => ({ temperature: 0 } as TemperatureData)),
      this.getSpO2().catch(() => ({ spo2: 0 } as SpO2Data)),
    ]);

    const restingHr = Number((sleep as any)?.restingHR ?? 0);
    const sleepTotal =
      sleep && typeof sleep === 'object'
        ? Number((sleep.deep || 0) + (sleep.light || 0) + (sleep.rem || 0))
        : 0;

    return {
      hrvBalance: hrv.sdnn && hrv.sdnn > 0 ? Math.max(0, Math.min(100, Math.round((hrv.sdnn / 80) * 100))) : null,
      restingHrDelta: restingHr > 0 ? restingHr - 60 : null,
      tempDeviation: temp.temperature && temp.temperature > 0 ? Number((temp.temperature - 36.5).toFixed(2)) : null,
      overnightSpo2: spo2.spo2 && spo2.spo2 > 0 ? spo2.spo2 : null,
      sleepImpact: sleepTotal > 0 ? Math.max(0, Math.min(100, Math.round((sleepTotal / 480) * 100))) : null,
    };
  }

  async getBloodGlucose(dayIndex: number = 0): Promise<Array<{
    glucose: number;
    minGlucose?: number;
    maxGlucose?: number;
    type?: number;
    gluType?: number;
    timestamp: number;
  }>> {
    // X3 doesn't support blood glucose
    return [];
  }

  async measureHeartRate(): Promise<{ success: boolean }> {
    return this.startHeartRateMeasuring();
  }

  // ========== Real-time Monitoring ==========

  startHeartRateMonitoring(): void {
    if (this.connectedSDKType === 'jstyle') {
      JstyleService.startRealTimeHeartRate();
    }
    // V8 uses manual measurement — handled via measureHeartRate
  }

  stopHeartRateMonitoring(): void {
    if (this.connectedSDKType === 'jstyle') {
      JstyleService.stopRealTimeHeartRate();
    }
  }

  startSpO2Monitoring(): void {
    if (this.connectedSDKType === 'v8') {
      V8Service.startSpO2Measuring().catch(err => {
        console.log('⚠️ V8 startSpO2 error:', err.message);
      });
    } else if (this.connectedSDKType === 'jstyle') {
      JstyleService.startSpO2Measuring().catch(err => {
        console.log('⚠️ Jstyle startSpO2 error:', err.message);
      });
    }
  }

  stopSpO2Monitoring(): void {
    if (this.connectedSDKType === 'v8') {
      V8Service.stopSpO2Measuring().catch(err => {
        console.log('⚠️ V8 stopSpO2 error:', err.message);
      });
    } else if (this.connectedSDKType === 'jstyle') {
      JstyleService.stopSpO2Measuring().catch(err => {
        console.log('⚠️ Jstyle stopSpO2 error:', err.message);
      });
    }
  }

  // ========== Settings ==========

  async setProfile(profile: ProfileData): Promise<{ success: boolean }> {
    this.ensureConnected();
    if (this.isV8()) return await V8Service.setProfile(profile);
    return await JstyleService.setProfile(profile);
  }

  async getProfile(): Promise<ProfileData> {
    this.ensureConnected();
    // V8 doesn't support reading profile back — return defaults
    if (this.isV8()) {
      return { age: 25, height: 170, weight: 70, gender: 'male' };
    }
    const profile = await JstyleService.getProfile();
    return {
      age: profile.age,
      height: profile.height,
      weight: profile.weight,
      gender: profile.gender,
    };
  }

  async getGoal(): Promise<{ goal: number }> {
    this.ensureConnected();
    if (this.isV8()) return await V8Service.getGoal();
    return await JstyleService.getGoal();
  }

  async setGoal(goal: number): Promise<{ success: boolean }> {
    this.ensureConnected();
    if (this.isV8()) return await V8Service.setGoal(goal);
    return await JstyleService.setGoal(goal);
  }

  async setTimeFormat(is24Hour: boolean): Promise<{ success: boolean }> {
    this.ensureConnected();
    // X3 doesn't have a separate time format setting; time is set during sync
    return { success: true };
  }

  async setUnit(isMetric: boolean): Promise<{ success: boolean }> {
    this.ensureConnected();
    // X3 doesn't have a separate unit setting
    return { success: true };
  }

  async getDeviceTime(): Promise<{ time: string }> {
    return await JstyleService.getDeviceTime();
  }

  private _ringOffsetMs = 0;
  private _ringOffsetComputedAt = 0;
  private static readonly OFFSET_TTL_MS = 5 * 60_000; // 5 minutes

  /** Returns ms to add to ring timestamps to get device (wall-clock) time. Cached for 5 min. */
  async getRingOffsetMs(): Promise<number> {
    const age = Date.now() - this._ringOffsetComputedAt;
    if (age < UnifiedSmartRingService.OFFSET_TTL_MS) return this._ringOffsetMs;
    try {
      const { time } = await JstyleService.getDeviceTime();
      const [datePart, timePart] = time.split(' ');
      const [y, m, d] = datePart.split('.').map(Number);
      const [hh, mm, ss] = (timePart ?? '00:00:00').split(':').map(Number);
      const ringNow = new Date(y, m - 1, d, hh, mm, ss).getTime();
      this._ringOffsetMs = Date.now() - ringNow;
      this._ringOffsetComputedAt = Date.now();
    } catch {
      this._ringOffsetMs = 0;
    }
    return this._ringOffsetMs;
  }

  // ========== Device ==========

  findDevice(): void {
    console.log('🔔 Find device triggered');
  }

  async factoryReset(): Promise<{ success: boolean }> {
    this.ensureConnected();
    if (this.isV8()) return await V8Service.factoryReset();
    return await JstyleService.factoryReset();
  }

  // ========== Event Listeners ==========

  onConnectionStateChanged(callback: (state: ConnectionState) => void): () => void {
    this.jsConnectionListeners.add(callback);

    const unsubs: (() => void)[] = [];

    if (JstyleService.isAvailable()) {
      unsubs.push(JstyleService.onConnectionStateChanged(callback));
    }
    if (V8Service.isAvailable()) {
      unsubs.push(V8Service.onConnectionStateChanged(callback));
    }

    return () => {
      this.jsConnectionListeners.delete(callback);
      unsubs.forEach(u => u());
    };
  }

  onBluetoothStateChanged(callback: (state: BluetoothState) => void): () => void {
    const unsubs: (() => void)[] = [];

    if (JstyleService.isAvailable()) {
      unsubs.push(JstyleService.onBluetoothStateChanged(callback));
    }
    if (V8Service.isAvailable()) {
      unsubs.push(V8Service.onBluetoothStateChanged(callback));
    }

    return () => unsubs.forEach(u => u());
  }

  onDeviceDiscovered(callback: (device: DeviceInfo) => void): () => void {
    const unsubs: (() => void)[] = [];

    if (JstyleService.isAvailable()) {
      unsubs.push(JstyleService.onDeviceDiscovered((device) => {
        // Detect V8 bands by name even when discovered through Jstyle scanner
        const name = (device.name || '').toLowerCase();
        const isV8 = name.includes('v8') || name.includes('smartband');
        callback({
          ...device,
          sdkType: isV8 ? 'v8' : 'jstyle',
          deviceType: isV8 ? 'band' : 'ring',
        });
      }));
    }
    if (V8Service.isAvailable()) {
      unsubs.push(V8Service.onDeviceDiscovered((device) => {
        const name = (device.name || '').toLowerCase();
        const isX3 = name.includes('x3');
        const isX6 = name.includes('x6');
        callback({
          ...device,
          sdkType: isX3 ? 'jstyle' : 'v8',
          deviceType: isX3 || isX6 ? 'ring' : 'band',
        });
      }));
    }

    return () => unsubs.forEach(u => u());
  }

  onHeartRateReceived(callback: (data: HeartRateData) => void): () => void {
    const unsubs: (() => void)[] = [];

    if (JstyleService.isAvailable()) {
      unsubs.push(JstyleService.onHeartRateData((data) => {
        callback({ heartRate: data.heartRate, timestamp: data.timestamp });
      }));
    }
    if (V8Service.isAvailable()) {
      unsubs.push(V8Service.onHeartRateData((data) => {
        callback({ heartRate: data.heartRate, timestamp: data.timestamp });
      }));
    }

    return () => unsubs.forEach(u => u());
  }

  onStepsReceived(callback: (data: StepsData) => void): () => void {
    const unsubs: (() => void)[] = [];

    if (JstyleService.isAvailable()) {
      unsubs.push(JstyleService.onCurrentStepInfo((data) => {
        callback({
          steps: data.steps,
          distance: (data.distance || 0) * 1000, // km → m
          calories: data.calories,
          time: 0,
        });
      }));
    }
    if (V8Service.isAvailable()) {
      unsubs.push(V8Service.onRealTimeData((data: any) => {
        callback({
          steps: Number(data.steps) || 0,
          distance: (Number(data.distance) || 0) * 1000,
          calories: Number(data.calories) || 0,
          time: 0,
        });
      }));
    }

    return () => unsubs.forEach(u => u());
  }

  onSleepDataReceived(callback: (data: SleepData) => void): () => void {
    // Neither SDK has real-time sleep data events
    return () => {};
  }

  onBatteryReceived(callback: (data: BatteryData) => void): () => void {
    const unsubs: (() => void)[] = [];

    if (JstyleService.isAvailable()) {
      unsubs.push(JstyleService.onBatteryChanged(callback));
    }
    if (V8Service.isAvailable()) {
      unsubs.push(V8Service.onBatteryChanged(callback));
    }

    return () => unsubs.forEach(u => u());
  }

  onSpO2Received(callback: (data: SpO2Data) => void): () => void {
    const unsubs: (() => void)[] = [];

    if (JstyleService.isAvailable()) {
      unsubs.push(JstyleService.onSpO2Received(callback));
    }
    if (V8Service.isAvailable()) {
      unsubs.push(V8Service.onSpO2Received(callback));
    }

    return () => unsubs.forEach(u => u());
  }

  onBloodPressureReceived(callback: (data: BloodPressureData) => void): () => void {
    return () => {};
  }

  onError(callback: (error: any) => void): () => void {
    const unsubs: (() => void)[] = [];

    if (JstyleService.isAvailable()) {
      unsubs.push(JstyleService.onError(callback));
    }
    if (V8Service.isAvailable()) {
      unsubs.push(V8Service.onError(callback));
    }

    return () => unsubs.forEach(u => u());
  }

  // ========== Raw / Array Data Methods (for useHomeData, useMetricHistory, etc.) ==========

  /**
   * Raw sleep data with records array — used by useHomeData & BackgroundSleepTask
   */
  async getSleepDataRaw(): Promise<{ records: any[]; timestamp?: number }> {
    this.ensureConnected();
    console.log(`📱 [UnifiedService] getSleepDataRaw via ${this.connectedSDKType}`);
    if (this.isV8()) {
      // Return raw SDK records so deriveFromRaw() can parse them
      return await V8Service.getSleepDataRaw();
    }
    return await JstyleService.getSleepData();
  }

  /**
   * Continuous HR with {records} shape — used by useHomeData & DailyHeartRateCard
   * V8 returns flat HeartRateData[], so we group into the Jstyle record shape.
   */
  async getContinuousHeartRateRaw(): Promise<{ records: any[]; timestamp?: number }> {
    this.ensureConnected();
    console.log(`📱 [UnifiedService] getContinuousHeartRateRaw via ${this.connectedSDKType}`);
    if (this.isV8()) {
      const hrData = await V8Service.getContinuousHeartRate();
      // Group V8 flat records by date into Jstyle-compatible {date, arrayDynamicHR, startTimestamp}
      const byDate = new Map<string, { date: string; startTimestamp: number; arrayDynamicHR: number[] }>();
      for (const h of hrData) {
        if (h.heartRate <= 0 || !h.timestamp) continue;
        const d = new Date(h.timestamp);
        const dateStr = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
        if (!byDate.has(dateStr)) {
          const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
          byDate.set(dateStr, { date: dateStr, startTimestamp: midnight, arrayDynamicHR: new Array(1440).fill(0) });
        }
        const rec = byDate.get(dateStr)!;
        const minuteOfDay = d.getHours() * 60 + d.getMinutes();
        if (minuteOfDay >= 0 && minuteOfDay < 1440) {
          rec.arrayDynamicHR[minuteOfDay] = h.heartRate;
        }
      }
      // Trim trailing zeros from arrayDynamicHR
      for (const rec of byDate.values()) {
        let last = rec.arrayDynamicHR.length - 1;
        while (last >= 0 && rec.arrayDynamicHR[last] === 0) last--;
        rec.arrayDynamicHR = rec.arrayDynamicHR.slice(0, last + 1);
      }
      return { records: Array.from(byDate.values()), timestamp: Date.now() };
    }
    return await JstyleService.getContinuousHeartRate();
  }

  /**
   * Single/static HR with {records} shape — used by useHomeData as fallback
   * V8 uses continuous only, so returns empty.
   */
  async getSingleHeartRateRaw(): Promise<{ records: any[]; timestamp?: number }> {
    this.ensureConnected();
    console.log(`📱 [UnifiedService] getSingleHeartRateRaw via ${this.connectedSDKType}`);
    if (this.isV8()) {
      return { records: [], timestamp: Date.now() };
    }
    return await JstyleService.getSingleHeartRate();
  }

  /**
   * Normalized HRV array — used by useHomeData & useMetricHistory
   */
  async getHRVDataNormalizedArray(): Promise<HRVData[]> {
    this.ensureConnected();
    console.log(`📱 [UnifiedService] getHRVDataNormalizedArray via ${this.connectedSDKType}`);
    if (this.isV8()) {
      return await V8Service.getHRVDataNormalized();
    }
    return await JstyleService.getHRVDataNormalized();
  }

  /**
   * Normalized SpO2 array — used by useMetricHistory & TodayCardVitalsService
   */
  async getSpO2DataNormalizedArray(): Promise<SpO2Data[]> {
    this.ensureConnected();
    console.log(`📱 [UnifiedService] getSpO2DataNormalizedArray via ${this.connectedSDKType}`);
    if (this.isV8()) {
      return await V8Service.getSpO2DataNormalized();
    }
    return await JstyleService.getSpO2DataNormalized();
  }

  /**
   * Normalized temperature array — used by useMetricHistory & TodayCardVitalsService
   */
  async getTemperatureDataNormalizedArray(): Promise<TemperatureData[]> {
    this.ensureConnected();
    console.log(`📱 [UnifiedService] getTemperatureDataNormalizedArray via ${this.connectedSDKType}`);
    if (this.isV8()) {
      return await V8Service.getTemperatureDataNormalized();
    }
    return await JstyleService.getTemperatureDataNormalized();
  }

  /**
   * Raw SpO2 with records — used by TodayCardVitalsService
   */
  async getSpO2DataRaw(): Promise<{ records: any[] }> {
    this.ensureConnected();
    console.log(`📱 [UnifiedService] getSpO2DataRaw via ${this.connectedSDKType}`);
    if (this.isV8()) {
      const normalized = await V8Service.getSpO2DataNormalized();
      // Wrap V8 normalized array into the raw record shape TodayCardVitalsService expects
      return {
        records: [{
          arrayAutomaticSpo2Data: normalized.map(s => ({
            automaticSpo2Data: s.spo2,
            timestamp: s.timestamp,
          })),
        }],
      };
    }
    return await JstyleService.getSpO2Data();
  }

  /**
   * Start heart rate measurement — routes to correct SDK
   */
  async startHeartRateMeasuring(): Promise<{ success: boolean }> {
    this.ensureConnected();
    console.log(`📱 [UnifiedService] startHeartRateMeasuring via ${this.connectedSDKType}`);
    if (this.isV8()) {
      // Start realtime stream first (provides continuous HR), then manual measurement as fallback
      try { await V8Service.startRealTimeData(); } catch (e) { console.log('[UnifiedService] V8 startRealTimeData error:', e); }
      return await V8Service.startHeartRateMeasuring();
    }
    const result = await JstyleService.startHeartRateMeasuring();
    return { success: !!result?.success };
  }

  /**
   * Stop heart rate measurement — routes to correct SDK
   */
  async stopHeartRateMeasuring(): Promise<void> {
    console.log(`📱 [UnifiedService] stopHeartRateMeasuring via ${this.connectedSDKType}`);
    if (this.isV8()) {
      // V8 manual measurement auto-stops after duration
      return;
    }
    await JstyleService.stopHeartRateMeasuring();
  }

  /**
   * Stop real-time data stream
   */
  async stopRealTimeData(): Promise<void> {
    console.log(`📱 [UnifiedService] stopRealTimeData via ${this.connectedSDKType}`);
    if (this.isV8()) {
      try { await V8Service.stopRealTimeData(); } catch (e) { console.log('[UnifiedService] V8 stopRealTimeData error:', e); }
      return;
    }
    await JstyleService.stopRealTimeData();
  }

  // ========== SDK-Specific Feature Access ==========

  getJstyleService() {
    if (this.connectedSDKType === 'jstyle' || JstyleService.isAvailable()) {
      return JstyleService;
    }
    return null;
  }

  getV8Service() {
    if (this.connectedSDKType === 'v8' || V8Service.isAvailable()) {
      return V8Service;
    }
    return null;
  }
}

export default new UnifiedSmartRingService();
