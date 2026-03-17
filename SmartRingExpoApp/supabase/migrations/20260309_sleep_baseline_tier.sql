-- Add sleep baseline tier columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS sleep_baseline_tier TEXT,
  ADD COLUMN IF NOT EXISTS sleep_baseline_avg_score REAL;
