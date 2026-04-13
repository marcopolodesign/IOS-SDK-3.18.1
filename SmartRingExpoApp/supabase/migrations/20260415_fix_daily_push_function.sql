-- Fix trigger_daily_summary_push to use correct setting key names
-- matching the existing convention used by compute_illness_scores()

CREATE OR REPLACE FUNCTION trigger_daily_summary_push(push_type TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  edge_url     TEXT := current_setting('app.edge_function_url', true);
  notif_secret TEXT := current_setting('app.notification_secret', true);
BEGIN
  IF edge_url IS NULL OR notif_secret IS NULL THEN
    RAISE WARNING '[daily_summary_push] Missing app.edge_function_url or app.notification_secret settings';
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
