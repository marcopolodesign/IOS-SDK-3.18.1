import { useState, useEffect, useCallback, useRef } from 'react';
import SmartRingService from '../services/SmartRingService';
import type {
  DeviceInfo,
  ConnectionState,
  BluetoothState,
  BatteryData,
  HeartRateData,
  SpO2Data,
  StepsData,
} from '../types/sdk.types';

interface RingMetrics {
  heartRate: number | null;
  spo2: number | null;
  steps: number | null;
  calories: number | null;
  distance: number | null;
}

interface UseSmartRingReturn {
  connectionState: ConnectionState;
  bluetoothState: BluetoothState;
  isConnected: boolean;
  isScanning: boolean;
  devices: DeviceInfo[];
  connectedDevice: DeviceInfo | null;
  battery: number | null;
  version: string | null;
  metrics: RingMetrics;
  isMockMode: boolean;
  isLoadingMetrics: boolean;
  scan: (duration?: number) => Promise<void>;
  stopScan: () => void;
  connect: (mac: string) => Promise<boolean>;
  disconnect: () => void;
  findDevice: () => void;
  refreshMetrics: () => Promise<void>;
}

export const useSmartRing = (): UseSmartRingReturn => {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [bluetoothState, setBluetoothState] = useState<BluetoothState>('unknown');
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<DeviceInfo | null>(null);
  const [battery, setBattery] = useState<number | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [metrics, setMetrics] = useState<RingMetrics>({
    heartRate: null,
    spo2: null,
    steps: null,
    calories: null,
    distance: null,
  });
  const isMockMode = SmartRingService.isUsingMockData();
  const metricsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Function to fetch all metrics from the ring
  const fetchMetrics = useCallback(async () => {
    try {
      console.log('📊 Fetching metrics from ring...');
      setIsLoadingMetrics(true);
      
      // Fetch steps data
      try {
        const stepsData = await SmartRingService.getSteps();
        setMetrics(prev => ({
          ...prev,
          steps: stepsData.steps,
          calories: stepsData.calories,
          distance: stepsData.distance,
        }));
        console.log('✅ Steps:', stepsData.steps);
      } catch (err: any) {
        console.log('⚠️ Could not fetch steps:', err.message);
      }

      // Fetch heart rate (this might trigger a real-time reading)
      try {
        const hrData = await SmartRingService.getHeartRate();
        setMetrics(prev => ({ ...prev, heartRate: hrData.heartRate }));
        console.log('✅ Heart Rate:', hrData.heartRate);
      } catch (err: any) {
        console.log('⚠️ Could not fetch heart rate:', err.message);
      }

      // Fetch SpO2
      try {
        const spo2Data = await SmartRingService.getSpO2();
        setMetrics(prev => ({ ...prev, spo2: spo2Data.spo2 }));
        console.log('✅ SpO2:', spo2Data.spo2);
      } catch (err: any) {
        console.log('⚠️ Could not fetch SpO2:', err.message);
      }

    } catch (error) {
      console.log('❌ Error fetching metrics:', error);
    } finally {
      setIsLoadingMetrics(false);
    }
  }, []);

  // Refresh metrics manually
  const refreshMetrics = useCallback(async () => {
    const status = await SmartRingService.isConnected();
    if (status.connected) {
      await fetchMetrics();
    } else {
      console.log('⚠️ Cannot refresh metrics - not connected');
    }
  }, [fetchMetrics]);

  useEffect(() => {
    const unsubConnection = SmartRingService.onConnectionStateChanged((state) => {
      setConnectionState(state);
      if (state === 'disconnected') {
        setConnectedDevice(null);
        setBattery(null);
        setVersion(null);
        setMetrics({
          heartRate: null,
          spo2: null,
          steps: null,
          calories: null,
          distance: null,
        });
        // Clear metrics refresh interval
        if (metricsIntervalRef.current) {
          clearInterval(metricsIntervalRef.current);
          metricsIntervalRef.current = null;
        }
      }
    });

    const unsubBluetooth = SmartRingService.onBluetoothStateChanged((state) => {
      setBluetoothState(state);
    });

    const unsubDevice = SmartRingService.onDeviceDiscovered((device) => {
      setDevices((prev) => {
        // Check for duplicates by MAC or by device name suffix (for R10_ rings)
        const existingIndex = prev.findIndex((d) => {
          // Same MAC
          if (d.mac && device.mac && d.mac === device.mac) return true;
          // For R10_ devices, check if the name suffix matches (e.g., both "FOCUS R1" with same ID pattern)
          if (d.id?.startsWith('sdk_R10_') && device.mac?.includes(':')) {
            // Cached device (sdk_R10_AC04) vs scanned device (FE:E7:32:31:41:37)
            // Extract the suffix from the SDK id (AC04) and check if it appears in the name or is the same ring
            const sdkSuffix = d.id.replace('sdk_R10_', '');
            // If scanned device name is "FOCUS R1", they're likely the same ring
            if (d.name === device.name) return true;
          }
          if (device.id?.startsWith('sdk_R10_') && d.mac?.includes(':')) {
            if (d.name === device.name) return true;
          }
          return false;
        });
        
        if (existingIndex === -1) {
          return [...prev, device];
        }
        
        // If new device has a real MAC and existing doesn't, replace it
        const existing = prev[existingIndex];
        if (device.mac?.includes(':') && !existing.mac?.includes(':')) {
          const newDevices = [...prev];
          newDevices[existingIndex] = device;
          return newDevices;
        }
        
        return prev;
      });
    });

    const unsubBattery = SmartRingService.onBatteryReceived((data) => {
      setBattery(data.battery);
    });

    return () => {
      unsubConnection();
      unsubBluetooth();
      unsubDevice();
      unsubBattery();
    };
  }, []);

  const scan = useCallback(async (duration: number = 10) => {
    setIsScanning(true);
    setDevices([]);
    try {
      const discoveredDevices = await SmartRingService.scan(duration);
      setDevices(discoveredDevices);
    } finally {
      setIsScanning(false);
    }
  }, []);

  const stopScan = useCallback(() => {
    SmartRingService.stopScan();
    setIsScanning(false);
  }, []);

  const connect = useCallback(async (mac: string): Promise<boolean> => {
    const device = devices.find((d) => d.mac === mac);
    if (!device) return false;

    try {
      const result = await SmartRingService.connect(mac);
      if (result.success) {
        setConnectedDevice(device);
        
        // Wait a moment for the connection to stabilize before fetching data
        console.log('🔗 Connection successful, waiting for stabilization...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Verify we're still connected before fetching data
        try {
          const status = await SmartRingService.isConnected();
          if (status.connected) {
            console.log('✅ Connection stable, fetching device data...');
            
            // Fetch battery
            SmartRingService.getBattery()
              .then((data) => setBattery(data.battery))
              .catch((err) => console.log('⚠️ Could not fetch battery:', err.message));
            
            // Fetch version
            SmartRingService.getVersion()
              .then((data) => setVersion(data.version))
              .catch((err) => console.log('⚠️ Could not fetch version:', err.message));
            
            // Fetch initial metrics
            await fetchMetrics();
            
            // Set up periodic metrics refresh (every 30 seconds)
            if (metricsIntervalRef.current) {
              clearInterval(metricsIntervalRef.current);
            }
            metricsIntervalRef.current = setInterval(() => {
              console.log('🔄 Auto-refreshing metrics...');
              fetchMetrics();
            }, 30000);
            
          } else {
            console.log('⚠️ Connection not stable after wait, skipping data fetch');
          }
        } catch (err) {
          console.log('⚠️ Could not verify connection status:', err);
        }
        
        return true;
      }
      return false;
    } catch (error) {
      console.log('❌ Connection failed:', error);
      return false;
    }
  }, [devices, fetchMetrics]);

  const disconnect = useCallback(() => {
    SmartRingService.disconnect();
  }, []);

  const findDevice = useCallback(() => {
    SmartRingService.findDevice();
  }, []);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (metricsIntervalRef.current) {
        clearInterval(metricsIntervalRef.current);
      }
    };
  }, []);

  return {
    connectionState,
    bluetoothState,
    isConnected: connectionState === 'connected',
    isScanning,
    devices,
    connectedDevice,
    battery,
    version,
    metrics,
    isMockMode,
    isLoadingMetrics,
    scan,
    stopScan,
    connect,
    disconnect,
    findDevice,
    refreshMetrics,
  };
};

export default useSmartRing;





