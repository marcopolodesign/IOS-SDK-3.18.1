import { useState, useEffect, useCallback } from 'react';
import SmartRingService from '../services/SmartRingService';
import type {
  StepsData,
  SleepData,
  HeartRateData,
  SpO2Data,
  BloodPressureData,
  HRVData,
  StressData,
  TemperatureData,
} from '../types/sdk.types';

interface UseHealthDataReturn {
  steps: StepsData | null;
  sleep: SleepData | null;
  heartRate: HeartRateData | null;
  heartRateHistory: number[];
  spO2: SpO2Data | null;
  bloodPressure: BloodPressureData | null;
  hrv: HRVData | null;
  stress: StressData | null;
  temperature: TemperatureData | null;
  isMonitoringHeartRate: boolean;
  isMonitoringSpO2: boolean;
  isMonitoringBloodPressure: boolean;
  isLoading: boolean;
  refreshSteps: () => Promise<void>;
  refreshSleep: () => Promise<void>;
  refresh24HourHeartRate: () => Promise<void>;
  refreshHRV: () => Promise<void>;
  refreshStress: () => Promise<void>;
  refreshTemperature: () => Promise<void>;
  startHeartRateMonitoring: () => void;
  stopHeartRateMonitoring: () => void;
  startSpO2Monitoring: () => void;
  stopSpO2Monitoring: () => void;
  startBloodPressureMonitoring: () => void;
  stopBloodPressureMonitoring: () => void;
}

export const useHealthData = (): UseHealthDataReturn => {
  const [steps, setSteps] = useState<StepsData | null>(null);
  const [sleep, setSleep] = useState<SleepData | null>(null);
  const [heartRate, setHeartRate] = useState<HeartRateData | null>(null);
  const [heartRateHistory, setHeartRateHistory] = useState<number[]>([]);
  const [spO2, setSpO2] = useState<SpO2Data | null>(null);
  const [bloodPressure, setBloodPressure] = useState<BloodPressureData | null>(null);
  const [hrv, setHRV] = useState<HRVData | null>(null);
  const [stress, setStress] = useState<StressData | null>(null);
  const [temperature, setTemperature] = useState<TemperatureData | null>(null);
  const [isMonitoringHeartRate, setIsMonitoringHeartRate] = useState(false);
  const [isMonitoringSpO2, setIsMonitoringSpO2] = useState(false);
  const [isMonitoringBloodPressure, setIsMonitoringBloodPressure] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const unsubSteps = SmartRingService.onStepsReceived((data) => {
      setSteps(data);
    });

    const unsubSleep = SmartRingService.onSleepDataReceived((data) => {
      setSleep(data);
    });

    const unsubHeartRate = SmartRingService.onHeartRateReceived((data) => {
      setHeartRate(data);
    });

    const unsubSpO2 = SmartRingService.onSpO2Received((data) => {
      setSpO2(data);
    });

    const unsubBloodPressure = SmartRingService.onBloodPressureReceived((data) => {
      setBloodPressure(data);
    });

    return () => {
      unsubSteps();
      unsubSleep();
      unsubHeartRate();
      unsubSpO2();
      unsubBloodPressure();
    };
  }, []);

  const refreshSteps = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await SmartRingService.getSteps();
      setSteps(data);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshSleep = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await SmartRingService.getSleepData();
      setSleep(data);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refresh24HourHeartRate = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await SmartRingService.get24HourHeartRate();
      setHeartRateHistory(data);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshHRV = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await SmartRingService.getHRVData();
      setHRV(data);
    } catch (error) {
      console.log('HRV data not available');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshStress = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await SmartRingService.getStressData();
      setStress(data);
    } catch (error) {
      console.log('Stress data not available');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshTemperature = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await SmartRingService.getTemperature();
      setTemperature(data);
    } catch (error) {
      console.log('Temperature data not available');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const startHeartRateMonitoring = useCallback(() => {
    SmartRingService.startHeartRateMonitoring();
    setIsMonitoringHeartRate(true);
  }, []);

  const stopHeartRateMonitoring = useCallback(() => {
    SmartRingService.stopHeartRateMonitoring();
    setIsMonitoringHeartRate(false);
  }, []);

  const startSpO2Monitoring = useCallback(() => {
    SmartRingService.startSpO2Monitoring();
    setIsMonitoringSpO2(true);
  }, []);

  const stopSpO2Monitoring = useCallback(() => {
    SmartRingService.stopSpO2Monitoring();
    setIsMonitoringSpO2(false);
  }, []);

  const startBloodPressureMonitoring = useCallback(() => {
    SmartRingService.startBloodPressureMonitoring();
    setIsMonitoringBloodPressure(true);
  }, []);

  const stopBloodPressureMonitoring = useCallback(() => {
    SmartRingService.stopBloodPressureMonitoring();
    setIsMonitoringBloodPressure(false);
  }, []);

  return {
    steps,
    sleep,
    heartRate,
    heartRateHistory,
    spO2,
    bloodPressure,
    hrv,
    stress,
    temperature,
    isMonitoringHeartRate,
    isMonitoringSpO2,
    isMonitoringBloodPressure,
    isLoading,
    refreshSteps,
    refreshSleep,
    refresh24HourHeartRate,
    refreshHRV,
    refreshStress,
    refreshTemperature,
    startHeartRateMonitoring,
    stopHeartRateMonitoring,
    startSpO2Monitoring,
    stopSpO2Monitoring,
    startBloodPressureMonitoring,
    stopBloodPressureMonitoring,
  };
};

export default useHealthData;





