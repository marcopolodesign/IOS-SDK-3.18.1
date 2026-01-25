/**
 * Blood Glucose data utilities for Smart Ring
 */

import UnifiedSmartRingService from '../../services/UnifiedSmartRingService';

export interface BloodGlucoseInfo {
  glucose: number;        // mg/dL
  minGlucose?: number;
  maxGlucose?: number;
  type?: 'scheduled' | 'manual';
  gluType?: 'beforeMeals' | 'normal' | 'afterMeals';
  timestamp: number;
}

/**
 * Get blood glucose data for a specific day
 * @param dayIndex 0 = today, 1 = yesterday, etc. (up to 6 days)
 * @returns Array of blood glucose readings
 */
export async function getBloodGlucose(dayIndex: number = 0): Promise<BloodGlucoseInfo[]> {
  console.log(`🩸 [RingData] Fetching blood glucose for day ${dayIndex}...`);
  
  try {
    const data = await UnifiedSmartRingService.getBloodGlucose(dayIndex);
    
    return data.map(item => ({
      glucose: item.glucose,
      minGlucose: item.minGlucose,
      maxGlucose: item.maxGlucose,
      type: item.type === 0 ? 'scheduled' : item.type === 1 ? 'manual' : undefined,
      gluType: item.gluType === 0 ? 'beforeMeals' : item.gluType === 1 ? 'normal' : item.gluType === 2 ? 'afterMeals' : undefined,
      timestamp: item.timestamp,
    }));
  } catch (error) {
    console.error('🩸 [RingData] Failed to get blood glucose data:', error);
    throw error;
  }
}

/**
 * Get the most recent blood glucose reading
 * @param dayIndex 0 = today, 1 = yesterday, etc.
 * @returns Most recent reading or null
 */
export async function getLatestBloodGlucose(dayIndex: number = 0): Promise<BloodGlucoseInfo | null> {
  const readings = await getBloodGlucose(dayIndex);
  if (readings.length === 0) return null;
  
  // Sort by timestamp descending and return most recent
  return readings.sort((a, b) => b.timestamp - a.timestamp)[0];
}

/**
 * Get blood glucose status based on value
 * Normal range: 70-100 mg/dL (fasting), <140 mg/dL (after meals)
 */
export function getBloodGlucoseStatus(glucose: number, gluType?: 'beforeMeals' | 'normal' | 'afterMeals'): {
  status: 'normal' | 'low' | 'elevated' | 'high';
  color: string;
  label: string;
} {
  // Fasting (before meals): 70-100 mg/dL normal
  // After meals: <140 mg/dL normal
  const isFasting = gluType === 'beforeMeals';
  const normalMin = isFasting ? 70 : 80;
  const normalMax = isFasting ? 100 : 140;
  
  if (glucose < normalMin) {
    return { status: 'low', color: '#F87171', label: 'Low' };
  } else if (glucose > normalMax) {
    return { status: 'high', color: '#F87171', label: 'High' };
  } else if (glucose > normalMax * 0.9) {
    return { status: 'elevated', color: '#FBBF24', label: 'Elevated' };
  } else {
    return { status: 'normal', color: '#4ADE80', label: 'Normal' };
  }
}

/**
 * Format blood glucose value for display
 */
export function formatBloodGlucose(glucose: number): string {
  return `${glucose.toFixed(0)} mg/dL`;
}

