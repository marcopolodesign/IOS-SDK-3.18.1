-- ============================================================
-- Readiness Score — Persisted per-day, server-side computation
-- Fixes: recovery-detail.tsx showing wrong scores for past days
-- because restingHR was never persisted to sleep_sessions and
-- computeReadiness() was computed on-the-fly with missing data.
-- ============================================================

-- 1. Add resting_hr column to sleep_sessions (populated as a
--    side-effect of the readiness rollup).
ALTER TABLE sleep_sessions
  ADD COLUMN IF NOT EXISTS resting_hr INT;

-- 2. Add readiness columns to daily_summaries.
ALTER TABLE daily_summaries
  ADD COLUMN IF NOT EXISTS readiness_score        INT,
  ADD COLUMN IF NOT EXISTS readiness_sleep_score  INT,
  ADD COLUMN IF NOT EXISTS readiness_hr_score     INT,
  ADD COLUMN IF NOT EXISTS readiness_strain_score INT,
  ADD COLUMN IF NOT EXISTS readiness_resting_hr   INT,
  ADD COLUMN IF NOT EXISTS readiness_computed_at  TIMESTAMPTZ;

-- 3. Compute readiness for one user on one date.
--    Formula mirrors recovery-detail.tsx computeReadiness():
--      score = sleepScore*0.50 + restingHRScore*0.30 + strainScore*0.20
--    where:
--      restingHRScore = CLAMP((90 - restingHR) / 50 * 100, 0, 100)
--                       defaults to 50 when no HR data
--      strainScore    = CLAMP(100 - steps/10000*100, 0, 100)
CREATE OR REPLACE FUNCTION compute_daily_readiness(p_user UUID, p_date DATE)
RETURNS VOID AS $$
DECLARE
  v_sleep_score   INT;
  v_resting_hr    INT;
  v_steps         INT;
  v_sleep_comp    INT;
  v_hr_comp       INT;
  v_strain_comp   INT;
  v_readiness     INT;
  tz              TEXT := 'America/Argentina/Buenos_Aires';
  day_start       TIMESTAMPTZ;
  day_end         TIMESTAMPTZ;
  overnight_end   TIMESTAMPTZ;
BEGIN
  day_start     := (p_date::TEXT || ' 00:00:00 ' || tz)::TIMESTAMPTZ;
  day_end       := (p_date::TEXT || ' 23:59:59 ' || tz)::TIMESTAMPTZ;
  overnight_end := (p_date::TEXT || ' 08:00:00 ' || tz)::TIMESTAMPTZ;

  -- Sleep score: most recent night session ending on p_date
  SELECT sleep_score
    INTO v_sleep_score
    FROM sleep_sessions
   WHERE user_id     = p_user
     AND session_type = 'night'
     AND end_time    >= day_start
     AND end_time    <= day_end
   ORDER BY end_time DESC
   LIMIT 1;

  -- Resting HR: minimum HR from overnight window (midnight–8am, local time)
  SELECT MIN(heart_rate)
    INTO v_resting_hr
    FROM heart_rate_readings
   WHERE user_id    = p_user
     AND recorded_at >= day_start
     AND recorded_at <  overnight_end
     AND heart_rate  > 0;

  -- If no overnight HR, try the full-day minimum as fallback
  IF v_resting_hr IS NULL THEN
    SELECT MIN(heart_rate)
      INTO v_resting_hr
      FROM heart_rate_readings
     WHERE user_id    = p_user
       AND recorded_at >= day_start
       AND recorded_at <= day_end
       AND heart_rate  > 0;
  END IF;

  -- Steps: from daily_summaries for the same date
  SELECT total_steps
    INTO v_steps
    FROM daily_summaries
   WHERE user_id = p_user
     AND date    = p_date;

  -- Skip entirely if there is nothing to score
  IF COALESCE(v_sleep_score, 0) = 0 AND v_resting_hr IS NULL THEN
    RETURN;
  END IF;

  -- Component scores
  v_sleep_comp  := COALESCE(v_sleep_score, 0);

  v_hr_comp := CASE
    WHEN v_resting_hr IS NOT NULL AND v_resting_hr > 0
      THEN GREATEST(0, LEAST(100, ROUND(((90.0 - v_resting_hr) / 50.0) * 100)::INT))
    ELSE 50
  END;

  v_strain_comp := GREATEST(
    0,
    LEAST(100,
      (100 - ROUND((COALESCE(v_steps, 0)::FLOAT / 10000.0) * 100))::INT
    )
  );

  v_readiness := GREATEST(0, LEAST(100, ROUND(
    v_sleep_comp  * 0.50 +
    v_hr_comp     * 0.30 +
    v_strain_comp * 0.20
  )::INT));

  -- Upsert into daily_summaries
  INSERT INTO daily_summaries (
    user_id, date,
    readiness_score, readiness_sleep_score, readiness_hr_score,
    readiness_strain_score, readiness_resting_hr, readiness_computed_at
  )
  VALUES (
    p_user, p_date,
    v_readiness, v_sleep_comp, v_hr_comp,
    v_strain_comp, v_resting_hr, NOW()
  )
  ON CONFLICT (user_id, date) DO UPDATE SET
    readiness_score        = EXCLUDED.readiness_score,
    readiness_sleep_score  = EXCLUDED.readiness_sleep_score,
    readiness_hr_score     = EXCLUDED.readiness_hr_score,
    readiness_strain_score = EXCLUDED.readiness_strain_score,
    readiness_resting_hr   = EXCLUDED.readiness_resting_hr,
    readiness_computed_at  = EXCLUDED.readiness_computed_at;

  -- Back-fill resting_hr on the sleep session if not already set
  IF v_resting_hr IS NOT NULL THEN
    UPDATE sleep_sessions
       SET resting_hr = v_resting_hr
     WHERE user_id     = p_user
       AND session_type = 'night'
       AND end_time    >= day_start
       AND end_time    <= day_end
       AND resting_hr  IS NULL;
  END IF;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[compute_daily_readiness] user=% date=% failed: %', p_user, p_date, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Schedule pg_cron: 3:15 AM UTC daily (12:15 AM Buenos Aires)
--    Runs for the current date AND the previous 2 days to catch late ring syncs.
SELECT cron.schedule(
  'daily-readiness-rollup',
  '15 3 * * *',
  $$
  SELECT compute_daily_readiness(user_id::UUID, d::DATE)
  FROM (SELECT DISTINCT user_id FROM daily_summaries) u
  CROSS JOIN generate_series(
    CURRENT_DATE - INTERVAL '2 days',
    CURRENT_DATE,
    '1 day'::INTERVAL
  ) AS d;
  $$
);
