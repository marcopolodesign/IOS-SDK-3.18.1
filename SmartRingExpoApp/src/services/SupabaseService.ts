import 'react-native-url-polyfill/auto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { reportError } from '../utils/sentry';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { Database } from '../types/supabase.types';

// Initialize Supabase client
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://pxuemdkxdjuwxtupeqoa.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4dWVtZGt4ZGp1d3h0dXBlcW9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwMjMwNzQsImV4cCI6MjA4MjU5OTA3NH0.qwjvTCLPFLkGm1tW82UkPCXF9rnVKAf3zDxv3cFkb9w';

// Supabase initialization log disabled to reduce startup noise
// console.log('[Supabase] Initializing with URL:', supabaseUrl);

export const supabase: SupabaseClient<Database> = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Handle app state changes for token refresh (per Supabase docs)
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});

// Type aliases for convenience
type Profile = Database['public']['Tables']['profiles']['Row'];
type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];
type HeartRateReading = Database['public']['Tables']['heart_rate_readings']['Row'];
type StepsReading = Database['public']['Tables']['steps_readings']['Row'];
type SleepSession = Database['public']['Tables']['sleep_sessions']['Row'];
type DailySummary = Database['public']['Tables']['daily_summaries']['Row'];
type WeeklySummary = Database['public']['Tables']['weekly_summaries']['Row'];
type MonthlySummary = Database['public']['Tables']['monthly_summaries']['Row'];
type StravaActivity = Database['public']['Tables']['strava_activities']['Row'];

class SupabaseService {
  // ============================================
  // PROFILE OPERATIONS
  // ============================================
  
  async getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.error('Error fetching profile:', error);
      reportError(error, { method: 'getProfile', table: 'profiles' });
      return null;
    }
    return data;
  }

  async updateProfile(userId: string, updates: ProfileUpdate): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating profile:', error);
      reportError(error, { method: 'updateProfile', table: 'profiles' });
      return null;
    }
    return data;
  }

  async updateSleepBaselineTier(userId: string, tier: string, avgScore: number): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update({
        sleep_baseline_tier: tier,
        sleep_baseline_avg_score: avgScore,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      console.warn('[SupabaseService] updateSleepBaselineTier error:', error);
      reportError(error, { method: 'updateSleepBaselineTier', table: 'profiles' }, 'warning');
    }
  }

  // ============================================
  // HEART RATE OPERATIONS
  // ============================================

  async insertHeartRateReadings(readings: Omit<HeartRateReading, 'id' | 'created_at'>[]): Promise<boolean> {
    const { error } = await supabase
      .from('heart_rate_readings')
      .upsert(readings, { onConflict: 'user_id,recorded_at', ignoreDuplicates: true });

    if (error) {
      console.error('Error inserting heart rate readings:', error);
      reportError(error, { method: 'insertHeartRateReadings', table: 'heart_rate_readings' });
      return false;
    }
    return true;
  }

  async deleteHeartRateReadingsForRange(userId: string, from: Date, to: Date): Promise<void> {
    const { error } = await supabase
      .from('heart_rate_readings')
      .delete()
      .eq('user_id', userId)
      .gte('recorded_at', from.toISOString())
      .lt('recorded_at', to.toISOString());
    if (error) reportError(error, { method: 'deleteHeartRateReadingsForRange', table: 'heart_rate_readings' });
  }

  async getHeartRateReadings(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<HeartRateReading[]> {
    const { data, error } = await supabase
      .from('heart_rate_readings')
      .select('*')
      .eq('user_id', userId)
      .gte('recorded_at', startDate.toISOString())
      .lte('recorded_at', endDate.toISOString())
      .order('recorded_at', { ascending: true });
    
    if (error) {
      console.error('Error fetching heart rate readings:', error);
      reportError(error, { method: 'getHeartRateReadings', table: 'heart_rate_readings' });
      return [];
    }
    return data || [];
  }

  // ============================================
  // STEPS OPERATIONS
  // ============================================

  async insertStepsReadings(readings: Omit<StepsReading, 'id' | 'created_at'>[]): Promise<boolean> {
    const { error } = await supabase
      .from('steps_readings')
      .upsert(readings, { onConflict: 'user_id,recorded_at', ignoreDuplicates: true });

    if (error) {
      console.error('Error inserting steps readings:', error);
      reportError(error, { method: 'insertStepsReadings', table: 'steps_readings' });
      return false;
    }
    return true;
  }

  async getStepsReadings(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<StepsReading[]> {
    const { data, error } = await supabase
      .from('steps_readings')
      .select('*')
      .eq('user_id', userId)
      .gte('recorded_at', startDate.toISOString())
      .lte('recorded_at', endDate.toISOString())
      .order('recorded_at', { ascending: true });
    
    if (error) {
      console.error('Error fetching steps readings:', error);
      reportError(error, { method: 'getStepsReadings', table: 'steps_readings' });
      return [];
    }
    return data || [];
  }

  // ============================================
  // SLEEP OPERATIONS
  // ============================================

  async insertSleepSession(session: Omit<SleepSession, 'id' | 'created_at'>): Promise<boolean> {
    const { error } = await supabase
      .from('sleep_sessions')
      .upsert(session, { onConflict: 'user_id,start_time', ignoreDuplicates: false });

    if (error) {
      console.error('Error inserting sleep session:', error);
      reportError(error, { method: 'insertSleepSession', table: 'sleep_sessions' });
      return false;
    }
    return true;
  }

  async deleteSleepSession(userId: string, startTime: string): Promise<boolean> {
    const { error } = await supabase
      .from('sleep_sessions')
      .delete()
      .eq('user_id', userId)
      .eq('start_time', startTime);

    if (error) {
      console.error('Error deleting sleep session:', error);
      reportError(error, { method: 'deleteSleepSession', table: 'sleep_sessions' });
      return false;
    }
    return true;
  }

  async getSleepSessions(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<SleepSession[]> {
    const { data, error } = await supabase
      .from('sleep_sessions')
      .select('*')
      .eq('user_id', userId)
      .gte('start_time', startDate.toISOString())
      .lte('start_time', endDate.toISOString())
      .order('start_time', { ascending: false });
    
    if (error) {
      console.error('Error fetching sleep sessions:', error);
      reportError(error, { method: 'getSleepSessions', table: 'sleep_sessions' });
      return [];
    }
    return data || [];
  }

  // ============================================
  // NAP / SESSION TYPE QUERIES
  // ============================================

  async getLatestNightSessionEndTime(userId: string): Promise<Date | null> {
    const { data, error } = await supabase
      .from('sleep_sessions')
      .select('end_time')
      .eq('user_id', userId)
      .eq('session_type', 'night')
      .order('end_time', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;
    return new Date(data.end_time);
  }

  async getNapSessionsForDate(
    userId: string,
    date: Date
  ): Promise<SleepSession[]> {
    const dateStr = date.toISOString().split('T')[0];
    const startOfDay = new Date(dateStr);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const { data, error } = await supabase
      .from('sleep_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('session_type', 'nap')
      .gte('start_time', startOfDay.toISOString())
      .lte('start_time', endOfDay.toISOString())
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Error fetching nap sessions:', error);
      reportError(error, { method: 'getNapSessionsForDate', table: 'sleep_sessions' });
      return [];
    }
    return data || [];
  }

  // ============================================
  // DAILY SUMMARY OPERATIONS
  // ============================================

  async upsertDailySummary(summary: Omit<DailySummary, 'id' | 'created_at'>): Promise<boolean> {
    const { error } = await supabase
      .from('daily_summaries')
      .upsert(
        { ...summary, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,date' }
      );
    
    if (error) {
      console.error('Error upserting daily summary:', error);
      reportError(error, { method: 'upsertDailySummary', table: 'daily_summaries' });
      return false;
    }
    return true;
  }

  async getDailySummaries(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<DailySummary[]> {
    const { data, error } = await supabase
      .from('daily_summaries')
      .select('*')
      .eq('user_id', userId)
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0])
      .order('date', { ascending: false });
    
    if (error) {
      console.error('Error fetching daily summaries:', error);
      reportError(error, { method: 'getDailySummaries', table: 'daily_summaries' });
      return [];
    }
    return data || [];
  }

  async getDailySummary(userId: string, date: Date): Promise<DailySummary | null> {
    const dateStr = date.toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('daily_summaries')
      .select('*')
      .eq('user_id', userId)
      .eq('date', dateStr)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching daily summary:', error);
      reportError(error, { method: 'getDailySummary', table: 'daily_summaries' }, 'warning');
    }
    return data || null;
  }

  // ============================================
  // WEEKLY/MONTHLY SUMMARY OPERATIONS
  // ============================================

  async getWeeklySummaries(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<WeeklySummary[]> {
    const { data, error } = await supabase
      .from('weekly_summaries')
      .select('*')
      .eq('user_id', userId)
      .gte('week_start', startDate.toISOString().split('T')[0])
      .lte('week_start', endDate.toISOString().split('T')[0])
      .order('week_start', { ascending: false });
    
    if (error) {
      console.error('Error fetching weekly summaries:', error);
      reportError(error, { method: 'getWeeklySummaries', table: 'weekly_summaries' });
      return [];
    }
    return data || [];
  }

  async getMonthlySummaries(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<MonthlySummary[]> {
    const { data, error } = await supabase
      .from('monthly_summaries')
      .select('*')
      .eq('user_id', userId)
      .gte('month_start', startDate.toISOString().split('T')[0])
      .lte('month_start', endDate.toISOString().split('T')[0])
      .order('month_start', { ascending: false });
    
    if (error) {
      console.error('Error fetching monthly summaries:', error);
      reportError(error, { method: 'getMonthlySummaries', table: 'monthly_summaries' });
      return [];
    }
    return data || [];
  }

  // ============================================
  // STRAVA ACTIVITIES
  // ============================================

  async upsertStravaActivities(activities: Omit<StravaActivity, 'created_at'>[]): Promise<boolean> {
    const { error } = await supabase
      .from('strava_activities')
      .upsert(activities, { onConflict: 'id' });
    
    if (error) {
      console.error('Error upserting Strava activities:', error);
      reportError(error, { method: 'upsertStravaActivities', table: 'strava_activities' });
      return false;
    }
    return true;
  }

  async getStravaActivities(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<StravaActivity[]> {
    const { data, error } = await supabase
      .from('strava_activities')
      .select('*')
      .eq('user_id', userId)
      .gte('start_date', startDate.toISOString())
      .lte('start_date', endDate.toISOString())
      .order('start_date', { ascending: false });
    
    if (error) {
      console.error('Error fetching Strava activities:', error);
      reportError(error, { method: 'getStravaActivities', table: 'strava_activities' });
      return [];
    }
    return data || [];
  }

  // ============================================
  // RING SYNC OPERATIONS
  // ============================================

  async createRingSync(
    userId: string,
    deviceMac: string,
    batteryLevel?: number,
    firmwareVersion?: string
  ): Promise<string | null> {
    const { data, error } = await supabase
      .from('ring_syncs')
      .insert({
        user_id: userId,
        device_mac: deviceMac,
        battery_level: batteryLevel,
        firmware_version: firmwareVersion,
      })
      .select('id')
      .single();
    
    if (error) {
      console.error('Error creating ring sync:', error);
      reportError(error, { method: 'createRingSync', table: 'ring_syncs' }, 'warning');
      return null;
    }
    return data?.id || null;
  }

  // ============================================
  // BULK HEALTH DATA INSERT
  // ============================================

  async insertSpO2Readings(
    readings: { user_id: string; spo2: number; recorded_at: string }[]
  ): Promise<boolean> {
    const { error } = await supabase
      .from('spo2_readings')
      .upsert(readings, { onConflict: 'user_id,recorded_at', ignoreDuplicates: true });
    if (error) {
      console.error('Error inserting SpO2 readings:', error);
      reportError(error, { method: 'insertSpO2Readings', table: 'spo2_readings' });
      return false;
    }
    return true;
  }

  async insertHRVReadings(
    readings: {
      user_id: string;
      sdnn?: number;
      rmssd?: number;
      pnn50?: number;
      lf?: number;
      hf?: number;
      lf_hf_ratio?: number;
      recorded_at: string;
    }[]
  ): Promise<boolean> {
    const { error } = await supabase
      .from('hrv_readings')
      .upsert(readings, { onConflict: 'user_id,recorded_at', ignoreDuplicates: false });
    if (error) {
      console.error('Error inserting HRV readings:', error);
      reportError(error, { method: 'insertHRVReadings', table: 'hrv_readings' });
      return false;
    }
    return true;
  }

  async insertStressReadings(
    readings: { user_id: string; stress_level: number; recorded_at: string }[]
  ): Promise<boolean> {
    const { error } = await supabase
      .from('stress_readings')
      .upsert(readings, { onConflict: 'user_id,recorded_at', ignoreDuplicates: true });
    if (error) {
      console.error('Error inserting stress readings:', error);
      reportError(error, { method: 'insertStressReadings', table: 'stress_readings' });
      return false;
    }
    return true;
  }

  async insertTemperatureReadings(
    readings: { user_id: string; temperature_c: number; recorded_at: string }[]
  ): Promise<boolean> {
    const { error } = await supabase
      .from('temperature_readings')
      .upsert(readings, { onConflict: 'user_id,recorded_at', ignoreDuplicates: true });
    if (error) {
      console.error('Error inserting temperature readings:', error);
      reportError(error, { method: 'insertTemperatureReadings', table: 'temperature_readings' });
      return false;
    }
    return true;
  }

  // ============================================
  // BLOOD PRESSURE OPERATIONS
  // ============================================

  async insertBloodPressureReadings(
    readings: {
      user_id: string;
      systolic: number;
      diastolic: number;
      heart_rate?: number;
      recorded_at: string;
    }[]
  ): Promise<boolean> {
    const { error } = await supabase
      .from('blood_pressure_readings')
      .upsert(readings, { onConflict: 'user_id,recorded_at', ignoreDuplicates: true });
    if (error) {
      console.error('Error inserting BP readings:', error);
      reportError(error, { method: 'insertBloodPressureReadings', table: 'blood_pressure_readings' });
      return false;
    }
    return true;
  }

  async getBloodPressureReadings(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ systolic: number; diastolic: number; heart_rate: number | null; recorded_at: string }[]> {
    const { data, error } = await supabase
      .from('blood_pressure_readings')
      .select('systolic, diastolic, heart_rate, recorded_at')
      .eq('user_id', userId)
      .gte('recorded_at', startDate.toISOString())
      .lte('recorded_at', endDate.toISOString())
      .order('recorded_at', { ascending: true });
    if (error) {
      console.error('Error fetching BP readings:', error);
      reportError(error, { method: 'getBloodPressureReadings', table: 'blood_pressure_readings' });
      return [];
    }
    return data || [];
  }

  // ============================================
  // SPORT RECORDS OPERATIONS
  // ============================================

  async insertSportRecords(
    records: {
      user_id: string;
      sport_type: string;
      start_time: string;
      end_time: string;
      duration_minutes?: number;
      distance_m?: number;
      calories?: number;
      avg_heart_rate?: number;
      max_heart_rate?: number;
      raw_data?: Record<string, unknown>;
    }[]
  ): Promise<boolean> {
    const { error } = await supabase
      .from('sport_records')
      .upsert(records, { onConflict: 'user_id,start_time', ignoreDuplicates: true });
    if (error) {
      console.error('Error inserting sport records:', error);
      reportError(error, { method: 'insertSportRecords', table: 'sport_records' });
      return false;
    }
    return true;
  }

  async getSportRecords(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    sport_type: string;
    start_time: string;
    end_time: string;
    duration_minutes: number | null;
    distance_m: number | null;
    calories: number | null;
    avg_heart_rate: number | null;
    max_heart_rate: number | null;
  }[]> {
    const { data, error } = await supabase
      .from('sport_records')
      .select('sport_type, start_time, end_time, duration_minutes, distance_m, calories, avg_heart_rate, max_heart_rate')
      .eq('user_id', userId)
      .gte('start_time', startDate.toISOString())
      .lte('start_time', endDate.toISOString())
      .order('start_time', { ascending: false });
    if (error) {
      console.error('Error fetching sport records:', error);
      reportError(error, { method: 'getSportRecords', table: 'sport_records' });
      return [];
    }
    return data || [];
  }

  // ============================================
  // VITALS GETTERS (for daily summary calculation)
  // ============================================

  async getSpO2Readings(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ spo2: number; recorded_at: string }[]> {
    const { data, error } = await supabase
      .from('spo2_readings')
      .select('spo2, recorded_at')
      .eq('user_id', userId)
      .gte('recorded_at', startDate.toISOString())
      .lte('recorded_at', endDate.toISOString())
      .order('recorded_at', { ascending: true });
    if (error) {
      console.error('Error fetching SpO2 readings:', error);
      reportError(error, { method: 'getSpO2Readings', table: 'spo2_readings' });
      return [];
    }
    return data || [];
  }

  async getHRVReadings(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ sdnn: number | null; rmssd: number | null; pnn50: number | null; lf: number | null; hf: number | null; lf_hf_ratio: number | null; recorded_at: string }[]> {
    const { data, error } = await supabase
      .from('hrv_readings')
      .select('sdnn, rmssd, pnn50, lf, hf, lf_hf_ratio, recorded_at')
      .eq('user_id', userId)
      .gte('recorded_at', startDate.toISOString())
      .lte('recorded_at', endDate.toISOString())
      .order('recorded_at', { ascending: true });
    if (error) {
      console.error('Error fetching HRV readings:', error);
      reportError(error, { method: 'getHRVReadings', table: 'hrv_readings' });
      return [];
    }
    return data || [];
  }

  async getStressReadings(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ stress_level: number; recorded_at: string }[]> {
    const { data, error } = await supabase
      .from('stress_readings')
      .select('stress_level, recorded_at')
      .eq('user_id', userId)
      .gte('recorded_at', startDate.toISOString())
      .lte('recorded_at', endDate.toISOString())
      .order('recorded_at', { ascending: true });
    if (error) {
      console.error('Error fetching stress readings:', error);
      reportError(error, { method: 'getStressReadings', table: 'stress_readings' });
      return [];
    }
    return data || [];
  }

  async getTemperatureReadings(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ temperature_c: number; recorded_at: string }[]> {
    const { data, error } = await supabase
      .from('temperature_readings')
      .select('temperature_c, recorded_at')
      .eq('user_id', userId)
      .gte('recorded_at', startDate.toISOString())
      .lte('recorded_at', endDate.toISOString())
      .order('recorded_at', { ascending: true });
    if (error) {
      console.error('Error fetching temperature readings:', error);
      reportError(error, { method: 'getTemperatureReadings', table: 'temperature_readings' });
      return [];
    }
    return data || [];
  }

  // ============================================
  // CAFFEINE DRINK OPERATIONS
  // ============================================

  async insertCaffeineEntry(entry: {
    drink_type: string;
    name?: string | null;
    caffeine_mg: number;
    consumed_at: string;
  }): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('caffeinated_drinks').insert({
      user_id: user.id,
      ...entry,
    });
    if (error) {
      console.error('[Supabase] insertCaffeineEntry error:', error);
      reportError(error, { method: 'insertCaffeineEntry' });
    }
  }

  async getCaffeineEntriesForRange(
    startISO: string,
    endISO: string,
  ): Promise<Database['public']['Tables']['caffeinated_drinks']['Row'][]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data, error } = await supabase
      .from('caffeinated_drinks')
      .select('*')
      .eq('user_id', user.id)
      .gte('consumed_at', startISO)
      .lte('consumed_at', endISO)
      .order('consumed_at', { ascending: true });
    if (error) {
      console.error('[Supabase] getCaffeineEntriesForRange error:', error);
      reportError(error, { method: 'getCaffeineEntriesForRange' });
      return [];
    }
    return data ?? [];
  }

  async deleteCaffeineEntry(id: string): Promise<void> {
    const { error } = await supabase
      .from('caffeinated_drinks')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('[Supabase] deleteCaffeineEntry error:', error);
      reportError(error, { method: 'deleteCaffeineEntry' });
    }
  }

  // Fire-and-forget remote debug log — never throws, never blocks sync
  debugLog(userId: string, event: string, payload: Record<string, any>): void {
    supabase.from('debug_logs' as any).insert({ user_id: userId, event, payload }).then();
  }
}

export const supabaseService = new SupabaseService();
export default supabaseService;

