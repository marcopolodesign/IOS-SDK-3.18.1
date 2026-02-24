-- ============================================
-- Add unique constraints for idempotent upserts
-- and optimized indexes for 7-day range queries
-- ============================================

-- Unique constraints (required for ON CONFLICT upserts)
ALTER TABLE heart_rate_readings
  ADD CONSTRAINT IF NOT EXISTS heart_rate_readings_user_recorded_unique
  UNIQUE (user_id, recorded_at);

ALTER TABLE steps_readings
  ADD CONSTRAINT IF NOT EXISTS steps_readings_user_recorded_unique
  UNIQUE (user_id, recorded_at);

ALTER TABLE sleep_sessions
  ADD CONSTRAINT IF NOT EXISTS sleep_sessions_user_start_unique
  UNIQUE (user_id, start_time);

ALTER TABLE spo2_readings
  ADD CONSTRAINT IF NOT EXISTS spo2_readings_user_recorded_unique
  UNIQUE (user_id, recorded_at);

ALTER TABLE hrv_readings
  ADD CONSTRAINT IF NOT EXISTS hrv_readings_user_recorded_unique
  UNIQUE (user_id, recorded_at);

ALTER TABLE temperature_readings
  ADD CONSTRAINT IF NOT EXISTS temperature_readings_user_recorded_unique
  UNIQUE (user_id, recorded_at);

ALTER TABLE stress_readings
  ADD CONSTRAINT IF NOT EXISTS stress_readings_user_recorded_unique
  UNIQUE (user_id, recorded_at);

-- Additional optimized DESC indexes for recent-data queries
CREATE INDEX IF NOT EXISTS idx_hr_user_date_desc ON heart_rate_readings(user_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_sleep_user_start_desc ON sleep_sessions(user_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_hrv_user_date_desc ON hrv_readings(user_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_spo2_user_date_desc ON spo2_readings(user_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_temp_user_date_desc ON temperature_readings(user_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_steps_user_date_desc ON steps_readings(user_id, recorded_at DESC);
