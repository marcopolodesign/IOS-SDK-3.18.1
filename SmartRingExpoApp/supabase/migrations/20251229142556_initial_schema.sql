-- ============================================
-- PROFILES: Extends Supabase auth.users
-- ============================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE,
    display_name TEXT,
    avatar_url TEXT,
    height_cm INT,
    weight_kg FLOAT,
    birth_date DATE,
    gender TEXT CHECK (gender IN ('male', 'female', 'other')),
    strava_athlete_id BIGINT,
    ring_mac_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email)
    VALUES (NEW.id, NEW.email);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- STRAVA TOKENS: OAuth tokens per user
-- ============================================
CREATE TABLE strava_tokens (
    user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    athlete_id BIGINT,
    scope TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RING SYNCS: Track periodic data syncs
-- ============================================
CREATE TABLE ring_syncs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    device_mac TEXT,
    battery_level INT,
    firmware_version TEXT
);

-- Heart rate readings (granular, timestamped)
CREATE TABLE heart_rate_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    sync_id UUID REFERENCES ring_syncs(id) ON DELETE SET NULL,
    heart_rate INT NOT NULL,
    rri INT,
    recorded_at TIMESTAMPTZ NOT NULL,
    source TEXT DEFAULT 'smart_ring',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_hr_user_date ON heart_rate_readings(user_id, recorded_at);

-- Steps readings (hourly granularity)
CREATE TABLE steps_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    steps INT NOT NULL,
    distance_m FLOAT,
    calories FLOAT,
    recorded_at TIMESTAMPTZ NOT NULL,
    period_minutes INT DEFAULT 60,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_steps_user_date ON steps_readings(user_id, recorded_at);

-- Sleep sessions
CREATE TABLE sleep_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    deep_min INT,
    light_min INT,
    rem_min INT,
    awake_min INT,
    sleep_score INT,
    detail_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_sleep_user_date ON sleep_sessions(user_id, start_time);

-- SpO2 readings
CREATE TABLE spo2_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    spo2 INT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_spo2_user_date ON spo2_readings(user_id, recorded_at);

-- HRV readings
CREATE TABLE hrv_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    sdnn FLOAT,
    rmssd FLOAT,
    pnn50 FLOAT,
    lf FLOAT,
    hf FLOAT,
    lf_hf_ratio FLOAT,
    recorded_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_hrv_user_date ON hrv_readings(user_id, recorded_at);

-- Stress readings
CREATE TABLE stress_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    stress_level INT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_stress_user_date ON stress_readings(user_id, recorded_at);

-- Temperature readings
CREATE TABLE temperature_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    temperature_c FLOAT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_temp_user_date ON temperature_readings(user_id, recorded_at);

-- ============================================
-- STRAVA ACTIVITIES
-- ============================================
CREATE TABLE strava_activities (
    id BIGINT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT,
    sport_type TEXT,
    distance_m FLOAT,
    moving_time_sec INT,
    elapsed_time_sec INT,
    total_elevation_gain_m FLOAT,
    start_date TIMESTAMPTZ,
    average_heartrate FLOAT,
    max_heartrate FLOAT,
    calories FLOAT,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_strava_user_date ON strava_activities(user_id, start_date);

-- ============================================
-- DAILY SUMMARIES (for quick date-range queries)
-- ============================================
CREATE TABLE daily_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_steps INT DEFAULT 0,
    total_distance_m FLOAT DEFAULT 0,
    total_calories INT DEFAULT 0,
    sleep_total_min INT,
    sleep_deep_min INT,
    sleep_light_min INT,
    sleep_rem_min INT,
    hr_avg FLOAT,
    hr_min INT,
    hr_max INT,
    spo2_avg FLOAT,
    hrv_avg FLOAT,
    stress_avg FLOAT,
    strava_activities_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);
CREATE INDEX idx_daily_user_date ON daily_summaries(user_id, date);

-- ============================================
-- WEEKLY/MONTHLY SUMMARIES (for trends)
-- ============================================
CREATE TABLE weekly_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    total_steps INT,
    total_distance_m FLOAT,
    total_calories INT,
    avg_sleep_min FLOAT,
    avg_hr FLOAT,
    avg_spo2 FLOAT,
    strava_activities_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, week_start)
);
CREATE INDEX idx_weekly_user_date ON weekly_summaries(user_id, week_start);

CREATE TABLE monthly_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    month_start DATE NOT NULL,
    total_steps INT,
    total_distance_m FLOAT,
    total_calories INT,
    avg_sleep_min FLOAT,
    avg_hr FLOAT,
    avg_spo2 FLOAT,
    strava_activities_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, month_start)
);
CREATE INDEX idx_monthly_user_date ON monthly_summaries(user_id, month_start);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE strava_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE ring_syncs ENABLE ROW LEVEL SECURITY;
ALTER TABLE heart_rate_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE steps_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sleep_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE spo2_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE hrv_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE stress_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE temperature_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE strava_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_summaries ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users manage own strava tokens" ON strava_tokens FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own ring syncs" ON ring_syncs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own hr readings" ON heart_rate_readings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own steps readings" ON steps_readings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own sleep sessions" ON sleep_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own spo2 readings" ON spo2_readings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own hrv readings" ON hrv_readings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own stress readings" ON stress_readings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own temp readings" ON temperature_readings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own strava activities" ON strava_activities FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own daily summaries" ON daily_summaries FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own weekly summaries" ON weekly_summaries FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own monthly summaries" ON monthly_summaries FOR ALL USING (auth.uid() = user_id);



