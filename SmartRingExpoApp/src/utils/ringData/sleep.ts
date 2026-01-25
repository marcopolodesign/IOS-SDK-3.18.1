/**
 * Sleep data utilities for Smart Ring
 * 
 * SDK SLEEPTYPE enum:
 * 0 = SLEEPTYPENONE    (no data)
 * 1 = SLEEPTYPESOBER   (awake)
 * 2 = SLEEPTYPELIGHT   (light sleep)
 * 3 = SLEEPTYPEDEEP    (deep sleep)
 * 4 = SLEEPTYPEREM     (REM)
 * 5 = SLEEPTYPEUNWEARED (not wearing)
 */

import QCBandService from '../../services/QCBandService';

export interface SleepSegment {
  startTime: string;
  endTime: string;
  duration: number;  // minutes
  type: number;      // 0-5 (see enum above)
  typeName: string;  // Human-readable type
}

export interface SleepInfo {
  // Total times in minutes
  totalSleepMinutes: number;
  deepMinutes: number;
  lightMinutes: number;
  remMinutes: number;
  awakeMinutes: number;
  
  // Nap data
  totalNapMinutes: number;
  
  // Timing
  fallAsleepDuration: number;  // Minutes to fall asleep
  bedTime?: string;
  wakeTime?: string;
  
  // Raw segments for detailed analysis
  segments: SleepSegment[];
  napSegments: SleepSegment[];
  
  // Metadata
  timestamp: number;
  dayIndex: number;
}

export interface SleepScore {
  score: number;      // 0-100
  quality: 'Poor' | 'Fair' | 'Good' | 'Excellent';
  breakdown: {
    duration: number;     // Points for total sleep duration
    deepSleep: number;    // Points for deep sleep %
    efficiency: number;   // Points for sleep efficiency (less awake time)
    consistency: number;  // Points for consistent sleep/wake times
  };
}

const SLEEP_TYPE_NAMES = ['None', 'Awake', 'Light', 'Deep', 'REM', 'Unweared'];

/**
 * Get sleep data for a specific day
 * @param dayIndex 0 = today, 1 = yesterday, etc. (up to 6 days)
 * @returns Detailed sleep information
 */
export async function getSleep(dayIndex: number = 0): Promise<SleepInfo> {
  console.log(`😴 [RingData] Fetching sleep data for day ${dayIndex}...`);
  
  const rawData = await QCBandService.getSleepData(dayIndex);
  
  // Log raw data
  console.log('😴 [RingData] Raw sleep segments:', rawData.sleepSegments.length);
  
  // Process segments with type names
  const segments: SleepSegment[] = rawData.sleepSegments.map(s => ({
    ...s,
    typeName: SLEEP_TYPE_NAMES[s.type] || 'Unknown',
  }));
  
  const napSegments: SleepSegment[] = rawData.napSegments.map(s => ({
    ...s,
    typeName: SLEEP_TYPE_NAMES[s.type] || 'Unknown',
  }));
  
  // Calculate totals by type (correct mapping)
  const awakeMinutes = segments.filter(s => s.type === 1).reduce((acc, s) => acc + s.duration, 0);
  const lightMinutes = segments.filter(s => s.type === 2).reduce((acc, s) => acc + s.duration, 0);
  const deepMinutes = segments.filter(s => s.type === 3).reduce((acc, s) => acc + s.duration, 0);
  const remMinutes = segments.filter(s => s.type === 4).reduce((acc, s) => acc + s.duration, 0);
  
  const info: SleepInfo = {
    totalSleepMinutes: rawData.totalSleepMinutes,
    deepMinutes,
    lightMinutes,
    remMinutes,
    awakeMinutes,
    totalNapMinutes: rawData.totalNapMinutes,
    fallAsleepDuration: rawData.fallAsleepDuration,
    bedTime: segments[0]?.startTime,
    wakeTime: segments[segments.length - 1]?.endTime,
    segments,
    napSegments,
    timestamp: rawData.timestamp,
    dayIndex,
  };
  
  console.log(`😴 [RingData] Sleep: Total=${info.totalSleepMinutes}m, Deep=${deepMinutes}m, Light=${lightMinutes}m, REM=${remMinutes}m, Awake=${awakeMinutes}m`);
  
  return info;
}

/**
 * Get sleep data for multiple days
 * @param days Number of days to fetch (1-7)
 * @returns Array of sleep info for each day
 */
export async function getSleepHistory(days: number = 7): Promise<SleepInfo[]> {
  console.log(`😴 [RingData] Fetching ${days} days of sleep history...`);
  
  const results: SleepInfo[] = [];
  for (let i = 0; i < Math.min(days, 7); i++) {
    try {
      const sleepData = await getSleep(i);
      results.push(sleepData);
    } catch (err) {
      console.log(`😴 [RingData] Failed to get sleep for day ${i}:`, err);
    }
  }
  
  return results;
}

/**
 * Calculate a sleep quality score (0-100)
 * 
 * Scoring based on sleep science research:
 * - Ideal total sleep: 7-9 hours
 * - Ideal deep sleep: 15-25% of total
 * - Ideal REM: 20-25% of total
 * - Less awake time = better
 */
export function calculateSleepScore(sleep: SleepInfo): SleepScore {
  const totalMinutes = sleep.totalSleepMinutes;
  
  // Duration score (0-35 points)
  // Optimal: 7-9 hours (420-540 minutes)
  let durationScore = 0;
  if (totalMinutes >= 420 && totalMinutes <= 540) {
    durationScore = 35; // Optimal
  } else if (totalMinutes >= 360 && totalMinutes < 420) {
    durationScore = 25; // Slightly under
  } else if (totalMinutes > 540 && totalMinutes <= 600) {
    durationScore = 25; // Slightly over
  } else if (totalMinutes >= 300 && totalMinutes < 360) {
    durationScore = 15; // Under
  } else if (totalMinutes > 600) {
    durationScore = 15; // Over
  } else {
    durationScore = 5; // Very under
  }
  
  // Deep sleep score (0-25 points)
  // Optimal: 15-25% of total sleep
  const deepPercent = totalMinutes > 0 ? (sleep.deepMinutes / totalMinutes) * 100 : 0;
  let deepScore = 0;
  if (deepPercent >= 15 && deepPercent <= 25) {
    deepScore = 25;
  } else if (deepPercent >= 10 && deepPercent < 15) {
    deepScore = 18;
  } else if (deepPercent > 25 && deepPercent <= 30) {
    deepScore = 18;
  } else if (deepPercent >= 5 && deepPercent < 10) {
    deepScore = 10;
  } else {
    deepScore = 5;
  }
  
  // Efficiency score (0-25 points)
  // Based on how little time spent awake
  const awakePercent = totalMinutes > 0 ? (sleep.awakeMinutes / totalMinutes) * 100 : 0;
  let efficiencyScore = 0;
  if (awakePercent <= 5) {
    efficiencyScore = 25;
  } else if (awakePercent <= 10) {
    efficiencyScore = 20;
  } else if (awakePercent <= 15) {
    efficiencyScore = 15;
  } else if (awakePercent <= 20) {
    efficiencyScore = 10;
  } else {
    efficiencyScore = 5;
  }
  
  // REM/Consistency score (0-15 points)
  // Optimal REM: 20-25%
  const remPercent = totalMinutes > 0 ? (sleep.remMinutes / totalMinutes) * 100 : 0;
  let consistencyScore = 0;
  if (remPercent >= 20 && remPercent <= 25) {
    consistencyScore = 15;
  } else if (remPercent >= 15 && remPercent < 20) {
    consistencyScore = 12;
  } else if (remPercent > 25 && remPercent <= 30) {
    consistencyScore = 12;
  } else if (remPercent >= 10) {
    consistencyScore = 8;
  } else {
    consistencyScore = 5;
  }
  
  const totalScore = durationScore + deepScore + efficiencyScore + consistencyScore;
  
  let quality: SleepScore['quality'] = 'Poor';
  if (totalScore >= 85) quality = 'Excellent';
  else if (totalScore >= 70) quality = 'Good';
  else if (totalScore >= 50) quality = 'Fair';
  
  return {
    score: totalScore,
    quality,
    breakdown: {
      duration: durationScore,
      deepSleep: deepScore,
      efficiency: efficiencyScore,
      consistency: consistencyScore,
    },
  };
}

/**
 * Format sleep duration for display
 */
export function formatSleepDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/**
 * Get sleep stage color
 */
export function getSleepStageColor(type: number): string {
  switch (type) {
    case 1: return 'rgba(255, 255, 255, 0.3)'; // Awake - light gray
    case 2: return '#818CF8'; // Light - medium indigo
    case 3: return '#6366F1'; // Deep - dark indigo
    case 4: return '#A5B4FC'; // REM - light indigo
    default: return 'transparent';
  }
}

