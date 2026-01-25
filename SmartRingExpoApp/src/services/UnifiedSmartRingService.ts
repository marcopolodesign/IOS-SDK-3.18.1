/**
 * UnifiedSmartRingService - Unified interface for multiple smart ring SDKs
 *
 * This service provides a single API that works with:
 * - CRPSmartBand SDK (via SmartRingService)
 * - QCBandSDK (via QCBandService)
 *
 * It automatically detects which SDK is available and uses the appropriate one.
 * Requires a physical device connection - no mock data.
 */

import { Platform } from 'react-native';
import SmartRingService from './SmartRingService';
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

export type SDKType = 'crp' | 'qcband' | 'none';

interface UnifiedServiceConfig {
  preferredSDK?: SDKType;
}

class UnifiedSmartRingService {
  private activeSDK: SDKType = 'none';
  private config: UnifiedServiceConfig = {};

  // JavaScript-side connection state listeners (for manual state notifications)
  private jsConnectionListeners: Set<(state: ConnectionState) => void> = new Set();

  constructor() {
    this.config = { preferredSDK: 'qcband' };
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
   * Configure the service
   */
  configure(config: UnifiedServiceConfig): void {
    this.config = config;
    this.detectSDK();
  }

  /**
   * Detect which SDK is available
   * NOTE: Verbose logs disabled to reduce startup noise
   */
  private detectSDK(): void {
    if (Platform.OS !== 'ios') {
      this.activeSDK = 'none';
      return;
    }

    // Check for preferred SDK first
    if (this.config.preferredSDK === 'qcband' && QCBandService.isAvailable()) {
      this.activeSDK = 'qcband';
      return;
    }

    if (this.config.preferredSDK === 'crp' && SmartRingService.isNativeModuleAvailable()) {
      this.activeSDK = 'crp';
      return;
    }

    // Auto-detect: try QCBandSDK first (newer), then CRPSmartBand
    if (QCBandService.isAvailable()) {
      this.activeSDK = 'qcband';
      return;
    }

    if (SmartRingService.isNativeModuleAvailable()) {
      this.activeSDK = 'crp';
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
    return this.activeSDK !== 'none';
  }

  private ensureSDKAvailable(): void {
    if (this.activeSDK === 'none') {
      throw new Error('No Smart Ring SDK available - requires native iOS build with connected device');
    }
  }

  // ========== Connection Methods ==========

  async scan(duration: number = 10): Promise<DeviceInfo[]> {
    this.ensureSDKAvailable();
    switch (this.activeSDK) {
      case 'qcband':
        // QCBandService.scan() initiates scanning and devices arrive via onDeviceDiscovered events
        // It returns { success, message } not devices array
        await QCBandService.scan(duration);
        return []; // Devices will come through onDeviceDiscovered callback
      case 'crp':
        return await SmartRingService.scan(duration);
      default:
        return [];
    }
  }

  stopScan(): void {
    switch (this.activeSDK) {
      case 'qcband':
        QCBandService.stopScan();
        break;
      case 'crp':
        SmartRingService.stopScan();
        break;
    }
  }

  async connect(mac: string): Promise<{ success: boolean; message: string }> {
    this.ensureSDKAvailable();
    switch (this.activeSDK) {
      case 'qcband':
        return await QCBandService.connect(mac);
      case 'crp':
        return await SmartRingService.connect(mac);
      default:
        return { success: false, message: 'No SDK available' };
    }
  }

  disconnect(): void {
    switch (this.activeSDK) {
      case 'qcband':
        QCBandService.disconnect();
        break;
      case 'crp':
        SmartRingService.disconnect();
        break;
    }
  }

  async isConnected(): Promise<{
    connected: boolean;
    state: string;
    deviceName: string | null;
    deviceMac: string | null;
  }> {
    switch (this.activeSDK) {
      case 'qcband': {
        const status = await QCBandService.getConnectionStatus();
        return {
          connected: status.connected,
          state: status.state,
          deviceName: status.deviceName,
          deviceMac: status.deviceMac,
        };
      }
      case 'crp':
        return await SmartRingService.isConnected();
      default:
        return { connected: false, state: 'unavailable', deviceName: null, deviceMac: null };
    }
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
    switch (this.activeSDK) {
      case 'qcband': {
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
      case 'crp':
        return await SmartRingService.getFullConnectionStatus();
      default:
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
  }

  async getPairedDevice(): Promise<{
    hasPairedDevice: boolean;
    device: DeviceInfo | null;
  }> {
    switch (this.activeSDK) {
      case 'qcband':
        return await QCBandService.getPairedDevice();
      case 'crp':
        return await SmartRingService.getPairedDevice();
      default:
        return { hasPairedDevice: false, device: null };
    }
  }

  async forgetPairedDevice(): Promise<{ success: boolean; message: string }> {
    switch (this.activeSDK) {
      case 'qcband':
        return await QCBandService.forgetPairedDevice();
      case 'crp':
        return await SmartRingService.forgetPairedDevice();
      default:
        return { success: false, message: 'No SDK available' };
    }
  }

  async autoReconnect(): Promise<{ success: boolean; message: string; deviceId?: string; deviceName?: string }> {
    let result: { success: boolean; message: string; deviceId?: string; deviceName?: string };

    switch (this.activeSDK) {
      case 'qcband':
        result = await QCBandService.autoReconnect();
        break;
      case 'crp':
        // CRP doesn't have this method
        result = { success: false, message: 'Not supported' };
        break;
      default:
        result = { success: false, message: 'No SDK available' };
    }

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
    switch (this.activeSDK) {
      case 'qcband':
        return await QCBandService.getCurrentSteps();
      case 'crp':
        return await SmartRingService.getSteps();
      default:
        throw new Error('No SDK available');
    }
  }

  async getSleepData(): Promise<SleepData> {
    this.ensureSDKAvailable();
    switch (this.activeSDK) {
      case 'qcband':
        return await QCBandService.getSleepByDay(0);
      case 'crp':
        return await SmartRingService.getSleepData();
      default:
        throw new Error('No SDK available');
    }
  }

  async getBattery(): Promise<BatteryData> {
    this.ensureSDKAvailable();
    switch (this.activeSDK) {
      case 'qcband':
        return await QCBandService.getBattery();
      case 'crp':
        return await SmartRingService.getBattery();
      default:
        throw new Error('No SDK available');
    }
  }

  async getVersion(): Promise<{ version: string }> {
    this.ensureSDKAvailable();
    switch (this.activeSDK) {
      case 'qcband':
        const qcVersion = await QCBandService.getVersion();
        return { version: qcVersion.softwareVersion };
      case 'crp':
        return await SmartRingService.getVersion();
      default:
        throw new Error('No SDK available');
    }
  }

  async get24HourHeartRate(): Promise<number[]> {
    this.ensureSDKAvailable();
    switch (this.activeSDK) {
      case 'qcband':
        // QCBandSDK uses scheduled HR data
        const data = await QCBandService.getScheduledHeartRate([0]);
        return data.map(d => d.heartRate);
      case 'crp':
        return await SmartRingService.get24HourHeartRate();
      default:
        return [];
    }
  }

  async get24HourSteps(): Promise<number[]> {
    this.ensureSDKAvailable();
    switch (this.activeSDK) {
      case 'qcband':
        // Not provided by QCBandSDK; return empty array for now
        return [];
      case 'crp':
        return await SmartRingService.get24HourSteps();
      default:
        return [];
    }
  }

  async getHRVData(): Promise<HRVData> {
    this.ensureSDKAvailable();
    switch (this.activeSDK) {
      case 'qcband':
        const hrvData = await QCBandService.getHRVData([0]);
        return hrvData[0] || {};
      case 'crp':
        return await SmartRingService.getHRVData();
      default:
        throw new Error('No SDK available');
    }
  }

  async getStressData(): Promise<StressData> {
    this.ensureSDKAvailable();
    switch (this.activeSDK) {
      case 'qcband':
        const stressData = await QCBandService.getStressData([0]);
        return stressData[0] || { level: 0 };
      case 'crp':
        return await SmartRingService.getStressData();
      default:
        throw new Error('No SDK available');
    }
  }

  async getTemperature(): Promise<TemperatureData> {
    this.ensureSDKAvailable();
    switch (this.activeSDK) {
      case 'qcband':
        const tempData = await QCBandService.getScheduledTemperature(0);
        return tempData[0] || { temperature: 0 };
      case 'crp':
        return await SmartRingService.getTemperature();
      default:
        throw new Error('No SDK available');
    }
  }

  async getHeartRate(): Promise<HeartRateData> {
    this.ensureSDKAvailable();
    switch (this.activeSDK) {
      case 'qcband': {
        const data = await QCBandService.getScheduledHeartRate([0]);
        const first = data[0];
        return first || { heartRate: 0 };
      }
      case 'crp':
        return await SmartRingService.getHeartRate();
      default:
        throw new Error('No SDK available');
    }
  }

  async getSpO2(): Promise<SpO2Data> {
    this.ensureSDKAvailable();
    switch (this.activeSDK) {
      case 'qcband': {
        const data = await QCBandService.getManualBloodOxygen(0);
        const first = data[0];
        return first || { spo2: 0 };
      }
      case 'crp':
        return await SmartRingService.getSpO2();
      default:
        throw new Error('No SDK available');
    }
  }

  async getBloodGlucose(dayIndex: number = 0): Promise<Array<{
    glucose: number;
    minGlucose?: number;
    maxGlucose?: number;
    type?: number;
    gluType?: number;
    timestamp: number;
  }>> {
    switch (this.activeSDK) {
      case 'qcband':
        return await QCBandService.getBloodGlucose(dayIndex);
      case 'crp':
        return []; // Not supported
      default:
        return [];
    }
  }

  async measureHeartRate(): Promise<{ success: boolean }> {
    if (this.activeSDK === 'none') {
      return { success: false };
    }
    switch (this.activeSDK) {
      case 'qcband': {
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
      case 'crp':
        return await SmartRingService.measureHeartRate();
      default:
        return { success: false };
    }
  }

  // ========== Real-time Monitoring ==========

  startHeartRateMonitoring(): void {
    switch (this.activeSDK) {
      case 'qcband':
        QCBandService.startRealtimeHeartRate();
        break;
      case 'crp':
        SmartRingService.startHeartRateMonitoring();
        break;
    }
  }

  stopHeartRateMonitoring(): void {
    switch (this.activeSDK) {
      case 'qcband':
        QCBandService.stopRealtimeHeartRate();
        break;
      case 'crp':
        SmartRingService.stopHeartRateMonitoring();
        break;
    }
  }

  startSpO2Monitoring(): void {
    switch (this.activeSDK) {
      case 'qcband':
        // Start SpO2 measurement - results come via onSpO2Data event
        QCBandService.startMeasurement('spo2').catch(err => {
          console.log('⚠️ startMeasurement spo2 error:', err.message);
        });
        break;
      case 'crp':
        SmartRingService.startSpO2Monitoring();
        break;
    }
  }

  stopSpO2Monitoring(): void {
    switch (this.activeSDK) {
      case 'qcband':
        QCBandService.stopMeasurement('spo2').catch(err => {
          console.log('⚠️ stopMeasurement spo2 error:', err.message);
        });
        break;
      case 'crp':
        SmartRingService.stopSpO2Monitoring();
        break;
    }
  }

  startBloodPressureMonitoring(): void {
    switch (this.activeSDK) {
      case 'qcband':
        QCBandService.startMeasurement('bloodPressure').catch(err => {
          console.log('⚠️ startMeasurement bloodPressure error:', err.message);
        });
        break;
      case 'crp':
        SmartRingService.startBloodPressureMonitoring();
        break;
    }
  }

  stopBloodPressureMonitoring(): void {
    switch (this.activeSDK) {
      case 'qcband':
        QCBandService.stopMeasurement('bloodPressure').catch(err => {
          console.log('⚠️ stopMeasurement bloodPressure error:', err.message);
        });
        break;
      case 'crp':
        SmartRingService.stopBloodPressureMonitoring();
        break;
    }
  }

  // ========== Settings ==========

  async setProfile(profile: ProfileData): Promise<{ success: boolean }> {
    this.ensureSDKAvailable();
    switch (this.activeSDK) {
      case 'qcband':
        return await QCBandService.setProfile({
          is24Hour: true,
          isMetric: true,
          gender: profile.gender,
          age: profile.age,
          height: profile.height,
          weight: profile.weight,
        });
      case 'crp':
        return await SmartRingService.setProfile(profile);
      default:
        return { success: false };
    }
  }

  async getProfile(): Promise<ProfileData> {
    this.ensureSDKAvailable();
    switch (this.activeSDK) {
      case 'qcband': {
        const profile = await QCBandService.getProfile();
        return {
          age: profile.age,
          height: profile.height,
          weight: profile.weight,
          gender: profile.gender,
        };
      }
      case 'crp':
        return await SmartRingService.getProfile();
      default:
        throw new Error('No SDK available');
    }
  }

  async getGoal(): Promise<{ goal: number }> {
    this.ensureSDKAvailable();
    switch (this.activeSDK) {
      case 'qcband': {
        const data = await QCBandService.getGoal();
        return { goal: data.goal };
      }
      case 'crp': {
        const data = await SmartRingService.getGoal();
        return { goal: data.goal };
      }
      default:
        throw new Error('No SDK available');
    }
  }

  async setGoal(goal: number): Promise<{ success: boolean }> {
    this.ensureSDKAvailable();
    switch (this.activeSDK) {
      case 'qcband':
        return await QCBandService.setGoal(goal);
      case 'crp':
        return await SmartRingService.setGoal(goal);
      default:
        return { success: false };
    }
  }

  async setTimeFormat(is24Hour: boolean): Promise<{ success: boolean }> {
    this.ensureSDKAvailable();
    switch (this.activeSDK) {
      case 'qcband':
        return await QCBandService.setTimeFormat(is24Hour);
      case 'crp':
        return await SmartRingService.setTimeFormat(is24Hour);
      default:
        return { success: false };
    }
  }

  async setUnit(isMetric: boolean): Promise<{ success: boolean }> {
    this.ensureSDKAvailable();
    switch (this.activeSDK) {
      case 'qcband':
        return await QCBandService.setUnit(isMetric);
      case 'crp':
        return await SmartRingService.setUnit(isMetric);
      default:
        return { success: false };
    }
  }

  // ========== Device ==========

  findDevice(): void {
    switch (this.activeSDK) {
      case 'crp':
        SmartRingService.findDevice();
        break;
      default:
        console.log('🔔 Find device triggered');
        break;
    }
  }

  // ========== Event Listeners ==========

  onConnectionStateChanged(callback: (state: ConnectionState) => void): () => void {
    // Register for JS-side events (manual emissions from autoReconnect, etc.)
    this.jsConnectionListeners.add(callback);

    // Also register for native SDK events
    let nativeUnsubscribe: () => void = () => {};
    switch (this.activeSDK) {
      case 'qcband':
        nativeUnsubscribe = QCBandService.onConnectionStateChanged(callback);
        break;
      case 'crp':
        nativeUnsubscribe = SmartRingService.onConnectionStateChanged(callback);
        break;
    }

    // Return cleanup function that removes both
    return () => {
      this.jsConnectionListeners.delete(callback);
      nativeUnsubscribe();
    };
  }

  onBluetoothStateChanged(callback: (state: BluetoothState) => void): () => void {
    switch (this.activeSDK) {
      case 'qcband':
        return QCBandService.onBluetoothStateChanged(callback);
      case 'crp':
        return SmartRingService.onBluetoothStateChanged(callback);
      default:
        return () => {};
    }
  }

  onDeviceDiscovered(callback: (device: DeviceInfo) => void): () => void {
    switch (this.activeSDK) {
      case 'qcband':
        return QCBandService.onDeviceDiscovered(callback);
      case 'crp':
        return SmartRingService.onDeviceDiscovered(callback);
      default:
        return () => {};
    }
  }

  onHeartRateReceived(callback: (data: HeartRateData) => void): () => void {
    switch (this.activeSDK) {
      case 'qcband':
        return QCBandService.onRealtimeHeartRate((hr) => {
          callback({ heartRate: hr });
        });
      case 'crp':
        return SmartRingService.onHeartRateReceived(callback);
      default:
        return () => {};
    }
  }

  onStepsReceived(callback: (data: StepsData) => void): () => void {
    switch (this.activeSDK) {
      case 'qcband':
        return QCBandService.onCurrentStepInfo((data) => {
          callback({
            steps: data.steps,
            distance: data.distance,
            calories: data.calories,
            time: 0,
          });
        });
      case 'crp':
        return SmartRingService.onStepsReceived(callback);
      default:
        return () => {};
    }
  }

  onSleepDataReceived(callback: (data: SleepData) => void): () => void {
    switch (this.activeSDK) {
      case 'qcband':
        return () => {};
      case 'crp':
        return SmartRingService.onSleepDataReceived(callback);
      default:
        return () => {};
    }
  }

  onBatteryReceived(callback: (data: BatteryData) => void): () => void {
    switch (this.activeSDK) {
      case 'qcband':
        return QCBandService.onBatteryChanged(callback);
      case 'crp':
        return SmartRingService.onBatteryReceived(callback);
      default:
        return () => {};
    }
  }

  onSpO2Received(callback: (data: SpO2Data) => void): () => void {
    switch (this.activeSDK) {
      case 'qcband':
        return QCBandService.onSpO2Received(callback);
      case 'crp':
        return SmartRingService.onSpO2Received(callback);
      default:
        return () => {};
    }
  }

  onBloodPressureReceived(callback: (data: BloodPressureData) => void): () => void {
    switch (this.activeSDK) {
      case 'qcband':
        return () => {};
      case 'crp':
        return SmartRingService.onBloodPressureReceived(callback);
      default:
        return () => {};
    }
  }

  onError(callback: (error: any) => void): () => void {
    switch (this.activeSDK) {
      case 'qcband':
        return QCBandService.onError(callback);
      case 'crp':
        return SmartRingService.onError(callback);
      default:
        return () => {};
    }
  }

  // ========== QCBandSDK Specific Features ==========
  // These are only available when using QCBandSDK

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
