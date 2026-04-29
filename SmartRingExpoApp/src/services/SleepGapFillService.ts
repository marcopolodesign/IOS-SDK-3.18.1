import { SleepSegment, SleepStage } from '../components/home/SleepStagesChart';

/**
 * Ultradian sleep cycle model.
 * Early cycles: deep-heavy. Later cycles: REM-heavy.
 * Consistent with AASM sleep architecture norms.
 */
const ULTRADIAN_CYCLES: Array<Array<{ stage: SleepStage; minutes: number }>> = [
  // Cycle 1 (~80 min): first NREM period, maximal deep
  [
    { stage: 'core', minutes: 10 },
    { stage: 'deep', minutes: 45 },
    { stage: 'core', minutes: 10 },
    { stage: 'rem',  minutes: 15 },
  ],
  // Cycle 2 (~85 min): balanced
  [
    { stage: 'core', minutes: 15 },
    { stage: 'deep', minutes: 25 },
    { stage: 'core', minutes: 10 },
    { stage: 'rem',  minutes: 35 },
  ],
  // Cycle 3+ (~90 min): REM-dominant
  [
    { stage: 'core', minutes: 15 },
    { stage: 'deep', minutes: 10 },
    { stage: 'core', minutes: 10 },
    { stage: 'rem',  minutes: 55 },
  ],
];

function groupToSegments(perMinute: SleepStage[], gapStart: Date): SleepSegment[] {
  const result: SleepSegment[] = [];
  let i = 0;
  while (i < perMinute.length) {
    const stage = perMinute[i];
    let j = i;
    while (j < perMinute.length && perMinute[j] === stage) j++;
    result.push({
      stage,
      startTime: new Date(gapStart.getTime() + i * 60000),
      endTime:   new Date(gapStart.getTime() + j * 60000),
      isInferred: true,
    });
    i = j;
  }
  return result;
}

/**
 * Generate estimated sleep segments for a period with no ring data,
 * using a standard ultradian architecture model.
 * Returns empty array if gap < 10 minutes.
 */
export function fillSleepGap(gapStart: Date, gapEnd: Date): SleepSegment[] {
  const gapMinutes = Math.round((gapEnd.getTime() - gapStart.getTime()) / 60000);
  if (gapMinutes < 10) return [];

  const perMinute: SleepStage[] = [];
  let cycleIdx = 0;

  while (perMinute.length < gapMinutes) {
    const cycle = ULTRADIAN_CYCLES[Math.min(cycleIdx, ULTRADIAN_CYCLES.length - 1)];
    for (const seg of cycle) {
      for (let m = 0; m < seg.minutes && perMinute.length < gapMinutes; m++) {
        perMinute.push(seg.stage);
      }
    }
    cycleIdx++;
  }

  return groupToSegments(perMinute, gapStart);
}
