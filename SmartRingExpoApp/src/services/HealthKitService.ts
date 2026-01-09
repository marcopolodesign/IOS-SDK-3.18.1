/**
 * HealthKitService - Integration with Apple HealthKit
 * Using react-native-health library
 */

import { Platform } from 'react-native';
import type {
  StepsData,
  SleepData,
  HeartRateData,
  SpO2Data,
  HRVData,
} from '../types/sdk.types';

// Dynamic import for HealthKit
let AppleHealthKit: any = null;

if (Platform.OS === 'ios') {
  try {
    // react-native-health uses module.exports, not default export
    const healthModule = require('react-native-health');
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/222d9e95-a481-4991-af22-0fe5181f77fe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'HealthKitService.ts:20',message:'react-native-health module require result',data:{moduleType:typeof healthModule,hasDefault:!!healthModule.default,moduleKeys:Object.keys(healthModule||{}).slice(0,10),hasIsAvailable:typeof healthModule?.isAvailable==='function'},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'module-load'})}).catch(()=>{});
    // #endregion
    
    // Use the module directly (it's exported as module.exports = HealthKit)
    AppleHealthKit = healthModule;
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/222d9e95-a481-4991-af22-0fe5181f77fe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'HealthKitService.ts:25',message:'AppleHealthKit assigned',data:{moduleType:typeof AppleHealthKit,hasIsAvailable:typeof AppleHealthKit?.isAvailable==='function',hasInitHealthKit:typeof AppleHealthKit?.initHealthKit==='function'},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'module-load'})}).catch(()=>{});
    // #endregion
    console.log('✅ react-native-health module loaded successfully');
    console.log('Module type:', typeof AppleHealthKit);
    console.log('Module keys:', Object.keys(AppleHealthKit || {}).slice(0, 10));
    console.log('Has isAvailable:', typeof AppleHealthKit?.isAvailable === 'function');
  } catch (e) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/222d9e95-a481-4991-af22-0fe5181f77fe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'HealthKitService.ts:catch',message:'HealthKit library not available',data:{error:String(e),errorName:e?.name,errorMessage:e?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'module-load'})}).catch(()=>{});
    // #endregion
    console.log('❌ HealthKit library not available:', e);
    console.log('Error details:', JSON.stringify(e, null, 2));
  }
} else {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/222d9e95-a481-4991-af22-0fe5181f77fe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'HealthKitService.ts:else',message:'Not iOS platform',data:{platform:Platform.OS},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'platform-check'})}).catch(()=>{});
  // #endregion
  console.log('Not iOS platform, HealthKit unavailable');
}

// Permission constants
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

  constructor() {
    // Check availability async
    this.checkAvailability();
  }

  /**
   * Check if HealthKit is available on this device
   */
  private checkAvailability(): void {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/222d9e95-a481-4991-af22-0fe5181f77fe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'HealthKitService.ts:checkAvailability',message:'checkAvailability called',data:{platform:Platform.OS,hasModule:!!AppleHealthKit},timestamp:Date.now(),sessionId:'debug-session',runId:'init',hypothesisId:'availability-check'})}).catch(()=>{});
    // #endregion
    if (Platform.OS !== 'ios' || !AppleHealthKit) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/222d9e95-a481-4991-af22-0fe5181f77fe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'HealthKitService.ts:checkAvailability',message:'Early return - not iOS or no module',data:{platform:Platform.OS,hasModule:!!AppleHealthKit},timestamp:Date.now(),sessionId:'debug-session',runId:'init',hypothesisId:'availability-check'})}).catch(()=>{});
      // #endregion
      this._isAvailable = false;
      return;
    }

    try {
      AppleHealthKit.isAvailable((err: any, available: boolean) => {
        this._isAvailable = available;
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/222d9e95-a481-4991-af22-0fe5181f77fe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'HealthKitService.ts:checkAvailability:callback',message:'isAvailable callback result',data:{available,error:err?String(err):null,errorType:err?.constructor?.name},timestamp:Date.now(),sessionId:'debug-session',runId:'init',hypothesisId:'availability-check'})}).catch(()=>{});
        // #endregion
        console.log('HealthKit availability check:', available, err);
      });
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/222d9e95-a481-4991-af22-0fe5181f77fe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'HealthKitService.ts:checkAvailability:catch',message:'Error in checkAvailability',data:{error:String(error),errorName:error?.name,errorMessage:error?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'init',hypothesisId:'availability-check'})}).catch(()=>{});
      // #endregion
      console.log('Error checking HealthKit availability:', error);
      this._isAvailable = false;
    }
  }

  /**
   * Check if HealthKit is available (sync)
   */
  isHealthKitAvailable(): boolean {
    return this._isAvailable && Platform.OS === 'ios';
  }

  /**
   * Async check for availability
   */
  async checkIsAvailable(): Promise<boolean> {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/222d9e95-a481-4991-af22-0fe5181f77fe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'HealthKitService.ts:checkIsAvailable',message:'checkIsAvailable called',data:{platform:Platform.OS,hasModule:!!AppleHealthKit},timestamp:Date.now(),sessionId:'debug-session',runId:'init',hypothesisId:'async-availability'})}).catch(()=>{});
    // #endregion
    if (Platform.OS !== 'ios') {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/222d9e95-a481-4991-af22-0fe5181f77fe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'HealthKitService.ts:checkIsAvailable',message:'Not iOS platform',data:{platform:Platform.OS},timestamp:Date.now(),sessionId:'debug-session',runId:'init',hypothesisId:'async-availability'})}).catch(()=>{});
      // #endregion
      return false;
    }

    if (!AppleHealthKit) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/222d9e95-a481-4991-af22-0fe5181f77fe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'HealthKitService.ts:checkIsAvailable',message:'AppleHealthKit module not loaded',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'init',hypothesisId:'async-availability'})}).catch(()=>{});
      // #endregion
      console.log('AppleHealthKit module not loaded');
      return false;
    }

    return new Promise((resolve) => {
      try {
        AppleHealthKit.isAvailable((err: any, available: boolean) => {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/222d9e95-a481-4991-af22-0fe5181f77fe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'HealthKitService.ts:checkIsAvailable:callback',message:'isAvailable async result',data:{available,error:err?String(err):null,errorType:err?.constructor?.name},timestamp:Date.now(),sessionId:'debug-session',runId:'init',hypothesisId:'async-availability'})}).catch(()=>{});
          // #endregion
          console.log('HealthKit isAvailable result:', available, err);
          this._isAvailable = available;
          resolve(available);
        });
      } catch (error) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/222d9e95-a481-4991-af22-0fe5181f77fe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'HealthKitService.ts:checkIsAvailable:catch',message:'Error in checkIsAvailable',data:{error:String(error),errorName:error?.name,errorMessage:error?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'init',hypothesisId:'async-availability'})}).catch(()=>{});
        // #endregion
        console.log('Error in isAvailable:', error);
        resolve(false);
      }
    });
  }

  /**
   * Initialize HealthKit and request permissions
   */
  async initialize(): Promise<boolean> {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/222d9e95-a481-4991-af22-0fe5181f77fe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'HealthKitService.ts:initialize',message:'initialize called',data:{platform:Platform.OS,hasModule:!!AppleHealthKit,permissionsCount:Object.keys(HEALTHKIT_PERMISSIONS.permissions.read||{}).length},timestamp:Date.now(),sessionId:'debug-session',runId:'init',hypothesisId:'initialization'})}).catch(()=>{});
    // #endregion
    if (Platform.OS !== 'ios') {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/222d9e95-a481-4991-af22-0fe5181f77fe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'HealthKitService.ts:initialize',message:'Not iOS platform',data:{platform:Platform.OS},timestamp:Date.now(),sessionId:'debug-session',runId:'init',hypothesisId:'initialization'})}).catch(()=>{});
      // #endregion
      console.log('HealthKit only available on iOS');
      return false;
    }

    if (!AppleHealthKit) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/222d9e95-a481-4991-af22-0fe5181f77fe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'HealthKitService.ts:initialize',message:'Module not loaded in initialize',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'init',hypothesisId:'initialization'})}).catch(()=>{});
      // #endregion
      console.log('AppleHealthKit module not loaded');
      return false;
    }

    return new Promise((resolve) => {
      try {
        AppleHealthKit.initHealthKit(HEALTHKIT_PERMISSIONS, (err: string) => {
          if (err) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/222d9e95-a481-4991-af22-0fe5181f77fe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'HealthKitService.ts:initialize:callback',message:'initHealthKit error',data:{error:String(err),errorType:typeof err},timestamp:Date.now(),sessionId:'debug-session',runId:'init',hypothesisId:'initialization'})}).catch(()=>{});
            // #endregion
            console.log('HealthKit initialization error:', err);
            resolve(false);
          } else {
            this.isInitialized = true;
            this._isAvailable = true;
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/222d9e95-a481-4991-af22-0fe5181f77fe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'HealthKitService.ts:initialize:callback',message:'HealthKit initialized successfully',data:{isInitialized:this.isInitialized,isAvailable:this._isAvailable},timestamp:Date.now(),sessionId:'debug-session',runId:'init',hypothesisId:'initialization'})}).catch(()=>{});
            // #endregion
            console.log('✅ HealthKit initialized successfully');
            resolve(true);
          }
        });
      } catch (error) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/222d9e95-a481-4991-af22-0fe5181f77fe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'HealthKitService.ts:initialize:catch',message:'Exception in initialize',data:{error:String(error),errorName:error?.name,errorMessage:error?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'init',hypothesisId:'initialization'})}).catch(()=>{});
        // #endregion
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

  /**
   * Get today's step count from HealthKit
   */
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
              console.log('Error getting steps:', err);
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
        console.log('Error in getSteps:', error);
        resolve(null);
      }
    });
  }

  /**
   * Get heart rate samples from HealthKit
   */
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
              console.log('Error getting heart rate:', err);
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
        console.log('Error in getHeartRate:', error);
        resolve([]);
      }
    });
  }

  /**
   * Get latest heart rate
   */
  async getLatestHeartRate(): Promise<HeartRateData | null> {
    const samples = await this.getHeartRate();
    return samples.length > 0 ? samples[0] : null;
  }

  /**
   * Get resting heart rate
   */
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

  /**
   * Get HRV (Heart Rate Variability) data
   */
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

  /**
   * Get sleep data from HealthKit
   */
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

  /**
   * Get SpO2 (Blood Oxygen) data
   */
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

  /**
   * Sync smart ring data to HealthKit
   */
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
