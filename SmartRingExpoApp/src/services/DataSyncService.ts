import { supabase, supabaseService } from './SupabaseService';
import { authService } from './AuthService';
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
    const userId = authService.currentUser?.id;
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    if (this._syncStatus.isSyncing) {
      return { success: false, error: 'Sync already in progress' };
    }

    this._syncStatus = { ...this._syncStatus, isSyncing: true, error: null };
    this.notifyListeners();

    try {
      const smartRingService = UnifiedSmartRingService;

      // Create a sync record
      const battery = await smartRingService.getBattery();
      const version = await smartRingService.getVersion();
      
      const syncId = await supabaseService.createRingSync(
        userId,
        'unknown', // device mac - would come from actual device
        battery?.battery,
        version?.version
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

      // Update daily summary
      await this.updateDailySummary(userId, new Date());

      this._syncStatus = {
        lastSyncAt: new Date(),
        isSyncing: false,
        error: null,
      };
      this.notifyListeners();

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
    }
  }

  private async syncStepsData(
    userId: string,
    service: typeof UnifiedSmartRingService
  ) {
    try {
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
    }
  }

  private async syncSleepData(
    userId: string,
    service: typeof UnifiedSmartRingService
  ) {
    try {
      const sleepData = await service.getSleepData();

      if (sleepData && (sleepData.deep > 0 || sleepData.light > 0)) {
        // Use actual start/end times if available from SDK
        const endTime = sleepData.endTime
          ? new Date(sleepData.endTime)
          : new Date(); // fallback to now

        const totalMinutes = sleepData.deep + sleepData.light + (sleepData.rem || 0) + (sleepData.awake || 0);
        const startTime = sleepData.startTime
          ? new Date(sleepData.startTime)
          : new Date(endTime.getTime() - totalMinutes * 60 * 1000);

        // Parse segment details from SDK
        // The SDK provides segments in the "detail" field as JSON string
        let detailJson = null;
        if (sleepData.detail) {
          try {
            detailJson = JSON.parse(sleepData.detail);
            // Expected format: array of segments with { type, startTime, endTime, duration }
            // type: 0=None, 1=Awake, 2=Light, 3=Deep, 4=REM, 5=Unweared
            console.log('[Sync] Sleep detail parsed:', detailJson);
          } catch (e) {
            console.error('[Sync] Failed to parse sleep detail:', e);
          }
        }

        await supabaseService.insertSleepSession({
          user_id: userId,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          deep_min: sleepData.deep,
          light_min: sleepData.light,
          rem_min: sleepData.rem || null,
          awake_min: sleepData.awake || null,
          sleep_score: null,
          detail_json: detailJson, // Segment-by-segment breakdown
        });
      }
    } catch (e) {
      console.error('Error syncing sleep data:', e);
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
        supabaseService.getSleepSessions(userId, startOfDay, endOfDay),
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

      // Sleep data
      const latestSleep = sleep[0];
      const sleepTotalMin = latestSleep
        ? (latestSleep.deep_min || 0) + (latestSleep.light_min || 0) + (latestSleep.rem_min || 0)
        : null;

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
        updated_at: new Date().toISOString(),
      });

      return true;
    } catch (e) {
      console.error('Error updating daily summary:', e);
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


