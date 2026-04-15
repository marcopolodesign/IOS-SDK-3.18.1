-- Daily WhatsApp check-in: seed recipient + PL/pgSQL trigger + pg_cron schedule.
-- Fires at 12:03 UTC (9:03 AM ART) — 3 min after the morning push to avoid contention.
-- edge_function_url and notification_secret already in app_config from migration 20260416.

INSERT INTO app_config (key, value)
VALUES ('whatsapp_recipient', 'whatsapp:+5491169742032')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

CREATE OR REPLACE FUNCTION trigger_whatsapp_checkin()
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
    body    := '{}'::jsonb
  );
END;
$$;

SELECT cron.schedule(
  'daily-whatsapp-checkin',
  '3 12 * * *',
  $$SELECT trigger_whatsapp_checkin()$$
);
