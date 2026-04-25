-- Fix: readiness cron was including CURRENT_DATE (today), which runs at 12:15 AM ART
-- before the ring has synced. This stored garbage data (sleepScore=0, wrong resting HR)
-- that the client then displayed instead of the correct ring-computed values.
--
-- New range: CURRENT_DATE-3 to CURRENT_DATE-1 (yesterday and 2 days back).
-- Today is always computed client-side in recovery-detail.tsx from live ring data.

SELECT cron.unschedule('daily-readiness-rollup');

SELECT cron.schedule(
  'daily-readiness-rollup',
  '15 3 * * *',
  $$
  SELECT compute_daily_readiness(user_id::UUID, d::DATE)
  FROM (SELECT DISTINCT user_id FROM daily_summaries) u
  CROSS JOIN generate_series(
    CURRENT_DATE - INTERVAL '3 days',
    CURRENT_DATE - INTERVAL '1 day',
    '1 day'::INTERVAL
  ) AS d;
  $$
);
