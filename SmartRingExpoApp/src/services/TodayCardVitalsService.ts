import AsyncStorage from '@react-native-async-storage/async-storage';
import UnifiedSmartRingService from './UnifiedSmartRingService';
import { reportError } from '../utils/sentry';

export type TodayCardHydrationReason =
  | 'initial'
  | 'reconnect'
  | 'foreground'
  | 'tab-focus'
  | 'manual';

export type CardDataStatus = 'idle' | 'retrying' | 'partial' | 'ready';

export interface TodayVitals {
  temperatureC: number | null;
  minSpo2: number | null;
  lastSpo2: number | null;
  updatedAt: number | null;
}

export interface TodayCardVitalsHydrationResult {
  vitals: TodayVitals;
  status: CardDataStatus;
  missing: Array<keyof Pick<TodayVitals, 'temperatureC' | 'minSpo2' | 'lastSpo2'>>;
  shouldScheduleDelayedRetry: boolean;
}

interface HydrationOptions {
  reason: TodayCardHydrationReason;
  currentVitals?: TodayVitals | null;
  cachedVitals?: TodayVitals | null;
}

const STORAGE_KEY = 'today_card_vitals_v1';
const RETRY_DELAYS_MS = [0, 1200, 2500];

export function getCardDataStatusFromVitals(vitals: TodayVitals): CardDataStatus {
  const missing = getMissingVitalKeys(vitals);
  if (missing.length === 0) return 'ready';
  if (missing.length < 3) return 'partial';
  return 'idle';
}

export function getMissingVitalKeys(
  vitals: TodayVitals
): Array<keyof Pick<TodayVitals, 'temperatureC' | 'minSpo2' | 'lastSpo2'>> {
  const missing: Array<keyof Pick<TodayVitals, 'temperatureC' | 'minSpo2' | 'lastSpo2'>> = [];
  if (vitals.temperatureC === null) missing.push('temperatureC');
  if (vitals.minSpo2 === null) missing.push('minSpo2');
  if (vitals.lastSpo2 === null) missing.push('lastSpo2');
  return missing;
}

function emptyVitals(): TodayVitals {
  return {
    temperatureC: null,
    minSpo2: null,
    lastSpo2: null,
    updatedAt: null,
  };
}

function isValidTemperature(value: number): boolean {
  return Number.isFinite(value) && value >= 34 && value <= 42;
}

function isValidSpo2(value: number): boolean {
  return Number.isFinite(value) && value >= 70 && value <= 100;
}

function toNullableNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

class TodayCardVitalsService {
  private inFlightHydration: Promise<TodayCardVitalsHydrationResult> | null = null;

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private mergeVitals(primary?: TodayVitals | null, secondary?: TodayVitals | null): TodayVitals {
    const first = primary || emptyVitals();
    const second = secondary || emptyVitals();
    return {
      temperatureC: first.temperatureC ?? second.temperatureC,
      minSpo2: first.minSpo2 ?? second.minSpo2,
      lastSpo2: first.lastSpo2 ?? second.lastSpo2,
      updatedAt: first.updatedAt ?? second.updatedAt,
    };
  }

  private applyFreshVitals(base: TodayVitals, fresh: Partial<TodayVitals>): TodayVitals {
    const merged: TodayVitals = {
      temperatureC: fresh.temperatureC ?? base.temperatureC,
      minSpo2: fresh.minSpo2 ?? base.minSpo2,
      lastSpo2: fresh.lastSpo2 ?? base.lastSpo2,
      updatedAt: base.updatedAt,
    };
    const changed =
      merged.temperatureC !== base.temperatureC ||
      merged.minSpo2 !== base.minSpo2 ||
      merged.lastSpo2 !== base.lastSpo2;
    if (changed) {
      merged.updatedAt = Date.now();
    }
    return merged;
  }

  private async fetchDeviceVitals(missing: Array<'temperatureC' | 'minSpo2' | 'lastSpo2'>): Promise<Partial<TodayVitals>> {
    const partial: Partial<TodayVitals> = {};
    const wantsTemperature = missing.includes('temperatureC');
    const wantsSpo2 = missing.includes('minSpo2') || missing.includes('lastSpo2');

    if (wantsTemperature) {
      try {
        const tempData = await UnifiedSmartRingService.getTemperatureDataNormalizedArray();
        const validTemps = tempData
          .map(item => Number(item.temperature))
          .filter(isValidTemperature);
        if (validTemps.length > 0) {
          partial.temperatureC = validTemps[validTemps.length - 1];
        }
      } catch (error) {
        console.log('[TodayCardVitalsService] temperature fetch failed:', error);
        reportError(error, { op: 'todayCard.fetchTemperature' }, 'warning');
      }
    }

    if (wantsSpo2) {
      try {
        const rawSpo2 = await UnifiedSmartRingService.getSpO2DataRaw();
        const values: number[] = [];
        for (const rec of rawSpo2.records || []) {
          const entries: any[] = Array.isArray(rec.arrayAutomaticSpo2Data) ? rec.arrayAutomaticSpo2Data : [];
          for (const entry of entries) {
            const spo2 = Number(entry.automaticSpo2Data ?? entry.spo2 ?? 0);
            if (isValidSpo2(spo2)) values.push(spo2);
          }
        }
        if (values.length > 0) {
          partial.minSpo2 = Math.min(...values);
          partial.lastSpo2 = values[values.length - 1];
        }
      } catch (error) {
        console.log('[TodayCardVitalsService] spo2 fetch failed:', error);
        reportError(error, { op: 'todayCard.fetchSpO2' }, 'warning');
      }
    }

    return partial;
  }

  private async fetchRingVitals(missing: Array<'temperatureC' | 'minSpo2' | 'lastSpo2'>): Promise<Partial<TodayVitals>> {
    return this.fetchDeviceVitals(missing);
  }

  private async fetchMissingVitals(missing: Array<'temperatureC' | 'minSpo2' | 'lastSpo2'>): Promise<Partial<TodayVitals>> {
    const sdkType = UnifiedSmartRingService.getConnectedSDKType();
    if (sdkType !== 'none') return this.fetchDeviceVitals(missing);

    try {
      const status = await UnifiedSmartRingService.isConnected();
      if (status.connected) {
        return this.fetchDeviceVitals(missing);
      }
    } catch (error) {
      console.log('[TodayCardVitalsService] connection status check failed:', error);
      reportError(error, { op: 'todayCard.connectionCheck' }, 'warning');
    }

    return {};
  }

  async loadCachedVitals(): Promise<TodayVitals | null> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      const parsedVitals: TodayVitals = {
        temperatureC: toNullableNumber(parsed?.temperatureC),
        minSpo2: toNullableNumber(parsed?.minSpo2),
        lastSpo2: toNullableNumber(parsed?.lastSpo2),
        updatedAt: toNullableNumber(parsed?.updatedAt),
      };

      if (parsedVitals.temperatureC !== null && !isValidTemperature(parsedVitals.temperatureC)) {
        parsedVitals.temperatureC = null;
      }
      if (parsedVitals.minSpo2 !== null && !isValidSpo2(parsedVitals.minSpo2)) {
        parsedVitals.minSpo2 = null;
      }
      if (parsedVitals.lastSpo2 !== null && !isValidSpo2(parsedVitals.lastSpo2)) {
        parsedVitals.lastSpo2 = null;
      }

      if (getCardDataStatusFromVitals(parsedVitals) === 'idle') {
        return null;
      }

      console.log('[TodayCardVitalsService] Loaded cached vitals');
      return parsedVitals;
    } catch (error) {
      console.log('[TodayCardVitalsService] Failed to load cached vitals:', error);
      reportError(error, { op: 'todayCard.loadCache' }, 'warning');
      return null;
    }
  }

  async saveCachedVitals(vitals: TodayVitals): Promise<void> {
    try {
      if (getCardDataStatusFromVitals(vitals) === 'idle') return;
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(vitals));
      console.log('[TodayCardVitalsService] Saved cached vitals');
    } catch (error) {
      console.log('[TodayCardVitalsService] Failed to save cached vitals:', error);
      reportError(error, { op: 'todayCard.saveCache' }, 'warning');
    }
  }

  async hydrateMissingVitals(options: HydrationOptions): Promise<TodayCardVitalsHydrationResult> {
    if (this.inFlightHydration) {
      return this.inFlightHydration;
    }

    this.inFlightHydration = (async () => {
      const mergedStart = this.mergeVitals(options.currentVitals, options.cachedVitals);
      let working = { ...mergedStart };
      console.log(
        `[TodayCardVitalsService] hydration_start reason=${options.reason} source=${options.cachedVitals ? 'cache+state' : 'state-only'}`
      );

      let isConnected = false;
      try {
        const connection = await UnifiedSmartRingService.isConnected();
        isConnected = !!connection.connected;
      } catch (error) {
        console.log('[TodayCardVitalsService] connection check failed:', error);
        reportError(error, { op: 'todayCard.hydrationCheck' }, 'warning');
      }

      if (!isConnected) {
        const missingDisconnected = getMissingVitalKeys(working);
        console.log('[TodayCardVitalsService] returning cached/state vitals (ring disconnected)');
        return {
          vitals: working,
          status: getCardDataStatusFromVitals(working),
          missing: missingDisconnected,
          shouldScheduleDelayedRetry: false,
        };
      }

      for (let index = 0; index < RETRY_DELAYS_MS.length; index++) {
        const delay = RETRY_DELAYS_MS[index];
        const missingBefore = getMissingVitalKeys(working);
        if (missingBefore.length === 0) break;

        if (delay > 0) {
          await this.sleep(delay);
        }

        console.log(
          `[TodayCardVitalsService] reason=${options.reason} attempt=${index + 1} missing_before=${missingBefore.join(',')}`
        );

        const fresh = await this.fetchMissingVitals(missingBefore);
        console.log(
          `[TodayCardVitalsService] reason=${options.reason} attempt=${index + 1} fresh_keys=${Object.keys(fresh).join(',') || 'none'}`
        );
        working = this.applyFreshVitals(working, fresh);
        const missingAfter = getMissingVitalKeys(working);

        console.log(
          `[TodayCardVitalsService] reason=${options.reason} attempt=${index + 1} missing_after=${missingAfter.join(',') || 'none'}`
        );
      }

      const status = getCardDataStatusFromVitals(working);
      const missing = getMissingVitalKeys(working);

      if (working.updatedAt !== mergedStart.updatedAt) {
        await this.saveCachedVitals(working);
        console.log('[TodayCardVitalsService] hydration completed with fresh vitals');
      } else {
        console.log('[TodayCardVitalsService] hydration completed using cache/state only');
      }

      return {
        vitals: working,
        status,
        missing,
        shouldScheduleDelayedRetry: missing.length > 0,
      };
    })();

    try {
      return await this.inFlightHydration;
    } finally {
      this.inFlightHydration = null;
    }
  }
}

export default new TodayCardVitalsService();
