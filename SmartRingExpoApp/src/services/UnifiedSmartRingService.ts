/**
 * UnifiedSmartRingService - Dual SDK Smart Ring Interface
 *
 * Routes commands to the correct SDK based on which device is connected:
 * - Focus R1 → QCBandSDK (QCBandService)
 * - Focus X3 → Jstyle BleSDK (JstyleService)
 *
 * Scanning discovers devices from both SDKs simultaneously.
 * Once connected, all data commands route to the appropriate SDK.
 */

import { Platform } from 'react-native';
import QCBandService from './QCBandService';
import JstyleService from './JstyleService';
import type {
  DeviceInfo,
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
} from '../types/sdk.types';

export type SDKType = 'qcband' | 'jstyle' | 'none';

class UnifiedSmartRingService {
  private activeSDK: SDKType = 'none';
  private connectedSDKType: SDKType = 'none';
  private autoReconnectInFlight: Promise<{ success: boolean; message: string; deviceId?: string; deviceName?: string }> | null = null;

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

    // Prefer Jstyle (X3/BleSDK) as default active SDK; fall back to QCBand (R1) if not available
    if (JstyleService.isAvailable()) {
      this.activeSDK = 'jstyle';
      return;
    }

    if (QCBandService.isAvailable()) {
      this.activeSDK = 'qcband';
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
  setConnectedSDKType(type: SDKType): void {
    console.log('📱 [UnifiedService] Setting connected SDK type:', type);
    this.connectedSDKType = type;
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
    return QCBandService.isAvailable() || JstyleService.isAvailable();
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

    // Start scanning on both SDKs in parallel
    const promises: Promise<any>[] = [];

    if (QCBandService.isAvailable()) {
      promises.push(
        QCBandService.scan(duration).catch(err => {
          console.log('⚠️ QCBand scan error:', err.message);
        })
      );
    }

    if (JstyleService.isAvailable()) {
      promises.push(
        JstyleService.scan(duration).catch(err => {
          console.log('⚠️ Jstyle scan error:', err.message);
        })
      );
    }

    await Promise.allSettled(promises);
    return []; // Devices will come through onDeviceDiscovered callbacks
  }

  stopScan(): void {
    if (QCBandService.isAvailable()) {
      QCBandService.stopScan();
    }
    if (JstyleService.isAvailable()) {
      JstyleService.stopScan();
    }
  }

  async connect(mac: string, sdkType?: SDKType): Promise<{ success: boolean; message: string }> {
    this.ensureSDKAvailable();

    const type = sdkType || 'qcband';
    this.connectedSDKType = type;

    if (type === 'jstyle') {
      return await JstyleService.connect(mac);
    }
    return await QCBandService.connect(mac);
  }

  disconnect(): void {
    if (this.connectedSDKType === 'jstyle') {
      JstyleService.disconnect();
    } else if (this.connectedSDKType === 'qcband' || this.activeSDK === 'qcband') {
      QCBandService.disconnect();
    }
    this.connectedSDKType = 'none';
  }

  async isConnected(): Promise<{
    connected: boolean;
    state: string;
    deviceName: string | null;
    deviceMac: string | null;
  }> {
    if (this.connectedSDKType === 'jstyle') {
      const status = await JstyleService.isConnected();
      return {
        connected: status.connected,
        state: status.state,
        deviceName: status.deviceName,
        deviceMac: status.deviceId,
      };
    }
    if (this.connectedSDKType === 'qcband' || this.activeSDK === 'qcband') {
      const status = await QCBandService.getConnectionStatus();
      return {
        connected: status.connected,
        state: status.state,
        deviceName: status.deviceName,
        deviceMac: status.deviceMac,
      };
    }
    return { connected: false, state: 'unavailable', deviceName: null, deviceMac: null };
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
    if (this.connectedSDKType === 'jstyle') {
      const status = await JstyleService.isConnected();
      return {
        managerState: status.state,
        managerStateCode: status.connected ? 3 : 0,
        cachedState: status.state,
        cachedStateCode: status.connected ? 3 : 0,
        isConnected: status.connected,
        deviceName: status.deviceName,
        deviceMac: status.deviceId,
      };
    }
    if (this.connectedSDKType === 'qcband' || this.activeSDK === 'qcband') {
      const status = await QCBandService.getConnectionStatus();
      return {
        managerState: status.state,
        managerStateCode: status.stateCode,
        cachedState: status.state,
        cachedStateCode: status.stateCode,
        isConnected: status.connected,
        deviceName: status.deviceName,
        deviceMac: status.deviceMac,
      };
    }
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
    // Check Jstyle first, then QCBand
    if (JstyleService.isAvailable()) {
      const jResult = await JstyleService.getPairedDevice();
      if (jResult.hasPairedDevice && jResult.device) {
        return {
          hasPairedDevice: true,
          device: { ...jResult.device, sdkType: 'jstyle' },
        };
      }
    }

    if (QCBandService.isAvailable()) {
      const qcResult = await QCBandService.getPairedDevice();
      if (qcResult.hasPairedDevice && qcResult.device) {
        return {
          hasPairedDevice: true,
          device: { ...qcResult.device, sdkType: 'qcband' },
        };
      }
    }

    return { hasPairedDevice: false, device: null };
  }

  async forgetPairedDevice(): Promise<{ success: boolean; message: string }> {
    if (this.connectedSDKType === 'jstyle') {
      return await JstyleService.forgetPairedDevice();
    }
    if (this.connectedSDKType === 'qcband' || this.activeSDK === 'qcband') {
      return await QCBandService.forgetPairedDevice();
    }
    return { success: false, message: 'No SDK available' };
  }

  async autoReconnect(): Promise<{ success: boolean; message: string; deviceId?: string; deviceName?: string }> {
    if (this.autoReconnectInFlight) {
      return this.autoReconnectInFlight;
    }

    this.autoReconnectInFlight = (async () => {
      if (JstyleService.isAvailable()) {
        try {
          const jStatus = await JstyleService.isConnected();
          if (jStatus.connected) {
            this.connectedSDKType = 'jstyle';
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

      if (QCBandService.isAvailable()) {
        try {
          const qcStatus = await QCBandService.getConnectionStatus();
          if (qcStatus.connected) {
            this.connectedSDKType = 'qcband';
            return {
              success: true,
              message: 'Already connected',
              deviceId: qcStatus.deviceMac ?? undefined,
              deviceName: qcStatus.deviceName ?? undefined,
            };
          }
        } catch (e) {
          console.log('⚠️ QCBand isConnected check failed:', e);
        }
      }

      // Try Jstyle first, then QCBand
      if (JstyleService.isAvailable()) {
        try {
          const jPaired = await JstyleService.hasPairedDevice();
          if (jPaired.hasPairedDevice) {
            this.connectedSDKType = 'jstyle';
            const result = await JstyleService.autoReconnect();
            if (result.success) {
              setTimeout(() => this.emitConnectionState('connected'), 500);
              return result;
            }
            this.connectedSDKType = 'none';
          }
        } catch (e) {
          console.log('⚠️ Jstyle autoReconnect failed:', e);
        }
      }

      if (QCBandService.isAvailable()) {
        try {
          const qcPaired = await QCBandService.hasPairedDevice();
          if (qcPaired.hasPairedDevice) {
            this.connectedSDKType = 'qcband';
            const result = await QCBandService.autoReconnect();
            if (result.success) {
              setTimeout(() => this.emitConnectionState('connected'), 500);
              return result;
            }
            this.connectedSDKType = 'none';
          }
        } catch (e) {
          console.log('⚠️ QCBand autoReconnect failed:', e);
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

  // ========== Data Retrieval ==========

  async getSteps(): Promise<StepsData> {
    this.ensureConnected();

    if (this.connectedSDKType === 'jstyle') {
      return await JstyleService.getSteps();
    }

    const data = await QCBandService.getCurrentSteps();
    const rawCalories = (data as any)?.calories ?? 0;
    const normalizedCalories = Math.round(rawCalories / 1000);

    return {
      ...data,
      steps: Math.round((data as any)?.steps ?? 0),
      calories: normalizedCalories,
      distance: Math.round((data as any)?.distance ?? 0),
      time: (data as any)?.time ?? 0,
    };
  }

  async getSleepData(): Promise<SleepData> {
    this.ensureConnected();

    if (this.connectedSDKType === 'jstyle') {
      return await JstyleService.getSleepByDay(0);
    }

    return await QCBandService.getSleepByDay(0);
  }

  async getBattery(): Promise<BatteryData> {
    this.ensureConnected();

    if (this.connectedSDKType === 'jstyle') {
      return await JstyleService.getBattery();
    }

    return await QCBandService.getBattery();
  }

  async getVersion(): Promise<{ version: string }> {
    this.ensureConnected();

    if (this.connectedSDKType === 'jstyle') {
      const info = await JstyleService.getVersion();
      return { version: info.softwareVersion };
    }

    const qcVersion = await QCBandService.getVersion();
    return { version: qcVersion.softwareVersion };
  }

  async get24HourHeartRate(): Promise<number[]> {
    this.ensureConnected();

    if (this.connectedSDKType === 'jstyle') {
      const data = await JstyleService.getScheduledHeartRate([0]);
      return data.map(d => d.heartRate);
    }

    const data = await QCBandService.getScheduledHeartRate([0]);
    return data.map(d => d.heartRate);
  }

  async getScheduledHeartRateRaw(days: number[] = [0]) {
    this.ensureConnected();

    if (this.connectedSDKType === 'jstyle') {
      // X3 continuous HR records contain no timestamp fields, only raw HR arrays.
      // HRV data includes per-record timestamps AND heartRate values (hourly cadence),
      // making it the only reliable source for time-of-day HR charting on X3.
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

    return await QCBandService.getScheduledHeartRate(days);
  }

  async get24HourSteps(): Promise<number[]> {
    this.ensureConnected();
    return [];
  }

  async getHRVData(): Promise<HRVData> {
    this.ensureConnected();

    if (this.connectedSDKType === 'jstyle') {
      const data = await JstyleService.getHRVDataNormalized();
      return data[0] || {};
    }

    const hrvData = await QCBandService.getHRVData([0]);
    return hrvData[0] || {};
  }

  async getStressData(): Promise<StressData> {
    this.ensureConnected();

    if (this.connectedSDKType === 'jstyle') {
      // X3 doesn't have a dedicated stress endpoint; derive from HRV if needed
      return { level: 0 };
    }

    const stressData = await QCBandService.getStressData([0]);
    return stressData[0] || { level: 0 };
  }

  async getTemperature(): Promise<TemperatureData> {
    this.ensureConnected();

    if (this.connectedSDKType === 'jstyle') {
      const data = await JstyleService.getTemperatureDataNormalized();
      return data[0] || { temperature: 0 };
    }

    const tempData = await QCBandService.getScheduledTemperature(0);
    return tempData[0] || { temperature: 0 };
  }

  async getHeartRate(): Promise<HeartRateData> {
    this.ensureConnected();

    if (this.connectedSDKType === 'jstyle') {
      const data = await JstyleService.getScheduledHeartRate([0]);
      return data[0] || { heartRate: 0 };
    }

    const data = await QCBandService.getScheduledHeartRate([0]);
    return data[0] || { heartRate: 0 };
  }

  async getSleepByDay(dayIndex: number = 0): Promise<SleepData | null> {
    try {
      this.ensureConnected();

      if (this.connectedSDKType === 'jstyle') {
        return await JstyleService.getSleepByDay(dayIndex);
      }

      return await QCBandService.getSleepByDay(dayIndex);
    } catch (e) {
      console.log('getSleepByDay error', e);
      return null;
    }
  }

  async getSpO2(): Promise<SpO2Data> {
    this.ensureConnected();

    if (this.connectedSDKType === 'jstyle') {
      const data = await JstyleService.getSpO2DataNormalized();
      return data[0] || { spo2: 0 };
    }

    const data = await QCBandService.getManualBloodOxygen(0);
    return data[0] || { spo2: 0 };
  }

  async getBloodGlucose(dayIndex: number = 0): Promise<Array<{
    glucose: number;
    minGlucose?: number;
    maxGlucose?: number;
    type?: number;
    gluType?: number;
    timestamp: number;
  }>> {
    if (this.connectedSDKType === 'qcband') {
      return await QCBandService.getBloodGlucose(dayIndex);
    }
    // X3 doesn't support blood glucose
    return [];
  }

  async measureHeartRate(): Promise<{ success: boolean }> {
    this.ensureConnected();

    if (this.connectedSDKType === 'jstyle') {
      const result = await JstyleService.startHeartRateMeasuring();
      return { success: !!result?.success };
    }

    try {
      const result = await QCBandService.startHeartRateMeasuring();
      return { success: !!result?.success };
    } catch (error) {
      console.log('⚠️ startHeartRateMeasuring failed, trying startMeasurement:', error);
      const result = await QCBandService.startMeasurement('heartRate');
      return { success: !!result?.success || result?.success === undefined };
    }
  }

  // ========== Real-time Monitoring ==========

  startHeartRateMonitoring(): void {
    if (this.connectedSDKType === 'jstyle') {
      JstyleService.startRealTimeHeartRate();
    } else if (this.connectedSDKType === 'qcband') {
      QCBandService.startRealtimeHeartRate();
    }
  }

  stopHeartRateMonitoring(): void {
    if (this.connectedSDKType === 'jstyle') {
      JstyleService.stopRealTimeHeartRate();
    } else if (this.connectedSDKType === 'qcband') {
      QCBandService.stopRealtimeHeartRate();
    }
  }

  startSpO2Monitoring(): void {
    if (this.connectedSDKType === 'jstyle') {
      JstyleService.startSpO2Measuring().catch(err => {
        console.log('⚠️ Jstyle startSpO2 error:', err.message);
      });
    } else if (this.connectedSDKType === 'qcband') {
      QCBandService.startMeasurement('spo2').catch(err => {
        console.log('⚠️ startMeasurement spo2 error:', err.message);
      });
    }
  }

  stopSpO2Monitoring(): void {
    if (this.connectedSDKType === 'jstyle') {
      JstyleService.stopSpO2Measuring().catch(err => {
        console.log('⚠️ Jstyle stopSpO2 error:', err.message);
      });
    } else if (this.connectedSDKType === 'qcband') {
      QCBandService.stopMeasurement('spo2').catch(err => {
        console.log('⚠️ stopMeasurement spo2 error:', err.message);
      });
    }
  }

  startBloodPressureMonitoring(): void {
    if (this.connectedSDKType === 'qcband') {
      QCBandService.startMeasurement('bloodPressure').catch(err => {
        console.log('⚠️ startMeasurement bloodPressure error:', err.message);
      });
    }
    // X3 doesn't have dedicated BP measurement; BP comes from HRV data
  }

  stopBloodPressureMonitoring(): void {
    if (this.connectedSDKType === 'qcband') {
      QCBandService.stopMeasurement('bloodPressure').catch(err => {
        console.log('⚠️ stopMeasurement bloodPressure error:', err.message);
      });
    }
  }

  // ========== Settings ==========

  async setProfile(profile: ProfileData): Promise<{ success: boolean }> {
    this.ensureConnected();

    if (this.connectedSDKType === 'jstyle') {
      return await JstyleService.setProfile({
        gender: profile.gender,
        age: profile.age,
        height: profile.height,
        weight: profile.weight,
      });
    }

    return await QCBandService.setProfile({
      is24Hour: true,
      isMetric: true,
      gender: profile.gender,
      age: profile.age,
      height: profile.height,
      weight: profile.weight,
    });
  }

  async getProfile(): Promise<ProfileData> {
    this.ensureConnected();

    if (this.connectedSDKType === 'jstyle') {
      const profile = await JstyleService.getProfile();
      return {
        age: profile.age,
        height: profile.height,
        weight: profile.weight,
        gender: profile.gender,
      };
    }

    const profile = await QCBandService.getProfile();
    return {
      age: profile.age,
      height: profile.height,
      weight: profile.weight,
      gender: profile.gender,
    };
  }

  async getGoal(): Promise<{ goal: number }> {
    this.ensureConnected();

    if (this.connectedSDKType === 'jstyle') {
      return await JstyleService.getGoal();
    }

    return await QCBandService.getGoal();
  }

  async setGoal(goal: number): Promise<{ success: boolean }> {
    this.ensureConnected();

    if (this.connectedSDKType === 'jstyle') {
      return await JstyleService.setGoal(goal);
    }

    return await QCBandService.setGoal(goal);
  }

  async setTimeFormat(is24Hour: boolean): Promise<{ success: boolean }> {
    this.ensureConnected();

    if (this.connectedSDKType === 'jstyle') {
      // X3 doesn't have a separate time format setting; time is set during sync
      return { success: true };
    }

    return await QCBandService.setTimeFormat(is24Hour);
  }

  async setUnit(isMetric: boolean): Promise<{ success: boolean }> {
    this.ensureConnected();

    if (this.connectedSDKType === 'jstyle') {
      // X3 doesn't have a separate unit setting
      return { success: true };
    }

    return await QCBandService.setUnit(isMetric);
  }

  // ========== Device ==========

  findDevice(): void {
    console.log('🔔 Find device triggered');
  }

  async factoryReset(): Promise<{ success: boolean }> {
    this.ensureConnected();

    if (this.connectedSDKType === 'jstyle') {
      return await JstyleService.factoryReset();
    }

    console.log('⚠️ factoryReset is not implemented for QCBandService');
    return { success: false };
  }

  // ========== Event Listeners ==========

  onConnectionStateChanged(callback: (state: ConnectionState) => void): () => void {
    this.jsConnectionListeners.add(callback);

    const unsubs: (() => void)[] = [];

    if (QCBandService.isAvailable()) {
      unsubs.push(QCBandService.onConnectionStateChanged(callback));
    }
    if (JstyleService.isAvailable()) {
      unsubs.push(JstyleService.onConnectionStateChanged(callback));
    }

    return () => {
      this.jsConnectionListeners.delete(callback);
      unsubs.forEach(u => u());
    };
  }

  onBluetoothStateChanged(callback: (state: BluetoothState) => void): () => void {
    const unsubs: (() => void)[] = [];

    if (QCBandService.isAvailable()) {
      unsubs.push(QCBandService.onBluetoothStateChanged(callback));
    }
    if (JstyleService.isAvailable()) {
      unsubs.push(JstyleService.onBluetoothStateChanged(callback));
    }

    return () => unsubs.forEach(u => u());
  }

  onDeviceDiscovered(callback: (device: DeviceInfo) => void): () => void {
    const unsubs: (() => void)[] = [];

    if (QCBandService.isAvailable()) {
      unsubs.push(QCBandService.onDeviceDiscovered((device) => {
        callback({ ...device, sdkType: 'qcband' });
      }));
    }
    if (JstyleService.isAvailable()) {
      unsubs.push(JstyleService.onDeviceDiscovered((device) => {
        callback({ ...device, sdkType: 'jstyle' });
      }));
    }

    return () => unsubs.forEach(u => u());
  }

  onHeartRateReceived(callback: (data: HeartRateData) => void): () => void {
    const unsubs: (() => void)[] = [];

    if (QCBandService.isAvailable()) {
      unsubs.push(QCBandService.onRealtimeHeartRate((hr) => {
        callback({ heartRate: hr });
      }));
    }
    if (JstyleService.isAvailable()) {
      unsubs.push(JstyleService.onHeartRateData((data) => {
        callback({ heartRate: data.heartRate, timestamp: data.timestamp });
      }));
    }

    return () => unsubs.forEach(u => u());
  }

  onStepsReceived(callback: (data: StepsData) => void): () => void {
    const unsubs: (() => void)[] = [];

    if (QCBandService.isAvailable()) {
      unsubs.push(QCBandService.onCurrentStepInfo((data) => {
        callback({
          steps: data.steps,
          distance: data.distance,
          calories: data.calories,
          time: 0,
        });
      }));
    }
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

    return () => unsubs.forEach(u => u());
  }

  onSleepDataReceived(callback: (data: SleepData) => void): () => void {
    // Neither SDK has real-time sleep data events
    return () => {};
  }

  onBatteryReceived(callback: (data: BatteryData) => void): () => void {
    const unsubs: (() => void)[] = [];

    if (QCBandService.isAvailable()) {
      unsubs.push(QCBandService.onBatteryChanged(callback));
    }
    if (JstyleService.isAvailable()) {
      unsubs.push(JstyleService.onBatteryChanged(callback));
    }

    return () => unsubs.forEach(u => u());
  }

  onSpO2Received(callback: (data: SpO2Data) => void): () => void {
    const unsubs: (() => void)[] = [];

    if (QCBandService.isAvailable()) {
      unsubs.push(QCBandService.onSpO2Received(callback));
    }
    if (JstyleService.isAvailable()) {
      unsubs.push(JstyleService.onSpO2Received(callback));
    }

    return () => unsubs.forEach(u => u());
  }

  onBloodPressureReceived(callback: (data: BloodPressureData) => void): () => void {
    return () => {};
  }

  onError(callback: (error: any) => void): () => void {
    const unsubs: (() => void)[] = [];

    if (QCBandService.isAvailable()) {
      unsubs.push(QCBandService.onError(callback));
    }
    if (JstyleService.isAvailable()) {
      unsubs.push(JstyleService.onError(callback));
    }

    return () => unsubs.forEach(u => u());
  }

  // ========== SDK-Specific Feature Access ==========

  getQCBandService() {
    if (this.connectedSDKType === 'qcband' || this.activeSDK === 'qcband') {
      return QCBandService;
    }
    return null;
  }

  getJstyleService() {
    if (this.connectedSDKType === 'jstyle' || JstyleService.isAvailable()) {
      return JstyleService;
    }
    return null;
  }

  // Ring-specific features (QCBand only)
  async startWearCalibration(timeout: number = 120): Promise<{ success: boolean } | null> {
    if (this.connectedSDKType === 'qcband') {
      return await QCBandService.startWearCalibration(timeout);
    }
    return null;
  }

  async getFlipWristInfo(): Promise<{ enable: boolean; hand: 'left' | 'right' } | null> {
    if (this.connectedSDKType === 'qcband') {
      return await QCBandService.getFlipWristInfo();
    }
    return null;
  }

  // Sport mode
  async startSportMode(type: string): Promise<{ success: boolean } | null> {
    if (this.connectedSDKType === 'qcband') {
      return await QCBandService.startSportMode(type);
    }
    return null;
  }

  async stopSportMode(type: string): Promise<{ success: boolean } | null> {
    if (this.connectedSDKType === 'qcband') {
      return await QCBandService.stopSportMode(type);
    }
    return null;
  }

  // Camera control
  async switchToPhotoMode(): Promise<{ success: boolean } | null> {
    if (this.connectedSDKType === 'qcband') {
      return await QCBandService.switchToPhotoMode();
    }
    return null;
  }
}

export default new UnifiedSmartRingService();
