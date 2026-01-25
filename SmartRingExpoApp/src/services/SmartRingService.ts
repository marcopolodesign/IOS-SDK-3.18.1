import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
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
  SportData,
  ConnectionState,
  BluetoothState,
  UpgradeProgress,
  ISmartRingService,
} from '../types/sdk.types';

// Re-export types for convenience
export type {
  DeviceInfo,
  StepsData,
  SleepData,
  HeartRateData,
  BloodPressureData,
  SpO2Data,
  BatteryData,
  ProfileData,
  ConnectionState,
  BluetoothState,
};

// Safely get native module - will be null if not available (e.g., in Expo Go)
let SmartRingBridge: any = null;
let eventEmitter: NativeEventEmitter | null = null;

try {
  SmartRingBridge = NativeModules.SmartRingBridge;
  if (SmartRingBridge) {
    eventEmitter = new NativeEventEmitter(SmartRingBridge);
  }
} catch (error) {
  // Native module not available - silent fail
}

class SmartRingService implements Partial<ISmartRingService> {
  private debugSubscription: any = null;
  private isNativeAvailable: boolean;

  constructor() {
    this.isNativeAvailable = !!SmartRingBridge;
    if (this.isNativeAvailable) {
      // Silent - using real SDK
      this.setupDebugListener();
    }
    // No log for native module not available - reduces startup noise
  }

  private setupDebugListener() {
    if (eventEmitter && !this.debugSubscription) {
      this.debugSubscription = eventEmitter.addListener('onDebugLog', (data: { message: string; timestamp: number }) => {
        console.log(`🔧 [SDK] ${data.message}`);
      });
      // Silent - debug listener set up
    }
  }

  private ensureNativeAvailable(): void {
    if (!this.isNativeAvailable) {
      throw new Error('Smart Ring SDK not available - requires native iOS build');
    }
  }

  // Check for previously paired device (doesn't trigger scan or pairing prompt)
  async getPairedDevice(): Promise<{
    hasPairedDevice: boolean;
    device: DeviceInfo | null;
  }> {
    if (!this.isNativeAvailable) {
      return { hasPairedDevice: false, device: null };
    }
    if (Platform.OS !== 'ios') {
      return { hasPairedDevice: false, device: null };
    }
    try {
      const result = await SmartRingBridge.getPairedDevice();
      console.log('🔍 getPairedDevice result:', result);
      return {
        hasPairedDevice: result.hasPairedDevice,
        device: result.hasPairedDevice ? result.device : null,
      };
    } catch (error) {
      console.log('⚠️ getPairedDevice error:', error);
      return { hasPairedDevice: false, device: null };
    }
  }

  // Forget/clear the paired device from SDK memory
  async forgetPairedDevice(): Promise<{ success: boolean; message: string }> {
    if (!this.isNativeAvailable) {
      return { success: false, message: 'Native module not available' };
    }
    if (Platform.OS !== 'ios') {
      return { success: false, message: 'Only available on iOS' };
    }
    try {
      const result = await SmartRingBridge.forgetPairedDevice();
      console.log('🗑️ forgetPairedDevice result:', result);
      return result;
    } catch (error) {
      console.log('⚠️ forgetPairedDevice error:', error);
      return { success: false, message: 'Failed to forget device' };
    }
  }

  // Connection Methods
  async scan(duration: number = 10): Promise<DeviceInfo[]> {
    this.ensureNativeAvailable();
    if (Platform.OS !== 'ios') {
      throw new Error('Smart Ring SDK is only available on iOS');
    }
    return await SmartRingBridge.scan(duration);
  }

  // Unfiltered scan for debugging - shows ALL Bluetooth devices including TVs, etc.
  async scanAll(duration: number = 10): Promise<(DeviceInfo & { isRingOrBand?: boolean })[]> {
    this.ensureNativeAvailable();
    if (Platform.OS !== 'ios') {
      throw new Error('Smart Ring SDK is only available on iOS');
    }
    console.log('🔍 Starting unfiltered scan (debug mode)...');
    return await SmartRingBridge.scanAll(duration);
  }

  stopScan(): void {
    if (this.isNativeAvailable) {
      SmartRingBridge.stopScan();
    }
  }

  async connect(mac: string): Promise<{ success: boolean; message: string }> {
    this.ensureNativeAvailable();
    return await SmartRingBridge.connect(mac);
  }

  disconnect(): void {
    if (this.isNativeAvailable) {
      SmartRingBridge.disconnect();
    }
  }

  reconnect(): void {
    if (this.isNativeAvailable) {
      SmartRingBridge.reconnect();
    }
  }

  async isConnected(): Promise<{
    connected: boolean;
    state: string;
    deviceName: string | null;
    deviceMac: string | null;
  }> {
    if (!this.isNativeAvailable) {
      return { connected: false, state: 'unavailable', deviceName: null, deviceMac: null };
    }
    const result = await SmartRingBridge.isConnected();
    console.log('🔍 isConnected result:', result);
    return result;
  }

  // Get full connection status with detailed state info - for debugging
  // States: 0=Unbind, 1=Connecting, 2=Connected, 3=Disconnecting,
  //         4=Disconnected, 5=Syncing, 6=SyncSuccess, 7=SyncError
  async getFullConnectionStatus(): Promise<{
    managerState: string;
    managerStateCode: number;
    cachedState: string;
    cachedStateCode: number;
    isConnected: boolean;
    deviceName: string | null;
    deviceMac: string | null;
  }> {
    if (!this.isNativeAvailable) {
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
    try {
      const result = await SmartRingBridge.getFullConnectionStatus();
      console.log('📊 Full Connection Status:', JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      console.log('⚠️ getFullConnectionStatus error:', error);
      return {
        managerState: 'error',
        managerStateCode: -1,
        cachedState: 'error',
        cachedStateCode: -1,
        isConnected: false,
        deviceName: null,
        deviceMac: null,
      };
    }
  }

  // Get the currently connected device (if any)
  async getConnectedDevice(): Promise<{
    connected: boolean;
    device: DeviceInfo | null;
    state?: string;
    message?: string;
  }> {
    if (!this.isNativeAvailable) {
      return { connected: false, device: null, state: 'unavailable' };
    }
    const result = await SmartRingBridge.getConnectedDevice();
    console.log('🔍 getConnectedDevice result:', result);
    return result;
  }

  // Reset connection state (use if connection is stuck)
  async resetConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.isNativeAvailable) {
      return { success: false, message: 'Native module not available' };
    }
    console.log('🔄 Resetting connection...');
    return await SmartRingBridge.resetConnection();
  }

  // Data Retrieval
  async getSteps(): Promise<StepsData> {
    this.ensureNativeAvailable();
    return await SmartRingBridge.getSteps();
  }

  async getSleepData(): Promise<SleepData> {
    this.ensureNativeAvailable();
    return await SmartRingBridge.getSleepData();
  }

  async getBattery(): Promise<BatteryData> {
    this.ensureNativeAvailable();
    return await SmartRingBridge.getBattery();
  }

  async getVersion(): Promise<{ version: string }> {
    this.ensureNativeAvailable();
    return await SmartRingBridge.getVersion();
  }

  // Get latest heart rate from 24-hour data
  async getHeartRate(): Promise<HeartRateData> {
    this.ensureNativeAvailable();
    try {
      // Get 24-hour heart rate data and return the most recent non-zero value
      const data = await SmartRingBridge.get24HourHeartRate();
      console.log('📊 Raw heart rate data:', JSON.stringify(data));
      const values = data.heartRates || data || [];
      // Find the most recent non-zero heart rate
      let latestHR = 0;
      for (let i = values.length - 1; i >= 0; i--) {
        if (values[i] > 0) {
          latestHR = values[i];
          break;
        }
      }
      return { heartRate: latestHR, timestamp: Date.now() };
    } catch (error: any) {
      console.log('⚠️ getHeartRate error:', error.message);
      return { heartRate: 0, timestamp: Date.now() };
    }
  }

  // Get latest SpO2 - uses auto O2 data
  async getSpO2(): Promise<SpO2Data> {
    this.ensureNativeAvailable();
    // Try to get today's auto O2 data
    try {
      // Note: The SDK might not have a direct getSpO2 method
      // We'll return a default value and rely on real-time monitoring
      // For now, return 0 which indicates no data available
      return { spo2: 0, timestamp: Date.now() };
    } catch (error) {
      return { spo2: 0, timestamp: Date.now() };
    }
  }

  async get24HourHeartRate(): Promise<number[]> {
    this.ensureNativeAvailable();
    return await SmartRingBridge.get24HourHeartRate();
  }

  async get24HourSteps(): Promise<number[]> {
    this.ensureNativeAvailable();
    return await SmartRingBridge.get24HourSteps();
  }

  async getProfile(): Promise<ProfileData> {
    this.ensureNativeAvailable();
    return await SmartRingBridge.getProfile();
  }

  async getGoal(): Promise<{ goal: number }> {
    this.ensureNativeAvailable();
    return await SmartRingBridge.getGoal();
  }

  async getSportData(): Promise<SportData[]> {
    this.ensureNativeAvailable();
    return await SmartRingBridge.getSportData();
  }

  async getAllData(): Promise<{ steps: StepsData[]; sleep: SleepData[] }> {
    this.ensureNativeAvailable();
    return await SmartRingBridge.getAllData();
  }

  async getHRVData(): Promise<HRVData> {
    this.ensureNativeAvailable();
    // Note: Real implementation would need to be added to native bridge
    throw new Error('HRV data not available');
  }

  async getStressData(): Promise<StressData> {
    this.ensureNativeAvailable();
    throw new Error('Stress data not available');
  }

  async getTemperature(): Promise<TemperatureData> {
    this.ensureNativeAvailable();
    throw new Error('Temperature data not available');
  }

  // Real-time Monitoring
  // Start a real-time heart rate measurement (result comes via onHeartRateReceived event)
  async measureHeartRate(): Promise<{ success: boolean }> {
    if (!this.isNativeAvailable) {
      return { success: false };
    }
    try {
      const result = await SmartRingBridge.getCurrentHeartRate();
      console.log('💓 measureHeartRate result:', result);
      return { success: true };
    } catch (error: any) {
      console.log('⚠️ measureHeartRate error:', error.message);
      return { success: false };
    }
  }

  startHeartRateMonitoring(): void {
    if (this.isNativeAvailable) {
      SmartRingBridge.startHeartRateMonitoring();
    }
  }

  stopHeartRateMonitoring(): void {
    if (this.isNativeAvailable) {
      SmartRingBridge.stopHeartRateMonitoring();
    }
  }

  startSpO2Monitoring(): void {
    if (this.isNativeAvailable) {
      SmartRingBridge.startSpO2Monitoring();
    }
  }

  stopSpO2Monitoring(): void {
    if (this.isNativeAvailable) {
      SmartRingBridge.stopSpO2Monitoring();
    }
  }

  startBloodPressureMonitoring(): void {
    if (this.isNativeAvailable) {
      SmartRingBridge.startBloodPressureMonitoring();
    }
  }

  stopBloodPressureMonitoring(): void {
    if (this.isNativeAvailable) {
      SmartRingBridge.stopBloodPressureMonitoring();
    }
  }

  // Settings
  async setGoal(goal: number): Promise<{ success: boolean }> {
    this.ensureNativeAvailable();
    return await SmartRingBridge.setGoal(goal);
  }

  async setProfile(profile: ProfileData): Promise<{ success: boolean }> {
    this.ensureNativeAvailable();
    return await SmartRingBridge.setProfile(profile);
  }

  async setTimeFormat(is24Hour: boolean): Promise<{ success: boolean }> {
    this.ensureNativeAvailable();
    return await SmartRingBridge.setTimeFormat(is24Hour);
  }

  async setUnit(isMetric: boolean): Promise<{ success: boolean }> {
    this.ensureNativeAvailable();
    return await SmartRingBridge.setUnit(isMetric);
  }

  // Device
  findDevice(): void {
    if (this.isNativeAvailable) {
      SmartRingBridge.findDevice();
    }
  }

  // Event Listeners
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
    const subscription = eventEmitter.addListener('onDeviceDiscovered', (device) => {
      callback(device);
    });
    return () => subscription.remove();
  }

  onStepsReceived(callback: (data: StepsData) => void): () => void {
    if (!eventEmitter) return () => {};
    const subscription = eventEmitter.addListener('onStepsReceived', (data) => {
      callback(data);
    });
    return () => subscription.remove();
  }

  onHeartRateReceived(callback: (data: HeartRateData) => void): () => void {
    if (!eventEmitter) return () => {};
    const subscription = eventEmitter.addListener('onHeartRateReceived', (data) => {
      callback(data);
    });
    return () => subscription.remove();
  }

  onSleepDataReceived(callback: (data: SleepData) => void): () => void {
    if (!eventEmitter) return () => {};
    const subscription = eventEmitter.addListener('onSleepDataReceived', (data) => {
      callback(data);
    });
    return () => subscription.remove();
  }

  onBatteryReceived(callback: (data: BatteryData) => void): () => void {
    if (!eventEmitter) return () => {};
    const subscription = eventEmitter.addListener('onBatteryReceived', (data) => {
      callback(data);
    });
    return () => subscription.remove();
  }

  onSpO2Received(callback: (data: SpO2Data) => void): () => void {
    if (!eventEmitter) return () => {};
    const subscription = eventEmitter.addListener('onSpO2Received', (data) => {
      callback(data);
    });
    return () => subscription.remove();
  }

  onBloodPressureReceived(callback: (data: BloodPressureData) => void): () => void {
    if (!eventEmitter) return () => {};
    const subscription = eventEmitter.addListener('onBloodPressureReceived', (data) => {
      callback(data);
    });
    return () => subscription.remove();
  }

  onUpgradeProgress(callback: (progress: UpgradeProgress) => void): () => void {
    if (!eventEmitter) return () => {};
    const subscription = eventEmitter.addListener('onUpgradeProgress', (data) => {
      callback(data);
    });
    return () => subscription.remove();
  }

  // Called when device is fully ready after sync (time synced, ready for data requests)
  onDeviceReady(callback: (data: { deviceName: string; deviceMac: string; timestamp: number }) => void): () => void {
    if (!eventEmitter) return () => {};
    const subscription = eventEmitter.addListener('onDeviceReady', (data) => {
      console.log('📱 Device ready event received:', data);
      callback(data);
    });
    return () => subscription.remove();
  }

  // Start continuous (real-time) heart rate streaming
  async startContinuousHeartRate(): Promise<{ success: boolean; message: string }> {
    if (!this.isNativeAvailable) {
      return { success: false, message: 'Native module not available' };
    }
    if (Platform.OS !== 'ios') {
      return { success: false, message: 'Only available on iOS' };
    }
    try {
      const result = await SmartRingBridge.startContinuousHeartRate();
      console.log('💓 startContinuousHeartRate result:', result);
      return result;
    } catch (error) {
      console.log('⚠️ startContinuousHeartRate error:', error);
      return { success: false, message: 'Failed to start continuous HR' };
    }
  }

  // Stop continuous heart rate streaming
  async stopContinuousHeartRate(): Promise<{ success: boolean }> {
    if (!this.isNativeAvailable) {
      return { success: false };
    }
    if (Platform.OS !== 'ios') {
      return { success: false };
    }
    try {
      const result = await SmartRingBridge.stopContinuousHeartRate();
      console.log('💓 stopContinuousHeartRate result:', result);
      return result;
    } catch (error) {
      console.log('⚠️ stopContinuousHeartRate error:', error);
      return { success: false };
    }
  }

  onError(callback: (error: any) => void): () => void {
    if (!eventEmitter) return () => {};
    const subscription = eventEmitter.addListener('onError', (error) => {
      callback(error);
    });
    return () => subscription.remove();
  }

  // Helper to check if native SDK is available (no more mock mode)
  isUsingMockData(): boolean {
    return false; // Mock data is completely removed
  }

  // Check if native module is available
  isNativeModuleAvailable(): boolean {
    return this.isNativeAvailable;
  }
}

export default new SmartRingService();
