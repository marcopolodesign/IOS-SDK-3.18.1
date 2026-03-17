-- Add session_type and nap_score to sleep_sessions
ALTER TABLE sleep_sessions ADD COLUMN IF NOT EXISTS session_type TEXT;
ALTER TABLE sleep_sessions ADD COLUMN IF NOT EXISTS nap_score INTEGER;

-- Add nap_total_min to daily_summaries
ALTER TABLE daily_summaries ADD COLUMN IF NOT EXISTS nap_total_min INTEGER;

-- Index for querying by session type
CREATE INDEX IF NOT EXISTS idx_sleep_sessions_user_type_start
  ON sleep_sessions (user_id, session_type, start_time);

-- Backfill existing sessions: daytime (06:00–19:59) and <= 180 min → 'nap', else 'night'
UPDATE sleep_sessions
SET session_type = CASE
  WHEN (COALESCE(deep_min, 0) + COALESCE(light_min, 0) + COALESCE(rem_min, 0)) <= 180
    AND EXTRACT(HOUR FROM start_time::timestamp) BETWEEN 6 AND 19
  THEN 'nap'
  ELSE 'night'
END
WHERE session_type IS NULL;
