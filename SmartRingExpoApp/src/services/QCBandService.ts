/**
 * QCBandService - JavaScript wrapper for QCBandSDK native module
 * 
 * This service provides access to the QC Wireless smart ring SDK.
 * It handles connection, data retrieval, and real-time monitoring.
 * 
 * Features specific to QCBandSDK:
 * - Ring-specific features (touch control, gesture control, wear calibration)
 * - Sport mode control
 * - Scheduled measurements (HR every 5 min, etc.)
 * - Blood glucose monitoring
 * - Camera/photo control
 */

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
  ConnectionState,
  BluetoothState,
} from '../types/sdk.types';

// QCBandSDK specific types
export interface QCBandFeatures {
  temperature: boolean;
  bloodPressure: boolean;
  bloodOxygen: boolean;
  bloodGlucose: boolean;
  stress: boolean;
  hrv: boolean;
  dialMarket: boolean;
  menstrualCycle: boolean;
  weather: boolean;
  contacts: boolean;
  music: boolean;
  eBook: boolean;
  touchControl: boolean;
  gestureControl: boolean;
  flipWrist: boolean;
}

export interface QCSportInfo {
  sportType: number;
  duration: number;
  state: 'start' | 'pause' | 'stop';
  heartRate: number;
  steps: number;
  calories: number;
  distance: number;
}

export interface QCFlipWristInfo {
  enable: boolean;
  hand: 'left' | 'right';
}

export type QCMeasurementType = 
  | 'heartRate'
  | 'bloodPressure'
  | 'spo2'
  | 'stress'
  | 'hrv'
  | 'temperature'
  | 'bloodGlucose'
  | 'oneKey'; // One-click measurement

export type QCTouchControlType =
  | 'off'
  | 'music'
  | 'video'
  | 'eBook'
  | 'takePhoto'
  | 'phoneCall'
  | 'game'
  | 'hrMeasure';

// Safely get native module
let QCBandBridge: any = null;
let eventEmitter: NativeEventEmitter | null = null;

try {
  QCBandBridge = NativeModules.QCBandBridge;
  if (QCBandBridge) {
    eventEmitter = new NativeEventEmitter(QCBandBridge);
  }
} catch (error) {
  console.log('QCBandBridge native module not available');
}

class QCBandService {
  private holdHRInterval: NodeJS.Timeout | null = null;

  /**
   * Check if QCBandSDK is available
   */
  isAvailable(): boolean {
    return QCBandBridge !== null && Platform.OS === 'ios';
  }

  // ========== Connection Methods ==========

  async scan(duration: number = 10): Promise<DeviceInfo[]> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.scan(duration);
  }

  stopScan(): void {
    if (QCBandBridge) {
      QCBandBridge.stopScan();
    }
  }

  async connect(mac: string): Promise<{ success: boolean; message: string }> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.connect(mac);
  }

  disconnect(): void {
    if (QCBandBridge) {
      QCBandBridge.disconnect();
    }
  }

  // ========== Time & Settings ==========

  async setTime(): Promise<{ success: boolean; features: QCBandFeatures }> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.setTime();
  }

  async setProfile(profile: {
    is24Hour: boolean;
    isMetric: boolean;
    gender: 'male' | 'female';
    age: number;
    height: number;
    weight: number;
  }): Promise<{ success: boolean }> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.setProfile(profile);
  }

  // ========== Battery & Firmware ==========

  async getBattery(): Promise<BatteryData> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.getBattery();
  }

  async getVersion(): Promise<{ hardwareVersion: string; softwareVersion: string }> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.getVersion();
  }

  // ========== Steps & Sport ==========

  async getSteps(dayIndex: number = 0): Promise<StepsData> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.getSteps(dayIndex);
  }

  async getCurrentSteps(): Promise<StepsData> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.getCurrentSteps();
  }

  async getSportRecords(lastTimestamp: number = 0): Promise<QCSportInfo[]> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.getSportRecords(lastTimestamp);
  }

  // ========== Sleep ==========

  async getSleepByDay(dayIndex: number = 0): Promise<SleepData> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.getSleepByDay(dayIndex);
  }

  async getSleepFromDay(startDayIndex: number): Promise<Record<string, SleepData>> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.getSleepFromDay(startDayIndex);
  }

  // ========== Heart Rate ==========

  /**
   * Start real-time heart rate monitoring
   * Note: You must call holdRealtimeHeartRate() every 20 seconds to keep the session alive
   */
  startRealtimeHeartRate(): void {
    if (QCBandBridge) {
      QCBandBridge.startRealtimeHeartRate();
      
      // Automatically hold the session every 18 seconds
      this.holdHRInterval = setInterval(() => {
        this.holdRealtimeHeartRate();
      }, 18000);
    }
  }

  holdRealtimeHeartRate(): void {
    if (QCBandBridge) {
      QCBandBridge.holdRealtimeHeartRate();
    }
  }

  stopRealtimeHeartRate(): void {
    if (this.holdHRInterval) {
      clearInterval(this.holdHRInterval);
      this.holdHRInterval = null;
    }
    if (QCBandBridge) {
      QCBandBridge.stopRealtimeHeartRate();
    }
  }

  async getScheduledHeartRate(dayIndexes: number[]): Promise<HeartRateData[]> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.getScheduledHeartRate(dayIndexes);
  }

  async getManualHeartRate(dayIndex: number = 0): Promise<HeartRateData[]> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.getManualHeartRate(dayIndex);
  }

  // ========== Single Measurements ==========

  async startMeasurement(
    type: QCMeasurementType,
    timeout: number = 60
  ): Promise<any> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.startMeasurement(type, timeout);
  }

  async stopMeasurement(type: QCMeasurementType): Promise<{ success: boolean }> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.stopMeasurement(type);
  }

  // ========== Blood Pressure ==========

  async getScheduledBloodPressure(): Promise<BloodPressureData[]> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.getScheduledBloodPressure();
  }

  async getManualBloodPressure(lastTimestamp: number = 0): Promise<BloodPressureData[]> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.getManualBloodPressure(lastTimestamp);
  }

  // ========== Stress & HRV ==========

  async getStressData(dayIndexes: number[]): Promise<StressData[]> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.getStressData(dayIndexes);
  }

  async getHRVData(dayIndexes: number[]): Promise<HRVData[]> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.getHRVData(dayIndexes);
  }

  // ========== Temperature ==========

  async getScheduledTemperature(dayIndex: number = 0): Promise<TemperatureData[]> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.getScheduledTemperature(dayIndex);
  }

  async getManualTemperature(dayIndex: number = 0): Promise<TemperatureData[]> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.getManualTemperature(dayIndex);
  }

  // ========== Blood Glucose ==========

  async getBloodGlucose(dayIndex: number = 0): Promise<any[]> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.getBloodGlucose(dayIndex);
  }

  // ========== Firmware Update ==========

  async startFirmwareUpdate(filePath: string): Promise<{ success: boolean; message: string }> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.startFirmwareUpdate(filePath);
  }

  // ========== Ring-Specific Features ==========

  async startWearCalibration(timeout: number = 120): Promise<{ success: boolean }> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.startWearCalibration(timeout);
  }

  async stopWearCalibration(): Promise<{ success: boolean }> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.stopWearCalibration();
  }

  async getFlipWristInfo(): Promise<QCFlipWristInfo> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.getFlipWristInfo();
  }

  async setTouchControl(
    controlType: QCTouchControlType,
    strength: number = 1,
    duration: number = 3
  ): Promise<{ success: boolean }> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.setTouchControl(controlType, strength, duration);
  }

  async setGestureControl(
    controlType: QCTouchControlType,
    strength: number = 1
  ): Promise<{ success: boolean }> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.setGestureControl(controlType, strength);
  }

  // ========== Camera ==========

  async switchToPhotoMode(): Promise<{ success: boolean }> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.switchToPhotoMode();
  }

  // ========== Sport Mode ==========

  async startSportMode(sportType: string): Promise<{ success: boolean }> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.startSportMode(sportType);
  }

  async pauseSportMode(sportType: string): Promise<{ success: boolean }> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.pauseSportMode(sportType);
  }

  async stopSportMode(sportType: string): Promise<{ success: boolean }> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.stopSportMode(sportType);
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
    const subscription = eventEmitter.addListener('onDeviceDiscovered', (device) => {
      callback(device);
    });
    return () => subscription.remove();
  }

  onRealtimeHeartRate(callback: (heartRate: number) => void): () => void {
    if (!eventEmitter) return () => {};
    const subscription = eventEmitter.addListener('onRealtimeHeartRate', (event) => {
      callback(event.heartRate);
    });
    return () => subscription.remove();
  }

  onCurrentStepInfo(callback: (data: { steps: number; calories: number; distance: number }) => void): () => void {
    if (!eventEmitter) return () => {};
    const subscription = eventEmitter.addListener('onCurrentStepInfo', (data) => {
      callback(data);
    });
    return () => subscription.remove();
  }

  onSportInfo(callback: (info: QCSportInfo) => void): () => void {
    if (!eventEmitter) return () => {};
    const subscription = eventEmitter.addListener('onSportInfoReceived', (info) => {
      callback(info);
    });
    return () => subscription.remove();
  }

  onBatteryChanged(callback: (data: BatteryData) => void): () => void {
    if (!eventEmitter) return () => {};
    const subscription = eventEmitter.addListener('onBatteryReceived', (data) => {
      callback(data);
    });
    return () => subscription.remove();
  }

  onFirmwareUpgradeProgress(callback: (data: { state: string; progress: number }) => void): () => void {
    if (!eventEmitter) return () => {};
    const subscription = eventEmitter.addListener('onFirmwareUpgradeProgress', (data) => {
      callback(data);
    });
    return () => subscription.remove();
  }

  onFindPhone(callback: (status: 'start' | 'stop') => void): () => void {
    if (!eventEmitter) return () => {};
    const subscription = eventEmitter.addListener('onFindPhone', (event) => {
      callback(event.status === 1 ? 'start' : 'stop');
    });
    return () => subscription.remove();
  }

  onTakePicture(callback: () => void): () => void {
    if (!eventEmitter) return () => {};
    const subscription = eventEmitter.addListener('onTakePicture', () => {
      callback();
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
}

export default new QCBandService();





