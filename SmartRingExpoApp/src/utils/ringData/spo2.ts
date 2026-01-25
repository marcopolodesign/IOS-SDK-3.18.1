/**
 * Blood Oxygen (SpO2) data utilities for Smart Ring
 */

import UnifiedSmartRingService from '../../services/UnifiedSmartRingService';

export interface SpO2Info {
  spo2: number;       // Percentage (90-100 typically)
  timestamp: number;
}

/**
 * Get the most recent SpO2 reading
 * @returns Blood oxygen saturation percentage
 */
export async function getSpO2(): Promise<SpO2Info> {
  console.log('🫁 [RingData] Fetching SpO2...');
  
  const result = await UnifiedSmartRingService.getSpO2();
  
  const info: SpO2Info = {
    spo2: result.spo2 ?? 0,
    timestamp: Date.now(),
  };
  
  console.log(`🫁 [RingData] SpO2: ${info.spo2}%`);
  return info;
}

/**
 * Get SpO2 status based on value
 * Normal: 95-100%
 * Low: 90-94%
 * Critical: <90%
 */
export function getSpO2Status(spo2: number): 'Normal' | 'Low' | 'Critical' | 'Unknown' {
  if (spo2 === 0) return 'Unknown';
  if (spo2 >= 95) return 'Normal';
  if (spo2 >= 90) return 'Low';
  return 'Critical';
}

/**
 * Get SpO2 color based on value
 */
export function getSpO2Color(spo2: number): string {
  if (spo2 >= 95) return '#4ADE80';  // Green - normal
  if (spo2 >= 90) return '#FBBF24';  // Yellow - low
  if (spo2 > 0) return '#F87171';    // Red - critical
  return '#6B7280';                   // Gray - unknown
}

