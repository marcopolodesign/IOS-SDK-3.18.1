-- Upgrade whatsapp-checkin from 1× to 3× daily.
-- Also seeds whatsapp_app_link for tappable deeplink in WhatsApp messages.

-- 1. Remove old single cron job
SELECT cron.unschedule('daily-whatsapp-checkin');

-- 2. Drop old trigger (no type param)
DROP FUNCTION IF EXISTS trigger_whatsapp_checkin();

-- 3. New parameterized trigger (matches daily-summary-push pattern)
CREATE OR REPLACE FUNCTION trigger_whatsapp_checkin(msg_type TEXT DEFAULT 'morning')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  edge_url     TEXT;
  notif_secret TEXT;
BEGIN
  SELECT value INTO edge_url     FROM app_config WHERE key = 'edge_function_url';
  SELECT value INTO notif_secret FROM app_config WHERE key = 'notification_secret';

  IF edge_url IS NULL OR notif_secret IS NULL THEN
    RAISE WARNING '[whatsapp_checkin] Missing edge_function_url or notification_secret in app_config';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := edge_url || '/whatsapp-checkin',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || notif_secret,
      'Content-Type',  'application/json'
    ),
    body    := jsonb_build_object('type', msg_type)
  );
END;
$$;

-- 4. Schedule 3 daily cron jobs (times in UTC → ART is UTC-3)
--    Morning:  12:03 UTC = 9:03 AM ART  — sleep recap + coaching
--    Evening:  23:03 UTC = 8:03 PM ART  — activity recap
--    Night:    01:33 UTC = 10:33 PM ART — wind-down / bedtime nudge
SELECT cron.schedule('whatsapp-morning',  '3 12 * * *', $$SELECT trigger_whatsapp_checkin('morning')$$);
SELECT cron.schedule('whatsapp-evening',  '3 23 * * *', $$SELECT trigger_whatsapp_checkin('evening')$$);
SELECT cron.schedule('whatsapp-night',    '33 1 * * *', $$SELECT trigger_whatsapp_checkin('night')$$);

-- 5. Seed app link (TestFlight for now — swap to App Store URL when published)
INSERT INTO app_config (key, value)
VALUES ('whatsapp_app_link', 'https://apps.apple.com/app/com.focusring.app')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
