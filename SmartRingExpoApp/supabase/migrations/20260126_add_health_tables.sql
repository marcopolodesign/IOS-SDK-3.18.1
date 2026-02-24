-- ============================================
-- BLOOD PRESSURE READINGS
-- ============================================
CREATE TABLE blood_pressure_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    systolic INT NOT NULL,
    diastolic INT NOT NULL,
    heart_rate INT,
    recorded_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_bp_user_date ON blood_pressure_readings(user_id, recorded_at);

-- ============================================
-- SPORT/ACTIVITY RECORDS (from ring, separate from Strava)
-- ============================================
CREATE TABLE sport_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    sport_type TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    duration_minutes INT,
    distance_m FLOAT,
    calories INT,
    avg_heart_rate INT,
    max_heart_rate INT,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_sport_user_date ON sport_records(user_id, start_time);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE blood_pressure_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sport_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own bp readings" ON blood_pressure_readings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own sport records" ON sport_records FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- UPDATE DAILY SUMMARIES TABLE
-- ============================================
ALTER TABLE daily_summaries
ADD COLUMN IF NOT EXISTS bp_systolic_avg FLOAT,
ADD COLUMN IF NOT EXISTS bp_diastolic_avg FLOAT,
ADD COLUMN IF NOT EXISTS sport_records_count INT DEFAULT 0;
