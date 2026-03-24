-- Add device_type column to health data tables
-- Allows distinguishing data from ring vs band

ALTER TABLE hrv_readings ADD COLUMN IF NOT EXISTS device_type TEXT DEFAULT 'ring';
ALTER TABLE sleep_sessions ADD COLUMN IF NOT EXISTS device_type TEXT DEFAULT 'ring';
ALTER TABLE daily_metrics ADD COLUMN IF NOT EXISTS device_type TEXT DEFAULT 'ring';
