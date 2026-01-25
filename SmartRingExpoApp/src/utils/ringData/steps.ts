/**
 * Steps/Activity data utilities for Smart Ring
 */

import UnifiedSmartRingService from '../../services/UnifiedSmartRingService';

export interface StepsInfo {
  steps: number;
  calories: number;     // kcal
  distance: number;     // meters
  timestamp: number;
}

/**
 * Get current steps data from the ring (today's totals)
 * @returns Steps, calories, and distance
 */
export async function getSteps(): Promise<StepsInfo> {
  console.log('👟 [RingData] Fetching steps...');
  
  const result = await UnifiedSmartRingService.getSteps();
  
  const info: StepsInfo = {
    steps: result.steps ?? 0,
    calories: result.calories ?? 0,
    distance: result.distance ?? 0,
    timestamp: Date.now(),
  };
  
  console.log(`👟 [RingData] Steps: ${info.steps}, Calories: ${info.calories}, Distance: ${info.distance}m`);
  return info;
}

/**
 * Format distance for display
 * @param meters Distance in meters
 * @param useMetric Use metric system (km) or imperial (miles)
 */
export function formatDistance(meters: number, useMetric: boolean = true): string {
  if (useMetric) {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`;
    }
    return `${Math.round(meters)} m`;
  } else {
    const miles = meters * 0.000621371;
    return `${miles.toFixed(2)} mi`;
  }
}

/**
 * Calculate step goal progress
 */
export function getStepProgress(steps: number, goal: number = 10000): number {
  return Math.min((steps / goal) * 100, 100);
}

