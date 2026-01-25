/**
 * Heart Rate data utilities for Smart Ring
 */

import UnifiedSmartRingService from '../../services/UnifiedSmartRingService';
import QCBandService from '../../services/QCBandService';

export interface HeartRateInfo {
  heartRate: number;    // bpm
  timestamp: number;
  source: 'scheduled' | 'manual' | 'realtime';
}

export interface HeartRateMeasurement {
  isActive: boolean;
  currentValue: number | null;
  finalValue: number | null;
}

/**
 * Get the most recent heart rate reading (from scheduled measurements)
 * @returns Last recorded heart rate
 */
export async function getHeartRate(): Promise<HeartRateInfo> {
  console.log('💓 [RingData] Fetching heart rate...');
  
  const result = await UnifiedSmartRingService.getHeartRate();
  
  const info: HeartRateInfo = {
    heartRate: result.heartRate ?? 0,
    timestamp: result.timestamp ?? Date.now(),
    source: 'scheduled',
  };
  
  console.log(`💓 [RingData] Heart Rate: ${info.heartRate} bpm`);
  return info;
}

/**
 * Start a real-time heart rate measurement
 * Results come via the onHeartRateData event listener
 * @returns Promise that resolves when measurement starts
 */
export async function startHeartRateMeasurement(): Promise<{ success: boolean }> {
  console.log('💓 [RingData] Starting HR measurement...');
  return await UnifiedSmartRingService.measureHeartRate();
}

/**
 * Stop heart rate measurement
 */
export async function stopHeartRateMeasurement(): Promise<void> {
  console.log('💓 [RingData] Stopping HR measurement...');
  await QCBandService.stopHeartRateMeasuring();
}

/**
 * Subscribe to real-time heart rate data
 * @param callback Function called when HR data is received
 * @returns Unsubscribe function
 */
export function onHeartRateData(
  callback: (data: { 
    heartRate: number; 
    timestamp: number; 
    isRealTime?: boolean; 
    isMeasuring?: boolean; 
    isFinal?: boolean;
  }) => void
): () => void {
  return QCBandService.onHeartRateData(callback);
}

/**
 * Get heart rate zone based on age
 */
export function getHeartRateZone(hr: number, age: number = 30): string {
  const maxHR = 220 - age;
  const percentage = (hr / maxHR) * 100;
  
  if (percentage < 50) return 'Rest';
  if (percentage < 60) return 'Light';
  if (percentage < 70) return 'Fat Burn';
  if (percentage < 80) return 'Cardio';
  if (percentage < 90) return 'Hard';
  return 'Maximum';
}

/**
 * Get heart rate color based on value
 */
export function getHeartRateColor(hr: number): string {
  if (hr < 60) return '#60A5FA';   // Blue - low
  if (hr < 100) return '#4ADE80';  // Green - normal
  if (hr < 140) return '#FBBF24';  // Yellow - elevated
  return '#F87171';                // Red - high
}

/**
 * Get overnight heart rate data for sleep analysis
 * Returns raw HR measurements throughout the night (ring's scheduled readings)
 * @param dayIndex 0 = last night, 1 = night before, etc.
 */
export async function getOvernightHeartRate(dayIndex: number = 0): Promise<{
  measurements: Array<{ heartRate: number; timeMinutes: number; timestamp: number }>;
  baseline: number;
  min: number;
  max: number;
  hrv: number;
  count: number;
}> {
  console.log(`💓 [RingData] Fetching overnight HR for day ${dayIndex}...`);
  
  // Get all scheduled HR measurements for the day
  const data = await QCBandService.getScheduledHeartRate([dayIndex]);
  
  if (!data || data.length === 0) {
    console.log('💓 [RingData] No HR data available');
    return {
      measurements: [],
      baseline: 0,
      min: 0,
      max: 0,
      hrv: 0,
      count: 0,
    };
  }
  
  // #region agent log - Debug HR data structure
  console.log('💓 [RingData] First 3 HR measurements:', data.slice(0, 3).map(d => ({
    hr: d.heartRate,
    timeMinutes: d.timeMinutes,
    timestamp: d.timestamp,
    hasTimeMinutes: d.timeMinutes !== undefined,
  })));
  // #endregion
  
  // Optional: Filter for nighttime hours (10 PM - 8 AM)
  // Uncomment if you only want nighttime data
  // const nightData = data.filter(d => {
  //   const hour = Math.floor(d.timeMinutes / 60);
  //   return hour >= 22 || hour <= 8;
  // });
  
  const heartRates = data.map(d => d.heartRate);
  const baseline = heartRates.reduce((a, b) => a + b, 0) / heartRates.length;
  const min = Math.min(...heartRates);
  const max = Math.max(...heartRates);
  const hrv = calculateHRV(heartRates);
  
  console.log(`💓 [RingData] Overnight HR: ${data.length} measurements, baseline=${baseline.toFixed(0)}, range=${min}-${max}, HRV=${hrv.toFixed(1)}`);
  
  return {
    measurements: data,
    baseline,
    min,
    max,
    hrv,
    count: data.length,
  };
}

/**
 * Calculate Heart Rate Variability (simplified SDNN)
 * Higher HRV generally indicates better recovery/rest
 */
function calculateHRV(heartRates: number[]): number {
  if (heartRates.length < 2) return 0;
  
  // Calculate standard deviation of heart rates (simplified HRV metric)
  const mean = heartRates.reduce((a, b) => a + b, 0) / heartRates.length;
  const variance = heartRates.reduce((sum, hr) => sum + Math.pow(hr - mean, 2), 0) / heartRates.length;
  return Math.sqrt(variance);
}

/**
 * Analyze sleep quality from overnight HR data
 * Compare with ring's sleep classification
 */
export async function analyzeSleepFromHR(dayIndex: number = 0): Promise<{
  overnightHR: Awaited<ReturnType<typeof getOvernightHeartRate>>;
  analysis: {
    quality: 'Poor' | 'Fair' | 'Good' | 'Excellent';
    restfulness: number; // 0-100
    deepSleepIndicator: number; // % of time with HR below baseline-10
    consistency: number; // 0-100, lower HRV variation = more consistent
    notes: string[];
  };
}> {
  const hrData = await getOvernightHeartRate(dayIndex);
  
  if (hrData.count === 0) {
    return {
      overnightHR: hrData,
      analysis: {
        quality: 'Poor',
        restfulness: 0,
        deepSleepIndicator: 0,
        consistency: 0,
        notes: ['No HR data available'],
      },
    };
  }
  
  const { measurements, baseline, hrv } = hrData;
  
  // Calculate how much time was spent in "deep sleep HR range"
  const deepSleepThreshold = baseline - 10;
  const deepSleepCount = measurements.filter(m => m.heartRate < deepSleepThreshold).length;
  const deepSleepIndicator = (deepSleepCount / measurements.length) * 100;
  
  // Higher HRV = better rest (for overnight sleep)
  const restfulness = Math.min(100, (hrv / baseline) * 100 * 3); // Scaled
  
  // Consistency: how stable was HR throughout night
  const consistency = Math.max(0, 100 - ((hrData.max - hrData.min) / baseline * 100));
  
  // Overall quality score
  const qualityScore = (restfulness * 0.4) + (deepSleepIndicator * 0.4) + (consistency * 0.2);
  
  let quality: 'Poor' | 'Fair' | 'Good' | 'Excellent' = 'Poor';
  if (qualityScore >= 75) quality = 'Excellent';
  else if (qualityScore >= 60) quality = 'Good';
  else if (qualityScore >= 40) quality = 'Fair';
  
  const notes: string[] = [];
  if (deepSleepIndicator < 20) notes.push('Low time in deep sleep HR range');
  if (hrv < 10) notes.push('Low HRV - may need more recovery');
  if (consistency < 50) notes.push('Restless night - HR varied significantly');
  if (baseline > 70) notes.push('Elevated baseline HR overnight');
  
  return {
    overnightHR: hrData,
    analysis: {
      quality,
      restfulness,
      deepSleepIndicator,
      consistency,
      notes: notes.length > 0 ? notes : ['Sleep quality appears normal'],
    },
  };
}

