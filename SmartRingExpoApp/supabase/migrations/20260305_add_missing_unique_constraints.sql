-- blood_pressure_readings: dedup by user + time
CREATE UNIQUE INDEX IF NOT EXISTS bp_readings_user_recorded_unique
  ON blood_pressure_readings(user_id, recorded_at);

-- sport_records: dedup by user + start time
CREATE UNIQUE INDEX IF NOT EXISTS sport_records_user_start_unique
  ON sport_records(user_id, start_time);
