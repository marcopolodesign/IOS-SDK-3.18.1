/**
 * Battery data utilities for Smart Ring
 */

import UnifiedSmartRingService from '../../services/UnifiedSmartRingService';

export interface BatteryInfo {
  level: number;        // 0-100
  isCharging: boolean;
  timestamp: number;
}

/**
 * Get current battery level from the ring
 * @returns Battery level (0-100) and charging status
 */
export async function getBattery(): Promise<BatteryInfo> {
  console.log('🔋 [RingData] Fetching battery...');
  
  const result = await UnifiedSmartRingService.getBattery();
  
  const info: BatteryInfo = {
    level: result.battery ?? 0,
    isCharging: result.isCharging ?? false,
    timestamp: Date.now(),
  };
  
  console.log(`🔋 [RingData] Battery: ${info.level}%, Charging: ${info.isCharging}`);
  return info;
}

/**
 * Get battery color based on level
 */
export function getBatteryColor(level: number): string {
  if (level >= 60) return '#4ADE80'; // Green
  if (level >= 30) return '#FBBF24'; // Yellow
  return '#F87171'; // Red
}

/**
 * Get battery icon name based on level
 */
export function getBatteryIcon(level: number, isCharging: boolean): string {
  if (isCharging) return 'battery-charging';
  if (level >= 80) return 'battery-full';
  if (level >= 50) return 'battery-half';
  return 'battery-dead';
}

