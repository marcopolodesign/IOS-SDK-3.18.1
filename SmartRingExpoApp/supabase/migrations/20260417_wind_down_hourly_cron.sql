-- Change wind-down cron from fixed 01:00 UTC to hourly.
-- The edge function now filters per-user based on their 7-day average wake time,
-- so only users whose personal wind-down hour matches the current UTC hour receive it.

SELECT cron.unschedule('daily-wind-down-push');

SELECT cron.schedule(
  'daily-wind-down-push',
  '0 * * * *',
  $$SELECT trigger_daily_summary_push('wind-down')$$
);
