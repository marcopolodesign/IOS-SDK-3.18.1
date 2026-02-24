/**
 * HealthKitService - Integration with Apple HealthKit
 *
 * Currently DISABLED - all methods return safe defaults.
 * The react-native-health module has API compatibility issues.
 * Re-enable when HealthKit integration is properly set up.
 */

import { Platform } from 'react-native';
import type {
  StepsData,
  SleepData,
  HeartRateData,
  SpO2Data,
  HRVData,
} from '../types/sdk.types';

// HealthKit is currently disabled
const AppleHealthKit: any = null;

// Permission constants (kept for when HealthKit is re-enabled)
const HEALTHKIT_PERMISSIONS = {
  permissions: {
    read: [
      'Steps',
      'StepCount',
      'DistanceWalkingRunning',
      'ActiveEnergyBurned',
      'HeartRate',
      'RestingHeartRate',
      'HeartRateVariabilitySDNN',
      'OxygenSaturation',
      'SleepAnalysis',
    ],
    write: [
      'Steps',
      'HeartRate',
      'OxygenSaturation',
      'SleepAnalysis',
    ],
  },
};

class HealthKitService {
  private isInitialized = false;
  private _isAvailable = false;

  /**
   * Check if HealthKit is available (sync)
   */
  isHealthKitAvailable(): boolean {
    return false;
  }

  /**
   * Async check for availability
   */
  async checkIsAvailable(): Promise<boolean> {
    return false;
  }

  /**
   * Initialize HealthKit and request permissions
   */
  async initialize(): Promise<boolean> {
    if (Platform.OS !== 'ios' || !AppleHealthKit) {
      return false;
    }

    return new Promise((resolve) => {
      try {
        AppleHealthKit.initHealthKit(HEALTHKIT_PERMISSIONS, (err: string) => {
          if (err) {
            console.log('HealthKit initialization error:', err);
            resolve(false);
          } else {
            this.isInitialized = true;
            this._isAvailable = true;
            resolve(true);
          }
        });
      } catch (error) {
        console.log('Error initializing HealthKit:', error);
        resolve(false);
      }
    });
  }

  /**
   * Check if initialized
   */
  isReady(): boolean {
    return this.isInitialized && this._isAvailable;
  }

  // ==================== READ METHODS ====================

  async getSteps(date?: Date): Promise<StepsData | null> {
    if (!this.isReady() || !AppleHealthKit) return null;

    const targetDate = date || new Date();

    return new Promise((resolve) => {
      try {
        AppleHealthKit.getStepCount(
          {
            date: targetDate.toISOString(),
            includeManuallyAdded: true,
          },
          (err: string, results: { value: number }) => {
            if (err) {
              resolve(null);
              return;
            }
            resolve({
              steps: results?.value || 0,
              distance: 0,
              calories: 0,
              time: 0,
            });
          }
        );
      } catch (error) {
        resolve(null);
      }
    });
  }

  async getHeartRate(): Promise<HeartRateData[]> {
    if (!this.isReady() || !AppleHealthKit) return [];

    const end = new Date();
    const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);

    return new Promise((resolve) => {
      try {
        AppleHealthKit.getHeartRateSamples(
          {
            startDate: start.toISOString(),
            endDate: end.toISOString(),
            ascending: false,
            limit: 10,
          },
          (err: string, results: any[]) => {
            if (err) {
              resolve([]);
              return;
            }
            const data: HeartRateData[] = (results || []).map((sample) => ({
              heartRate: Math.round(sample.value),
              timestamp: new Date(sample.startDate).getTime(),
            }));
            resolve(data);
          }
        );
      } catch (error) {
        resolve([]);
      }
    });
  }

  async getLatestHeartRate(): Promise<HeartRateData | null> {
    const samples = await this.getHeartRate();
    return samples.length > 0 ? samples[0] : null;
  }

  async getRestingHeartRate(): Promise<number | null> {
    if (!this.isReady() || !AppleHealthKit) return null;

    return new Promise((resolve) => {
      try {
        AppleHealthKit.getRestingHeartRate(
          {
            startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            endDate: new Date().toISOString(),
          },
          (err: string, results: any[]) => {
            if (err || !results?.length) {
              resolve(null);
              return;
            }
            resolve(Math.round(results[results.length - 1].value));
          }
        );
      } catch (error) {
        resolve(null);
      }
    });
  }

  async getHRV(): Promise<HRVData | null> {
    if (!this.isReady() || !AppleHealthKit) return null;

    return new Promise((resolve) => {
      try {
        AppleHealthKit.getHeartRateVariabilitySamples(
          {
            startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            endDate: new Date().toISOString(),
            ascending: false,
            limit: 1,
          },
          (err: string, results: any[]) => {
            if (err || !results?.length) {
              resolve(null);
              return;
            }
            resolve({
              sdnn: results[0].value * 1000,
              timestamp: new Date(results[0].startDate).getTime(),
            });
          }
        );
      } catch (error) {
        resolve(null);
      }
    });
  }

  async getSleepData(): Promise<SleepData | null> {
    if (!this.isReady() || !AppleHealthKit) return null;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 1);
    startDate.setHours(18, 0, 0, 0);

    return new Promise((resolve) => {
      try {
        AppleHealthKit.getSleepSamples(
          {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            limit: 100,
          },
          (err: string, results: any[]) => {
            if (err || !results?.length) {
              resolve(null);
              return;
            }

            let deep = 0, light = 0, rem = 0, awake = 0;
            let startTime = Infinity, endTime = 0;

            results.forEach((sample) => {
              const start = new Date(sample.startDate).getTime();
              const end = new Date(sample.endDate).getTime();
              const duration = (end - start) / 1000 / 60;

              if (start < startTime) startTime = start;
              if (end > endTime) endTime = end;

              switch (sample.value) {
                case 'DEEP': deep += duration; break;
                case 'REM': rem += duration; break;
                case 'CORE':
                case 'ASLEEP': light += duration; break;
                case 'AWAKE': awake += duration; break;
              }
            });

            resolve({
              deep: Math.round(deep),
              light: Math.round(light),
              rem: Math.round(rem),
              awake: Math.round(awake),
              detail: `Total: ${Math.round(deep + light + rem)} min`,
              startTime: startTime === Infinity ? undefined : startTime,
              endTime: endTime === 0 ? undefined : endTime,
            });
          }
        );
      } catch (error) {
        resolve(null);
      }
    });
  }

  async getSpO2(): Promise<SpO2Data | null> {
    if (!this.isReady() || !AppleHealthKit) return null;

    return new Promise((resolve) => {
      try {
        AppleHealthKit.getOxygenSaturationSamples(
          {
            startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            endDate: new Date().toISOString(),
            ascending: false,
            limit: 1,
          },
          (err: string, results: any[]) => {
            if (err || !results?.length) {
              resolve(null);
              return;
            }
            resolve({
              spo2: Math.round(results[0].value * 100),
              timestamp: new Date(results[0].startDate).getTime(),
            });
          }
        );
      } catch (error) {
        resolve(null);
      }
    });
  }

  async syncToHealthKit(data: {
    steps?: StepsData;
    heartRate?: HeartRateData;
    spO2?: SpO2Data;
  }): Promise<{ success: boolean; synced: string[] }> {
    return {
      success: true,
      synced: [],
    };
  }
}

export default new HealthKitService();
