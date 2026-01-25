/**
 * Ring Data Utilities
 * 
 * Easy-to-use functions for fetching data from the smart ring.
 * 
 * Usage:
 * ```typescript
 * import { getBattery, getSteps, getHeartRate, getSleep, getSpO2 } from '@/utils/ringData';
 * 
 * // Get battery level
 * const battery = await getBattery();
 * console.log(battery.level); // 75
 * 
 * // Get today's steps
 * const steps = await getSteps();
 * console.log(steps.steps); // 5432
 * 
 * // Get heart rate
 * const hr = await getHeartRate();
 * console.log(hr.heartRate); // 72
 * 
 * // Get last night's sleep
 * const sleep = await getSleep();
 * console.log(sleep.deepMinutes); // 118
 * console.log(sleep.lightMinutes); // 212
 * 
 * // Get SpO2
 * const spo2 = await getSpO2();
 * console.log(spo2.spo2); // 98
 * ```
 */

// Battery
export {
  getBattery,
  getBatteryColor,
  getBatteryIcon,
  type BatteryInfo,
} from './battery';

// Steps
export {
  getSteps,
  formatDistance,
  getStepProgress,
  type StepsInfo,
} from './steps';

// Heart Rate
export {
  getHeartRate,
  startHeartRateMeasurement,
  stopHeartRateMeasurement,
  onHeartRateData,
  getHeartRateZone,
  getHeartRateColor,
  getOvernightHeartRate,
  analyzeSleepFromHR,
  type HeartRateInfo,
  type HeartRateMeasurement,
} from './heartRate';

// Sleep
export {
  getSleep,
  getSleepHistory,
  calculateSleepScore,
  formatSleepDuration,
  getSleepStageColor,
  type SleepInfo,
  type SleepSegment,
  type SleepScore,
} from './sleep';

// SpO2
export {
  getSpO2,
  getSpO2Status,
  getSpO2Color,
  type SpO2Info,
} from './spo2';

// Blood Glucose
export {
  getBloodGlucose,
  getLatestBloodGlucose,
  getBloodGlucoseStatus,
  formatBloodGlucose,
  type BloodGlucoseInfo,
} from './bloodGlucose';

// Custom Sleep Analysis (Advanced)
export {
  getCustomSleepAnalysis,
  type CustomSleepAnalysis,
  type CustomSleepStage,
  type SleepArchitecture,
  type PersonalizedInsights,
} from './customSleepAnalysis';

// Convenience function to fetch all metrics at once
export async function getAllMetrics(dayIndex: number = 0) {
  const [battery, steps, heartRate, sleep, spo2, bloodGlucose] = await Promise.allSettled([
    getBattery(),
    getSteps(),
    getHeartRate(),
    getSleep(dayIndex),
    getSpO2(),
    getBloodGlucose(dayIndex).catch(() => []), // Blood glucose may not be supported
  ]);

  return {
    battery: battery.status === 'fulfilled' ? battery.value : null,
    steps: steps.status === 'fulfilled' ? steps.value : null,
    heartRate: heartRate.status === 'fulfilled' ? heartRate.value : null,
    sleep: sleep.status === 'fulfilled' ? sleep.value : null,
    spo2: spo2.status === 'fulfilled' ? spo2.value : null,
    bloodGlucose: bloodGlucose.status === 'fulfilled' ? bloodGlucose.value : null,
  };
}

