-- ============================================================
-- Add PEAK status to illness_scores
-- PEAK = no illness signals AND ≥2 positive biometric indicators:
--   - HRV ≥10% above 14-day baseline median
--   - Nocturnal HR ≥3 bpm below 14-day baseline median
--   - Sleep awake ≤15 min
-- ============================================================

-- 1. Update compute_illness_scores() to detect PEAK
CREATE OR REPLACE FUNCTION compute_illness_scores() RETURNS void AS $$
DECLARE
  u                     RECORD;
  today                 DATE := CURRENT_DATE;
  cutoff_14d            TIMESTAMPTZ := NOW() - INTERVAL '14 days';
  cutoff_48h            TIMESTAMPTZ := NOW() - INTERVAL '48 hours';
  today_start           TIMESTAMPTZ;
  today_7am             TIMESTAMPTZ;
  today_end             TIMESTAMPTZ;
  v_nocturnal_hr        FLOAT;
  v_spo2_min            INT;
  v_hrv                 FLOAT;
  v_temp                FLOAT;
  v_awake               INT;
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
  sub_hr                FLOAT;
  sub_hrv_score         FLOAT;
  sub_spo2_score        FLOAT;
  sub_temp_score        FLOAT;
  sub_sleep_score       FLOAT;
  total_score           INT;
  v_status              TEXT;
  is_stale              BOOLEAN;
  prev_stat             TEXT;
  last_notified_at      TIMESTAMPTZ;
  edge_url              TEXT;
  notif_secret          TEXT;
  dev_float             FLOAT;
  ratio_float           FLOAT;
  peak_signals          INT;
BEGIN
  edge_url     := current_setting('app.edge_function_url', true);
  notif_secret := current_setting('app.notification_secret', true);

  today_start := (today::TEXT || ' 00:00:00 America/Argentina/Buenos_Aires')::TIMESTAMPTZ;
  today_7am   := (today::TEXT || ' 07:00:00 America/Argentina/Buenos_Aires')::TIMESTAMPTZ;
  today_end   := (today::TEXT || ' 23:59:59 America/Argentina/Buenos_Aires')::TIMESTAMPTZ;

  FOR u IN
    SELECT id FROM profiles WHERE baseline_completed_at IS NOT NULL
  LOOP
    BEGIN

      sub_hr := 0; sub_hrv_score := 0; sub_spo2_score := 0;
      sub_temp_score := 0; sub_sleep_score := 0; peak_signals := 0;

      SELECT NOT EXISTS (
        SELECT 1 FROM heart_rate_readings
        WHERE user_id = u.id AND recorded_at >= cutoff_48h
      ) INTO is_stale;

      SELECT ROUND(AVG(heart_rate)::NUMERIC, 1)
        INTO v_nocturnal_hr
        FROM heart_rate_readings
       WHERE user_id = u.id
         AND recorded_at >= today_start
         AND recorded_at <  today_7am
         AND heart_rate > 0;

      SELECT MIN(spo2)
        INTO v_spo2_min
        FROM spo2_readings
       WHERE user_id = u.id
         AND recorded_at >= today_start
         AND recorded_at <= today_end;

      SELECT ROUND(AVG(sdnn)::NUMERIC, 1)
        INTO v_hrv
        FROM hrv_readings
       WHERE user_id = u.id
         AND recorded_at >= today_start
         AND recorded_at <= today_end
         AND sdnn > 0;

      SELECT ROUND(AVG(temperature_c)::NUMERIC, 2)
        INTO v_temp
        FROM temperature_readings
       WHERE user_id = u.id
         AND recorded_at >= today_start
         AND recorded_at <= today_end
         AND temperature_c > 30;

      SELECT awake_min
        INTO v_awake
        FROM sleep_sessions
       WHERE user_id = u.id
         AND session_type = 'night'
         AND end_time >= today_start
       ORDER BY end_time DESC
       LIMIT 1;

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

      IF coalesce(bl_days, 0) < 3 THEN
        INSERT INTO illness_scores (user_id, score_date, score, status, stale, baseline_days)
        VALUES (u.id, today, 0, 'CLEAR', TRUE, coalesce(bl_days, 0))
        ON CONFLICT (user_id, score_date) DO UPDATE
          SET score = 0, status = 'CLEAR', stale = TRUE,
              baseline_days = coalesce(EXCLUDED.baseline_days, 0);
        CONTINUE;
      END IF;

      m_nocturnal_hr := _median(bl_nocturnal_hr);
      m_hrv          := _median(bl_hrv);
      m_spo2         := _median(bl_spo2);
      m_temp         := _median(bl_temp);
      m_awake        := _median(bl_awake);

      -- ── Score illness signals ─────────────────────────────────
      IF v_nocturnal_hr IS NOT NULL AND m_nocturnal_hr IS NOT NULL THEN
        dev_float := v_nocturnal_hr - m_nocturnal_hr;
        IF    dev_float >= 15 THEN sub_hr := 30.0;
        ELSIF dev_float >= 10 THEN sub_hr := 19.8;
        ELSIF dev_float >=  5 THEN sub_hr :=  9.9;
        ELSE                        sub_hr :=  0.0;
        END IF;
      END IF;

      IF v_hrv IS NOT NULL AND m_hrv IS NOT NULL AND m_hrv > 0 THEN
        ratio_float := v_hrv / m_hrv;
        IF    ratio_float <= 0.65 THEN sub_hrv_score := 25.0;
        ELSIF ratio_float <= 0.75 THEN sub_hrv_score := 16.5;
        ELSIF ratio_float <= 0.85 THEN sub_hrv_score :=  8.25;
        ELSE                           sub_hrv_score :=  0.0;
        END IF;
      END IF;

      IF v_spo2_min IS NOT NULL THEN
        IF    v_spo2_min <= 90 THEN sub_spo2_score := 20.0;
        ELSIF v_spo2_min <= 92 THEN sub_spo2_score := 13.2;
        ELSIF v_spo2_min <= 94 THEN sub_spo2_score :=  6.6;
        ELSE                         sub_spo2_score :=  0.0;
        END IF;
      END IF;

      IF v_temp IS NOT NULL AND m_temp IS NOT NULL THEN
        dev_float := v_temp - m_temp;
        IF    dev_float >= 1.0 THEN sub_temp_score := 15.0;
        ELSIF dev_float >= 0.6 THEN sub_temp_score :=  9.9;
        ELSIF dev_float >= 0.3 THEN sub_temp_score :=  4.95;
        ELSE                         sub_temp_score :=  0.0;
        END IF;
      END IF;

      IF v_awake IS NOT NULL THEN
        IF    v_awake >= 60 THEN sub_sleep_score := 10.0;
        ELSIF v_awake >= 45 THEN sub_sleep_score :=  6.6;
        ELSIF v_awake >= 30 THEN sub_sleep_score :=  3.3;
        ELSE                      sub_sleep_score :=  0.0;
        END IF;
      END IF;

      total_score := LEAST(
        ROUND(sub_hr + sub_hrv_score + sub_spo2_score + sub_temp_score + sub_sleep_score)::INT,
        100
      );

      -- ── PEAK detection: no illness + ≥2 positive indicators ──
      IF total_score = 0 THEN
        IF v_hrv IS NOT NULL AND m_hrv IS NOT NULL AND m_hrv > 0
           AND v_hrv >= m_hrv * 1.10 THEN
          peak_signals := peak_signals + 1;
        END IF;
        IF v_nocturnal_hr IS NOT NULL AND m_nocturnal_hr IS NOT NULL
           AND v_nocturnal_hr <= m_nocturnal_hr - 3 THEN
          peak_signals := peak_signals + 1;
        END IF;
        IF v_awake IS NOT NULL AND v_awake <= 15 THEN
          peak_signals := peak_signals + 1;
        END IF;
      END IF;

      v_status := CASE
        WHEN total_score >= 60 THEN 'SICK'
        WHEN total_score >= 25 THEN 'WATCH'
        WHEN total_score = 0 AND peak_signals >= 2 THEN 'PEAK'
        ELSE 'CLEAR'
      END;

      SELECT status INTO prev_stat
        FROM illness_scores
       WHERE user_id = u.id AND score_date = today - 1;

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

      -- Only notify for WATCH/SICK (PEAK is positive, no alert needed)
      IF v_status IN ('WATCH', 'SICK')
         AND NOT is_stale
         AND edge_url IS NOT NULL
         AND notif_secret IS NOT NULL
      THEN
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
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
