/**
 * useHealthKit - Custom hook for Apple HealthKit integration
 * Using @kingstinct/react-native-healthkit
 */

import { useState, useEffect, useCallback } from 'react';
import HealthKitService from '../services/HealthKitService';
import type {
  StepsData,
  SleepData,
  HeartRateData,
  SpO2Data,
  BloodPressureData,
  HRVData,
} from '../types/sdk.types';

interface UseHealthKitReturn {
  // Status
  isAvailable: boolean;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Data from HealthKit
  healthKitSteps: StepsData | null;
  healthKitSleep: SleepData | null;
  healthKitHeartRate: HeartRateData | null;
  healthKitHeartRateHistory: HeartRateData[];
  healthKitRestingHR: number | null;
  healthKitHRV: HRVData | null;
  healthKitSpO2: SpO2Data | null;
  healthKitBloodPressure: BloodPressureData | null;
  
  // Actions
  initialize: () => Promise<boolean>;
  refreshAll: () => Promise<void>;
  refreshSteps: () => Promise<void>;
  refreshSleep: () => Promise<void>;
  refreshHeartRate: () => Promise<void>;
  refreshSpO2: () => Promise<void>;
  refreshBloodPressure: () => Promise<void>;
  
  // Sync to HealthKit
  syncAll: (data: {
    steps?: StepsData;
    heartRate?: HeartRateData;
    spO2?: SpO2Data;
    bloodPressure?: BloodPressureData;
  }) => Promise<{ success: boolean; synced: string[] }>;
}

export const useHealthKit = (): UseHealthKitReturn => {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Data states
  const [healthKitSteps, setHealthKitSteps] = useState<StepsData | null>(null);
  const [healthKitSleep, setHealthKitSleep] = useState<SleepData | null>(null);
  const [healthKitHeartRate, setHealthKitHeartRate] = useState<HeartRateData | null>(null);
  const [healthKitHeartRateHistory, setHealthKitHeartRateHistory] = useState<HeartRateData[]>([]);
  const [healthKitRestingHR, setHealthKitRestingHR] = useState<number | null>(null);
  const [healthKitHRV, setHealthKitHRV] = useState<HRVData | null>(null);
  const [healthKitSpO2, setHealthKitSpO2] = useState<SpO2Data | null>(null);
  const [healthKitBloodPressure, setHealthKitBloodPressure] = useState<BloodPressureData | null>(null);

  // Check availability on mount - async
  useEffect(() => {
    const checkAvailability = async () => {
      try {
        const available = await HealthKitService.checkIsAvailable();
        console.log('HealthKit available:', available);
        setIsAvailable(available);
      } catch (e) {
        console.log('Error checking HealthKit availability:', e);
        setIsAvailable(false);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAvailability();
  }, []);

  // Initialize HealthKit
  const initialize = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const success = await HealthKitService.initialize();
      setIsInitialized(success);
      setIsAvailable(success);
      
      if (!success) {
        setError('Failed to initialize HealthKit. Please check permissions.');
      }
      
      return success;
    } catch (err) {
      console.log('Error initializing HealthKit:', err);
      setError('Error initializing HealthKit');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refresh functions
  const refreshSteps = useCallback(async () => {
    if (!isInitialized) return;
    try {
      const data = await HealthKitService.getSteps();
      setHealthKitSteps(data);
    } catch (e) {
      console.log('Error refreshing steps:', e);
    }
  }, [isInitialized]);

  const refreshSleep = useCallback(async () => {
    if (!isInitialized) return;
    try {
      const data = await HealthKitService.getSleepData();
      setHealthKitSleep(data);
    } catch (e) {
      console.log('Error refreshing sleep:', e);
    }
  }, [isInitialized]);

  const refreshHeartRate = useCallback(async () => {
    if (!isInitialized) return;
    
    try {
      const [latest, history, resting, hrv] = await Promise.all([
        HealthKitService.getLatestHeartRate(),
        HealthKitService.getHeartRate(),
        HealthKitService.getRestingHeartRate(),
        HealthKitService.getHRV(),
      ]);
      
      setHealthKitHeartRate(latest);
      setHealthKitHeartRateHistory(history);
      setHealthKitRestingHR(resting);
      setHealthKitHRV(hrv);
    } catch (e) {
      console.log('Error refreshing heart rate:', e);
    }
  }, [isInitialized]);

  const refreshSpO2 = useCallback(async () => {
    if (!isInitialized) return;
    try {
      const data = await HealthKitService.getSpO2();
      setHealthKitSpO2(data);
    } catch (e) {
      console.log('Error refreshing SpO2:', e);
    }
  }, [isInitialized]);

  const refreshBloodPressure = useCallback(async () => {
    if (!isInitialized) return;
    // Blood pressure not yet implemented in simplified service
    setHealthKitBloodPressure(null);
  }, [isInitialized]);

  const refreshAll = useCallback(async () => {
    if (!isInitialized) return;
    
    setIsLoading(true);
    try {
      await Promise.all([
        refreshSteps(),
        refreshSleep(),
        refreshHeartRate(),
        refreshSpO2(),
        refreshBloodPressure(),
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, refreshSteps, refreshSleep, refreshHeartRate, refreshSpO2, refreshBloodPressure]);

  // Auto-refresh when initialized
  useEffect(() => {
    if (isInitialized) {
      refreshAll();
    }
  }, [isInitialized]);

  // Sync function
  const syncAll = useCallback(async (data: {
    steps?: StepsData;
    heartRate?: HeartRateData;
    spO2?: SpO2Data;
    bloodPressure?: BloodPressureData;
  }) => {
    if (!isInitialized) return { success: false, synced: [] };
    return await HealthKitService.syncToHealthKit(data);
  }, [isInitialized]);

  return {
    isAvailable,
    isInitialized,
    isLoading,
    error,
    healthKitSteps,
    healthKitSleep,
    healthKitHeartRate,
    healthKitHeartRateHistory,
    healthKitRestingHR,
    healthKitHRV,
    healthKitSpO2,
    healthKitBloodPressure,
    initialize,
    refreshAll,
    refreshSteps,
    refreshSleep,
    refreshHeartRate,
    refreshSpO2,
    refreshBloodPressure,
    syncAll,
  };
};

export default useHealthKit;
