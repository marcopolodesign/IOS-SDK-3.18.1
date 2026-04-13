-- Daily summary push notifications via pg_cron
-- Calls the daily-summary-push edge function twice a day:
--   Morning: 12:00 UTC = 9:00 AM ART (UTC-3)
--   Evening: 23:00 UTC = 8:00 PM ART (UTC-3)

-- pg_cron and pg_net are already enabled (used by illness_scores cron)

CREATE OR REPLACE FUNCTION trigger_daily_summary_push(push_type TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  edge_url  TEXT := current_setting('app.settings.edge_functions_url', true);
  notif_secret TEXT := current_setting('app.settings.notification_secret', true);
BEGIN
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

-- Morning sleep summary: 12:00 UTC = 9 AM ART
SELECT cron.schedule(
  'daily-summary-push-morning',
  '0 12 * * *',
  $$SELECT trigger_daily_summary_push('morning')$$
);

-- Evening activity summary: 23:00 UTC = 8 PM ART
SELECT cron.schedule(
  'daily-summary-push-evening',
  '0 23 * * *',
  $$SELECT trigger_daily_summary_push('evening')$$
);
