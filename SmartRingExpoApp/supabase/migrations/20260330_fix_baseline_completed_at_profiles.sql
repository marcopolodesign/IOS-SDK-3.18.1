-- Fix: baseline_completed_at was mistakenly added to non-existent user_profiles table.
-- The actual table is `profiles`. Add column there.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS baseline_completed_at timestamptz DEFAULT NULL;
