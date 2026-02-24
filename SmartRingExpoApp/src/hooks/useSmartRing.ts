import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import UnifiedSmartRingService from '../services/UnifiedSmartRingService';
import type {
  DeviceInfo,
  ConnectionState,
  BluetoothState,
  BatteryData,
  HeartRateData,
  SpO2Data,
  StepsData,
} from '../types/sdk.types';

// Helper to check if a device is a ring/band
const isRingDevice = (device: DeviceInfo): boolean => {
  const name = device.name?.toLowerCase() || '';
  const id = device.id?.toLowerCase() || '';

  // Jstyle X3 devices (tagged by native bridge)
  if (device.sdkType === 'jstyle') return true;

  // Check for X3 patterns
  if (name.includes('x3')) return true;
  if (name.includes('jstyle')) return true;
  if (name.includes('focus x3')) return true;

  // Check for R10_ pattern (ring devices)
  if (id.includes('r10_') || name.includes('r10_')) return true;

  // Check for FOCUS R1 (already formatted)
  if (name.includes('focus r1')) return true;

  // Check for SmartBand
  if (name.includes('smartband')) return true;

  // Check for sdk_ prefix (cached ring)
  if (id.startsWith('sdk_r10_')) return true;

  return false;
};

// Helper to format device display name
const formatDeviceName = (device: DeviceInfo): string => {
  const name = device.name || '';
  const id = device.id || '';
  const lower = name.toLowerCase();

  // Jstyle X3 devices
  if (device.sdkType === 'jstyle') return 'FOCUS X3';
  if (lower.includes('x3')) return 'FOCUS X3';
  if (lower.includes('jstyle')) return 'FOCUS X3';

  // If it's already "FOCUS R1", return as-is
  if (name.includes('FOCUS R1')) return 'FOCUS R1';

  // R10_* devices should be "FOCUS R1"
  if (name.startsWith('R10_') || id.includes('R10_') || id.startsWith('sdk_R10_')) {
    return 'FOCUS R1';
  }

  // SmartBand stays as-is
  if (lower.includes('smartband')) return name;

  return name || 'Smart Ring';
};

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
  isAutoConnecting: boolean;
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
  measureHeartRate: () => Promise<void>;
  measureSpO2: () => Promise<void>;
  checkForPairedDevice: () => Promise<{ hasPairedDevice: boolean; device: DeviceInfo | null }>;
  autoConnect: () => Promise<{ success: boolean; device: DeviceInfo | null }>;
  forgetDevice: () => Promise<void>;
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
  const [isAutoConnecting, setIsAutoConnecting] = useState(false);
  const [metrics, setMetrics] = useState<RingMetrics>({
    heartRate: null,
    spo2: null,
    steps: null,
    calories: null,
    distance: null,
  });
  const isMockMode = UnifiedSmartRingService.isUsingMockData();
  const metricsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Function to fetch all metrics from the ring (including battery)
  const fetchMetrics = useCallback(async () => {
    try {
      console.log('📊 Fetching metrics from ring...');
      setIsLoadingMetrics(true);

      // Fetch battery first - this is critical for the UI
      try {
        const batteryData = await UnifiedSmartRingService.getBattery();
        setBattery(batteryData.battery);
        console.log('✅ Battery:', batteryData.battery + '%');
      } catch (err: any) {
        console.log('⚠️ Could not fetch battery:', err.message);
      }

      // Fetch steps data
      try {
        const stepsData = await UnifiedSmartRingService.getSteps();
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

      // Fetch heart rate from 24-hour data first
      try {
        const hrData = await UnifiedSmartRingService.getHeartRate();
        setMetrics(prev => ({ ...prev, heartRate: hrData.heartRate }));
        console.log('✅ Heart Rate (24hr):', hrData.heartRate);
      } catch (err: any) {
        console.log('⚠️ Could not fetch heart rate:', err.message);
      }

      // Fetch SpO2
      try {
        const spo2Data = await UnifiedSmartRingService.getSpO2();
        setMetrics(prev => ({ ...prev, spo2: spo2Data.spo2 }));
        console.log('✅ SpO2:', spo2Data.spo2);
      } catch (err: any) {
        console.log('⚠️ Could not fetch SpO2:', err.message);
      }

      // DISABLED: Real-time HR measurement on connection
      // This was causing issues - SDK needs more time to stabilize
      // User can manually trigger HR measurement from the Ring screen
      // try {
      //   console.log('💓 Triggering real-time HR measurement...');
      //   await UnifiedSmartRingService.measureHeartRate();
      // } catch (err: any) {
      //   console.log('⚠️ Could not trigger real-time HR:', err.message);
      // }

    } catch (error) {
      console.log('❌ Error fetching metrics:', error);
    } finally {
      setIsLoadingMetrics(false);
    }
  }, []);

  // Refresh metrics manually
  const refreshMetrics = useCallback(async () => {
    const status = await UnifiedSmartRingService.isConnected();
    if (status.connected) {
      await fetchMetrics();
    } else {
      console.log('⚠️ Cannot refresh metrics - not connected');
    }
  }, [fetchMetrics]);

  useEffect(() => {
    // Check initial connection state on mount
    // This is critical for components that mount after connection is already established
    UnifiedSmartRingService.isConnected().then((status) => {
      console.log('📱 [useSmartRing] Initial connection check:', status.connected);
      if (status.connected) {
        setConnectionState('connected');
      }
    });

    const unsubConnection = UnifiedSmartRingService.onConnectionStateChanged((state) => {
      const now = Date.now();
      console.log('📱 [useSmartRing] Connection state event:', state);
      setConnectionState(state);

      if (state === 'connected') {
        // NOTE: Auto-fetch metrics on connection is DISABLED
        // Multiple components use useSmartRing(), each would trigger fetchMetrics()
        // Instead, useHomeData handles data fetching on connection (single source of truth)
        // Components can call refreshMetrics() manually if needed
      }
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

    const unsubBluetooth = UnifiedSmartRingService.onBluetoothStateChanged((state) => {
      setBluetoothState(state);
    });

    const unsubDevice = UnifiedSmartRingService.onDeviceDiscovered((device) => {
      setDevices((prev) => {
        // Ensure prev is always an array
        const deviceList = Array.isArray(prev) ? prev : [];
        // Check for duplicates by MAC or by device name suffix (for R10_ rings)
        const existingIndex = deviceList.findIndex((d) => {
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
          return [...deviceList, device];
        }
        
        // If new device has a real MAC and existing doesn't, replace it
        const existing = deviceList[existingIndex];
        if (device.mac?.includes(':') && !existing.mac?.includes(':')) {
          const newDevices = [...deviceList];
          newDevices[existingIndex] = device;
          return newDevices;
        }
        
        return deviceList;
      });
    });

    const unsubBattery = UnifiedSmartRingService.onBatteryReceived((data) => {
      setBattery(data.battery);
    });

    // Listen for real-time heart rate (from setStartSingleHR / receiveHeartRate delegate)
    const unsubHeartRate = UnifiedSmartRingService.onHeartRateReceived((data) => {
      console.log('💓 Real-time heart rate received:', data.heartRate);
      if (data.heartRate > 0) {
        setMetrics(prev => ({ ...prev, heartRate: data.heartRate }));
      }
    });

    // Listen for real-time SpO2 (from setStartSpO2 / receiveSpO2 delegate)
    const unsubSpO2 = UnifiedSmartRingService.onSpO2Received((data) => {
      console.log('🫁 Real-time SpO2 received:', data.spo2);
      if (data.spo2 > 0) {
        setMetrics(prev => ({ ...prev, spo2: data.spo2 }));
      }
    });

    // Listen for real-time steps (from receiveSteps delegate)
    const unsubSteps = UnifiedSmartRingService.onStepsReceived((data) => {
      console.log('👟 Real-time steps received:', data.steps);
      setMetrics(prev => ({
        ...prev,
        steps: data.steps,
        calories: data.calories,
        distance: data.distance,
      }));
    });

    return () => {
      unsubConnection();
      unsubBluetooth();
      unsubDevice();
      unsubBattery();
      unsubHeartRate();
      unsubSpO2();
      unsubSteps();
    };
  }, [fetchMetrics]);

  const scan = useCallback(async (duration: number = 10) => {
    setIsScanning(true);
    setDevices([]);
    try {
      const discoveredDevices = await UnifiedSmartRingService.scan(duration);
      // Ensure we always set an array
      setDevices(Array.isArray(discoveredDevices) ? discoveredDevices : []);
    } finally {
      setIsScanning(false);
    }
  }, []);

  const stopScan = useCallback(() => {
    UnifiedSmartRingService.stopScan();
    setIsScanning(false);
  }, []);

  const connect = useCallback(async (mac: string): Promise<boolean> => {
    console.log('🔗 [useSmartRing] connect() called with MAC:', mac);

    const device = devices.find((d) => d.mac === mac);
    if (!device) {
      console.log('❌ [useSmartRing] Device not found in devices list');
      return false;
    }

    // Determine SDK type from device and set it on the unified service
    const sdkType = device.sdkType || 'qcband';
    console.log('🔗 [useSmartRing] Device sdkType:', sdkType);
    UnifiedSmartRingService.setConnectedSDKType(sdkType);

    try {
      // Jstyle native bridge expects the CoreBluetooth peripheral UUID (device.id),
      // not the MAC address. QCBand uses MAC.
      const connectId = sdkType === 'jstyle' ? device.id : mac;
      console.log('🔗 [useSmartRing] Calling UnifiedSmartRingService.connect() with:', connectId);
      const startTime = Date.now();

      const result = await UnifiedSmartRingService.connect(connectId, sdkType);

      const elapsed = Date.now() - startTime;
      console.log(`🔗 [useSmartRing] connect() returned after ${elapsed}ms:`, result);
      
      if (result.success) {
        // CRITICAL: Set both connectedDevice AND connectionState
        setConnectedDevice(device);
        setConnectionState('connected');
        console.log('✅ [useSmartRing] Connection successful! UI should now show connected state.');

        // Note: SDK is usually busy syncing after connection
        // Data fetching is skipped here - user can manually refresh later
        // when the SDK is no longer busy

        return true;
      }
      console.log('❌ [useSmartRing] Connection returned false');
      return false;
    } catch (error) {
      console.log('❌ [useSmartRing] Connection failed:', error);
      return false;
    }
  }, [devices]);

  const disconnect = useCallback(() => {
    UnifiedSmartRingService.disconnect();
  }, []);

  const findDevice = useCallback(() => {
    UnifiedSmartRingService.findDevice();
  }, []);

  // Check for previously paired device without triggering scan or pairing prompt
  const checkForPairedDevice = useCallback(async (): Promise<{
    hasPairedDevice: boolean;
    device: DeviceInfo | null;
  }> => {
    console.log('🔍 Checking for previously paired device...');
    try {
      const result = await UnifiedSmartRingService.getPairedDevice();
      if (result.hasPairedDevice && result.device) {
        console.log('✅ Found paired device:', result.device.name);
        // Add to devices list for connect() to find it
        setDevices([result.device]);
      }
      return result;
    } catch (error) {
      console.log('⚠️ Error checking for paired device:', error);
      return { hasPairedDevice: false, device: null };
    }
  }, []);

  // Auto-connect to previously paired device (skips scan entirely)
  // Uses native SDK's auto-reconnect which retrieves the device by saved UUID
  const autoConnect = useCallback(async (): Promise<{
    success: boolean;
    device: DeviceInfo | null;
  }> => {
    console.log('🔄 Attempting auto-connect to paired device...');
    setIsAutoConnecting(true);

    try {
      // If the OS already re-established the BLE link, avoid kicking off a second reconnect
      const nativeStatus = await UnifiedSmartRingService.isConnected();
      if (nativeStatus.connected) {
        console.log('📶 Already connected at native level - skipping autoReconnect');
        const { hasPairedDevice, device } = await checkForPairedDevice();
        if (hasPairedDevice && device) {
          setConnectedDevice(device);
        }
        setConnectionState('connected');
        return { success: true, device: hasPairedDevice ? device : null };
      }

      // First check if there's a paired device
      const { hasPairedDevice, device } = await checkForPairedDevice();

      if (!hasPairedDevice) {
        console.log('📱 No paired device found for auto-connect');
        setIsAutoConnecting(false);
        return { success: false, device: null };
      }

      // Double-check connectivity right before calling the native reconnect to avoid racing an existing link
      const statusBeforeReconnect = await UnifiedSmartRingService.isConnected();
      if (statusBeforeReconnect.connected) {
        console.log('📶 Connection restored during auto-connect flow - skipping native autoReconnect');
        if (device) {
          setConnectedDevice(device);
        }
        setConnectionState('connected');
        return { success: true, device: device || null };
      }

      console.log('🔗 Auto-reconnecting to paired device...');

      // Use native auto-reconnect which handles everything:
      // 1. Gets saved UUID from UserDefaults
      // 2. Retrieves peripheral using retrievePeripheralsWithIdentifiers
      // 3. Connects and syncs time
      const result = await UnifiedSmartRingService.autoReconnect();

      if (result.success) {
        console.log('✅ Auto-reconnect successful!');
        
        // Build connected device info from result or paired device info
        const connectedDeviceInfo: DeviceInfo = device || {
          id: result.deviceId || '',
          mac: result.deviceId || '',
          name: result.deviceName || 'Smart Ring',
          rssi: -50,
        };
        
        console.log('📱 Setting connected device:', connectedDeviceInfo.name);
        console.log('📱 [DEBUG] Before setConnectedDevice, current connectionState:', connectionState);
        setConnectedDevice(connectedDeviceInfo);
        setConnectionState('connected');
        console.log('📱 [DEBUG] After setConnectionState("connected"), state should update soon');
        
        return { success: true, device: connectedDeviceInfo };
      } else {
        console.log('❌ Auto-reconnect failed:', result.message);
        return { success: false, device };
      }
    } catch (error) {
      console.log('❌ Auto-connect error:', error);
      return { success: false, device: null };
    } finally {
      console.log('📱 [DEBUG] autoConnect finally block - setting isAutoConnecting to false');
      setIsAutoConnecting(false);
    }
  }, [checkForPairedDevice]);

  // Trigger a real-time heart rate measurement
  // Result will come via onHeartRateReceived event listener
  const measureHeartRate = useCallback(async (): Promise<void> => {
    console.log('💓 Starting real-time heart rate measurement...');
    try {
      await UnifiedSmartRingService.measureHeartRate();
    } catch (error) {
      console.log('❌ Failed to start heart rate measurement:', error);
    }
  }, []);

  // Trigger a real-time SpO2 measurement
  // Result will come via onSpO2Received event listener
  const measureSpO2 = useCallback(async (): Promise<void> => {
    console.log('🫁 Starting real-time SpO2 measurement...');
    try {
      UnifiedSmartRingService.startSpO2Monitoring();
    } catch (error) {
      console.log('❌ Failed to start SpO2 measurement:', error);
    }
  }, []);

  // Forget/clear the paired device from SDK memory
  const forgetDevice = useCallback(async (): Promise<void> => {
    console.log('🗑️ Forgetting paired device...');
    await UnifiedSmartRingService.forgetPairedDevice();
    setConnectedDevice(null);
    setDevices([]);
    setBattery(null);
    setVersion(null);
    setMetrics({
      heartRate: null,
      spo2: null,
      steps: null,
      calories: null,
      distance: null,
    });
    setConnectionState('disconnected');
    console.log('✅ Device forgotten, state cleared');
  }, []);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (metricsIntervalRef.current) {
        clearInterval(metricsIntervalRef.current);
      }
    };
  }, []);

  // Filter to only show ring devices and format names properly
  const filteredDevices = useMemo(() => {
    return devices
      .filter(isRingDevice)
      .map(device => ({
        ...device,
        name: formatDeviceName(device),
      }))
      // Remove duplicates by MAC
      .filter((device, index, self) => 
        index === self.findIndex(d => d.mac === device.mac)
      );
  }, [devices]);

  return {
    connectionState,
    bluetoothState,
    isConnected: connectionState === 'connected',
    isScanning,
    isAutoConnecting,
    devices: filteredDevices,
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
    measureHeartRate,
    measureSpO2,
    checkForPairedDevice,
    autoConnect,
    forgetDevice,
  };
};

export default useSmartRing;



