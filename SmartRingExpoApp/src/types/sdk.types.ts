// Smart Ring SDK Type Definitions

export interface DeviceInfo {
  id: string;
  mac: string;
  name: string;       // Display name (transformed, e.g., "FOCUS R1")
  localName?: string; // Original Bluetooth name
  rssi: number;
  ver?: string;
  isConnected?: boolean;
  sdkType?: 'qcband' | 'jstyle'; // Which SDK this device uses
}

export interface StepsData {
  steps: number;
  distance: number; // in meters
  calories: number; // in kcal
  time: number; // duration in seconds
}

export interface SleepQualityRecord {
  arraySleepQuality: number[]; // Array of sleep type values per time unit
  sleepUnitLength: number; // Minutes per quality value (typically 1)
  startTimestamp?: number; // Start time of this record (ms since epoch)
}

export interface SleepData {
  deep: number; // minutes
  light: number; // minutes
  awake?: number; // minutes
  rem?: number; // minutes
  detail: string;
  startTime?: number; // timestamp
  endTime?: number; // timestamp
  rawQualityRecords?: SleepQualityRecord[]; // Raw per-minute quality data for building hypnogram
}

export interface HeartRateData {
  heartRate: number;
  rri?: number; // R-R interval in ms
  timestamp?: number;
}

export interface BloodPressureData {
  systolic: number; // sbp
  diastolic: number; // dbp
  heartRate: number;
  timestamp?: number;
}

export interface SpO2Data {
  spo2: number; // percentage (96-100)
  timestamp?: number;
}

export interface HRVData {
  sdnn?: number;
  rmssd?: number;
  pnn50?: number;
  lf?: number;
  hf?: number;
  lfHfRatio?: number;
  heartRate?: number;
  stress?: number;
  timestamp?: number;
}

export interface StressData {
  level: number; // 0-100
  timestamp?: number;
}

export interface TemperatureData {
  temperature: number; // in Celsius
  timestamp?: number;
}

export interface BatteryData {
  battery: number; // percentage 0-100
  isCharging?: boolean;
}

export interface ProfileData {
  height: number; // cm
  weight: number; // kg
  age: number;
  gender: 'male' | 'female';
}

export interface AlarmData {
  id: number;
  enabled: boolean;
  hour: number;
  minute: number;
  weekdays: number[]; // 0-6, Sunday = 0
  type: 'once' | 'daily' | 'weekly';
}

export interface SportData {
  type: SportType;
  startTime: number;
  endTime: number;
  duration: number; // seconds
  steps: number;
  distance: number;
  calories: number;
  heartRateAvg?: number;
  heartRateMax?: number;
}

export enum SportType {
  Walking = 0,
  Running = 1,
  Cycling = 2,
  Hiking = 3,
  Swimming = 4,
  Yoga = 5,
  Gym = 6,
  Other = 7,
}

export interface FirmwareInfo {
  currentVersion: string;
  latestVersion?: string;
  updateAvailable: boolean;
  changelog?: string;
  fileUrl?: string;
}

export interface UpgradeProgress {
  state: UpgradeState;
  progress: number; // 0-100
}

export enum UpgradeState {
  Idle = 0,
  Preparing = 1,
  Uploading = 2,
  Installing = 3,
  Complete = 4,
  Failed = 5,
}

export type ConnectionState = 
  | 'disconnected'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'unknown';

export type BluetoothState = 
  | 'unknown'
  | 'resetting'
  | 'unsupported'
  | 'unauthorized'
  | 'poweredOff'
  | 'poweredOn';

// 24-hour time series data point
export interface TimeSeriesPoint {
  timestamp: number;
  value: number;
}

// Full day health summary
export interface DaySummary {
  date: string; // YYYY-MM-DD
  steps: StepsData;
  sleep?: SleepData;
  heartRateAvg?: number;
  heartRateMin?: number;
  heartRateMax?: number;
  heartRateSeries?: TimeSeriesPoint[];
  spo2Avg?: number;
  stressAvg?: number;
  caloriesTotal?: number;
}

// Event types for the SDK
export interface SDKEvents {
  onConnectionStateChanged: (state: ConnectionState) => void;
  onBluetoothStateChanged: (state: BluetoothState) => void;
  onDeviceDiscovered: (device: DeviceInfo) => void;
  onStepsReceived: (data: StepsData) => void;
  onHeartRateReceived: (data: HeartRateData) => void;
  onSleepDataReceived: (data: SleepData) => void;
  onBatteryReceived: (data: BatteryData) => void;
  onSpO2Received: (data: SpO2Data) => void;
  onBloodPressureReceived: (data: BloodPressureData) => void;
  onUpgradeProgress: (progress: UpgradeProgress) => void;
  onError: (error: Error) => void;
}

// SDK Service interface
export interface ISmartRingService {
  // Connection
  scan(duration?: number): Promise<DeviceInfo[]>;
  stopScan(): void;
  connect(mac: string): Promise<{ success: boolean; message: string }>;
  disconnect(): void;
  reconnect(): void;
  
  // Data retrieval
  getSteps(): Promise<StepsData>;
  getSleepData(): Promise<SleepData>;
  getBattery(): Promise<BatteryData>;
  getVersion(): Promise<{ version: string }>;
  get24HourHeartRate(): Promise<number[]>;
  get24HourSteps(): Promise<number[]>;
  getHRVData(): Promise<HRVData>;
  getStressData(): Promise<StressData>;
  getTemperature(): Promise<TemperatureData>;
  getSportData(): Promise<SportData[]>;
  getAllData(): Promise<{ steps: StepsData[]; sleep: SleepData[] }>;
  
  // Real-time monitoring
  startHeartRateMonitoring(): void;
  stopHeartRateMonitoring(): void;
  startSpO2Monitoring(): void;
  stopSpO2Monitoring(): void;
  startBloodPressureMonitoring(): void;
  stopBloodPressureMonitoring(): void;
  
  // Settings
  setGoal(goal: number): Promise<{ success: boolean }>;
  setProfile(profile: ProfileData): Promise<{ success: boolean }>;
  setAlarm(alarm: AlarmData): Promise<{ success: boolean }>;
  setTimeFormat(is24Hour: boolean): Promise<{ success: boolean }>;
  setUnit(isMetric: boolean): Promise<{ success: boolean }>;
  
  // Device
  findDevice(): void;
  
  // Firmware
  checkForUpdate(): Promise<FirmwareInfo>;
  startFirmwareUpdate(filePath: string): void;
  
  // Events
  onConnectionStateChanged(callback: SDKEvents['onConnectionStateChanged']): () => void;
  onBluetoothStateChanged(callback: SDKEvents['onBluetoothStateChanged']): () => void;
  onDeviceDiscovered(callback: SDKEvents['onDeviceDiscovered']): () => void;
  onStepsReceived(callback: SDKEvents['onStepsReceived']): () => void;
  onHeartRateReceived(callback: SDKEvents['onHeartRateReceived']): () => void;
  onSleepDataReceived(callback: SDKEvents['onSleepDataReceived']): () => void;
  onBatteryReceived(callback: SDKEvents['onBatteryReceived']): () => void;
  onError(callback: SDKEvents['onError']): () => void;
  
  // State
  isUsingMockData(): boolean;
}




