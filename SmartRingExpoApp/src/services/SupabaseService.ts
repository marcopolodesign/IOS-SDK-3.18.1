import 'react-native-url-polyfill/auto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { Database } from '../types/supabase.types';

// Initialize Supabase client
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54331';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

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
      return null;
    }
    return data;
  }

  // ============================================
  // HEART RATE OPERATIONS
  // ============================================

  async insertHeartRateReadings(readings: Omit<HeartRateReading, 'id' | 'created_at'>[]): Promise<boolean> {
    const { error } = await supabase
      .from('heart_rate_readings')
      .insert(readings);
    
    if (error) {
      console.error('Error inserting heart rate readings:', error);
      return false;
    }
    return true;
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
      .insert(readings);
    
    if (error) {
      console.error('Error inserting steps readings:', error);
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
      .insert(session);
    
    if (error) {
      console.error('Error inserting sleep session:', error);
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
    const { error } = await supabase.from('spo2_readings').insert(readings);
    if (error) {
      console.error('Error inserting SpO2 readings:', error);
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
    const { error } = await supabase.from('hrv_readings').insert(readings);
    if (error) {
      console.error('Error inserting HRV readings:', error);
      return false;
    }
    return true;
  }

  async insertStressReadings(
    readings: { user_id: string; stress_level: number; recorded_at: string }[]
  ): Promise<boolean> {
    const { error } = await supabase.from('stress_readings').insert(readings);
    if (error) {
      console.error('Error inserting stress readings:', error);
      return false;
    }
    return true;
  }

  async insertTemperatureReadings(
    readings: { user_id: string; temperature_c: number; recorded_at: string }[]
  ): Promise<boolean> {
    const { error } = await supabase.from('temperature_readings').insert(readings);
    if (error) {
      console.error('Error inserting temperature readings:', error);
      return false;
    }
    return true;
  }
}

export const supabaseService = new SupabaseService();
export default supabaseService;

