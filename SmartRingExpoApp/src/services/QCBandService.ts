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

  // ========== Initialization ==========

  async initialize(): Promise<{ success: boolean; message: string }> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.initialize();
  }

  // ========== Connection Methods ==========

  async scan(duration: number = 30): Promise<{ success: boolean; message: string }> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.scan(duration);
  }

  async stopScan(): Promise<{ success: boolean; message: string }> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.stopScan();
  }

  async getDiscoveredDevices(): Promise<DeviceInfo[]> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.getDiscoveredDevices();
  }

  async connect(peripheralId: string): Promise<{ success: boolean; message: string }> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.connect(peripheralId);
  }

  async disconnect(): Promise<{ success: boolean; message: string }> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.disconnect();
  }

  async isConnected(): Promise<{
    connected: boolean;
    state: string;
    deviceName: string | null;
    deviceId: string | null;
  }> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.isConnected();
  }

  // ========== Paired Device Management ==========

  async hasPairedDevice(): Promise<{ hasPairedDevice: boolean }> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.hasPairedDevice();
  }

  async getPairedDevice(): Promise<{
    hasPairedDevice: boolean;
    device: DeviceInfo | null;
  }> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.getPairedDevice();
  }

  async autoReconnect(): Promise<{ success: boolean; message: string; deviceId?: string; deviceName?: string }> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.autoReconnect();
  }

  async forgetPairedDevice(): Promise<{ success: boolean; message: string }> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.forgetPairedDevice();
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

  async getProfile(): Promise<{
    is24Hour: boolean;
    isMetric: boolean;
    gender: 'male' | 'female';
    age: number;
    height: number;
    weight: number;
  }> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.getProfile();
  }

  async getGoal(): Promise<{ goal: number }> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.getGoal();
  }

  async setGoal(goal: number): Promise<{ success: boolean }> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.setGoal(goal);
  }

  async setTimeFormat(is24Hour: boolean): Promise<{ success: boolean }> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.setTimeFormat(is24Hour);
  }

  async setUnit(isMetric: boolean): Promise<{ success: boolean }> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.setUnit(isMetric);
  }

  // ========== Battery & Firmware ==========

  async getBattery(): Promise<BatteryData> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.getBattery();
  }

  async getFirmwareInfo(): Promise<{ hardwareVersion: string; softwareVersion: string }> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.getFirmwareInfo();
  }

  async getVersion(): Promise<{ hardwareVersion: string; softwareVersion: string }> {
    // Alias for getFirmwareInfo
    return await this.getFirmwareInfo();
  }

  async getConnectionState(): Promise<{ state: string }> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.getConnectionState();
  }

  async getConnectionStatus(): Promise<{
    connected: boolean;
    state: string;
    stateCode: number;
    deviceName: string | null;
    deviceMac: string | null;
  }> {
    const result = await this.isConnected();
    return {
      connected: result.connected,
      state: result.state,
      stateCode: result.connected ? 3 : 0, // QCStateConnected = 3
      deviceName: result.deviceName,
      deviceMac: result.deviceId,
    };
  }

  async alertBinding(): Promise<{ success: boolean }> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.alertBinding();
  }

  // ========== Steps & Sport ==========

  async getSteps(): Promise<StepsData> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.getSteps();
  }

  async getStepsDetail(dayIndex: number = 0): Promise<StepsData[]> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.getStepsDetail(dayIndex);
  }

  async getCurrentSteps(): Promise<StepsData> {
    // Alias for getSteps
    return await this.getSteps();
  }

  async getSportRecords(lastTimestamp: number = 0): Promise<QCSportInfo[]> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.getSportRecords(lastTimestamp);
  }

  // ========== Sleep ==========

  async getSleepData(dayIndex: number = 0): Promise<{
    totalSleepMinutes: number;
    totalNapMinutes: number;
    fallAsleepDuration: number;
    sleepSegments: Array<{
      startTime: string;
      endTime: string;
      duration: number;
      type: number;
    }>;
    napSegments: Array<{
      startTime: string;
      endTime: string;
      duration: number;
      type: number;
    }>;
    timestamp: number;
  }> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.getSleepData(dayIndex);
  }

  async getSleepByDay(dayIndex: number = 0): Promise<SleepData> {
    /**
     * SDK SLEEPTYPE enum:
     * 0 = SLEEPTYPENONE (no data)
     * 1 = SLEEPTYPESOBER (awake/sober)
     * 2 = SLEEPTYPELIGHT (light sleep)
     * 3 = SLEEPTYPEDEEP (deep sleep)
     * 4 = SLEEPTYPEREM (REM)
     * 5 = SLEEPTYPEUNWEARED (not wearing)
     */
    const data = await this.getSleepData(dayIndex);
    
    // Log raw data for debugging
    console.log('😴 [QCBandService] RAW sleep data from ring:', JSON.stringify(data, null, 2));
    console.log('😴 [QCBandService] Sleep segments breakdown:');
    data.sleepSegments.forEach((s, i) => {
      const typeNames = ['None', 'Awake', 'Light', 'Deep', 'REM', 'Unweared'];
      console.log(`  Segment ${i}: type=${s.type} (${typeNames[s.type] || 'Unknown'}), duration=${s.duration}min, ${s.startTime} → ${s.endTime}`);
    });
    
    // Correct mapping based on SDK SLEEPTYPE enum
    const awake = data.sleepSegments.filter(s => s.type === 1).reduce((acc, s) => acc + s.duration, 0);
    const light = data.sleepSegments.filter(s => s.type === 2).reduce((acc, s) => acc + s.duration, 0);
    const deep = data.sleepSegments.filter(s => s.type === 3).reduce((acc, s) => acc + s.duration, 0);
    const rem = data.sleepSegments.filter(s => s.type === 4).reduce((acc, s) => acc + s.duration, 0);
    
    console.log(`😴 [QCBandService] Processed: Deep=${deep}min, Light=${light}min, REM=${rem}min, Awake=${awake}min`);
    console.log(`😴 [QCBandService] SDK totalSleepMinutes=${data.totalSleepMinutes}, fallAsleepDuration=${data.fallAsleepDuration}`);
    
    return {
      deep,
      light,
      rem,
      awake,
      detail: `Deep: ${deep}min, Light: ${light}min, REM: ${rem}min, Awake: ${awake}min`,
      startTime: data.sleepSegments[0]?.startTime ? new Date(data.sleepSegments[0].startTime).getTime() : undefined,
      endTime: data.sleepSegments[data.sleepSegments.length - 1]?.endTime ? new Date(data.sleepSegments[data.sleepSegments.length - 1].endTime).getTime() : undefined,
    };
  }

  async getSleepFromDay(startDayIndex: number): Promise<Record<string, SleepData>> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.getSleepFromDay(startDayIndex);
  }

  // ========== Heart Rate ==========

  /**
   * Start a single heart rate measurement
   * Results come via onHeartRateData event
   */
  async startHeartRateMeasuring(): Promise<{ success: boolean; message: string }> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.startHeartRateMeasuring();
  }

  async stopHeartRateMeasuring(): Promise<{ success: boolean; message: string }> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.stopHeartRateMeasuring();
  }

  /**
   * Start real-time heart rate monitoring
   * The native module handles the hold timer automatically
   * Results come via onHeartRateData event with isRealTime: true
   */
  async startRealTimeHeartRate(): Promise<{ success: boolean; message: string }> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.startRealTimeHeartRate();
  }

  async stopRealTimeHeartRate(): Promise<{ success: boolean; message: string }> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.stopRealTimeHeartRate();
  }

  // Legacy methods for compatibility
  startRealtimeHeartRate(): void {
    this.startRealTimeHeartRate();
  }

  holdRealtimeHeartRate(): void {
    // No longer needed - native module handles this automatically
  }

  stopRealtimeHeartRate(): void {
    if (this.holdHRInterval) {
      clearInterval(this.holdHRInterval);
      this.holdHRInterval = null;
    }
    this.stopRealTimeHeartRate();
  }

  async getScheduledHeartRate(dayIndexes: number[]): Promise<HeartRateData[]> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.getScheduledHeartRate(dayIndexes);
  }

  async getManualHeartRate(dayIndex: number = 0): Promise<HeartRateData[]> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.getManualHeartRate(dayIndex);
  }

  async getManualBloodOxygen(dayIndex: number = 0): Promise<SpO2Data[]> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.getManualBloodOxygen(dayIndex);
  }

  async getBloodGlucose(dayIndex: number = 0): Promise<Array<{
    glucose: number;
    minGlucose?: number;
    maxGlucose?: number;
    type?: number; // 0=scheduled, 1=manual
    gluType?: number; // 0=before meals, 1=normal, 2=after meals
    timestamp: number;
  }>> {
    if (!QCBandBridge) throw new Error('QCBandSDK not available');
    return await QCBandBridge.getBloodGlucose(dayIndex);
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

  onHeartRateData(callback: (data: { heartRate: number; timestamp: number; isRealTime?: boolean; isMeasuring?: boolean; isFinal?: boolean }) => void): () => void {
    if (!eventEmitter) return () => {};
    const subscription = eventEmitter.addListener('onHeartRateData', (data) => {
      callback(data);
    });
    return () => subscription.remove();
  }

  onRealtimeHeartRate(callback: (heartRate: number) => void): () => void {
    if (!eventEmitter) return () => {};
    const subscription = eventEmitter.addListener('onHeartRateData', (event) => {
      if (event.isRealTime) {
        callback(event.heartRate);
      }
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

  onSpO2Received(callback: (data: SpO2Data) => void): () => void {
    if (!eventEmitter) return () => {};
    const subscription = eventEmitter.addListener('onSpO2Received', (data) => {
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

  onScanFinished(callback: (devices: DeviceInfo[]) => void): () => void {
    if (!eventEmitter) return () => {};
    const subscription = eventEmitter.addListener('onScanFinished', (event) => {
      callback(event.devices);
    });
    return () => subscription.remove();
  }

  onDebugLog(callback: (message: string, timestamp: number) => void): () => void {
    if (!eventEmitter) return () => {};
    const subscription = eventEmitter.addListener('onDebugLog', (event) => {
      callback(event.message, event.timestamp);
    });
    return () => subscription.remove();
  }

  onTemperatureData(callback: (data: { temperature: number; timestamp: number }) => void): () => void {
    if (!eventEmitter) return () => {};
    const subscription = eventEmitter.addListener('onTemperatureData', (data) => {
      callback(data);
    });
    return () => subscription.remove();
  }

  onStepsData(callback: (data: StepsData) => void): () => void {
    if (!eventEmitter) return () => {};
    const subscription = eventEmitter.addListener('onStepsData', (data) => {
      callback(data);
    });
    return () => subscription.remove();
  }

  onBatteryData(callback: (data: BatteryData) => void): () => void {
    if (!eventEmitter) return () => {};
    const subscription = eventEmitter.addListener('onBatteryData', (data) => {
      callback(data);
    });
    return () => subscription.remove();
  }
}

export default new QCBandService();




