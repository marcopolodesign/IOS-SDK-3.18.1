-- Wind-down push notification cron
-- 01:00 UTC = 10:00 PM ART (UTC-3)
-- Calls daily-summary-push with type="wind-down"
-- trigger_daily_summary_push() already defined in 20260413_daily_summary_push_cron.sql

SELECT cron.schedule(
  'daily-wind-down-push',
  '0 1 * * *',
  $$SELECT trigger_daily_summary_push('wind-down')$$
);
