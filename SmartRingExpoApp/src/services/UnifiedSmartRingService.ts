/**
 * UnifiedSmartRingService - Jstyle/X3 Smart Ring Interface
 *
 * All ring commands route to the Jstyle BleSDK (JstyleService).
 * Scanning discovers X3 devices; once connected all data commands
 * flow through JstyleService.
 */

import { Platform } from 'react-native';
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
  SportData,
  FeatureAvailability,
  RecoveryContributors,
} from '../types/sdk.types';

export type SDKType = 'jstyle' | 'none';

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

    if (JstyleService.isAvailable()) {
      this.activeSDK = 'jstyle';
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
    return JstyleService.isAvailable();
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

    if (JstyleService.isAvailable()) {
      await JstyleService.scan(duration).catch(err => {
        console.log('⚠️ Jstyle scan error:', err.message);
      });
    }

    return []; // Devices will come through onDeviceDiscovered callbacks
  }

  stopScan(): void {
    if (JstyleService.isAvailable()) {
      JstyleService.stopScan();
    }
  }

  async connect(mac: string, sdkType?: SDKType): Promise<{ success: boolean; message: string }> {
    this.ensureSDKAvailable();

    const type = sdkType || 'jstyle';
    this.connectedSDKType = type;

    return await JstyleService.connect(mac);
  }

  disconnect(): void {
    if (this.connectedSDKType === 'jstyle') {
      JstyleService.disconnect();
    }
    this.connectedSDKType = 'none';
  }

  async isConnected(): Promise<{
    connected: boolean;
    state: string;
    deviceName: string | null;
    deviceMac: string | null;
  }> {
    if (this.connectedSDKType === 'jstyle' || JstyleService.isAvailable()) {
      const status = await JstyleService.isConnected();
      return {
        connected: status.connected,
        state: status.state,
        deviceName: status.deviceName,
        deviceMac: status.deviceId,
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
    if (this.connectedSDKType === 'jstyle' || JstyleService.isAvailable()) {
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
    if (JstyleService.isAvailable()) {
      const jResult = await JstyleService.getPairedDevice();
      if (jResult.hasPairedDevice && jResult.device) {
        return {
          hasPairedDevice: true,
          device: { ...jResult.device, sdkType: 'jstyle' },
        };
      }
    }

    return { hasPairedDevice: false, device: null };
  }

  async forgetPairedDevice(): Promise<{ success: boolean; message: string }> {
    if (this.connectedSDKType === 'jstyle' || JstyleService.isAvailable()) {
      return await JstyleService.forgetPairedDevice();
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
    return await JstyleService.getSteps();
  }

  async getSleepData(): Promise<SleepData> {
    this.ensureConnected();
    return await JstyleService.getSleepByDay(0);
  }

  async getBattery(): Promise<BatteryData> {
    this.ensureConnected();
    return await JstyleService.getBattery();
  }

  async getVersion(): Promise<{ version: string }> {
    this.ensureConnected();
    const info = await JstyleService.getVersion();
    return { version: info.softwareVersion };
  }

  async get24HourHeartRate(): Promise<number[]> {
    this.ensureConnected();
    const data = await JstyleService.getScheduledHeartRate([0]);
    return data.map(d => d.heartRate);
  }

  async getScheduledHeartRateRaw(days: number[] = [0]) {
    this.ensureConnected();

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

  async get24HourSteps(): Promise<number[]> {
    this.ensureConnected();
    return [];
  }

  async getHRVData(): Promise<HRVData> {
    this.ensureConnected();
    const data = await JstyleService.getHRVDataNormalized();
    return data[0] || {};
  }

  async getStressData(): Promise<StressData> {
    this.ensureConnected();
    // X3 doesn't have a dedicated stress endpoint; derive from HRV if needed
    return { level: 0 };
  }

  async getTemperature(): Promise<TemperatureData> {
    this.ensureConnected();
    const data = await JstyleService.getTemperatureDataNormalized();
    return data[0] || { temperature: 0 };
  }

  async getHeartRate(): Promise<HeartRateData> {
    this.ensureConnected();
    const data = await JstyleService.getScheduledHeartRate([0]);
    return data[0] || { heartRate: 0 };
  }

  async getSleepByDay(dayIndex: number = 0): Promise<SleepData | null> {
    try {
      this.ensureConnected();
      return await JstyleService.getSleepByDay(dayIndex);
    } catch (e) {
      console.log('getSleepByDay error', e);
      return null;
    }
  }

  async getSpO2(): Promise<SpO2Data> {
    this.ensureConnected();
    const data = await JstyleService.getSpO2DataNormalized();
    return data[0] || { spo2: 0 };
  }

  async getBloodPressure(): Promise<BloodPressureData> {
    this.ensureConnected();
    const data = await JstyleService.getBloodPressureFromHRV();
    return data[0] || { systolic: 0, diastolic: 0, heartRate: 0 };
  }

  async getSportData(): Promise<SportData[]> {
    this.ensureConnected();
    return await JstyleService.getSportData();
  }

  async getRespiratoryRateNightly(dayIndex: number = 0): Promise<number | null> {
    this.ensureConnected();

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
    return {
      respiratoryRate: isX3,
      activitySessions: isX3,
      stressIndex: isX3,
      sleepHrv: isX3,
      osaEov: isX3,
      ppi: isX3,
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
    this.ensureConnected();
    const result = await JstyleService.startHeartRateMeasuring();
    return { success: !!result?.success };
  }

  // ========== Real-time Monitoring ==========

  startHeartRateMonitoring(): void {
    if (this.connectedSDKType === 'jstyle') {
      JstyleService.startRealTimeHeartRate();
    }
  }

  stopHeartRateMonitoring(): void {
    if (this.connectedSDKType === 'jstyle') {
      JstyleService.stopRealTimeHeartRate();
    }
  }

  startSpO2Monitoring(): void {
    if (this.connectedSDKType === 'jstyle') {
      JstyleService.startSpO2Measuring().catch(err => {
        console.log('⚠️ Jstyle startSpO2 error:', err.message);
      });
    }
  }

  stopSpO2Monitoring(): void {
    if (this.connectedSDKType === 'jstyle') {
      JstyleService.stopSpO2Measuring().catch(err => {
        console.log('⚠️ Jstyle stopSpO2 error:', err.message);
      });
    }
  }

  // ========== Settings ==========

  async setProfile(profile: ProfileData): Promise<{ success: boolean }> {
    this.ensureConnected();
    return await JstyleService.setProfile({
      gender: profile.gender,
      age: profile.age,
      height: profile.height,
      weight: profile.weight,
    });
  }

  async getProfile(): Promise<ProfileData> {
    this.ensureConnected();
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
    return await JstyleService.getGoal();
  }

  async setGoal(goal: number): Promise<{ success: boolean }> {
    this.ensureConnected();
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

  // ========== Device ==========

  findDevice(): void {
    console.log('🔔 Find device triggered');
  }

  async factoryReset(): Promise<{ success: boolean }> {
    this.ensureConnected();
    return await JstyleService.factoryReset();
  }

  // ========== Event Listeners ==========

  onConnectionStateChanged(callback: (state: ConnectionState) => void): () => void {
    this.jsConnectionListeners.add(callback);

    const unsubs: (() => void)[] = [];

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

    if (JstyleService.isAvailable()) {
      unsubs.push(JstyleService.onBluetoothStateChanged(callback));
    }

    return () => unsubs.forEach(u => u());
  }

  onDeviceDiscovered(callback: (device: DeviceInfo) => void): () => void {
    const unsubs: (() => void)[] = [];

    if (JstyleService.isAvailable()) {
      unsubs.push(JstyleService.onDeviceDiscovered((device) => {
        callback({ ...device, sdkType: 'jstyle' });
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

    return () => unsubs.forEach(u => u());
  }

  onSleepDataReceived(callback: (data: SleepData) => void): () => void {
    // SDK has no real-time sleep data events
    return () => {};
  }

  onBatteryReceived(callback: (data: BatteryData) => void): () => void {
    const unsubs: (() => void)[] = [];

    if (JstyleService.isAvailable()) {
      unsubs.push(JstyleService.onBatteryChanged(callback));
    }

    return () => unsubs.forEach(u => u());
  }

  onSpO2Received(callback: (data: SpO2Data) => void): () => void {
    const unsubs: (() => void)[] = [];

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

    if (JstyleService.isAvailable()) {
      unsubs.push(JstyleService.onError(callback));
    }

    return () => unsubs.forEach(u => u());
  }

  // ========== SDK-Specific Feature Access ==========

  getJstyleService() {
    if (this.connectedSDKType === 'jstyle' || JstyleService.isAvailable()) {
      return JstyleService;
    }
    return null;
  }
}

export default new UnifiedSmartRingService();
