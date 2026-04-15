import { supabase, supabaseService } from './SupabaseService';
import { reportError, addBreadcrumb } from '../utils/sentry';
import UnifiedSmartRingService from './UnifiedSmartRingService';
import { stravaService } from './StravaService';
import {
  StepsData,
  SleepData,
  HeartRateData,
  SpO2Data,
  HRVData,
  StressData,
  TemperatureData,
  BatteryData,
} from '../types/sdk.types';
import { classifySleepSession, calculateNapScore } from './NapClassifierService';
import { calculateSleepScoreFromStages, extractSleepVitalsFromRaw } from '../utils/ringData/sleep';

interface SyncStatus {
  lastSyncAt: Date | null;
  isSyncing: boolean;
  error: string | null;
}

class DataSyncService {
  private _syncStatus: SyncStatus = {
    lastSyncAt: null,
    isSyncing: false,
    error: null,
  };
  private _syncInterval: NodeJS.Timeout | null = null;
  private _syncListeners: ((status: SyncStatus) => void)[] = [];

  // ============================================
  // GETTERS
  // ============================================

  get syncStatus(): SyncStatus {
    return { ...this._syncStatus };
  }

  // ============================================
  // LISTENERS
  // ============================================

  onSyncStatusChange(callback: (status: SyncStatus) => void): () => void {
    this._syncListeners.push(callback);
    return () => {
      this._syncListeners = this._syncListeners.filter(l => l !== callback);
    };
  }

  private notifyListeners() {
    this._syncListeners.forEach(listener => listener(this._syncStatus));
  }

  // ============================================
  // SYNC CONTROL
  // ============================================

  startPeriodicSync(intervalMs: number = 5 * 60 * 1000) {
    if (this._syncInterval) {
      this.stopPeriodicSync();
    }

    // Initial sync
    this.syncAllData();

    // Set up periodic sync
    this._syncInterval = setInterval(() => {
      this.syncAllData();
    }, intervalMs);

    console.log(`Started periodic sync every ${intervalMs / 1000} seconds`);
  }

  stopPeriodicSync() {
    if (this._syncInterval) {
      clearInterval(this._syncInterval);
      this._syncInterval = null;
      console.log('Stopped periodic sync');
    }
  }

  // ============================================
  // MAIN SYNC FUNCTION
  // ============================================

  async syncAllData(): Promise<{ success: boolean; error?: string }> {
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    if (this._syncStatus.isSyncing) {
      return { success: false, error: 'Sync already in progress' };
    }

    // Skip sync if ring is not connected — avoids cascading NOT_CONNECTED errors
    // when sync is triggered immediately after a connection event that hasn't settled yet.
    const connectionStatus = await UnifiedSmartRingService.isConnected();
    if (!connectionStatus.connected) {
      console.log('[Sync] Skipping syncAllData — ring not connected');
      return { success: false, error: 'NOT_CONNECTED' };
    }

    this._syncStatus = { ...this._syncStatus, isSyncing: true, error: null };
    this.notifyListeners();

    try {
      const smartRingService = UnifiedSmartRingService;

      // Create a sync record (tolerate failures so sync continues)
      let batteryLevel: number | undefined;
      let versionStr: string | undefined;
      try {
        const battery = await smartRingService.getBattery();
        batteryLevel = battery?.battery;
      } catch (e) { console.warn('[Sync] getBattery failed:', (e as Error).message); reportError(e, { op: 'sync.getBattery' }, 'warning'); }
      try {
        const version = await smartRingService.getVersion();
        versionStr = version?.version;
      } catch (e) { console.warn('[Sync] getVersion failed:', (e as Error).message); reportError(e, { op: 'sync.getVersion' }, 'warning'); }

      const syncId = await supabaseService.createRingSync(
        userId,
        'unknown', // device mac - would come from actual device
        batteryLevel,
        versionStr
      );

      // Sync all data types
      await Promise.all([
        this.syncHeartRateData(userId, smartRingService, syncId),
        this.syncStepsData(userId, smartRingService),
        this.syncSleepData(userId, smartRingService), // Now includes segment detail
        this.syncVitalsData(userId, smartRingService), // includes SpO2, HRV, Stress, Temp
        this.syncBloodPressure(userId, smartRingService), // NEW
        this.syncSportRecords(userId, smartRingService), // NEW
      ]);

      // Update daily summary for today and the past 6 days so the activity detail screen
      // has real data for historical days (not just today).
      const summaryDates: Date[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        summaryDates.push(d);
      }
      await Promise.all(summaryDates.map(d => this.updateDailySummary(userId, d)));

      this._syncStatus = {
        lastSyncAt: new Date(),
        isSyncing: false,
        error: null,
      };
      this.notifyListeners();

      addBreadcrumb('sync', 'syncAllData completed');
      console.log('Data sync completed successfully');
      return { success: true };
    } catch (e) {
      const error = e as Error;
      this._syncStatus = {
        ...this._syncStatus,
        isSyncing: false,
        error: error.message,
      };
      this.notifyListeners();
      console.error('Data sync failed:', error);
      reportError(error, { op: 'syncAllData' });
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // INDIVIDUAL SYNC FUNCTIONS
  // ============================================

  private async syncHeartRateData(
    userId: string,
    service: typeof UnifiedSmartRingService,
    syncId: string | null
  ) {
    try {
      const hourlyData = await service.get24HourHeartRate();
      
      if (hourlyData && hourlyData.length > 0) {
        const now = new Date();
        const readings = hourlyData
          .map((hr, index) => {
            if (hr === 0) return null;
            const recordedAt = new Date(now);
            recordedAt.setHours(index, 0, 0, 0);
            return {
              user_id: userId,
              sync_id: syncId,
              heart_rate: hr,
              recorded_at: recordedAt.toISOString(),
              source: 'smart_ring',
            };
          })
          .filter((r): r is NonNullable<typeof r> => r !== null);

        if (readings.length > 0) {
          await supabaseService.insertHeartRateReadings(readings);
        }
      }
    } catch (e) {
      console.error('Error syncing heart rate data:', e);
      reportError(e, { op: 'syncHeartRateData' });
    }
  }

  private async syncStepsData(
    userId: string,
    service: typeof UnifiedSmartRingService
  ) {
    try {
      // Fetch all historical daily step entries from the ring (SDK stores ~7 days)
      const allDailySteps = await service.getAllDailyStepsHistory();
      const todayStr = new Date().toISOString().split('T')[0];

      // Write one reading per past day (noon timestamp to avoid overlap with today's hourly reads)
      const historicalReadings = allDailySteps
        .filter(entry => entry.dateKey !== todayStr && entry.steps > 0)
        .map(entry => ({
          user_id: userId,
          steps: entry.steps,
          distance_m: entry.distanceM,
          calories: entry.calories,
          recorded_at: `${entry.dateKey}T12:00:00.000Z`,
          period_minutes: 1440, // full day
        }));

      if (historicalReadings.length > 0) {
        await supabaseService.insertStepsReadings(historicalReadings);
        console.log(`[Sync] Wrote ${historicalReadings.length} historical daily step records`);
      }

      // Today: write hourly readings for fine-grained aggregation
      const hourlySteps = await service.get24HourSteps();
      const stepsData = await service.getSteps();

      if (hourlySteps && hourlySteps.length > 0) {
        const now = new Date();
        const readings = hourlySteps
          .map((steps, index) => {
            if (steps === 0) return null;
            const recordedAt = new Date(now);
            recordedAt.setHours(index, 0, 0, 0);
            return {
              user_id: userId,
              steps,
              distance_m: stepsData?.distance ? (stepsData.distance * steps) / stepsData.steps : null,
              calories: stepsData?.calories ? (stepsData.calories * steps) / stepsData.steps : null,
              recorded_at: recordedAt.toISOString(),
              period_minutes: 60,
            };
          })
          .filter((r): r is NonNullable<typeof r> => r !== null);

        if (readings.length > 0) {
          await supabaseService.insertStepsReadings(readings);
        }
      }
    } catch (e) {
      console.error('Error syncing steps data:', e);
      reportError(e, { op: 'syncStepsData' });
    }
  }

  private async syncSleepData(
    userId: string,
    service: typeof UnifiedSmartRingService
  ) {
    // Fetch existing sessions for overlap detection
    const since = new Date();
    since.setDate(since.getDate() - 8);
    const existingNights = await supabaseService.getSleepSessions(userId, since, new Date());
    const nightSessions = existingNights.filter(s => s.session_type === 'night');

    // Fetch ALL raw records at once (same call useHomeData uses for the hypnogram)
    let rawRecords: any[] = [];
    try {
      const rawResult = await service.getSleepDataRaw();
      rawRecords = rawResult.records || [];
    } catch (e) {
      console.error('[Sync] getSleepDataRaw failed:', e);
      reportError(e, { op: 'syncSleepData.getSleepDataRaw' });
      return;
    }
    if (rawRecords.length === 0) {
      console.log('[Sync] No raw sleep records from ring');
      return;
    }

    // Remote debug log — captures raw SDK values before any fallback processing
    supabaseService.debugLog(userId, 'sleep_raw_records', {
      count: rawRecords.length,
      records: rawRecords.map((r: any) => ({
        startTime_SleepData: r.startTime_SleepData ?? null,
        startTimestamp: r.startTimestamp ?? null,
        totalSleepTime: r.totalSleepTime ?? null,
        sleepUnitLength: r.sleepUnitLength ?? null,
        arraySleepQualityLength: (r.arraySleepQuality ?? []).length,
      })),
    });

    // V8-only: try alternative data sources to diagnose missing sleep data
    const v8Svc = service.getV8Service();
    if (v8Svc) {
      try {
        const sleepActivity = await v8Svc.getSleepWithActivityRaw();
        supabaseService.debugLog(userId, 'sleep_with_activity', {
          count: sleepActivity.length,
          records: sleepActivity.map((r: any) => ({
            startTime_SleepData: r.startTime_SleepData ?? null,
            totalSleepTime: r.totalSleepTime ?? null,
            sleepUnitLength: r.sleepUnitLength ?? null,
            arraySleepQualityLength: (r.arraySleepQuality ?? []).length,
            arrayActivityDataLength: (r.arrayActivityData ?? []).length,
          })),
        });
      } catch (e: any) {
        supabaseService.debugLog(userId, 'sleep_with_activity_error', { message: String(e?.message ?? e) });
      }

      try {
        const ppi = await v8Svc.getPPIDataRaw();
        supabaseService.debugLog(userId, 'ppi_data', {
          count: ppi.length,
          sample: ppi.slice(0, 5).map((r: any) => ({
            date: r.date ?? null,
            groupCount: r.groupCount ?? null,
            currentIndex: r.currentIndex ?? null,
            arrayPPIDataLength: (r.arrayPPIData ?? []).length,
          })),
        });
      } catch (e: any) {
        supabaseService.debugLog(userId, 'ppi_data_error', { message: String(e?.message ?? e) });
      }
    }

    // Parse "YYYY.MM.DD HH:mm:ss" string timestamps
    const parseStartStr = (str?: string): number | undefined => {
      if (!str) return undefined;
      const [d, t] = str.split(' ');
      if (!d || !t) return undefined;
      const [y, m, day] = d.split('.').map(Number);
      const [hh, mm, ss] = t.split(':').map(Number);
      if ([y, m, day, hh, mm, ss].some(n => Number.isNaN(n))) return undefined;
      return new Date(y, (m ?? 1) - 1, day, hh, mm, ss).getTime();
    };

    // Normalize records
    const normalized = rawRecords.map(r => {
      const start = r.startTimestamp || parseStartStr(r.startTime_SleepData);
      const unit = Number(r.sleepUnitLength) || 1;
      const arr: number[] = r.arraySleepQuality || [];
      const durationMin = Number(r.totalSleepTime) || arr.length * unit;
      return { start, unit, arr, durationMin };
    }).filter(r => typeof r.start === 'number' && r.start > 0);

    if (normalized.length === 0) return;

    // Merge consecutive records with ≤60 min gap into blocks (mirrors deriveFromRaw)
    const sorted = [...normalized].sort((a, b) => a.start! - b.start!);
    const MAX_GAP_MS = 60 * 60 * 1000;
    const blocks: { start: number; end: number; records: typeof normalized }[] = [];
    let curBlock: typeof blocks[0] | null = null;

    for (const rec of sorted) {
      const recStart = rec.start!;
      const recEnd = rec.start! + rec.durationMin * 60000;
      if (!curBlock) {
        curBlock = { start: recStart, end: recEnd, records: [rec] };
      } else if (recStart - curBlock.end <= MAX_GAP_MS) {
        curBlock.end = Math.max(curBlock.end, recEnd);
        curBlock.records.push(rec);
      } else {
        blocks.push(curBlock);
        curBlock = { start: recStart, end: recEnd, records: [rec] };
      }
    }
    if (curBlock) blocks.push(curBlock);

    // Build per-minute timeline and compute stage minutes for a merged block.
    // SDK encoding: 1=Deep, 2=Light, 3=REM, other=Awake (matches useHomeData mapSleepType).
    const computeStageMins = (block: typeof blocks[0]) => {
      const totalMin = Math.max(0, Math.round((block.end - block.start) / 60000));
      const timeline = new Array(totalMin).fill(0);
      for (const rec of block.records) {
        const offset = Math.round((rec.start! - block.start) / 60000);
        const unit = Math.max(1, rec.unit);
        rec.arr.forEach((val: number, idx: number) => {
          // Map SDK val → timeline value: deep=3, rem=2, light=1, awake=0
          const tv = val === 1 ? 3 : val === 3 ? 2 : val === 2 ? 1 : 0;
          for (let k = 0; k < unit; k++) {
            const pos = offset + idx * unit + k;
            if (pos >= 0 && pos < timeline.length) timeline[pos] = tv;
          }
        });
      }
      let deep = 0, rem = 0, light = 0, awake = 0;
      for (const v of timeline) {
        if (v === 3) deep++;
        else if (v === 2) rem++;
        else if (v === 1) light++;
        else awake++;
      }
      return { deep, light, rem, awake };
    };

    // Sync up to 7 days — match each block to the day it ENDS on (wake-up date)
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      try {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - dayIndex);
        const targetDateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;

        // Find all blocks that end (wake-up) on this date
        const matching = blocks.filter(b => {
          const endD = new Date(b.end);
          const endStr = `${endD.getFullYear()}-${String(endD.getMonth() + 1).padStart(2, '0')}-${String(endD.getDate()).padStart(2, '0')}`;
          return endStr === targetDateStr;
        });

        if (matching.length === 0) {
          console.log(`[Sync] Sleep day ${dayIndex} (${targetDateStr}): no blocks ending on this date`);
          continue;
        }

        // Use the longest block for this date (handles edge-case duplicates)
        const block = matching.reduce((a, b) => (b.end - b.start > a.end - a.start ? b : a), matching[0]);

        const startTime = new Date(block.start);
        const startTimeIso = startTime.toISOString();
        const endTime = new Date(block.end);

        // Duration gate — ring sometimes reports 20-25h cumulative sessions
        const durationHours = (block.end - block.start) / (1000 * 60 * 60);
        if (durationHours > 14) {
          console.log(`[Sync] Sleep day ${dayIndex}: skipping — implausible duration ${durationHours.toFixed(1)}h`);
          continue;
        }

        const { deep, light, rem, awake } = computeStageMins(block);

        if (deep === 0 && light === 0 && rem === 0) {
          console.log(`[Sync] Sleep day ${dayIndex} (${targetDateStr}): skipping — no sleep stages`);
          continue;
        }

        console.log(`[DataSync] sleep day ${dayIndex} (${targetDateStr}): deep=${deep} light=${light} rem=${rem} awake=${awake} start=${startTime.toISOString()}`);

        // Classify as night or nap
        const totalSleepMin = deep + light + rem;
        const priorNightEnd = await supabaseService.getLatestNightSessionEndTime(userId);
        const classification = classifySleepSession(startTime, endTime, totalSleepMin, priorNightEnd);

        // Extract resting HR from the raw records belonging to this sleep block.
        // Done early so it's available for both new inserts and back-fill of existing sessions.
        const blockRawRecords = rawRecords.filter((r: any) => {
          const ts = r.startTimestamp || (() => {
            const s = r.startTime_SleepData;
            if (!s) return undefined;
            const [d, t] = String(s).split(' ');
            if (!d || !t) return undefined;
            const [y, m, day] = d.split('.').map(Number);
            const [hh, mm, ss] = t.split(':').map(Number);
            if ([y, m, day, hh, mm, ss].some(n => Number.isNaN(n))) return undefined;
            return new Date(y, (m ?? 1) - 1, day, hh, mm, ss).getTime();
          })();
          return typeof ts === 'number' && ts >= block.start && ts <= block.end;
        });
        const { restingHR } = extractSleepVitalsFromRaw(blockRawRecords.length > 0 ? blockRawRecords : rawRecords);

        // Overlap guard — skip only if the existing session already has >= sleep minutes.
        // If the new block has more data (e.g. full night vs. partial mid-sleep sync), replace it.
        // Exception: always back-fill resting_hr if the existing session is missing it.
        const overlappingSession = nightSessions.find(night => {
          if (night.session_type !== classification.sessionType) return false;
          const nightStart = new Date(night.start_time).getTime();
          const nightEnd = new Date(night.end_time).getTime();
          const overlapMs = Math.min(endTime.getTime(), nightEnd) - Math.max(startTime.getTime(), nightStart);
          return overlapMs > 30 * 60 * 1000;
        });

        if (overlappingSession) {
          const existingTotalMin =
            (overlappingSession.deep_min || 0) +
            (overlappingSession.light_min || 0) +
            (overlappingSession.rem_min || 0);

          if (existingTotalMin >= totalSleepMin) {
            // Back-fill resting_hr on the existing session if it's missing
            if (restingHR > 0 && !(overlappingSession as any).resting_hr) {
              await supabase.from('sleep_sessions')
                .update({ resting_hr: restingHR })
                .eq('user_id', userId)
                .eq('start_time', overlappingSession.start_time);
              console.log(`[Sync] Sleep day ${dayIndex}: back-filled resting_hr=${restingHR} on existing session`);
            }
            console.log(`[Sync] Sleep day ${dayIndex}: skipping ${classification.sessionType} — existing has ${existingTotalMin}min >= new ${totalSleepMin}min`);
            continue;
          }

          // New data is more complete — replace the stale session
          console.log(`[Sync] Sleep day ${dayIndex}: replacing existing (${existingTotalMin}min) with new (${totalSleepMin}min)`);
          if (overlappingSession.start_time !== startTimeIso) {
            await supabaseService.deleteSleepSession(userId, overlappingSession.start_time);
          }
          // Remove from in-memory list so subsequent loop iterations don't re-match it
          const idx = nightSessions.indexOf(overlappingSession);
          if (idx !== -1) nightSessions.splice(idx, 1);
        }

        // Build rawQualityRecords for hypnogram rendering
        const rawQualityRecords = block.records.map(rec => ({
          startTimestamp: rec.start,
          sleepUnitLength: rec.unit,
          arraySleepQuality: rec.arr,
        }));
        const detailJson = rawQualityRecords.length > 0 ? { rawQualityRecords } : null;

        const napScore = classification.sessionType === 'nap'
          ? calculateNapScore(totalSleepMin, deep, light, rem, awake)
          : null;

        const sleepScore = classification.sessionType === 'night'
          ? calculateSleepScoreFromStages({ deep, light, rem: rem ?? 0, awake: awake ?? 0 })
          : null;

        const sessionPayload = {
          user_id: userId,
          start_time: startTimeIso,
          end_time: endTime.toISOString(),
          deep_min: deep,
          light_min: light,
          rem_min: rem || null,
          awake_min: awake || null,
          sleep_score: sleepScore,
          detail_json: detailJson,
          session_type: classification.sessionType,
          nap_score: napScore,
          resting_hr: restingHR > 0 ? restingHR : null,
        };
        await supabaseService.insertSleepSession(sessionPayload);
        // Track in-memory so subsequent loop iterations can detect overlap with this session
        nightSessions.push(sessionPayload as any);
        console.log(`[Sync] Sleep day ${dayIndex} (${targetDateStr}) synced: ${deep}d + ${light}l + ${rem}r = ${totalSleepMin}min`);
      } catch (e) {
        console.error(`Error syncing sleep data for day ${dayIndex}:`, e);
      }
    }
  }

  private async syncVitalsData(
    userId: string,
    service: typeof UnifiedSmartRingService
  ) {
    try {
      const now = new Date().toISOString();

      // SpO2
      const spo2Data = await service.getSpO2();
      if (spo2Data) {
        await supabaseService.insertSpO2Readings([{
          user_id: userId,
          spo2: spo2Data.spo2,
          recorded_at: now,
        }]);
      }

      // HRV
      const hrvData = await service.getHRVData();
      if (hrvData) {
        await supabaseService.insertHRVReadings([{
          user_id: userId,
          sdnn: hrvData.sdnn,
          rmssd: hrvData.rmssd,
          pnn50: hrvData.pnn50,
          lf: hrvData.lf,
          hf: hrvData.hf,
          lf_hf_ratio: hrvData.lfHfRatio,
          recorded_at: now,
        }]);
      }

      // Stress
      const stressData = await service.getStressData();
      if (stressData) {
        await supabaseService.insertStressReadings([{
          user_id: userId,
          stress_level: stressData.level,
          recorded_at: now,
        }]);
      }

      // Temperature
      const tempData = await service.getTemperature();
      if (tempData) {
        await supabaseService.insertTemperatureReadings([{
          user_id: userId,
          temperature_c: tempData.temperature,
          recorded_at: now,
        }]);
      }
    } catch (e) {
      console.error('Error syncing vitals data:', e);
      reportError(e, { op: 'syncVitalsData' });
    }
  }

  private async syncBloodPressure(
    userId: string,
    service: typeof UnifiedSmartRingService
  ) {
    try {
      const bpData = await service.getBloodPressure();
      if (bpData) {
        console.log('[Sync] BP data:', bpData);
        await supabaseService.insertBloodPressureReadings([{
          user_id: userId,
          systolic: bpData.systolic,
          diastolic: bpData.diastolic,
          heart_rate: bpData.heartRate,
          recorded_at: new Date().toISOString(),
        }]);
      }
    } catch (e) {
      console.error('Error syncing blood pressure data:', e);
      reportError(e, { op: 'syncBloodPressure' });
    }
  }

  private async syncSportRecords(
    userId: string,
    service: typeof UnifiedSmartRingService
  ) {
    try {
      const sportRecords = await service.getSportData();
      if (sportRecords && sportRecords.length > 0) {
        console.log('[Sync] Sport records:', sportRecords.length, 'records');
        const records = sportRecords.map(record => ({
          user_id: userId,
          sport_type: record.type.toString(),
          start_time: new Date(record.startTime).toISOString(),
          end_time: new Date(record.endTime).toISOString(),
          duration_minutes: Math.round(record.duration / 60),
          distance_m: record.distance,
          calories: record.calories,
          avg_heart_rate: record.heartRateAvg,
          max_heart_rate: record.heartRateMax,
          raw_data: record as any,
        }));
        await supabaseService.insertSportRecords(records);
      }
    } catch (e) {
      console.error('Error syncing sport records:', e);
      reportError(e, { op: 'syncSportRecords' });
    }
  }

  // ============================================
  // SUMMARY UPDATES
  // ============================================

  async updateDailySummary(userId: string, date: Date): Promise<boolean> {
    const dateStr = date.toISOString().split('T')[0];
    const startOfDay = new Date(dateStr);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    try {
      // Get all readings for the day
      const [
        heartRates,
        steps,
        sleep,
        stravaActivities,
        spo2Readings,
        hrvReadings,
        stressReadings,
        bpReadings,
        sportRecords,
      ] = await Promise.all([
        supabaseService.getHeartRateReadings(userId, startOfDay, endOfDay),
        supabaseService.getStepsReadings(userId, startOfDay, endOfDay),
        supabaseService.getSleepSessions(userId, new Date(startOfDay.getTime() - 12 * 60 * 60 * 1000), endOfDay),
        supabaseService.getStravaActivities(userId, startOfDay, endOfDay),
        supabaseService.getSpO2Readings(userId, startOfDay, endOfDay),
        supabaseService.getHRVReadings(userId, startOfDay, endOfDay),
        supabaseService.getStressReadings(userId, startOfDay, endOfDay),
        supabaseService.getBloodPressureReadings(userId, startOfDay, endOfDay),
        supabaseService.getSportRecords(userId, startOfDay, endOfDay),
      ]);

      // Calculate heart rate aggregates
      const hrValues = heartRates.map(r => r.heart_rate).filter(v => v > 0);
      const hrAvg = hrValues.length > 0 ? hrValues.reduce((a, b) => a + b, 0) / hrValues.length : null;
      const hrMin = hrValues.length > 0 ? Math.min(...hrValues) : null;
      const hrMax = hrValues.length > 0 ? Math.max(...hrValues) : null;

      // Calculate steps/activity aggregates
      const totalSteps = steps.reduce((sum, r) => sum + r.steps, 0);
      const totalDistance = steps.reduce((sum, r) => sum + (r.distance_m || 0), 0);
      const totalCalories = steps.reduce((sum, r) => sum + (r.calories || 0), 0);

      // Sleep data — separate night vs nap
      const nightSessions = sleep.filter(s => s.session_type !== 'nap');
      const napSessions = sleep.filter(s => s.session_type === 'nap');
      const latestSleep = nightSessions[0] || sleep[0];
      const sleepTotalMin = latestSleep
        ? (latestSleep.deep_min || 0) + (latestSleep.light_min || 0) + (latestSleep.rem_min || 0)
        : null;
      const napTotalMin = napSessions.reduce(
        (sum, s) => sum + (s.deep_min || 0) + (s.light_min || 0) + (s.rem_min || 0),
        0,
      ) || null;

      // Calculate SpO2 average
      const spo2Values = spo2Readings.map(r => r.spo2);
      const spo2Avg = spo2Values.length > 0
        ? spo2Values.reduce((a, b) => a + b, 0) / spo2Values.length
        : null;

      // Calculate HRV average (using SDNN as the primary metric)
      const sdnnValues = hrvReadings.map(r => r.sdnn).filter(v => v != null) as number[];
      const hrvAvg = sdnnValues.length > 0
        ? sdnnValues.reduce((a, b) => a + b, 0) / sdnnValues.length
        : null;

      // Calculate Stress average
      const stressValues = stressReadings.map(r => r.stress_level);
      const stressAvg = stressValues.length > 0
        ? stressValues.reduce((a, b) => a + b, 0) / stressValues.length
        : null;

      // Calculate Blood Pressure averages
      const systolicValues = bpReadings.map(r => r.systolic);
      const diastolicValues = bpReadings.map(r => r.diastolic);
      const bpSystolicAvg = systolicValues.length > 0
        ? systolicValues.reduce((a, b) => a + b, 0) / systolicValues.length
        : null;
      const bpDiastolicAvg = diastolicValues.length > 0
        ? diastolicValues.reduce((a, b) => a + b, 0) / diastolicValues.length
        : null;

      // Illness score signal columns
      const spo2Min = spo2Values.length > 0 ? Math.min(...spo2Values) : null;
      const sleepAwakeMin = latestSleep?.awake_min ?? null;
      const nocturnalReadings = (heartRates ?? []).filter(r => {
        const hour = new Date(r.recorded_at).getHours();
        return hour >= 0 && hour < 7 && r.heart_rate > 0;
      });
      const hrNocturnalAvg = nocturnalReadings.length > 0
        ? Math.round(nocturnalReadings.reduce((s, r) => s + r.heart_rate, 0) / nocturnalReadings.length)
        : null;

      await supabaseService.upsertDailySummary({
        user_id: userId,
        date: dateStr,
        total_steps: totalSteps,
        total_distance_m: totalDistance,
        total_calories: Math.round(totalCalories),
        sleep_total_min: sleepTotalMin,
        sleep_deep_min: latestSleep?.deep_min || null,
        sleep_light_min: latestSleep?.light_min || null,
        sleep_rem_min: latestSleep?.rem_min || null,
        nap_total_min: napTotalMin,
        hr_avg: hrAvg,
        hr_min: hrMin,
        hr_max: hrMax,
        spo2_avg: spo2Avg,
        hrv_avg: hrvAvg,
        stress_avg: stressAvg,
        bp_systolic_avg: bpSystolicAvg,
        bp_diastolic_avg: bpDiastolicAvg,
        sport_records_count: sportRecords.length,
        strava_activities_count: stravaActivities.length,
        spo2_min: spo2Min,
        sleep_awake_min: sleepAwakeMin,
        hr_nocturnal_avg: hrNocturnalAvg,
        updated_at: new Date().toISOString(),
      });

      return true;
    } catch (e) {
      console.error('Error updating daily summary:', e);
      reportError(e, { op: 'updateDailySummary' });
      return false;
    }
  }

  async updateWeeklySummary(userId: string, weekStart: Date): Promise<boolean> {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    try {
      const dailySummaries = await supabaseService.getDailySummaries(userId, weekStart, weekEnd);

      if (dailySummaries.length === 0) {
        return true;
      }

      const totalSteps = dailySummaries.reduce((sum, d) => sum + (d.total_steps || 0), 0);
      const totalDistance = dailySummaries.reduce((sum, d) => sum + (d.total_distance_m || 0), 0);
      const totalCalories = dailySummaries.reduce((sum, d) => sum + (d.total_calories || 0), 0);

      const sleepValues = dailySummaries.filter(d => d.sleep_total_min).map(d => d.sleep_total_min!);
      const avgSleep = sleepValues.length > 0 ? sleepValues.reduce((a, b) => a + b, 0) / sleepValues.length : null;

      const hrValues = dailySummaries.filter(d => d.hr_avg).map(d => d.hr_avg!);
      const avgHr = hrValues.length > 0 ? hrValues.reduce((a, b) => a + b, 0) / hrValues.length : null;

      const spo2Values = dailySummaries.filter(d => d.spo2_avg).map(d => d.spo2_avg!);
      const avgSpo2 = spo2Values.length > 0 ? spo2Values.reduce((a, b) => a + b, 0) / spo2Values.length : null;

      const stravaCount = dailySummaries.reduce((sum, d) => sum + (d.strava_activities_count || 0), 0);

      const { error } = await supabase
        .from('weekly_summaries')
        .upsert({
          user_id: userId,
          week_start: weekStart.toISOString().split('T')[0],
          total_steps: totalSteps,
          total_distance_m: totalDistance,
          total_calories: totalCalories,
          avg_sleep_min: avgSleep,
          avg_hr: avgHr,
          avg_spo2: avgSpo2,
          strava_activities_count: stravaCount,
        }, { onConflict: 'user_id,week_start' });

      return !error;
    } catch (e) {
      console.error('Error updating weekly summary:', e);
      reportError(e, { op: 'updateWeeklySummary' });
      return false;
    }
  }

  // ============================================
  // SYNC STRAVA
  // ============================================

  async syncStravaActivities(days: number = 30): Promise<{ success: boolean; count: number }> {
    if (!stravaService.isConnected) {
      return { success: false, count: 0 };
    }

    return await stravaService.syncActivitiesToSupabase(days);
  }
}

export const dataSyncService = new DataSyncService();
export default dataSyncService;


