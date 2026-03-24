/**
 * useHealthKit — React hook for Apple HealthKit integration
 * Uses the new @kingstinct/react-native-healthkit service
 */

import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import HealthKitService from '../services/HealthKitService';
import type {
  HKStepsResult,
  HKHeartRateResult,
  HKHRVResult,
  HKSpO2Result,
  HKSleepResult,
} from '../services/HealthKitService';

const isAvailable = Platform.OS === 'ios';

interface UseHealthKitReturn {
  isAvailable: boolean;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;

  steps: HKStepsResult | null;
  heartRate: HKHeartRateResult | null;
  hrv: HKHRVResult | null;
  spo2: HKSpO2Result | null;
  sleep: HKSleepResult | null;

  initialize: () => Promise<boolean>;
  refreshAll: () => Promise<void>;
}

export const useHealthKit = (): UseHealthKitReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [steps, setSteps] = useState<HKStepsResult | null>(null);
  const [heartRate, setHeartRate] = useState<HKHeartRateResult | null>(null);
  const [hrv, setHrv] = useState<HKHRVResult | null>(null);
  const [spo2, setSpo2] = useState<HKSpO2Result | null>(null);
  const [sleep, setSleep] = useState<HKSleepResult | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'ios') {
      setIsLoading(false);
      return;
    }
    HealthKitService.isConnected().then((connected) => {
      setIsConnected(connected);
      if (connected) {
        HealthKitService.checkPermissions().then((ok) => {
          if (ok) fetchAll();
          else setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    });
    return () => { HealthKitService.clearSubscriptions(); };
  }, []);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await HealthKitService.fetchAllHealthData();
      setSteps(data.steps);
      setHeartRate(data.heartRate);
      setHrv(data.hrv);
      setSpo2(data.spo2);
      setSleep(data.sleep);
    } catch (e: any) {
      setError(e?.message || 'Failed to fetch health data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const initialize = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const success = await HealthKitService.initialize();
      setIsConnected(success);
      if (success) await fetchAll();
      else setError('Failed to initialize HealthKit. Please check permissions.');
      return success;
    } catch (e: any) {
      setError(e?.message || 'Error initializing HealthKit');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [fetchAll]);

  const refreshAll = useCallback(async () => {
    if (!isConnected) return;
    await fetchAll();
  }, [isConnected, fetchAll]);

  return {
    isAvailable,
    isConnected,
    isLoading,
    error,
    steps,
    heartRate,
    hrv,
    spo2,
    sleep,
    initialize,
    refreshAll,
  };
};

export default useHealthKit;
