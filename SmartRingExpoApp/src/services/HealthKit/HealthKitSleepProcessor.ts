/**
 * HealthKitSleepProcessor — fetch and process sleep data from Apple Health
 * Uses @kingstinct/react-native-healthkit v13 API (filter.date pattern)
 */

import { queryCategorySamples } from '@kingstinct/react-native-healthkit';
import { reportError } from '../../utils/sentry';

export interface HKSleepResult {
  totalSleep: number; // minutes
  sleepEfficiency: number; // 0-100
  deep: number; // minutes
  light: number;
  rem: number;
  awake: number;
  bedTime: string | null; // ISO
  wakeTime: string | null; // ISO
  samples: any[];
}

// Apple Health sleep stage values
const IN_BED = 0;
const ASLEEP_GENERIC = 1;
const AWAKE = 2;
const CORE = 3;
const DEEP = 4;
const REM = 5;

const ASLEEP_VALUES = new Set([ASLEEP_GENERIC, CORE, DEEP, REM]);
const SESSION_GAP_MIN = 90;

class HealthKitSleepProcessor {
  async fetchSleepData(): Promise<HKSleepResult | null> {
    try {
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);

      // Last night window: 6pm yesterday → 12pm today (local time)
      const windowStart = new Date(yesterday);
      windowStart.setHours(18, 0, 0, 0);
      const windowEnd = new Date(now);
      windowEnd.setHours(12, 0, 0, 0);

      let result = await this.querySleepWindow(windowStart, windowEnd);
      if (result) return result;

      // Fallback: 7-day range
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      result = await this.querySleepWindow(sevenDaysAgo, now);
      return result;
    } catch (error) {
      reportError(error, { op: 'healthKit.fetchLatestSleep' }, 'warning');
      return null;
    }
  }

  private async querySleepWindow(from: Date, to: Date): Promise<HKSleepResult | null> {
    try {
      const query = await queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', {
        limit: 0,
        filter: {
          date: { startDate: from, endDate: to },
        },
      });

      const allSamples = Array.isArray(query) ? query : [];
      if (!allSamples.length) return null;

      // Clip samples to the query window
      const clipped = allSamples
        .map((s: any) => ({
          ...s,
          start: new Date(Math.max(new Date(s.startDate).getTime(), from.getTime())),
          end: new Date(Math.min(new Date(s.endDate).getTime(), to.getTime())),
        }))
        .filter((s) => s.start < s.end);

      if (!clipped.length) return null;

      const bestSession = this.findBestSleepSession(clipped);
      if (!bestSession?.length) return null;

      return this.processSleepData(bestSession);
    } catch {
      return null;
    }
  }

  private findBestSleepSession(samples: any[]): any[] | null {
    const sessions = this.groupIntoSessions(samples);
    if (!sessions.length) return null;

    const today = new Date();
    const morningStart = new Date(today);
    morningStart.setHours(5, 0, 0, 0);
    const morningEnd = new Date(today);
    morningEnd.setHours(12, 0, 0, 0);

    let best: any[] | null = null;
    let bestScore = -1;

    for (const session of sessions) {
      const sessionStart = new Date(session[0].startDate);
      const sessionEnd = new Date(session[session.length - 1].endDate);
      let score = 0;

      if (sessionEnd >= morningStart && sessionEnd <= morningEnd) score += 100;
      const durationH = (sessionEnd.getTime() - sessionStart.getTime()) / 3.6e6;
      if (durationH >= 6 && durationH <= 10) score += 50;
      const h = sessionStart.getHours();
      if (h >= 18 || h <= 2) score += 30;

      if (score > bestScore) {
        bestScore = score;
        best = session;
      }
    }

    return best;
  }

  private groupIntoSessions(samples: any[]): any[][] {
    const sorted = [...samples].sort(
      (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );
    const sessions: any[][] = [];
    let current: any[] = [];

    for (const s of sorted) {
      if (!current.length) {
        current = [s];
        continue;
      }
      const gap =
        (new Date(s.startDate).getTime() - new Date(current[current.length - 1].endDate).getTime()) / 60000;
      if (gap <= SESSION_GAP_MIN) {
        current.push(s);
      } else {
        sessions.push(current);
        current = [s];
      }
    }
    if (current.length) sessions.push(current);
    return sessions;
  }

  private processSleepData(samples: any[]): HKSleepResult {
    // samples are already sorted by startDate from groupIntoSessions
    const sorted = samples;

    const hasDetailedStages = sorted.some((s) => ASLEEP_VALUES.has(s.value) && s.value !== ASLEEP_GENERIC);

    let deepMin = 0, lightMin = 0, remMin = 0, awakeMin = 0;
    let totalSleep = 0, totalInBed = 0, totalAwake = 0;

    for (const s of sorted) {
      const dur = (new Date(s.endDate).getTime() - new Date(s.startDate).getTime()) / 60000;

      if (hasDetailedStages) {
        switch (s.value) {
          case DEEP: deepMin += dur; break;
          case CORE: lightMin += dur; break;
          case REM: remMin += dur; break;
          case AWAKE: awakeMin += dur; break;
        }
      } else {
        if (s.value === IN_BED) totalInBed += dur;
        else if (s.value === AWAKE) totalAwake += dur;
      }
    }

    if (hasDetailedStages) {
      totalSleep = deepMin + lightMin + remMin;
    } else {
      totalSleep = Math.max(0, totalInBed - totalAwake);
      lightMin = totalSleep;
    }

    const bedTime = new Date(sorted[0].startDate);
    const wakeTime = new Date(sorted[sorted.length - 1].endDate);
    const totalTimeInBed = Math.max(totalInBed, (wakeTime.getTime() - bedTime.getTime()) / 60000);
    const efficiency = totalTimeInBed > 0 ? Math.round((totalSleep / totalTimeInBed) * 100) : 0;

    return {
      totalSleep: Math.round(totalSleep),
      sleepEfficiency: efficiency,
      deep: Math.round(deepMin),
      light: Math.round(lightMin),
      rem: Math.round(remMin),
      awake: Math.round(awakeMin),
      bedTime: bedTime.toISOString(),
      wakeTime: wakeTime.toISOString(),
      samples: sorted,
    };
  }
}

export default HealthKitSleepProcessor;
