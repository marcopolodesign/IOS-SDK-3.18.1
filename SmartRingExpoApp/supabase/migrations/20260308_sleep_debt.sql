-- Add sleep target to profiles for sleep debt calculation
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sleep_target_min integer DEFAULT 480;
