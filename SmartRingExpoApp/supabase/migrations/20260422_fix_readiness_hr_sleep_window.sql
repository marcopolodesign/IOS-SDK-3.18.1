-- Fix compute_daily_readiness: use sleep session's actual start/end times
-- to find overnight HR readings instead of a fixed midnight–8am window.
-- This is more accurate because:
--   1. The user might sleep from 11pm to 7am (outside midnight window)
--   2. Ring HR readings can be stored with timestamps slightly off from the
--      expected date bucket, but still within the actual sleep window
--
-- Priority: sleep-session window → midnight–8am → full-day min (unchanged fallback)

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
  v_sleep_start   TIMESTAMPTZ;
  v_sleep_end     TIMESTAMPTZ;
  tz              TEXT := 'America/Argentina/Buenos_Aires';
  day_start       TIMESTAMPTZ;
  day_end         TIMESTAMPTZ;
  overnight_end   TIMESTAMPTZ;
BEGIN
  day_start     := (p_date::TEXT || ' 00:00:00 ' || tz)::TIMESTAMPTZ;
  day_end       := (p_date::TEXT || ' 23:59:59 ' || tz)::TIMESTAMPTZ;
  overnight_end := (p_date::TEXT || ' 08:00:00 ' || tz)::TIMESTAMPTZ;

  -- Sleep score + session window: most recent night session ending on p_date
  SELECT sleep_score, start_time, end_time
    INTO v_sleep_score, v_sleep_start, v_sleep_end
    FROM sleep_sessions
   WHERE user_id      = p_user
     AND session_type = 'night'
     AND end_time    >= day_start
     AND end_time    <= day_end
   ORDER BY end_time DESC
   LIMIT 1;

  -- Priority 1: minimum HR during the actual sleep session window.
  -- This correctly anchors to when the user was asleep and is immune to
  -- the fixed midnight window missing early-night or late-morning readings.
  IF v_sleep_start IS NOT NULL AND v_sleep_end IS NOT NULL THEN
    SELECT MIN(heart_rate)
      INTO v_resting_hr
      FROM heart_rate_readings
     WHERE user_id     = p_user
       AND recorded_at >= v_sleep_start
       AND recorded_at <= v_sleep_end
       AND heart_rate   > 0;
  END IF;

  -- Priority 2: midnight–8am window (catches rings that don't store per-session HR)
  IF v_resting_hr IS NULL THEN
    SELECT MIN(heart_rate)
      INTO v_resting_hr
      FROM heart_rate_readings
     WHERE user_id     = p_user
       AND recorded_at >= day_start
       AND recorded_at <  overnight_end
       AND heart_rate   > 0;
  END IF;

  -- Priority 3: full-day minimum as last resort
  IF v_resting_hr IS NULL THEN
    SELECT MIN(heart_rate)
      INTO v_resting_hr
      FROM heart_rate_readings
     WHERE user_id     = p_user
       AND recorded_at >= day_start
       AND recorded_at <= day_end
       AND heart_rate   > 0;
  END IF;

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

  -- Steps: from daily_summaries for the same date
  SELECT total_steps
    INTO v_steps
    FROM daily_summaries
   WHERE user_id = p_user
     AND date    = p_date;

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
     WHERE user_id      = p_user
       AND session_type = 'night'
       AND end_time    >= day_start
       AND end_time    <= day_end
       AND resting_hr  IS NULL;
  END IF;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[compute_daily_readiness] user=% date=% failed: %', p_user, p_date, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Immediately backfill past 30 days with the improved function
SELECT compute_daily_readiness(user_id::UUID, d::DATE)
FROM (SELECT DISTINCT user_id FROM daily_summaries) u
CROSS JOIN generate_series(
  CURRENT_DATE - INTERVAL '30 days',
  CURRENT_DATE - INTERVAL '1 day',
  '1 day'::INTERVAL
) AS d;
