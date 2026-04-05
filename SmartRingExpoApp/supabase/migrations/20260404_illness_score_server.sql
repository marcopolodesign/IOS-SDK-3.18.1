-- ============================================================
-- Illness Likelihood Score — Server-Side Computation
-- pg_cron runs compute_illness_scores() daily at 12:00 UTC
-- (9 AM Buenos Aires / ART = UTC-3)
-- ============================================================

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Helper: statistical median of a FLOAT array
CREATE OR REPLACE FUNCTION _median(arr FLOAT[]) RETURNS FLOAT AS $$
DECLARE
  sorted FLOAT[];
  n INT;
BEGIN
  SELECT array_agg(v ORDER BY v) INTO sorted
  FROM unnest(arr) AS v
  WHERE v IS NOT NULL;
  n := coalesce(array_length(sorted, 1), 0);
  IF n = 0 THEN RETURN NULL; END IF;
  IF n % 2 = 1 THEN RETURN sorted[(n + 1) / 2];
  ELSE RETURN (sorted[n / 2] + sorted[n / 2 + 1]) / 2.0;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. Helper: trim FLOAT array to last 14 elements
CREATE OR REPLACE FUNCTION _trim14(arr FLOAT[]) RETURNS FLOAT[] AS $$
DECLARE
  len INT;
BEGIN
  len := coalesce(array_length(arr, 1), 0);
  IF len <= 14 THEN RETURN arr; END IF;
  RETURN arr[len - 13 : len];
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. Add new columns to daily_summaries
--    (populated client-side for dashboard convenience; server function queries raw tables directly)
ALTER TABLE daily_summaries
  ADD COLUMN IF NOT EXISTS spo2_min        INT,
  ADD COLUMN IF NOT EXISTS sleep_awake_min INT,
  ADD COLUMN IF NOT EXISTS hr_nocturnal_avg FLOAT;

-- 5. user_baselines — one row per user, 14-day rolling arrays
CREATE TABLE IF NOT EXISTS user_baselines (
  user_id      UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  nocturnal_hr FLOAT[] NOT NULL DEFAULT '{}',
  hrv_sdnn     FLOAT[] NOT NULL DEFAULT '{}',
  spo2_min     FLOAT[] NOT NULL DEFAULT '{}',
  temperature  FLOAT[] NOT NULL DEFAULT '{}',
  sleep_awake  FLOAT[] NOT NULL DEFAULT '{}',
  days_logged  INT NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE user_baselines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own baselines"
  ON user_baselines FOR SELECT USING (auth.uid() = user_id);

-- 6. illness_scores — one row per user per day
CREATE TABLE IF NOT EXISTS illness_scores (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  score_date            DATE NOT NULL,
  score                 INT NOT NULL DEFAULT 0,      -- 0-100
  status                TEXT NOT NULL DEFAULT 'CLEAR', -- CLEAR / WATCH / SICK
  -- Signal values used for this computation
  nocturnal_hr          FLOAT,
  spo2_min_val          INT,
  hrv_sdnn              FLOAT,
  temperature_avg       FLOAT,
  sleep_awake_min       INT,
  -- 14-day baseline medians used
  baseline_nocturnal_hr FLOAT,
  baseline_hrv_sdnn     FLOAT,
  baseline_spo2_min     FLOAT,
  baseline_temperature  FLOAT,
  baseline_sleep_awake  FLOAT,
  -- Per-signal sub-scores (each 0–100 contribution before weighting)
  sub_nocturnal_hr      FLOAT NOT NULL DEFAULT 0,
  sub_hrv               FLOAT NOT NULL DEFAULT 0,
  sub_spo2              FLOAT NOT NULL DEFAULT 0,
  sub_temperature       FLOAT NOT NULL DEFAULT 0,
  sub_sleep             FLOAT NOT NULL DEFAULT 0,
  -- Metadata
  baseline_days         INT NOT NULL DEFAULT 0,
  stale                 BOOLEAN NOT NULL DEFAULT FALSE,
  notified              BOOLEAN NOT NULL DEFAULT FALSE,
  prev_status           TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, score_date)
);
ALTER TABLE illness_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own illness scores"
  ON illness_scores FOR SELECT USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_illness_scores_user_date
  ON illness_scores (user_id, score_date DESC);

-- 7. Main computation function
CREATE OR REPLACE FUNCTION compute_illness_scores() RETURNS void AS $$
DECLARE
  u                     RECORD;
  today                 DATE := CURRENT_DATE;
  cutoff_14d            TIMESTAMPTZ := NOW() - INTERVAL '14 days';
  cutoff_48h            TIMESTAMPTZ := NOW() - INTERVAL '48 hours';
  today_start           TIMESTAMPTZ;
  today_7am             TIMESTAMPTZ;
  today_end             TIMESTAMPTZ;
  -- Signal values
  v_nocturnal_hr        FLOAT;
  v_spo2_min            INT;
  v_hrv                 FLOAT;
  v_temp                FLOAT;
  v_awake               INT;
  -- Baseline arrays & medians
  bl_nocturnal_hr       FLOAT[];
  bl_hrv                FLOAT[];
  bl_spo2               FLOAT[];
  bl_temp               FLOAT[];
  bl_awake              FLOAT[];
  bl_days               INT;
  m_nocturnal_hr        FLOAT;
  m_hrv                 FLOAT;
  m_spo2                FLOAT;
  m_temp                FLOAT;
  m_awake               FLOAT;
  -- Per-signal sub-scores
  sub_hr                FLOAT;
  sub_hrv_score         FLOAT;
  sub_spo2_score        FLOAT;
  sub_temp_score        FLOAT;
  sub_sleep_score       FLOAT;
  -- Output
  total_score           INT;
  v_status              TEXT;
  is_stale              BOOLEAN;
  prev_stat             TEXT;
  last_notified_at      TIMESTAMPTZ;
  -- Config
  edge_url              TEXT;
  notif_secret          TEXT;
  dev_float             FLOAT;
  ratio_float           FLOAT;
BEGIN
  edge_url     := current_setting('app.edge_function_url', true);
  notif_secret := current_setting('app.notification_secret', true);

  -- Buenos Aires timezone boundaries for "today"
  today_start := (today::TEXT || ' 00:00:00 America/Argentina/Buenos_Aires')::TIMESTAMPTZ;
  today_7am   := (today::TEXT || ' 07:00:00 America/Argentina/Buenos_Aires')::TIMESTAMPTZ;
  today_end   := (today::TEXT || ' 23:59:59 America/Argentina/Buenos_Aires')::TIMESTAMPTZ;

  FOR u IN
    SELECT id FROM profiles WHERE baseline_completed_at IS NOT NULL
  LOOP
    BEGIN  -- per-user exception block so one failure never aborts the batch

      -- Reset sub-scores each iteration
      sub_hr := 0; sub_hrv_score := 0; sub_spo2_score := 0;
      sub_temp_score := 0; sub_sleep_score := 0;

      -- ── Staleness ────────────────────────────────────────────
      SELECT NOT EXISTS (
        SELECT 1 FROM heart_rate_readings
        WHERE user_id = u.id AND recorded_at >= cutoff_48h
      ) INTO is_stale;

      -- ── Today's signal values ─────────────────────────────────

      -- 1. Nocturnal HR: midnight–7 AM average
      SELECT ROUND(AVG(heart_rate)::NUMERIC, 1)
        INTO v_nocturnal_hr
        FROM heart_rate_readings
       WHERE user_id = u.id
         AND recorded_at >= today_start
         AND recorded_at <  today_7am
         AND heart_rate > 0;

      -- 2. SpO2 minimum for the day
      SELECT MIN(spo2)
        INTO v_spo2_min
        FROM spo2_readings
       WHERE user_id = u.id
         AND recorded_at >= today_start
         AND recorded_at <= today_end;

      -- 3. HRV SDNN average for the day
      SELECT ROUND(AVG(sdnn)::NUMERIC, 1)
        INTO v_hrv
        FROM hrv_readings
       WHERE user_id = u.id
         AND recorded_at >= today_start
         AND recorded_at <= today_end
         AND sdnn > 0;

      -- 4. Skin temperature (valid >30 °C only, filters off-wrist 0.0 artifacts)
      SELECT ROUND(AVG(temperature_c)::NUMERIC, 2)
        INTO v_temp
        FROM temperature_readings
       WHERE user_id = u.id
         AND recorded_at >= today_start
         AND recorded_at <= today_end
         AND temperature_c > 30;

      -- 5. Sleep fragmentation: awake_min from most recent night session
      SELECT awake_min
        INTO v_awake
        FROM sleep_sessions
       WHERE user_id = u.id
         AND session_type = 'night'
         AND end_time >= today_start
       ORDER BY end_time DESC
       LIMIT 1;

      -- ── 14-day baselines (grouped per day from raw readings) ──

      SELECT array_agg(day_avg ORDER BY day), COUNT(*)
        INTO bl_nocturnal_hr, bl_days
        FROM (
          SELECT DATE(recorded_at AT TIME ZONE 'America/Argentina/Buenos_Aires') AS day,
                 AVG(heart_rate) AS day_avg
            FROM heart_rate_readings
           WHERE user_id = u.id
             AND recorded_at >= cutoff_14d
             AND EXTRACT(HOUR FROM recorded_at AT TIME ZONE 'America/Argentina/Buenos_Aires') BETWEEN 0 AND 6
             AND heart_rate > 0
           GROUP BY day
        ) d;

      SELECT array_agg(day_avg ORDER BY day)
        INTO bl_hrv
        FROM (
          SELECT DATE(recorded_at AT TIME ZONE 'America/Argentina/Buenos_Aires') AS day,
                 AVG(sdnn) AS day_avg
            FROM hrv_readings
           WHERE user_id = u.id
             AND recorded_at >= cutoff_14d
             AND sdnn > 0
           GROUP BY day
        ) d;

      SELECT array_agg(day_min ORDER BY day)
        INTO bl_spo2
        FROM (
          SELECT DATE(recorded_at AT TIME ZONE 'America/Argentina/Buenos_Aires') AS day,
                 MIN(spo2) AS day_min
            FROM spo2_readings
           WHERE user_id = u.id
             AND recorded_at >= cutoff_14d
           GROUP BY day
        ) d;

      SELECT array_agg(day_avg ORDER BY day)
        INTO bl_temp
        FROM (
          SELECT DATE(recorded_at AT TIME ZONE 'America/Argentina/Buenos_Aires') AS day,
                 AVG(temperature_c) AS day_avg
            FROM temperature_readings
           WHERE user_id = u.id
             AND recorded_at >= cutoff_14d
             AND temperature_c > 30
           GROUP BY day
        ) d;

      SELECT array_agg(day_awake ORDER BY day)
        INTO bl_awake
        FROM (
          SELECT DATE(end_time AT TIME ZONE 'America/Argentina/Buenos_Aires') AS day,
                 awake_min AS day_awake
            FROM sleep_sessions
           WHERE user_id = u.id
             AND start_time >= cutoff_14d
             AND session_type = 'night'
             AND awake_min IS NOT NULL
           ORDER BY end_time DESC
        ) d;

      -- Baseline sufficiency gate: need ≥3 days of nocturnal HR data
      IF coalesce(bl_days, 0) < 3 THEN
        INSERT INTO illness_scores (user_id, score_date, score, status, stale, baseline_days)
        VALUES (u.id, today, 0, 'CLEAR', TRUE, coalesce(bl_days, 0))
        ON CONFLICT (user_id, score_date) DO UPDATE
          SET score = 0, status = 'CLEAR', stale = TRUE,
              baseline_days = coalesce(EXCLUDED.baseline_days, 0);
        CONTINUE;
      END IF;

      -- Compute medians
      m_nocturnal_hr := _median(bl_nocturnal_hr);
      m_hrv          := _median(bl_hrv);
      m_spo2         := _median(bl_spo2);
      m_temp         := _median(bl_temp);
      m_awake        := _median(bl_awake);

      -- ── Score each signal ─────────────────────────────────────

      -- Nocturnal HR deviation — weight 30 pts
      -- Thresholds: +5 bpm mild, +10 moderate, +15 severe
      IF v_nocturnal_hr IS NOT NULL AND m_nocturnal_hr IS NOT NULL THEN
        dev_float := v_nocturnal_hr - m_nocturnal_hr;
        IF    dev_float >= 15 THEN sub_hr := 30.0;
        ELSIF dev_float >= 10 THEN sub_hr := 19.8;  -- 66%
        ELSIF dev_float >=  5 THEN sub_hr :=  9.9;  -- 33%
        ELSE                        sub_hr :=  0.0;
        END IF;
      END IF;

      -- HRV SDNN suppression — weight 25 pts
      -- Thresholds: <85%, <75%, <65% of median
      IF v_hrv IS NOT NULL AND m_hrv IS NOT NULL AND m_hrv > 0 THEN
        ratio_float := v_hrv / m_hrv;
        IF    ratio_float <= 0.65 THEN sub_hrv_score := 25.0;
        ELSIF ratio_float <= 0.75 THEN sub_hrv_score := 16.5;  -- 66%
        ELSIF ratio_float <= 0.85 THEN sub_hrv_score :=  8.25; -- 33%
        ELSE                           sub_hrv_score :=  0.0;
        END IF;
      END IF;

      -- SpO2 minimum — weight 20 pts (absolute thresholds)
      -- Thresholds: <94%, <92%, <90%
      IF v_spo2_min IS NOT NULL THEN
        IF    v_spo2_min <= 90 THEN sub_spo2_score := 20.0;
        ELSIF v_spo2_min <= 92 THEN sub_spo2_score := 13.2;  -- 66%
        ELSIF v_spo2_min <= 94 THEN sub_spo2_score :=  6.6;  -- 33%
        ELSE                         sub_spo2_score :=  0.0;
        END IF;
      END IF;

      -- Skin temperature deviation — weight 15 pts
      -- Thresholds: +0.3 °C mild, +0.6 moderate, +1.0 severe
      IF v_temp IS NOT NULL AND m_temp IS NOT NULL THEN
        dev_float := v_temp - m_temp;
        IF    dev_float >= 1.0 THEN sub_temp_score := 15.0;
        ELSIF dev_float >= 0.6 THEN sub_temp_score :=  9.9;  -- 66%
        ELSIF dev_float >= 0.3 THEN sub_temp_score :=  4.95; -- 33%
        ELSE                         sub_temp_score :=  0.0;
        END IF;
      END IF;

      -- Sleep fragmentation — weight 10 pts
      -- Thresholds: >30 min awake mild, >45 moderate, >60 severe
      IF v_awake IS NOT NULL THEN
        IF    v_awake >= 60 THEN sub_sleep_score := 10.0;
        ELSIF v_awake >= 45 THEN sub_sleep_score :=  6.6;  -- 66%
        ELSIF v_awake >= 30 THEN sub_sleep_score :=  3.3;  -- 33%
        ELSE                      sub_sleep_score :=  0.0;
        END IF;
      END IF;

      total_score := LEAST(
        ROUND(sub_hr + sub_hrv_score + sub_spo2_score + sub_temp_score + sub_sleep_score)::INT,
        100
      );
      v_status := CASE
        WHEN total_score >= 60 THEN 'SICK'
        WHEN total_score >= 25 THEN 'WATCH'
        ELSE 'CLEAR'
      END;

      -- Previous day status (for trend awareness)
      SELECT status INTO prev_stat
        FROM illness_scores
       WHERE user_id = u.id AND score_date = today - 1;

      -- ── Upsert score row ──────────────────────────────────────
      INSERT INTO illness_scores (
        user_id, score_date, score, status,
        nocturnal_hr, spo2_min_val, hrv_sdnn, temperature_avg, sleep_awake_min,
        baseline_nocturnal_hr, baseline_hrv_sdnn, baseline_spo2_min,
        baseline_temperature, baseline_sleep_awake,
        sub_nocturnal_hr, sub_hrv, sub_spo2, sub_temperature, sub_sleep,
        baseline_days, stale, prev_status
      ) VALUES (
        u.id, today, total_score, v_status,
        v_nocturnal_hr, v_spo2_min, v_hrv, v_temp, v_awake,
        m_nocturnal_hr, m_hrv, m_spo2, m_temp, m_awake,
        sub_hr, sub_hrv_score, sub_spo2_score, sub_temp_score, sub_sleep_score,
        coalesce(bl_days, 0), is_stale, prev_stat
      )
      ON CONFLICT (user_id, score_date) DO UPDATE SET
        score                 = EXCLUDED.score,
        status                = EXCLUDED.status,
        nocturnal_hr          = EXCLUDED.nocturnal_hr,
        spo2_min_val          = EXCLUDED.spo2_min_val,
        hrv_sdnn              = EXCLUDED.hrv_sdnn,
        temperature_avg       = EXCLUDED.temperature_avg,
        sleep_awake_min       = EXCLUDED.sleep_awake_min,
        baseline_nocturnal_hr = EXCLUDED.baseline_nocturnal_hr,
        baseline_hrv_sdnn     = EXCLUDED.baseline_hrv_sdnn,
        baseline_spo2_min     = EXCLUDED.baseline_spo2_min,
        baseline_temperature  = EXCLUDED.baseline_temperature,
        baseline_sleep_awake  = EXCLUDED.baseline_sleep_awake,
        sub_nocturnal_hr      = EXCLUDED.sub_nocturnal_hr,
        sub_hrv               = EXCLUDED.sub_hrv,
        sub_spo2              = EXCLUDED.sub_spo2,
        sub_temperature       = EXCLUDED.sub_temperature,
        sub_sleep             = EXCLUDED.sub_sleep,
        baseline_days         = EXCLUDED.baseline_days,
        stale                 = EXCLUDED.stale,
        prev_status           = EXCLUDED.prev_status,
        notified              = FALSE,
        created_at            = NOW();

      -- ── Upsert user_baselines ─────────────────────────────────
      INSERT INTO user_baselines (
        user_id, nocturnal_hr, hrv_sdnn, spo2_min, temperature, sleep_awake,
        days_logged, updated_at
      ) VALUES (
        u.id,
        _trim14(bl_nocturnal_hr), _trim14(bl_hrv), _trim14(bl_spo2),
        _trim14(bl_temp), _trim14(bl_awake),
        coalesce(bl_days, 0), NOW()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        nocturnal_hr = EXCLUDED.nocturnal_hr,
        hrv_sdnn     = EXCLUDED.hrv_sdnn,
        spo2_min     = EXCLUDED.spo2_min,
        temperature  = EXCLUDED.temperature,
        sleep_awake  = EXCLUDED.sleep_awake,
        days_logged  = EXCLUDED.days_logged,
        updated_at   = NOW();

      -- ── Push notification via pg_net ──────────────────────────
      IF v_status IN ('WATCH', 'SICK')
         AND NOT is_stale
         AND edge_url IS NOT NULL
         AND notif_secret IS NOT NULL
      THEN
        -- 24-hour cooldown: skip if we already sent a notification today
        SELECT MAX(created_at) INTO last_notified_at
          FROM illness_scores
         WHERE user_id = u.id
           AND notified = TRUE
           AND created_at >= NOW() - INTERVAL '24 hours';

        IF last_notified_at IS NULL THEN
          PERFORM net.http_post(
            url     := edge_url || '/send-notification',
            headers := jsonb_build_object(
              'Authorization', 'Bearer ' || notif_secret,
              'Content-Type',  'application/json'
            ),
            body    := jsonb_build_object(
              'user_id', u.id::TEXT,
              'title',   CASE WHEN v_status = 'SICK'
                           THEN 'Your body may need rest'
                           ELSE 'We noticed something' END,
              'body',    CASE WHEN v_status = 'SICK'
                           THEN 'Multiple signals suggest your body is under strain. Body Stress: ' || total_score
                           ELSE 'Some signals are deviating from your baseline. Body Stress: ' || total_score END,
              'data',    jsonb_build_object('url', 'smartring:///?tab=focus')
            )
          );

          UPDATE illness_scores
             SET notified = TRUE
           WHERE user_id = u.id AND score_date = today;
        END IF;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[illness_scores] user % failed: %', u.id, SQLERRM;
    END;  -- end per-user block
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Schedule: 9 AM Buenos Aires (ART = UTC-3) = 12:00 UTC
SELECT cron.schedule(
  'daily-illness-scores',
  '0 12 * * *',
  $$SELECT compute_illness_scores()$$
);
