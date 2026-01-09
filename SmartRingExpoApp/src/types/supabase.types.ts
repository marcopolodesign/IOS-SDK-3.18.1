// Supabase Database Types
// Generated from database schema

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          display_name: string | null;
          avatar_url: string | null;
          height_cm: number | null;
          weight_kg: number | null;
          birth_date: string | null;
          gender: 'male' | 'female' | 'other' | null;
          strava_athlete_id: number | null;
          ring_mac_address: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          height_cm?: number | null;
          weight_kg?: number | null;
          birth_date?: string | null;
          gender?: 'male' | 'female' | 'other' | null;
          strava_athlete_id?: number | null;
          ring_mac_address?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          height_cm?: number | null;
          weight_kg?: number | null;
          birth_date?: string | null;
          gender?: 'male' | 'female' | 'other' | null;
          strava_athlete_id?: number | null;
          ring_mac_address?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      strava_tokens: {
        Row: {
          user_id: string;
          access_token: string;
          refresh_token: string;
          expires_at: string;
          athlete_id: number | null;
          scope: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          access_token: string;
          refresh_token: string;
          expires_at: string;
          athlete_id?: number | null;
          scope?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          access_token?: string;
          refresh_token?: string;
          expires_at?: string;
          athlete_id?: number | null;
          scope?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      ring_syncs: {
        Row: {
          id: string;
          user_id: string;
          synced_at: string;
          device_mac: string | null;
          battery_level: number | null;
          firmware_version: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          synced_at?: string;
          device_mac?: string | null;
          battery_level?: number | null;
          firmware_version?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          synced_at?: string;
          device_mac?: string | null;
          battery_level?: number | null;
          firmware_version?: string | null;
        };
      };
      heart_rate_readings: {
        Row: {
          id: string;
          user_id: string;
          sync_id: string | null;
          heart_rate: number;
          rri: number | null;
          recorded_at: string;
          source: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          sync_id?: string | null;
          heart_rate: number;
          rri?: number | null;
          recorded_at: string;
          source?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          sync_id?: string | null;
          heart_rate?: number;
          rri?: number | null;
          recorded_at?: string;
          source?: string;
          created_at?: string;
        };
      };
      steps_readings: {
        Row: {
          id: string;
          user_id: string;
          steps: number;
          distance_m: number | null;
          calories: number | null;
          recorded_at: string;
          period_minutes: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          steps: number;
          distance_m?: number | null;
          calories?: number | null;
          recorded_at: string;
          period_minutes?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          steps?: number;
          distance_m?: number | null;
          calories?: number | null;
          recorded_at?: string;
          period_minutes?: number;
          created_at?: string;
        };
      };
      sleep_sessions: {
        Row: {
          id: string;
          user_id: string;
          start_time: string;
          end_time: string;
          deep_min: number | null;
          light_min: number | null;
          rem_min: number | null;
          awake_min: number | null;
          sleep_score: number | null;
          detail_json: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          start_time: string;
          end_time: string;
          deep_min?: number | null;
          light_min?: number | null;
          rem_min?: number | null;
          awake_min?: number | null;
          sleep_score?: number | null;
          detail_json?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          start_time?: string;
          end_time?: string;
          deep_min?: number | null;
          light_min?: number | null;
          rem_min?: number | null;
          awake_min?: number | null;
          sleep_score?: number | null;
          detail_json?: Record<string, unknown> | null;
          created_at?: string;
        };
      };
      spo2_readings: {
        Row: {
          id: string;
          user_id: string;
          spo2: number;
          recorded_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          spo2: number;
          recorded_at: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          spo2?: number;
          recorded_at?: string;
          created_at?: string;
        };
      };
      hrv_readings: {
        Row: {
          id: string;
          user_id: string;
          sdnn: number | null;
          rmssd: number | null;
          pnn50: number | null;
          lf: number | null;
          hf: number | null;
          lf_hf_ratio: number | null;
          recorded_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          sdnn?: number | null;
          rmssd?: number | null;
          pnn50?: number | null;
          lf?: number | null;
          hf?: number | null;
          lf_hf_ratio?: number | null;
          recorded_at: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          sdnn?: number | null;
          rmssd?: number | null;
          pnn50?: number | null;
          lf?: number | null;
          hf?: number | null;
          lf_hf_ratio?: number | null;
          recorded_at?: string;
          created_at?: string;
        };
      };
      stress_readings: {
        Row: {
          id: string;
          user_id: string;
          stress_level: number;
          recorded_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          stress_level: number;
          recorded_at: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          stress_level?: number;
          recorded_at?: string;
          created_at?: string;
        };
      };
      temperature_readings: {
        Row: {
          id: string;
          user_id: string;
          temperature_c: number;
          recorded_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          temperature_c: number;
          recorded_at: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          temperature_c?: number;
          recorded_at?: string;
          created_at?: string;
        };
      };
      strava_activities: {
        Row: {
          id: number;
          user_id: string;
          name: string | null;
          sport_type: string | null;
          distance_m: number | null;
          moving_time_sec: number | null;
          elapsed_time_sec: number | null;
          total_elevation_gain_m: number | null;
          start_date: string | null;
          average_heartrate: number | null;
          max_heartrate: number | null;
          calories: number | null;
          raw_data: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id: number;
          user_id: string;
          name?: string | null;
          sport_type?: string | null;
          distance_m?: number | null;
          moving_time_sec?: number | null;
          elapsed_time_sec?: number | null;
          total_elevation_gain_m?: number | null;
          start_date?: string | null;
          average_heartrate?: number | null;
          max_heartrate?: number | null;
          calories?: number | null;
          raw_data?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          name?: string | null;
          sport_type?: string | null;
          distance_m?: number | null;
          moving_time_sec?: number | null;
          elapsed_time_sec?: number | null;
          total_elevation_gain_m?: number | null;
          start_date?: string | null;
          average_heartrate?: number | null;
          max_heartrate?: number | null;
          calories?: number | null;
          raw_data?: Record<string, unknown> | null;
          created_at?: string;
        };
      };
      daily_summaries: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          total_steps: number;
          total_distance_m: number;
          total_calories: number;
          sleep_total_min: number | null;
          sleep_deep_min: number | null;
          sleep_light_min: number | null;
          sleep_rem_min: number | null;
          hr_avg: number | null;
          hr_min: number | null;
          hr_max: number | null;
          spo2_avg: number | null;
          hrv_avg: number | null;
          stress_avg: number | null;
          strava_activities_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          total_steps?: number;
          total_distance_m?: number;
          total_calories?: number;
          sleep_total_min?: number | null;
          sleep_deep_min?: number | null;
          sleep_light_min?: number | null;
          sleep_rem_min?: number | null;
          hr_avg?: number | null;
          hr_min?: number | null;
          hr_max?: number | null;
          spo2_avg?: number | null;
          hrv_avg?: number | null;
          stress_avg?: number | null;
          strava_activities_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          date?: string;
          total_steps?: number;
          total_distance_m?: number;
          total_calories?: number;
          sleep_total_min?: number | null;
          sleep_deep_min?: number | null;
          sleep_light_min?: number | null;
          sleep_rem_min?: number | null;
          hr_avg?: number | null;
          hr_min?: number | null;
          hr_max?: number | null;
          spo2_avg?: number | null;
          hrv_avg?: number | null;
          stress_avg?: number | null;
          strava_activities_count?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      weekly_summaries: {
        Row: {
          id: string;
          user_id: string;
          week_start: string;
          total_steps: number | null;
          total_distance_m: number | null;
          total_calories: number | null;
          avg_sleep_min: number | null;
          avg_hr: number | null;
          avg_spo2: number | null;
          strava_activities_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          week_start: string;
          total_steps?: number | null;
          total_distance_m?: number | null;
          total_calories?: number | null;
          avg_sleep_min?: number | null;
          avg_hr?: number | null;
          avg_spo2?: number | null;
          strava_activities_count?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          week_start?: string;
          total_steps?: number | null;
          total_distance_m?: number | null;
          total_calories?: number | null;
          avg_sleep_min?: number | null;
          avg_hr?: number | null;
          avg_spo2?: number | null;
          strava_activities_count?: number;
          created_at?: string;
        };
      };
      monthly_summaries: {
        Row: {
          id: string;
          user_id: string;
          month_start: string;
          total_steps: number | null;
          total_distance_m: number | null;
          total_calories: number | null;
          avg_sleep_min: number | null;
          avg_hr: number | null;
          avg_spo2: number | null;
          strava_activities_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          month_start: string;
          total_steps?: number | null;
          total_distance_m?: number | null;
          total_calories?: number | null;
          avg_sleep_min?: number | null;
          avg_hr?: number | null;
          avg_spo2?: number | null;
          strava_activities_count?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          month_start?: string;
          total_steps?: number | null;
          total_distance_m?: number | null;
          total_calories?: number | null;
          avg_sleep_min?: number | null;
          avg_hr?: number | null;
          avg_spo2?: number | null;
          strava_activities_count?: number;
          created_at?: string;
        };
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}

// Convenience type exports
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type StravaToken = Database['public']['Tables']['strava_tokens']['Row'];
export type RingSync = Database['public']['Tables']['ring_syncs']['Row'];
export type HeartRateReading = Database['public']['Tables']['heart_rate_readings']['Row'];
export type StepsReading = Database['public']['Tables']['steps_readings']['Row'];
export type SleepSession = Database['public']['Tables']['sleep_sessions']['Row'];
export type SpO2Reading = Database['public']['Tables']['spo2_readings']['Row'];
export type HRVReading = Database['public']['Tables']['hrv_readings']['Row'];
export type StressReading = Database['public']['Tables']['stress_readings']['Row'];
export type TemperatureReading = Database['public']['Tables']['temperature_readings']['Row'];
export type StravaActivity = Database['public']['Tables']['strava_activities']['Row'];
export type DailySummary = Database['public']['Tables']['daily_summaries']['Row'];
export type WeeklySummary = Database['public']['Tables']['weekly_summaries']['Row'];
export type MonthlySummary = Database['public']['Tables']['monthly_summaries']['Row'];



