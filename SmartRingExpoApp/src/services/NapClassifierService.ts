/**
 * NapClassifierService — pure functions for classifying sleep sessions
 * as 'night' or 'nap' and scoring nap quality.
 *
 * Heuristic inspired by Oura and Ultrahuman approaches.
 */

export type SessionType = 'night' | 'nap';

export interface NapClassification {
  sessionType: SessionType;
  reason: string;
}

/**
 * Classify a sleep session as night or nap.
 *
 * Algorithm:
 * 1. < 15 min total sleep → nap (too short for night)
 * 2. > 180 min (3hr) → night (too long for nap)
 * 3. Within 4hr of prior night end → nap (Oura-style proximity guard)
 * 4. Start hour 20:00–03:59 → night; otherwise → nap
 * 5. Fallback → night
 */
export function classifySleepSession(
  startTime: Date,
  endTime: Date,
  totalSleepMin: number,
  priorNightEndTime?: Date | null,
): NapClassification {
  // Step 1: very short
  if (totalSleepMin < 15) {
    return { sessionType: 'nap', reason: 'duration_under_15m' };
  }

  // Step 2: long session
  if (totalSleepMin > 180) {
    return { sessionType: 'night', reason: 'duration_over_180m' };
  }

  // Step 3: proximity to prior night
  if (priorNightEndTime) {
    const hoursSincePriorNight =
      (startTime.getTime() - priorNightEndTime.getTime()) / (1000 * 60 * 60);
    if (hoursSincePriorNight >= 0 && hoursSincePriorNight < 4) {
      return { sessionType: 'nap', reason: 'proximity_to_prior_night' };
    }
  }

  // Step 4: time-of-day
  const startHour = startTime.getHours();
  if (startHour >= 20 || startHour < 4) {
    return { sessionType: 'night', reason: 'nighttime_hours' };
  }

  // Daytime session within 15–180 min range → nap
  return { sessionType: 'nap', reason: 'daytime_hours' };
}

/**
 * Calculate a simplified nap score (0–100).
 * - Duration component (0–40): ideal nap 20–30 min, still good up to 90 min
 * - Quality component (0–30): deep + REM ratio
 * - Efficiency component (0–30): sleep time vs total time in bed
 */
export function calculateNapScore(
  totalSleepMin: number,
  deepMin: number,
  lightMin: number,
  remMin: number,
  awakeMin: number,
): number {
  // Duration score (0–40)
  let durationScore: number;
  if (totalSleepMin >= 20 && totalSleepMin <= 30) {
    durationScore = 40; // ideal power nap
  } else if (totalSleepMin >= 15 && totalSleepMin <= 90) {
    // good range
    durationScore = 30;
  } else if (totalSleepMin < 15) {
    durationScore = Math.round((totalSleepMin / 15) * 20);
  } else {
    // > 90 min — diminishing returns, risk of grogginess
    durationScore = Math.max(10, 30 - Math.round((totalSleepMin - 90) / 10) * 5);
  }

  // Quality score (0–30): proportion of deep + REM
  const actualSleep = deepMin + lightMin + remMin;
  const deepRemRatio = actualSleep > 0 ? (deepMin + remMin) / actualSleep : 0;
  const qualityScore = Math.round(deepRemRatio * 30);

  // Efficiency score (0–30): time asleep vs total time in bed
  const totalInBed = totalSleepMin + awakeMin;
  const efficiency = totalInBed > 0 ? totalSleepMin / totalInBed : 0;
  const efficiencyScore = Math.round(efficiency * 30);

  return Math.min(100, durationScore + qualityScore + efficiencyScore);
}

/**
 * Get a label for the nap score.
 */
export function getNapLabel(score: number): 'great' | 'okay' | 'poor' {
  if (score >= 70) return 'great';
  if (score >= 40) return 'okay';
  return 'poor';
}
