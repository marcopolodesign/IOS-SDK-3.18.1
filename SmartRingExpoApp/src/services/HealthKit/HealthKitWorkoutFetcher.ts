/**
 * HealthKitWorkoutFetcher — fetch workouts from Apple Health
 * Uses @kingstinct/react-native-healthkit v13 API
 */

import { queryWorkoutSamples } from '@kingstinct/react-native-healthkit';
import type { HKWorkoutResult } from '../../types/activity.types';

// HealthKit WorkoutActivityType → normalized sport string
const ACTIVITY_TYPE_MAP: Record<number, string> = {
  37: 'Run',
  13: 'Ride',
  24: 'Hike',
  46: 'Swim',
  52: 'Walk',
  57: 'Yoga',
  66: 'Pilates',
  16: 'Elliptical',
  35: 'Rowing',
  9: 'Climbing',
  50: 'WeightTraining',
  20: 'WeightTraining',
  63: 'HIIT',
  11: 'CrossTraining',
  59: 'CoreTraining',
  14: 'Dance',
  44: 'StairClimbing',
  8: 'Boxing',
  65: 'Kickboxing',
  28: 'MartialArts',
  82: 'Triathlon',
  40: 'SnowSports',
  67: 'Snowboarding',
  60: 'CrossCountrySkiing',
  61: 'DownhillSkiing',
  41: 'Soccer',
  48: 'Tennis',
  79: 'Pickleball',
  6: 'Basketball',
  73: 'MixedCardio',
};

// Time-of-day label for unnamed workouts
function generateWorkoutName(sportType: string, startDate: Date): string {
  const hour = startDate.getHours();
  let timeOfDay: string;
  if (hour < 6) timeOfDay = 'Early';
  else if (hour < 12) timeOfDay = 'Morning';
  else if (hour < 17) timeOfDay = 'Afternoon';
  else if (hour < 21) timeOfDay = 'Evening';
  else timeOfDay = 'Night';
  return `${timeOfDay} ${sportType}`;
}

class HealthKitWorkoutFetcher {
  async fetchWorkouts(from: Date, to: Date): Promise<HKWorkoutResult[]> {
    try {
      const samples = await queryWorkoutSamples({
        limit: 50,
        ascending: false,
        filter: {
          date: { startDate: from, endDate: to },
        },
      });

      if (!Array.isArray(samples) || !samples.length) return [];

      return samples.map((s: any) => {
        const startDate = new Date(s.startDate);
        const endDate = new Date(s.endDate);
        const sportType = ACTIVITY_TYPE_MAP[s.workoutActivityType] || 'Workout';

        return {
          uuid: s.uuid,
          activityType: s.workoutActivityType,
          sportType,
          name: generateWorkoutName(sportType, startDate),
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          durationSec: s.duration?.value ?? Math.round((endDate.getTime() - startDate.getTime()) / 1000),
          distanceM: s.totalDistance?.value,
          calories: s.totalEnergyBurned?.value ? Math.round(s.totalEnergyBurned.value) : undefined,
          elevationAscended: s.metadataElevationAscended?.value,
          elevationDescended: s.metadataElevationDescended?.value,
          avgSpeed: s.metadataAverageSpeed?.value,
          maxSpeed: s.metadataMaximumSpeed?.value,
          isIndoor: s.metadataIndoorWorkout,
          sourceName: s.sourceRevision?.source?.name || s.device?.name || 'Apple Health',
        };
      });
    } catch (error) {
      return [];
    }
  }

  async fetchTodayWorkouts(): Promise<HKWorkoutResult[]> {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return this.fetchWorkouts(startOfDay, now);
  }

  async fetchWeekWorkouts(): Promise<HKWorkoutResult[]> {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return this.fetchWorkouts(sevenDaysAgo, now);
  }
}

export default HealthKitWorkoutFetcher;
