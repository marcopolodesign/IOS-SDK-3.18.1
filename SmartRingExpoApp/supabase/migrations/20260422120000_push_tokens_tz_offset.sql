-- Add timezone offset (minutes from UTC, e.g. -180 for ART) to push_tokens
-- Populated by the app on every token registration; used for local-time notification text
ALTER TABLE push_tokens
  ADD COLUMN IF NOT EXISTS tz_offset_min INTEGER;
