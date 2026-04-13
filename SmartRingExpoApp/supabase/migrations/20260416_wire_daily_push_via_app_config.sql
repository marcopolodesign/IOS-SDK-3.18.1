-- Wire daily-summary-push cron to use app_config for settings,
-- avoiding ALTER DATABASE (requires superuser, blocked in migrations).
-- Seeds edge_function_url and notification_secret into app_config,
-- then updates trigger_daily_summary_push() to read from there.

INSERT INTO app_config (key, value)
VALUES
  ('edge_function_url',   'https://pxuemdkxdjuwxtupeqoa.supabase.co/functions/v1'),
  ('notification_secret', 'focus-notify-2026')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

CREATE OR REPLACE FUNCTION trigger_daily_summary_push(push_type TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  edge_url     TEXT;
  notif_secret TEXT;
BEGIN
  SELECT value INTO edge_url     FROM app_config WHERE key = 'edge_function_url';
  SELECT value INTO notif_secret FROM app_config WHERE key = 'notification_secret';

  IF edge_url IS NULL OR notif_secret IS NULL THEN
    RAISE WARNING '[daily_summary_push] Missing edge_function_url or notification_secret in app_config';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := edge_url || '/daily-summary-push',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || notif_secret,
      'Content-Type',  'application/json'
    ),
    body    := jsonb_build_object('type', push_type)
  );
END;
$$;
