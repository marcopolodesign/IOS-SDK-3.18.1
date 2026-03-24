/**
 * Unified activity types — merges Strava, Apple Health, and ring workouts
 */

export interface UnifiedActivity {
  id: string;                       // 'strava_123' | 'hk_<uuid>' | 'ring_<timestamp>'
  source: 'strava' | 'appleHealth' | 'ring';
  sportType: string;                // normalized: 'Run', 'Ride', 'Hike', 'Swim', 'Walk', 'Yoga', etc.
  name: string;
  startDate: string;                // ISO
  endDate: string;                  // ISO
  durationSec: number;
  distanceM?: number;
  calories?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  // Strava-only enrichment
  sufferScore?: number;
  splitsJson?: any;
  zonesJson?: any;
  // Display hints
  color: string;
  icon: string;                     // Ionicons name
}

export interface HKWorkoutResult {
  uuid: string;
  activityType: number;             // WorkoutActivityType enum value
  sportType: string;                // normalized sport string
  name: string;                     // generated label e.g. "Morning Run"
  startDate: string;                // ISO
  endDate: string;                  // ISO
  durationSec: number;
  distanceM?: number;
  calories?: number;
  elevationAscended?: number;
  elevationDescended?: number;
  avgSpeed?: number;                // m/s
  maxSpeed?: number;                // m/s
  isIndoor?: boolean;
  sourceName: string;               // e.g. "Apple Watch"
}
