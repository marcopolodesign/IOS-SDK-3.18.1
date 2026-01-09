import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import SmartRingMockService from './SmartRingMockService';
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

// Toggle this to use mock data instead of real SDK
// Set to true to use sample/mock data (useful for testing without a physical device)
const USE_MOCK_DATA = false; // Real SDK enabled for physical ring testing

// Safely get native module - will be null if not available (e.g., in Expo Go)
let SmartRingBridge: any = null;
let eventEmitter: NativeEventEmitter | null = null;

try {
  SmartRingBridge = NativeModules.SmartRingBridge;
  if (SmartRingBridge) {
    eventEmitter = new NativeEventEmitter(SmartRingBridge);
  }
} catch (error) {
  console.log('Native module not available, using mock mode');
}

class SmartRingService implements Partial<ISmartRingService> {
  private useMock: boolean;
  private debugSubscription: any = null;

  constructor() {
    this.useMock = USE_MOCK_DATA || !SmartRingBridge;
    if (this.useMock) {
      console.log('📱 SmartRingService: Using MOCK DATA mode');
    } else {
      console.log('📱 SmartRingService: Using REAL SDK mode');
      // Set up debug log listener
      this.setupDebugListener();
    }
  }

  private setupDebugListener() {
    if (eventEmitter && !this.debugSubscription) {
      this.debugSubscription = eventEmitter.addListener('onDebugLog', (data: { message: string; timestamp: number }) => {
        console.log(`🔧 [SDK] ${data.message}`);
      });
      console.log('📱 Debug log listener set up');
    }
  }

  // Connection Methods
  async scan(duration: number = 10): Promise<DeviceInfo[]> {
    if (this.useMock) {
      return await SmartRingMockService.scan(duration);
    }
    if (Platform.OS !== 'ios') {
      throw new Error('Smart Ring SDK is only available on iOS');
    }
    return await SmartRingBridge.scan(duration);
  }

  // Unfiltered scan for debugging - shows ALL Bluetooth devices including TVs, etc.
  async scanAll(duration: number = 10): Promise<(DeviceInfo & { isRingOrBand?: boolean })[]> {
    if (this.useMock) {
      return await SmartRingMockService.scan(duration) as (DeviceInfo & { isRingOrBand?: boolean })[];
    }
    if (Platform.OS !== 'ios') {
      throw new Error('Smart Ring SDK is only available on iOS');
    }
    console.log('🔍 Starting unfiltered scan (debug mode)...');
    return await SmartRingBridge.scanAll(duration);
  }

  stopScan(): void {
    if (this.useMock) {
      SmartRingMockService.stopScan();
    } else {
      SmartRingBridge.stopScan();
    }
  }

  async connect(mac: string): Promise<{ success: boolean; message: string }> {
    if (this.useMock) {
      return await SmartRingMockService.connect(mac);
    }
    return await SmartRingBridge.connect(mac);
  }

  disconnect(): void {
    if (this.useMock) {
      SmartRingMockService.disconnect();
    } else {
      SmartRingBridge.disconnect();
    }
  }

  reconnect(): void {
    if (this.useMock) {
      SmartRingMockService.reconnect();
    } else {
      SmartRingBridge.reconnect();
    }
  }

  async isConnected(): Promise<{
    connected: boolean;
    state: string;
    deviceName: string | null;
    deviceMac: string | null;
  }> {
    if (this.useMock) {
      return { connected: false, state: 'disconnected', deviceName: null, deviceMac: null };
    }
    const result = await SmartRingBridge.isConnected();
    console.log('🔍 isConnected result:', result);
    return result;
  }

  // Get the currently connected device (if any)
  async getConnectedDevice(): Promise<{
    connected: boolean;
    device: DeviceInfo | null;
    state?: string;
    message?: string;
  }> {
    if (this.useMock) {
      return { connected: false, device: null };
    }
    const result = await SmartRingBridge.getConnectedDevice();
    console.log('🔍 getConnectedDevice result:', result);
    return result;
  }

  // Reset connection state (use if connection is stuck)
  async resetConnection(): Promise<{ success: boolean; message: string }> {
    if (this.useMock) {
      return { success: true, message: 'Mock reset' };
    }
    console.log('🔄 Resetting connection...');
    return await SmartRingBridge.resetConnection();
  }

  // Data Retrieval
  async getSteps(): Promise<StepsData> {
    if (this.useMock) {
      return await SmartRingMockService.getSteps();
    }
    return await SmartRingBridge.getSteps();
  }

  async getSleepData(): Promise<SleepData> {
    if (this.useMock) {
      return await SmartRingMockService.getSleepData();
    }
    return await SmartRingBridge.getSleepData();
  }

  async getBattery(): Promise<BatteryData> {
    if (this.useMock) {
      return await SmartRingMockService.getBattery();
    }
    return await SmartRingBridge.getBattery();
  }

  async getVersion(): Promise<{ version: string }> {
    if (this.useMock) {
      return await SmartRingMockService.getVersion();
    }
    return await SmartRingBridge.getVersion();
  }

  async get24HourHeartRate(): Promise<number[]> {
    if (this.useMock) {
      return await SmartRingMockService.get24HourHeartRate();
    }
    return await SmartRingBridge.get24HourHeartRate();
  }

  async get24HourSteps(): Promise<number[]> {
    if (this.useMock) {
      return await SmartRingMockService.get24HourSteps();
    }
    return await SmartRingBridge.get24HourSteps();
  }

  async getProfile(): Promise<ProfileData> {
    if (this.useMock) {
      return await SmartRingMockService.getProfile();
    }
    return await SmartRingBridge.getProfile();
  }

  async getGoal(): Promise<{ goal: number }> {
    if (this.useMock) {
      return await SmartRingMockService.getGoal();
    }
    return await SmartRingBridge.getGoal();
  }

  async getSportData(): Promise<SportData[]> {
    if (this.useMock) {
      return await SmartRingMockService.getSportData();
    }
    return await SmartRingBridge.getSportData();
  }

  async getAllData(): Promise<{ steps: StepsData[]; sleep: SleepData[] }> {
    if (this.useMock) {
      return await SmartRingMockService.getAllData();
    }
    return await SmartRingBridge.getAllData();
  }

  async getHRVData(): Promise<HRVData> {
    if (this.useMock) {
      return await SmartRingMockService.getHRVData();
    }
    // Note: Real implementation would need to be added to native bridge
    throw new Error('HRV data not available');
  }

  async getStressData(): Promise<StressData> {
    if (this.useMock) {
      return await SmartRingMockService.getStressData();
    }
    throw new Error('Stress data not available');
  }

  async getTemperature(): Promise<TemperatureData> {
    if (this.useMock) {
      return await SmartRingMockService.getTemperature();
    }
    throw new Error('Temperature data not available');
  }

  // Real-time Monitoring
  startHeartRateMonitoring(): void {
    if (this.useMock) {
      SmartRingMockService.startHeartRateMonitoring();
    } else {
      SmartRingBridge.startHeartRateMonitoring();
    }
  }

  stopHeartRateMonitoring(): void {
    if (this.useMock) {
      SmartRingMockService.stopHeartRateMonitoring();
    } else {
      SmartRingBridge.stopHeartRateMonitoring();
    }
  }

  startSpO2Monitoring(): void {
    if (this.useMock) {
      SmartRingMockService.startSpO2Monitoring();
    } else {
      SmartRingBridge.startSpO2Monitoring();
    }
  }

  stopSpO2Monitoring(): void {
    if (this.useMock) {
      SmartRingMockService.stopSpO2Monitoring();
    } else {
      SmartRingBridge.stopSpO2Monitoring();
    }
  }

  startBloodPressureMonitoring(): void {
    if (this.useMock) {
      SmartRingMockService.startBloodPressureMonitoring();
    } else {
      SmartRingBridge.startBloodPressureMonitoring();
    }
  }

  stopBloodPressureMonitoring(): void {
    if (this.useMock) {
      SmartRingMockService.stopBloodPressureMonitoring();
    } else {
      SmartRingBridge.stopBloodPressureMonitoring();
    }
  }

  // Settings
  async setGoal(goal: number): Promise<{ success: boolean }> {
    if (this.useMock) {
      return await SmartRingMockService.setGoal(goal);
    }
    return await SmartRingBridge.setGoal(goal);
  }

  async setProfile(profile: ProfileData): Promise<{ success: boolean }> {
    if (this.useMock) {
      return await SmartRingMockService.setProfile(profile);
    }
    return await SmartRingBridge.setProfile(profile);
  }

  async setTimeFormat(is24Hour: boolean): Promise<{ success: boolean }> {
    if (this.useMock) {
      return { success: true };
    }
    return await SmartRingBridge.setTimeFormat(is24Hour);
  }

  async setUnit(isMetric: boolean): Promise<{ success: boolean }> {
    if (this.useMock) {
      return { success: true };
    }
    return await SmartRingBridge.setUnit(isMetric);
  }

  // Device
  findDevice(): void {
    if (this.useMock) {
      console.log('🔔 Find device triggered (mock)');
    } else {
      SmartRingBridge.findDevice();
    }
  }

  // Event Listeners
  onConnectionStateChanged(callback: (state: ConnectionState) => void): () => void {
    if (this.useMock) {
      return SmartRingMockService.onConnectionStateChanged(callback);
    }
    if (!eventEmitter) return () => {};
    const subscription = eventEmitter.addListener('onConnectionStateChanged', (event) => {
      callback(event.state);
    });
    return () => subscription.remove();
  }

  onBluetoothStateChanged(callback: (state: BluetoothState) => void): () => void {
    if (this.useMock) {
      return SmartRingMockService.onBluetoothStateChanged(callback);
    }
    if (!eventEmitter) return () => {};
    const subscription = eventEmitter.addListener('onBluetoothStateChanged', (event) => {
      callback(event.state);
    });
    return () => subscription.remove();
  }

  onDeviceDiscovered(callback: (device: DeviceInfo) => void): () => void {
    if (this.useMock) {
      return SmartRingMockService.onDeviceDiscovered(callback);
    }
    if (!eventEmitter) return () => {};
    const subscription = eventEmitter.addListener('onDeviceDiscovered', (device) => {
      callback(device);
    });
    return () => subscription.remove();
  }

  onStepsReceived(callback: (data: StepsData) => void): () => void {
    if (this.useMock) {
      return SmartRingMockService.onStepsReceived(callback);
    }
    if (!eventEmitter) return () => {};
    const subscription = eventEmitter.addListener('onStepsReceived', (data) => {
      callback(data);
    });
    return () => subscription.remove();
  }

  onHeartRateReceived(callback: (data: HeartRateData) => void): () => void {
    if (this.useMock) {
      return SmartRingMockService.onHeartRateReceived(callback);
    }
    if (!eventEmitter) return () => {};
    const subscription = eventEmitter.addListener('onHeartRateReceived', (data) => {
      callback(data);
    });
    return () => subscription.remove();
  }

  onSleepDataReceived(callback: (data: SleepData) => void): () => void {
    if (this.useMock) {
      return SmartRingMockService.onSleepDataReceived(callback);
    }
    if (!eventEmitter) return () => {};
    const subscription = eventEmitter.addListener('onSleepDataReceived', (data) => {
      callback(data);
    });
    return () => subscription.remove();
  }

  onBatteryReceived(callback: (data: BatteryData) => void): () => void {
    if (this.useMock) {
      return SmartRingMockService.onBatteryReceived(callback);
    }
    if (!eventEmitter) return () => {};
    const subscription = eventEmitter.addListener('onBatteryReceived', (data) => {
      callback(data);
    });
    return () => subscription.remove();
  }

  onSpO2Received(callback: (data: SpO2Data) => void): () => void {
    if (this.useMock) {
      return SmartRingMockService.onSpO2Received(callback);
    }
    if (!eventEmitter) return () => {};
    const subscription = eventEmitter.addListener('onSpO2Received', (data) => {
      callback(data);
    });
    return () => subscription.remove();
  }

  onBloodPressureReceived(callback: (data: BloodPressureData) => void): () => void {
    if (this.useMock) {
      return SmartRingMockService.onBloodPressureReceived(callback);
    }
    if (!eventEmitter) return () => {};
    const subscription = eventEmitter.addListener('onBloodPressureReceived', (data) => {
      callback(data);
    });
    return () => subscription.remove();
  }

  onUpgradeProgress(callback: (progress: UpgradeProgress) => void): () => void {
    if (this.useMock) {
      return () => {};
    }
    if (!eventEmitter) return () => {};
    const subscription = eventEmitter.addListener('onUpgradeProgress', (data) => {
      callback(data);
    });
    return () => subscription.remove();
  }

  onError(callback: (error: any) => void): () => void {
    if (this.useMock) {
      return SmartRingMockService.onError(callback);
    }
    if (!eventEmitter) return () => {};
    const subscription = eventEmitter.addListener('onError', (error) => {
      callback(error);
    });
    return () => subscription.remove();
  }

  // Helper to check if using mock data
  isUsingMockData(): boolean {
    return this.useMock;
  }
}

export default new SmartRingService();
