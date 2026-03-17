-- Add detail columns to strava_activities
-- Populated after fetching /activities/{id} and /activities/{id}/zones
ALTER TABLE strava_activities
  ADD COLUMN IF NOT EXISTS suffer_score INTEGER,
  ADD COLUMN IF NOT EXISTS average_cadence REAL,
  ADD COLUMN IF NOT EXISTS average_speed REAL,
  ADD COLUMN IF NOT EXISTS max_speed REAL,
  ADD COLUMN IF NOT EXISTS pr_count INTEGER,
  ADD COLUMN IF NOT EXISTS elev_high REAL,
  ADD COLUMN IF NOT EXISTS elev_low REAL,
  ADD COLUMN IF NOT EXISTS zones_json JSONB,
  ADD COLUMN IF NOT EXISTS splits_metric_json JSONB,
  ADD COLUMN IF NOT EXISTS laps_json JSONB,
  ADD COLUMN IF NOT EXISTS best_efforts_json JSONB,
  ADD COLUMN IF NOT EXISTS detail_fetched_at TIMESTAMPTZ;
