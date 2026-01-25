/**
 * UnifiedSmartRingService - Smart Ring SDK Interface
 *
 * This service provides the API for the QCBandSDK.
 * Requires a physical device connection - no mock data.
 */

import { Platform } from 'react-native';
import QCBandService from './QCBandService';
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

export type SDKType = 'qcband' | 'none';

class UnifiedSmartRingService {
  private activeSDK: SDKType = 'none';

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
   * Detect which SDK is available
   */
  private detectSDK(): void {
    if (Platform.OS !== 'ios') {
      this.activeSDK = 'none';
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
   * Check if using mock data (always false - mock data removed)
   */
  isUsingMockData(): boolean {
    return false;
  }

  /**
   * Check if any SDK is available
   */
  isSDKAvailable(): boolean {
    return this.activeSDK === 'qcband';
  }

  private ensureSDKAvailable(): void {
    if (this.activeSDK === 'none') {
      throw new Error('No Smart Ring SDK available - requires native iOS build with connected device');
    }
  }

  // ========== Connection Methods ==========

  async scan(duration: number = 10): Promise<DeviceInfo[]> {
    this.ensureSDKAvailable();
    // QCBandService.scan() initiates scanning and devices arrive via onDeviceDiscovered events
    await QCBandService.scan(duration);
    return []; // Devices will come through onDeviceDiscovered callback
  }

  stopScan(): void {
    if (this.activeSDK === 'qcband') {
      QCBandService.stopScan();
    }
  }

  async connect(mac: string): Promise<{ success: boolean; message: string }> {
    this.ensureSDKAvailable();
    return await QCBandService.connect(mac);
  }

  disconnect(): void {
    if (this.activeSDK === 'qcband') {
      QCBandService.disconnect();
    }
  }

  async isConnected(): Promise<{
    connected: boolean;
    state: string;
    deviceName: string | null;
    deviceMac: string | null;
  }> {
    if (this.activeSDK === 'qcband') {
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
    if (this.activeSDK === 'qcband') {
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
    if (this.activeSDK === 'qcband') {
      return await QCBandService.getPairedDevice();
    }
    return { hasPairedDevice: false, device: null };
  }

  async forgetPairedDevice(): Promise<{ success: boolean; message: string }> {
    if (this.activeSDK === 'qcband') {
      return await QCBandService.forgetPairedDevice();
    }
    return { success: false, message: 'No SDK available' };
  }

  async autoReconnect(): Promise<{ success: boolean; message: string; deviceId?: string; deviceName?: string }> {
    if (this.activeSDK !== 'qcband') {
      return { success: false, message: 'No SDK available' };
    }

    const result = await QCBandService.autoReconnect();

    // Manually emit connection state since native SDK may not emit events after autoReconnect
    if (result.success) {
      // Small delay to ensure native SDK is fully ready
      setTimeout(() => {
        this.emitConnectionState('connected');
      }, 500);
    }

    return result;
  }

  // ========== Data Retrieval ==========

  async getSteps(): Promise<StepsData> {
    this.ensureSDKAvailable();
    const data = await QCBandService.getCurrentSteps();
    const rawCalories = (data as any)?.calories ?? 0;
    // SDK reports calories scaled by 1000 (official provider format) -> convert to kcal.
    const normalizedCalories = Math.round(rawCalories / 1000);

    // Normalize to whole numbers to avoid fractional calories/steps coming from SDK
    return {
      ...data,
      steps: Math.round((data as any)?.steps ?? 0),
      calories: normalizedCalories,
      distance: Math.round((data as any)?.distance ?? 0),
      time: (data as any)?.time ?? 0,
    };
  }

  async getSleepData(): Promise<SleepData> {
    this.ensureSDKAvailable();
    return await QCBandService.getSleepByDay(0);
  }

  async getBattery(): Promise<BatteryData> {
    this.ensureSDKAvailable();
    return await QCBandService.getBattery();
  }

  async getVersion(): Promise<{ version: string }> {
    this.ensureSDKAvailable();
    const qcVersion = await QCBandService.getVersion();
    return { version: qcVersion.softwareVersion };
  }

  async get24HourHeartRate(): Promise<number[]> {
    this.ensureSDKAvailable();
    // QCBandSDK uses scheduled HR data
    const data = await QCBandService.getScheduledHeartRate([0]);
    return data.map(d => d.heartRate);
  }

  async getScheduledHeartRateRaw(days: number[] = [0]) {
    this.ensureSDKAvailable();
    const data = await QCBandService.getScheduledHeartRate(days);
    return data;
  }

  async get24HourSteps(): Promise<number[]> {
    this.ensureSDKAvailable();
    // Not provided by QCBandSDK; return empty array for now
    return [];
  }

  async getHRVData(): Promise<HRVData> {
    this.ensureSDKAvailable();
    const hrvData = await QCBandService.getHRVData([0]);
    return hrvData[0] || {};
  }

  async getStressData(): Promise<StressData> {
    this.ensureSDKAvailable();
    const stressData = await QCBandService.getStressData([0]);
    return stressData[0] || { level: 0 };
  }

  async getTemperature(): Promise<TemperatureData> {
    this.ensureSDKAvailable();
    const tempData = await QCBandService.getScheduledTemperature(0);
    return tempData[0] || { temperature: 0 };
  }

  async getHeartRate(): Promise<HeartRateData> {
    this.ensureSDKAvailable();
    const data = await QCBandService.getScheduledHeartRate([0]);
    const first = data[0];
    return first || { heartRate: 0 };
  }

  async getSpO2(): Promise<SpO2Data> {
    this.ensureSDKAvailable();
    const data = await QCBandService.getManualBloodOxygen(0);
    const first = data[0];
    return first || { spo2: 0 };
  }

  async getBloodGlucose(dayIndex: number = 0): Promise<Array<{
    glucose: number;
    minGlucose?: number;
    maxGlucose?: number;
    type?: number;
    gluType?: number;
    timestamp: number;
  }>> {
    if (this.activeSDK === 'qcband') {
      return await QCBandService.getBloodGlucose(dayIndex);
    }
    return [];
  }

  async measureHeartRate(): Promise<{ success: boolean }> {
    if (this.activeSDK !== 'qcband') {
      return { success: false };
    }
    // Use startHeartRateMeasuring for single measurement (more reliable)
    // Results come via onHeartRateData event
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
    if (this.activeSDK === 'qcband') {
      QCBandService.startRealtimeHeartRate();
    }
  }

  stopHeartRateMonitoring(): void {
    if (this.activeSDK === 'qcband') {
      QCBandService.stopRealtimeHeartRate();
    }
  }

  startSpO2Monitoring(): void {
    if (this.activeSDK === 'qcband') {
      // Start SpO2 measurement - results come via onSpO2Data event
      QCBandService.startMeasurement('spo2').catch(err => {
        console.log('⚠️ startMeasurement spo2 error:', err.message);
      });
    }
  }

  stopSpO2Monitoring(): void {
    if (this.activeSDK === 'qcband') {
      QCBandService.stopMeasurement('spo2').catch(err => {
        console.log('⚠️ stopMeasurement spo2 error:', err.message);
      });
    }
  }

  startBloodPressureMonitoring(): void {
    if (this.activeSDK === 'qcband') {
      QCBandService.startMeasurement('bloodPressure').catch(err => {
        console.log('⚠️ startMeasurement bloodPressure error:', err.message);
      });
    }
  }

  stopBloodPressureMonitoring(): void {
    if (this.activeSDK === 'qcband') {
      QCBandService.stopMeasurement('bloodPressure').catch(err => {
        console.log('⚠️ stopMeasurement bloodPressure error:', err.message);
      });
    }
  }

  // ========== Settings ==========

  async setProfile(profile: ProfileData): Promise<{ success: boolean }> {
    this.ensureSDKAvailable();
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
    this.ensureSDKAvailable();
    const profile = await QCBandService.getProfile();
    return {
      age: profile.age,
      height: profile.height,
      weight: profile.weight,
      gender: profile.gender,
    };
  }

  async getGoal(): Promise<{ goal: number }> {
    this.ensureSDKAvailable();
    const data = await QCBandService.getGoal();
    return { goal: data.goal };
  }

  async setGoal(goal: number): Promise<{ success: boolean }> {
    this.ensureSDKAvailable();
    return await QCBandService.setGoal(goal);
  }

  async setTimeFormat(is24Hour: boolean): Promise<{ success: boolean }> {
    this.ensureSDKAvailable();
    return await QCBandService.setTimeFormat(is24Hour);
  }

  async setUnit(isMetric: boolean): Promise<{ success: boolean }> {
    this.ensureSDKAvailable();
    return await QCBandService.setUnit(isMetric);
  }

  // ========== Device ==========

  findDevice(): void {
    console.log('🔔 Find device triggered');
  }

  // ========== Event Listeners ==========

  onConnectionStateChanged(callback: (state: ConnectionState) => void): () => void {
    // Register for JS-side events (manual emissions from autoReconnect, etc.)
    this.jsConnectionListeners.add(callback);

    // Also register for native SDK events
    let nativeUnsubscribe: () => void = () => {};
    if (this.activeSDK === 'qcband') {
      nativeUnsubscribe = QCBandService.onConnectionStateChanged(callback);
    }

    // Return cleanup function that removes both
    return () => {
      this.jsConnectionListeners.delete(callback);
      nativeUnsubscribe();
    };
  }

  onBluetoothStateChanged(callback: (state: BluetoothState) => void): () => void {
    if (this.activeSDK === 'qcband') {
      return QCBandService.onBluetoothStateChanged(callback);
    }
    return () => {};
  }

  onDeviceDiscovered(callback: (device: DeviceInfo) => void): () => void {
    if (this.activeSDK === 'qcband') {
      return QCBandService.onDeviceDiscovered(callback);
    }
    return () => {};
  }

  onHeartRateReceived(callback: (data: HeartRateData) => void): () => void {
    if (this.activeSDK === 'qcband') {
      return QCBandService.onRealtimeHeartRate((hr) => {
        callback({ heartRate: hr });
      });
    }
    return () => {};
  }

  onStepsReceived(callback: (data: StepsData) => void): () => void {
    if (this.activeSDK === 'qcband') {
      return QCBandService.onCurrentStepInfo((data) => {
        callback({
          steps: data.steps,
          distance: data.distance,
          calories: data.calories,
          time: 0,
        });
      });
    }
    return () => {};
  }

  onSleepDataReceived(callback: (data: SleepData) => void): () => void {
    // QCBandSDK doesn't have real-time sleep data events
    return () => {};
  }

  onBatteryReceived(callback: (data: BatteryData) => void): () => void {
    if (this.activeSDK === 'qcband') {
      return QCBandService.onBatteryChanged(callback);
    }
    return () => {};
  }

  onSpO2Received(callback: (data: SpO2Data) => void): () => void {
    if (this.activeSDK === 'qcband') {
      return QCBandService.onSpO2Received(callback);
    }
    return () => {};
  }

  onBloodPressureReceived(callback: (data: BloodPressureData) => void): () => void {
    // QCBandSDK doesn't have blood pressure events in current implementation
    return () => {};
  }

  onError(callback: (error: any) => void): () => void {
    if (this.activeSDK === 'qcband') {
      return QCBandService.onError(callback);
    }
    return () => {};
  }

  // ========== QCBandSDK Specific Features ==========

  getQCBandService() {
    if (this.activeSDK === 'qcband') {
      return QCBandService;
    }
    return null;
  }

  // Ring-specific features
  async startWearCalibration(timeout: number = 120): Promise<{ success: boolean } | null> {
    if (this.activeSDK === 'qcband') {
      return await QCBandService.startWearCalibration(timeout);
    }
    return null;
  }

  async getFlipWristInfo(): Promise<{ enable: boolean; hand: 'left' | 'right' } | null> {
    if (this.activeSDK === 'qcband') {
      return await QCBandService.getFlipWristInfo();
    }
    return null;
  }

  // Sport mode
  async startSportMode(type: string): Promise<{ success: boolean } | null> {
    if (this.activeSDK === 'qcband') {
      return await QCBandService.startSportMode(type);
    }
    return null;
  }

  async stopSportMode(type: string): Promise<{ success: boolean } | null> {
    if (this.activeSDK === 'qcband') {
      return await QCBandService.stopSportMode(type);
    }
    return null;
  }

  // Camera control
  async switchToPhotoMode(): Promise<{ success: boolean } | null> {
    if (this.activeSDK === 'qcband') {
      return await QCBandService.switchToPhotoMode();
    }
    return null;
  }
}

export default new UnifiedSmartRingService();
