-- Add baseline_completed_at to user_profiles
-- Tracks when the user completed their initial baseline period (~3 days of data collection)
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS baseline_completed_at timestamptz DEFAULT NULL;
