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
  SportType,
  ConnectionState,
  BluetoothState,
} from '../types/sdk.types';

/**
 * Mock service that provides sample data for testing without a physical device
 * Use this to test the UI and app flow before connecting to a real device
 */
class SmartRingMockService {
  private connectionState: ConnectionState = 'disconnected';
  private bluetoothState: BluetoothState = 'poweredOn';
  private mockDevices: DeviceInfo[] = [
    {
      mac: 'AA:BB:CC:DD:EE:01',
      localName: 'SmartRing Pro',
      rssi: -45,
      ver: '3.18.1',
    },
    {
      mac: 'AA:BB:CC:DD:EE:02',
      localName: 'SmartRing Lite',
      rssi: -67,
      ver: '2.5.0',
    },
    {
      mac: 'AA:BB:CC:DD:EE:03',
      localName: 'SmartRing Sport',
      rssi: -72,
      ver: '3.12.0',
    },
  ];
  private connectedDevice: DeviceInfo | null = null;
  private mockProfile: ProfileData = {
    height: 175,
    weight: 70,
    age: 30,
    gender: 'male',
  };
  private mockGoal = 10000;
  private mockSteps: StepsData = {
    steps: 8523,
    distance: 6420,
    calories: 342,
    time: 28800,
  };
  private mockSleep: SleepData = {
    deep: 95,
    light: 185,
    awake: 25,
    rem: 65,
    detail: 'Good sleep quality',
    startTime: Date.now() - 8 * 60 * 60 * 1000,
    endTime: Date.now() - 30 * 60 * 1000,
  };
  private mockBattery = 78;
  private mockHeartRate = 72;
  private mockSpO2 = 98;
  private mockBloodPressure = { systolic: 118, diastolic: 76, heartRate: 72 };
  private isHeartRateMonitoring = false;
  private isSpO2Monitoring = false;
  private isBloodPressureMonitoring = false;
  private heartRateInterval: NodeJS.Timeout | null = null;
  private spO2Interval: NodeJS.Timeout | null = null;
  private bpInterval: NodeJS.Timeout | null = null;
  private listeners: Map<string, Function[]> = new Map();

  // Generate realistic 24-hour heart rate data
  private generate24HourHeartRate(): number[] {
    const data: number[] = [];
    for (let i = 0; i < 24; i++) {
      // Lower at night (midnight to 6am), higher during day
      let baseHR = 65;
      if (i >= 0 && i < 6) baseHR = 55; // sleeping
      else if (i >= 6 && i < 9) baseHR = 70; // morning
      else if (i >= 9 && i < 12) baseHR = 75; // mid-morning
      else if (i >= 12 && i < 14) baseHR = 80; // after lunch
      else if (i >= 14 && i < 18) baseHR = 72; // afternoon
      else if (i >= 18 && i < 21) baseHR = 68; // evening
      else baseHR = 62; // night
      
      data.push(baseHR + Math.floor(Math.random() * 15) - 7);
    }
    return data;
  }

  // Generate 24-hour steps data
  private generate24HourSteps(): number[] {
    const data: number[] = [];
    for (let i = 0; i < 24; i++) {
      let steps = 0;
      if (i >= 7 && i < 9) steps = 800 + Math.floor(Math.random() * 400); // morning commute
      else if (i >= 9 && i < 12) steps = 200 + Math.floor(Math.random() * 300); // work
      else if (i >= 12 && i < 14) steps = 600 + Math.floor(Math.random() * 400); // lunch
      else if (i >= 14 && i < 18) steps = 300 + Math.floor(Math.random() * 200); // work
      else if (i >= 18 && i < 20) steps = 1500 + Math.floor(Math.random() * 1000); // evening walk/gym
      else if (i >= 20 && i < 22) steps = 200 + Math.floor(Math.random() * 200); // evening
      data.push(steps);
    }
    return data;
  }

  // Connection Methods
  async scan(duration: number = 10): Promise<DeviceInfo[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        this.mockDevices.forEach((device, index) => {
          setTimeout(() => {
            this.emitDeviceDiscovered(device);
          }, index * 600);
        });
        resolve(this.mockDevices);
      }, 800);
    });
  }

  stopScan(): void {}

  async connect(mac: string): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve) => {
      const device = this.mockDevices.find((d) => d.mac === mac);
      if (device) {
        setTimeout(() => {
          this.connectionState = 'connecting';
          this.emitConnectionStateChanged('connecting');
          
          setTimeout(() => {
            this.connectionState = 'connected';
            this.connectedDevice = device;
            this.emitConnectionStateChanged('connected');
            resolve({ success: true, message: 'Connected successfully' });
          }, 1200);
        }, 100);
      } else {
        resolve({ success: false, message: 'Device not found' });
      }
    });
  }

  disconnect(): void {
    this.connectionState = 'disconnected';
    this.connectedDevice = null;
    this.stopHeartRateMonitoring();
    this.stopSpO2Monitoring();
    this.stopBloodPressureMonitoring();
    this.emitConnectionStateChanged('disconnected');
  }

  reconnect(): void {
    if (this.connectedDevice) {
      this.connect(this.connectedDevice.mac);
    }
  }

  // Data Retrieval
  async getSteps(): Promise<StepsData> {
    return new Promise((resolve) => {
      const steps = {
        ...this.mockSteps,
        steps: this.mockSteps.steps + Math.floor(Math.random() * 50),
      };
      setTimeout(() => {
        this.mockSteps = steps;
        this.emitStepsReceived(steps);
        resolve(steps);
      }, 300);
    });
  }

  async getSleepData(): Promise<SleepData> {
    return new Promise((resolve) => {
      setTimeout(() => {
        this.emitSleepDataReceived(this.mockSleep);
        resolve(this.mockSleep);
      }, 300);
    });
  }

  async getBattery(): Promise<BatteryData> {
    return new Promise((resolve) => {
      setTimeout(() => {
        this.emitBatteryReceived({ battery: this.mockBattery });
        resolve({ battery: this.mockBattery });
      }, 200);
    });
  }

  async getVersion(): Promise<{ version: string }> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ version: this.connectedDevice?.ver || '3.18.1' });
      }, 150);
    });
  }

  async get24HourHeartRate(): Promise<number[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(this.generate24HourHeartRate());
      }, 400);
    });
  }

  async get24HourSteps(): Promise<number[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(this.generate24HourSteps());
      }, 400);
    });
  }

  async getProfile(): Promise<ProfileData> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(this.mockProfile), 200);
    });
  }

  async getGoal(): Promise<{ goal: number }> {
    return new Promise((resolve) => {
      setTimeout(() => resolve({ goal: this.mockGoal }), 200);
    });
  }

  async getSportData(): Promise<SportData[]> {
    return new Promise((resolve) => {
      const sports: SportData[] = [
        {
          type: 1 as SportType, // Running
          startTime: Date.now() - 2 * 60 * 60 * 1000,
          endTime: Date.now() - 1.5 * 60 * 60 * 1000,
          duration: 30 * 60,
          steps: 4200,
          distance: 3500,
          calories: 280,
          heartRateAvg: 142,
          heartRateMax: 165,
        },
        {
          type: 0 as SportType, // Walking
          startTime: Date.now() - 5 * 60 * 60 * 1000,
          endTime: Date.now() - 4.5 * 60 * 60 * 1000,
          duration: 30 * 60,
          steps: 3100,
          distance: 2200,
          calories: 120,
          heartRateAvg: 95,
          heartRateMax: 110,
        },
      ];
      setTimeout(() => resolve(sports), 300);
    });
  }

  async getAllData(): Promise<{ steps: StepsData[]; sleep: SleepData[] }> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          steps: [this.mockSteps],
          sleep: [this.mockSleep],
        });
      }, 500);
    });
  }

  async getHRVData(): Promise<HRVData> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          sdnn: 45 + Math.random() * 20,
          rmssd: 35 + Math.random() * 15,
          pnn50: 12 + Math.random() * 10,
          lf: 1200 + Math.random() * 400,
          hf: 800 + Math.random() * 300,
          lfHfRatio: 1.2 + Math.random() * 0.8,
          timestamp: Date.now(),
        });
      }, 400);
    });
  }

  async getStressData(): Promise<StressData> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          level: 25 + Math.floor(Math.random() * 30),
          timestamp: Date.now(),
        });
      }, 300);
    });
  }

  async getTemperature(): Promise<TemperatureData> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          temperature: 36.4 + Math.random() * 0.6,
          timestamp: Date.now(),
        });
      }, 300);
    });
  }

  // Real-time Monitoring
  startHeartRateMonitoring(): void {
    if (this.isHeartRateMonitoring) return;
    
    this.isHeartRateMonitoring = true;
    this.heartRateInterval = setInterval(() => {
      this.mockHeartRate = 65 + Math.floor(Math.random() * 25);
      const data: HeartRateData = {
        heartRate: this.mockHeartRate,
        rri: Math.floor(60000 / this.mockHeartRate),
        timestamp: Date.now(),
      };
      this.emitHeartRateReceived(data);
    }, 1500);
  }

  stopHeartRateMonitoring(): void {
    this.isHeartRateMonitoring = false;
    if (this.heartRateInterval) {
      clearInterval(this.heartRateInterval);
      this.heartRateInterval = null;
    }
  }

  startSpO2Monitoring(): void {
    if (this.isSpO2Monitoring) return;
    
    this.isSpO2Monitoring = true;
    this.spO2Interval = setInterval(() => {
      this.mockSpO2 = 96 + Math.floor(Math.random() * 4);
      const data: SpO2Data = {
        spo2: this.mockSpO2,
        timestamp: Date.now(),
      };
      this.emitSpO2Received(data);
    }, 2000);
  }

  stopSpO2Monitoring(): void {
    this.isSpO2Monitoring = false;
    if (this.spO2Interval) {
      clearInterval(this.spO2Interval);
      this.spO2Interval = null;
    }
  }

  startBloodPressureMonitoring(): void {
    if (this.isBloodPressureMonitoring) return;
    
    this.isBloodPressureMonitoring = true;
    // Blood pressure takes longer to measure
    setTimeout(() => {
      this.mockBloodPressure = {
        systolic: 110 + Math.floor(Math.random() * 20),
        diastolic: 70 + Math.floor(Math.random() * 15),
        heartRate: 70 + Math.floor(Math.random() * 15),
      };
      const data: BloodPressureData = {
        ...this.mockBloodPressure,
        timestamp: Date.now(),
      };
      this.emitBloodPressureReceived(data);
      this.isBloodPressureMonitoring = false;
    }, 30000); // 30 seconds for BP measurement
  }

  stopBloodPressureMonitoring(): void {
    this.isBloodPressureMonitoring = false;
    if (this.bpInterval) {
      clearInterval(this.bpInterval);
      this.bpInterval = null;
    }
  }

  // Settings
  async setGoal(goal: number): Promise<{ success: boolean }> {
    return new Promise((resolve) => {
      this.mockGoal = goal;
      setTimeout(() => resolve({ success: true }), 200);
    });
  }

  async setProfile(profile: ProfileData): Promise<{ success: boolean }> {
    return new Promise((resolve) => {
      this.mockProfile = profile;
      setTimeout(() => resolve({ success: true }), 200);
    });
  }

  // Event Emitters
  private emit(event: string, data: any) {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach((callback) => callback(data));
  }

  private emitConnectionStateChanged(state: ConnectionState) {
    this.emit('onConnectionStateChanged', { state });
  }

  private emitBluetoothStateChanged(state: BluetoothState) {
    this.emit('onBluetoothStateChanged', { state });
  }

  private emitDeviceDiscovered(device: DeviceInfo) {
    this.emit('onDeviceDiscovered', device);
  }

  private emitStepsReceived(data: StepsData) {
    this.emit('onStepsReceived', data);
  }

  private emitHeartRateReceived(data: HeartRateData) {
    this.emit('onHeartRateReceived', data);
  }

  private emitSleepDataReceived(data: SleepData) {
    this.emit('onSleepDataReceived', data);
  }

  private emitBatteryReceived(data: BatteryData) {
    this.emit('onBatteryReceived', data);
  }

  private emitSpO2Received(data: SpO2Data) {
    this.emit('onSpO2Received', data);
  }

  private emitBloodPressureReceived(data: BloodPressureData) {
    this.emit('onBloodPressureReceived', data);
  }

  // Event Listeners
  onConnectionStateChanged(callback: (state: ConnectionState) => void): () => void {
    if (!this.listeners.has('onConnectionStateChanged')) {
      this.listeners.set('onConnectionStateChanged', []);
    }
    const wrappedCallback = (event: any) => callback(event.state);
    this.listeners.get('onConnectionStateChanged')!.push(wrappedCallback);
    setTimeout(() => callback(this.connectionState), 100);
    return () => this.removeListener('onConnectionStateChanged', wrappedCallback);
  }

  onBluetoothStateChanged(callback: (state: BluetoothState) => void): () => void {
    if (!this.listeners.has('onBluetoothStateChanged')) {
      this.listeners.set('onBluetoothStateChanged', []);
    }
    const wrappedCallback = (event: any) => callback(event.state);
    this.listeners.get('onBluetoothStateChanged')!.push(wrappedCallback);
    setTimeout(() => callback(this.bluetoothState), 100);
    return () => this.removeListener('onBluetoothStateChanged', wrappedCallback);
  }

  onDeviceDiscovered(callback: (device: DeviceInfo) => void): () => void {
    if (!this.listeners.has('onDeviceDiscovered')) {
      this.listeners.set('onDeviceDiscovered', []);
    }
    this.listeners.get('onDeviceDiscovered')!.push(callback);
    return () => this.removeListener('onDeviceDiscovered', callback);
  }

  onStepsReceived(callback: (data: StepsData) => void): () => void {
    if (!this.listeners.has('onStepsReceived')) {
      this.listeners.set('onStepsReceived', []);
    }
    this.listeners.get('onStepsReceived')!.push(callback);
    return () => this.removeListener('onStepsReceived', callback);
  }

  onHeartRateReceived(callback: (data: HeartRateData) => void): () => void {
    if (!this.listeners.has('onHeartRateReceived')) {
      this.listeners.set('onHeartRateReceived', []);
    }
    this.listeners.get('onHeartRateReceived')!.push(callback);
    return () => this.removeListener('onHeartRateReceived', callback);
  }

  onSleepDataReceived(callback: (data: SleepData) => void): () => void {
    if (!this.listeners.has('onSleepDataReceived')) {
      this.listeners.set('onSleepDataReceived', []);
    }
    this.listeners.get('onSleepDataReceived')!.push(callback);
    return () => this.removeListener('onSleepDataReceived', callback);
  }

  onBatteryReceived(callback: (data: BatteryData) => void): () => void {
    if (!this.listeners.has('onBatteryReceived')) {
      this.listeners.set('onBatteryReceived', []);
    }
    this.listeners.get('onBatteryReceived')!.push(callback);
    return () => this.removeListener('onBatteryReceived', callback);
  }

  onSpO2Received(callback: (data: SpO2Data) => void): () => void {
    if (!this.listeners.has('onSpO2Received')) {
      this.listeners.set('onSpO2Received', []);
    }
    this.listeners.get('onSpO2Received')!.push(callback);
    return () => this.removeListener('onSpO2Received', callback);
  }

  onBloodPressureReceived(callback: (data: BloodPressureData) => void): () => void {
    if (!this.listeners.has('onBloodPressureReceived')) {
      this.listeners.set('onBloodPressureReceived', []);
    }
    this.listeners.get('onBloodPressureReceived')!.push(callback);
    return () => this.removeListener('onBloodPressureReceived', callback);
  }

  onError(callback: (error: any) => void): () => void {
    return () => {};
  }

  private removeListener(event: string, callback: Function): void {
    const callbacks = this.listeners.get(event) || [];
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }
}

export default new SmartRingMockService();
