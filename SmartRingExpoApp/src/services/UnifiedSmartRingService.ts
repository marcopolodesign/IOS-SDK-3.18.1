/**
 * UnifiedSmartRingService - Unified interface for multiple smart ring SDKs
 * 
 * This service provides a single API that works with:
 * - CRPSmartBand SDK (via SmartRingService)
 * - QCBandSDK (via QCBandService)
 * - Mock data (for development and testing)
 * 
 * It automatically detects which SDK is available and uses the appropriate one.
 */

import { Platform } from 'react-native';
import SmartRingService from './SmartRingService';
import QCBandService from './QCBandService';
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
  ConnectionState,
  BluetoothState,
} from '../types/sdk.types';

export type SDKType = 'crp' | 'qcband' | 'mock' | 'none';

interface UnifiedServiceConfig {
  preferMock?: boolean;
  preferredSDK?: SDKType;
}

class UnifiedSmartRingService {
  private activeSDK: SDKType = 'none';
  private config: UnifiedServiceConfig = {};

  constructor() {
    this.detectSDK();
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
   */
  private detectSDK(): void {
    if (this.config.preferMock || (__DEV__ && this.config.preferMock !== false)) {
      this.activeSDK = 'mock';
      console.log('📱 UnifiedSmartRingService: Using MOCK mode');
      return;
    }

    if (Platform.OS !== 'ios') {
      this.activeSDK = 'mock';
      console.log('📱 UnifiedSmartRingService: Non-iOS platform, using MOCK mode');
      return;
    }

    // Check for preferred SDK first
    if (this.config.preferredSDK === 'qcband' && QCBandService.isAvailable()) {
      this.activeSDK = 'qcband';
      console.log('📱 UnifiedSmartRingService: Using QCBandSDK');
      return;
    }

    if (this.config.preferredSDK === 'crp' && !SmartRingService.isUsingMockData()) {
      this.activeSDK = 'crp';
      console.log('📱 UnifiedSmartRingService: Using CRPSmartBand SDK');
      return;
    }

    // Auto-detect: try QCBandSDK first (newer), then CRPSmartBand
    if (QCBandService.isAvailable()) {
      this.activeSDK = 'qcband';
      console.log('📱 UnifiedSmartRingService: Auto-detected QCBandSDK');
      return;
    }

    if (!SmartRingService.isUsingMockData()) {
      this.activeSDK = 'crp';
      console.log('📱 UnifiedSmartRingService: Auto-detected CRPSmartBand SDK');
      return;
    }

    this.activeSDK = 'mock';
    console.log('📱 UnifiedSmartRingService: No SDK detected, using MOCK mode');
  }

  /**
   * Get the currently active SDK type
   */
  getActiveSDK(): SDKType {
    return this.activeSDK;
  }

  /**
   * Check if using mock data
   */
  isUsingMockData(): boolean {
    return this.activeSDK === 'mock';
  }

  // ========== Connection Methods ==========

  async scan(duration: number = 10): Promise<DeviceInfo[]> {
    switch (this.activeSDK) {
      case 'qcband':
        return await QCBandService.scan(duration);
      case 'crp':
        return await SmartRingService.scan(duration);
      case 'mock':
      default:
        return await SmartRingMockService.scan(duration);
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
      case 'mock':
      default:
        SmartRingMockService.stopScan();
        break;
    }
  }

  async connect(mac: string): Promise<{ success: boolean; message: string }> {
    switch (this.activeSDK) {
      case 'qcband':
        return await QCBandService.connect(mac);
      case 'crp':
        return await SmartRingService.connect(mac);
      case 'mock':
      default:
        return await SmartRingMockService.connect(mac);
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
      case 'mock':
      default:
        SmartRingMockService.disconnect();
        break;
    }
  }

  // ========== Data Retrieval ==========

  async getSteps(): Promise<StepsData> {
    switch (this.activeSDK) {
      case 'qcband':
        return await QCBandService.getCurrentSteps();
      case 'crp':
        return await SmartRingService.getSteps();
      case 'mock':
      default:
        return await SmartRingMockService.getSteps();
    }
  }

  async getSleepData(): Promise<SleepData> {
    switch (this.activeSDK) {
      case 'qcband':
        return await QCBandService.getSleepByDay(0);
      case 'crp':
        return await SmartRingService.getSleepData();
      case 'mock':
      default:
        return await SmartRingMockService.getSleepData();
    }
  }

  async getBattery(): Promise<BatteryData> {
    switch (this.activeSDK) {
      case 'qcband':
        return await QCBandService.getBattery();
      case 'crp':
        return await SmartRingService.getBattery();
      case 'mock':
      default:
        return await SmartRingMockService.getBattery();
    }
  }

  async getVersion(): Promise<{ version: string }> {
    switch (this.activeSDK) {
      case 'qcband':
        const qcVersion = await QCBandService.getVersion();
        return { version: qcVersion.softwareVersion };
      case 'crp':
        return await SmartRingService.getVersion();
      case 'mock':
      default:
        return await SmartRingMockService.getVersion();
    }
  }

  async get24HourHeartRate(): Promise<number[]> {
    switch (this.activeSDK) {
      case 'qcband':
        // QCBandSDK uses scheduled HR data
        const data = await QCBandService.getScheduledHeartRate([0]);
        return data.map(d => d.heartRate);
      case 'crp':
        return await SmartRingService.get24HourHeartRate();
      case 'mock':
      default:
        return await SmartRingMockService.get24HourHeartRate();
    }
  }

  async getHRVData(): Promise<HRVData> {
    switch (this.activeSDK) {
      case 'qcband':
        const hrvData = await QCBandService.getHRVData([0]);
        return hrvData[0] || {};
      case 'crp':
        return await SmartRingService.getHRVData();
      case 'mock':
      default:
        return await SmartRingMockService.getHRVData();
    }
  }

  async getStressData(): Promise<StressData> {
    switch (this.activeSDK) {
      case 'qcband':
        const stressData = await QCBandService.getStressData([0]);
        return stressData[0] || { level: 0 };
      case 'crp':
        return await SmartRingService.getStressData();
      case 'mock':
      default:
        return await SmartRingMockService.getStressData();
    }
  }

  async getTemperature(): Promise<TemperatureData> {
    switch (this.activeSDK) {
      case 'qcband':
        const tempData = await QCBandService.getScheduledTemperature(0);
        return tempData[0] || { temperature: 0 };
      case 'crp':
        return await SmartRingService.getTemperature();
      case 'mock':
      default:
        return await SmartRingMockService.getTemperature();
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
      case 'mock':
      default:
        SmartRingMockService.startHeartRateMonitoring();
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
      case 'mock':
      default:
        SmartRingMockService.stopHeartRateMonitoring();
        break;
    }
  }

  startSpO2Monitoring(): void {
    switch (this.activeSDK) {
      case 'qcband':
        QCBandService.startMeasurement('spo2');
        break;
      case 'crp':
        SmartRingService.startSpO2Monitoring();
        break;
      case 'mock':
      default:
        SmartRingMockService.startSpO2Monitoring();
        break;
    }
  }

  stopSpO2Monitoring(): void {
    switch (this.activeSDK) {
      case 'qcband':
        QCBandService.stopMeasurement('spo2');
        break;
      case 'crp':
        SmartRingService.stopSpO2Monitoring();
        break;
      case 'mock':
      default:
        SmartRingMockService.stopSpO2Monitoring();
        break;
    }
  }

  startBloodPressureMonitoring(): void {
    switch (this.activeSDK) {
      case 'qcband':
        QCBandService.startMeasurement('bloodPressure');
        break;
      case 'crp':
        SmartRingService.startBloodPressureMonitoring();
        break;
      case 'mock':
      default:
        SmartRingMockService.startBloodPressureMonitoring();
        break;
    }
  }

  stopBloodPressureMonitoring(): void {
    switch (this.activeSDK) {
      case 'qcband':
        QCBandService.stopMeasurement('bloodPressure');
        break;
      case 'crp':
        SmartRingService.stopBloodPressureMonitoring();
        break;
      case 'mock':
      default:
        SmartRingMockService.stopBloodPressureMonitoring();
        break;
    }
  }

  // ========== Settings ==========

  async setProfile(profile: ProfileData): Promise<{ success: boolean }> {
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
      case 'mock':
      default:
        return await SmartRingMockService.setProfile(profile);
    }
  }

  async setGoal(goal: number): Promise<{ success: boolean }> {
    switch (this.activeSDK) {
      case 'crp':
        return await SmartRingService.setGoal(goal);
      case 'mock':
      default:
        return await SmartRingMockService.setGoal(goal);
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
    switch (this.activeSDK) {
      case 'qcband':
        return QCBandService.onConnectionStateChanged(callback);
      case 'crp':
        return SmartRingService.onConnectionStateChanged(callback);
      case 'mock':
      default:
        return SmartRingMockService.onConnectionStateChanged(callback);
    }
  }

  onBluetoothStateChanged(callback: (state: BluetoothState) => void): () => void {
    switch (this.activeSDK) {
      case 'qcband':
        return QCBandService.onBluetoothStateChanged(callback);
      case 'crp':
        return SmartRingService.onBluetoothStateChanged(callback);
      case 'mock':
      default:
        return SmartRingMockService.onBluetoothStateChanged(callback);
    }
  }

  onDeviceDiscovered(callback: (device: DeviceInfo) => void): () => void {
    switch (this.activeSDK) {
      case 'qcband':
        return QCBandService.onDeviceDiscovered(callback);
      case 'crp':
        return SmartRingService.onDeviceDiscovered(callback);
      case 'mock':
      default:
        return SmartRingMockService.onDeviceDiscovered(callback);
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
      case 'mock':
      default:
        return SmartRingMockService.onHeartRateReceived(callback);
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
      case 'mock':
      default:
        return SmartRingMockService.onStepsReceived(callback);
    }
  }

  onSleepDataReceived(callback: (data: SleepData) => void): () => void {
    switch (this.activeSDK) {
      case 'crp':
        return SmartRingService.onSleepDataReceived(callback);
      case 'mock':
      default:
        return SmartRingMockService.onSleepDataReceived(callback);
    }
  }

  onBatteryReceived(callback: (data: BatteryData) => void): () => void {
    switch (this.activeSDK) {
      case 'qcband':
        return QCBandService.onBatteryChanged(callback);
      case 'crp':
        return SmartRingService.onBatteryReceived(callback);
      case 'mock':
      default:
        return SmartRingMockService.onBatteryReceived(callback);
    }
  }

  onSpO2Received(callback: (data: SpO2Data) => void): () => void {
    switch (this.activeSDK) {
      case 'crp':
        return SmartRingService.onSpO2Received(callback);
      case 'mock':
      default:
        return SmartRingMockService.onSpO2Received(callback);
    }
  }

  onBloodPressureReceived(callback: (data: BloodPressureData) => void): () => void {
    switch (this.activeSDK) {
      case 'crp':
        return SmartRingService.onBloodPressureReceived(callback);
      case 'mock':
      default:
        return SmartRingMockService.onBloodPressureReceived(callback);
    }
  }

  onError(callback: (error: any) => void): () => void {
    switch (this.activeSDK) {
      case 'qcband':
        return QCBandService.onError(callback);
      case 'crp':
        return SmartRingService.onError(callback);
      case 'mock':
      default:
        return SmartRingMockService.onError(callback);
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





