// Supabase Database Types
// Generated from database schema

export interface Database {
  public: {
    Tables: {
      push_tokens: {
        Row: {
          id: string;
          user_id: string;
          token: string;
          platform: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          token: string;
          platform?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          token?: string;
          platform?: string;
          updated_at?: string;
        };
      };
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
          sleep_target_min: number | null;
          sleep_baseline_tier: string | null;
          sleep_baseline_avg_score: number | null;
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
          sleep_target_min?: number | null;
          sleep_baseline_tier?: string | null;
          sleep_baseline_avg_score?: number | null;
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
          sleep_target_min?: number | null;
          sleep_baseline_tier?: string | null;
          sleep_baseline_avg_score?: number | null;
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
          session_type: string | null;
          nap_score: number | null;
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
          session_type?: string | null;
          nap_score?: number | null;
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
          session_type?: string | null;
          nap_score?: number | null;
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
          suffer_score: number | null;
          average_cadence: number | null;
          average_speed: number | null;
          max_speed: number | null;
          pr_count: number | null;
          elev_high: number | null;
          elev_low: number | null;
          zones_json: Record<string, unknown> | null;
          splits_metric_json: unknown[] | null;
          laps_json: unknown[] | null;
          best_efforts_json: unknown[] | null;
          detail_fetched_at: string | null;
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
          suffer_score?: number | null;
          average_cadence?: number | null;
          average_speed?: number | null;
          max_speed?: number | null;
          pr_count?: number | null;
          elev_high?: number | null;
          elev_low?: number | null;
          zones_json?: Record<string, unknown> | null;
          splits_metric_json?: unknown[] | null;
          laps_json?: unknown[] | null;
          best_efforts_json?: unknown[] | null;
          detail_fetched_at?: string | null;
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
          suffer_score?: number | null;
          average_cadence?: number | null;
          average_speed?: number | null;
          max_speed?: number | null;
          pr_count?: number | null;
          elev_high?: number | null;
          elev_low?: number | null;
          zones_json?: Record<string, unknown> | null;
          splits_metric_json?: unknown[] | null;
          laps_json?: unknown[] | null;
          best_efforts_json?: unknown[] | null;
          detail_fetched_at?: string | null;
          created_at?: string;
        };
      };
      caffeinated_drinks: {
        Row: {
          id: string;
          user_id: string;
          drink_type: string;
          name: string | null;
          caffeine_mg: number;
          consumed_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          drink_type: string;
          name?: string | null;
          caffeine_mg: number;
          consumed_at: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          drink_type?: string;
          name?: string | null;
          caffeine_mg?: number;
          consumed_at?: string;
          created_at?: string;
        };
      };
      blood_pressure_readings: {
        Row: {
          id: string;
          user_id: string;
          systolic: number;
          diastolic: number;
          heart_rate: number | null;
          recorded_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          systolic: number;
          diastolic: number;
          heart_rate?: number | null;
          recorded_at: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          systolic?: number;
          diastolic?: number;
          heart_rate?: number | null;
          recorded_at?: string;
          created_at?: string;
        };
      };
      sport_records: {
        Row: {
          id: string;
          user_id: string;
          sport_type: string;
          start_time: string;
          end_time: string;
          duration_minutes: number | null;
          distance_m: number | null;
          calories: number | null;
          avg_heart_rate: number | null;
          max_heart_rate: number | null;
          raw_data: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          sport_type: string;
          start_time: string;
          end_time: string;
          duration_minutes?: number | null;
          distance_m?: number | null;
          calories?: number | null;
          avg_heart_rate?: number | null;
          max_heart_rate?: number | null;
          raw_data?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          sport_type?: string;
          start_time?: string;
          end_time?: string;
          duration_minutes?: number | null;
          distance_m?: number | null;
          calories?: number | null;
          avg_heart_rate?: number | null;
          max_heart_rate?: number | null;
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
          nap_total_min: number | null;
          hr_avg: number | null;
          hr_min: number | null;
          hr_max: number | null;
          spo2_avg: number | null;
          hrv_avg: number | null;
          stress_avg: number | null;
          bp_systolic_avg: number | null;
          bp_diastolic_avg: number | null;
          sport_records_count: number;
          strava_activities_count: number;
          spo2_min: number | null;
          sleep_awake_min: number | null;
          hr_nocturnal_avg: number | null;
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
          nap_total_min?: number | null;
          hr_avg?: number | null;
          hr_min?: number | null;
          hr_max?: number | null;
          spo2_avg?: number | null;
          hrv_avg?: number | null;
          stress_avg?: number | null;
          bp_systolic_avg?: number | null;
          bp_diastolic_avg?: number | null;
          sport_records_count?: number;
          strava_activities_count?: number;
          spo2_min?: number | null;
          sleep_awake_min?: number | null;
          hr_nocturnal_avg?: number | null;
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
          nap_total_min?: number | null;
          hr_avg?: number | null;
          hr_min?: number | null;
          hr_max?: number | null;
          spo2_avg?: number | null;
          hrv_avg?: number | null;
          stress_avg?: number | null;
          bp_systolic_avg?: number | null;
          bp_diastolic_avg?: number | null;
          sport_records_count?: number;
          strava_activities_count?: number;
          spo2_min?: number | null;
          sleep_awake_min?: number | null;
          hr_nocturnal_avg?: number | null;
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
      illness_scores: {
        Row: {
          id: string;
          user_id: string;
          score_date: string;
          score: number;
          status: string;
          nocturnal_hr: number | null;
          spo2_min_val: number | null;
          hrv_sdnn: number | null;
          temperature_avg: number | null;
          sleep_awake_min: number | null;
          baseline_nocturnal_hr: number | null;
          baseline_hrv_sdnn: number | null;
          baseline_spo2_min: number | null;
          baseline_temperature: number | null;
          baseline_sleep_awake: number | null;
          sub_nocturnal_hr: number;
          sub_hrv: number;
          sub_spo2: number;
          sub_temperature: number;
          sub_sleep: number;
          baseline_days: number;
          stale: boolean;
          notified: boolean;
          prev_status: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          score_date: string;
          score?: number;
          status?: string;
          nocturnal_hr?: number | null;
          spo2_min_val?: number | null;
          hrv_sdnn?: number | null;
          temperature_avg?: number | null;
          sleep_awake_min?: number | null;
          baseline_nocturnal_hr?: number | null;
          baseline_hrv_sdnn?: number | null;
          baseline_spo2_min?: number | null;
          baseline_temperature?: number | null;
          baseline_sleep_awake?: number | null;
          sub_nocturnal_hr?: number;
          sub_hrv?: number;
          sub_spo2?: number;
          sub_temperature?: number;
          sub_sleep?: number;
          baseline_days?: number;
          stale?: boolean;
          notified?: boolean;
          prev_status?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          score_date?: string;
          score?: number;
          status?: string;
          nocturnal_hr?: number | null;
          spo2_min_val?: number | null;
          hrv_sdnn?: number | null;
          temperature_avg?: number | null;
          sleep_awake_min?: number | null;
          baseline_nocturnal_hr?: number | null;
          baseline_hrv_sdnn?: number | null;
          baseline_spo2_min?: number | null;
          baseline_temperature?: number | null;
          baseline_sleep_awake?: number | null;
          sub_nocturnal_hr?: number;
          sub_hrv?: number;
          sub_spo2?: number;
          sub_temperature?: number;
          sub_sleep?: number;
          baseline_days?: number;
          stale?: boolean;
          notified?: boolean;
          prev_status?: string | null;
          created_at?: string;
        };
      };
      user_baselines: {
        Row: {
          user_id: string;
          nocturnal_hr: number[];
          hrv_sdnn: number[];
          spo2_min: number[];
          temperature: number[];
          sleep_awake: number[];
          days_logged: number;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          nocturnal_hr?: number[];
          hrv_sdnn?: number[];
          spo2_min?: number[];
          temperature?: number[];
          sleep_awake?: number[];
          days_logged?: number;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          nocturnal_hr?: number[];
          hrv_sdnn?: number[];
          spo2_min?: number[];
          temperature?: number[];
          sleep_awake?: number[];
          days_logged?: number;
          updated_at?: string;
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
export type CaffeinatedDrink = Database['public']['Tables']['caffeinated_drinks']['Row'];
export type CaffeinatedDrinkInsert = Database['public']['Tables']['caffeinated_drinks']['Insert'];
export type BloodPressureReading = Database['public']['Tables']['blood_pressure_readings']['Row'];
export type SportRecord = Database['public']['Tables']['sport_records']['Row'];
export type StravaActivity = Database['public']['Tables']['strava_activities']['Row'];
export type DailySummary = Database['public']['Tables']['daily_summaries']['Row'];
export type WeeklySummary = Database['public']['Tables']['weekly_summaries']['Row'];
export type MonthlySummary = Database['public']['Tables']['monthly_summaries']['Row'];
export type IllnessScore = Database['public']['Tables']['illness_scores']['Row'];
export type UserBaseline = Database['public']['Tables']['user_baselines']['Row'];



