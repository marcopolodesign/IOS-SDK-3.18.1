import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * daily-summary-push — personalized daily push notifications for all users.
 *
 * Called by pg_cron via net.http_post.
 * Authorization: Bearer <NOTIFICATION_SECRET>
 *
 * Body: { type: "morning" | "evening" | "wind-down" }
 *
 * morning  (12:00 UTC = 9 AM ART, fixed):
 *   Rich:    "You slept 7h 32m · Score: 85."
 *   Fallback:"Your sleep summary is ready — view now."
 *
 * evening  (23:00 UTC = 8 PM ART, fixed):
 *   "8,234 steps · avg HR 72 bpm."
 *   Skipped if no activity data.
 *
 * wind-down (every hour UTC — per-user delivery time):
 *   Cron runs hourly. Each user's delivery hour is computed from their
 *   7-day average wake time: wind_down_hour = avg_wake_utc - 8.5h.
 *   Only users whose wind-down UTC hour matches the current UTC hour receive it.
 *   "Time to wind down 🌙 To wake at 6:45 AM rested, aim to be asleep by 10:45 PM."
 */
serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const secret = Deno.env.get('NOTIFICATION_SECRET') ?? '';
    if (!authHeader.startsWith('Bearer ') || authHeader.slice(7) !== secret) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { type } = (await req.json()) as { type: 'morning' | 'evening' | 'wind-down' };
    if (!['morning', 'evening', 'wind-down'].includes(type)) {
      return new Response(JSON.stringify({ error: 'type must be "morning", "evening", or "wind-down"' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // All users with push tokens
    const { data: tokenRows, error: tokenErr } = await supabase
      .from('push_tokens')
      .select('user_id, token');

    if (tokenErr || !tokenRows?.length) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no tokens' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const now = new Date();
    const currentUtcHour = now.getUTCHours();
    const todayUtc = now.toISOString().slice(0, 10);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Bulk-fetch all data upfront — no N+1 queries
    const [{ data: allSessions }, { data: allSummaries }, { data: allWindDownSessions }] = await Promise.all([
      type === 'morning'
        ? supabase
            .from('sleep_sessions')
            .select('user_id, start_time, end_time, sleep_score')
            .gte('end_time', oneDayAgo)
            .order('end_time', { ascending: false })
        : Promise.resolve({ data: null }),

      type === 'evening'
        ? supabase
            .from('daily_summaries')
            .select('user_id, total_steps, hr_avg')
            .eq('date', todayUtc)
        : Promise.resolve({ data: null }),

      type === 'wind-down'
        ? supabase
            .from('sleep_sessions')
            .select('user_id, end_time')
            .gte('end_time', sevenDaysAgo)
            .order('end_time', { ascending: false })
        : Promise.resolve({ data: null }),
    ]);

    // Most-recent session per user for morning (already ordered desc)
    const sessionByUser: Record<string, { start_time: string; end_time: string; sleep_score: number | null }> = {};
    for (const s of allSessions ?? []) {
      if (!sessionByUser[s.user_id]) sessionByUser[s.user_id] = s;
    }

    const summaryByUser: Record<string, { total_steps: number | null; hr_avg: number | null }> = {};
    for (const s of allSummaries ?? []) {
      summaryByUser[s.user_id] = s;
    }

    // 7-day average wake time per user (UTC minutes of day)
    // Used to compute each user's personal wind-down delivery hour
    const wakeUtcMinSumByUser: Record<string, { sum: number; count: number }> = {};
    for (const s of allWindDownSessions ?? []) {
      const d = new Date(s.end_time);
      const utcMin = d.getUTCHours() * 60 + d.getUTCMinutes();
      if (!wakeUtcMinSumByUser[s.user_id]) wakeUtcMinSumByUser[s.user_id] = { sum: 0, count: 0 };
      wakeUtcMinSumByUser[s.user_id].sum += utcMin;
      wakeUtcMinSumByUser[s.user_id].count += 1;
    }

    const messages: object[] = [];

    for (const { user_id, token } of tokenRows) {
      let title = '';
      let body = '';

      if (type === 'morning') {
        const session = sessionByUser[user_id];

        if (!session) {
          // Fallback: no synced data yet — nudge user to open the app
          title = 'Your sleep summary is ready 🌙';
          body = 'See how you slept last night. Tap to view your analysis.';
        } else {
          const totalMin = Math.round(
            (new Date(session.end_time).getTime() - new Date(session.start_time).getTime()) / 60000,
          );
          const h = Math.floor(totalMin / 60);
          const m = totalMin % 60;
          const scoreText = session.sleep_score ? ` · Score: ${session.sleep_score}` : '';
          title = 'Good morning! Your sleep is ready 🌙';
          body = `You slept ${h}h ${m}m${scoreText}. Tap to see your full analysis.`;
        }

      } else if (type === 'evening') {
        const summary = summaryByUser[user_id];
        if (!summary) continue;

        const steps = summary.total_steps ? summary.total_steps.toLocaleString('en-US') : null;
        const hr = summary.hr_avg ? Math.round(summary.hr_avg) : null;
        if (!steps && !hr) continue;

        const parts: string[] = [];
        if (steps) parts.push(`${steps} steps`);
        if (hr) parts.push(`avg HR ${hr} bpm`);

        title = "Today's activity summary 🏃";
        body = `${parts.join(' · ')}. Tap to see your full day.`;

      } else {
        // wind-down: only send if this UTC hour matches the user's computed wind-down hour
        const userData = wakeUtcMinSumByUser[user_id];
        if (!userData) continue;

        const avgWakeUtcMin = Math.round(userData.sum / userData.count);

        // Wind-down = 30 min before bedtime; bedtime = wake - 8h
        // So wind-down = wake - 8h 30min = wake - 510 min
        const windDownUtcMin = ((avgWakeUtcMin - 510) + 1440 * 2) % 1440;
        const windDownUtcHour = Math.floor(windDownUtcMin / 60);

        // Skip users whose wind-down hour doesn't match the current UTC hour
        if (windDownUtcHour !== currentUtcHour) continue;

        // Format average wake time for display (12h, UTC)
        const wakeH = Math.floor(avgWakeUtcMin / 60);
        const wakeM = avgWakeUtcMin % 60;
        const wakeH12 = wakeH % 12 || 12;
        const wakeAmPm = wakeH < 12 ? 'AM' : 'PM';
        const wakeStr = `${wakeH12}:${String(wakeM).padStart(2, '0')} ${wakeAmPm}`;

        // Format bedtime (wake - 8h, 12h)
        const bedUtcMin = ((avgWakeUtcMin - 480) + 1440) % 1440;
        const bedH = Math.floor(bedUtcMin / 60);
        const bedM = bedUtcMin % 60;
        const bedH12 = bedH % 12 || 12;
        const bedAmPm = bedH < 12 ? 'AM' : 'PM';
        const bedStr = `${bedH12}:${String(bedM).padStart(2, '0')} ${bedAmPm}`;

        title = 'Time to wind down 🌙';
        body = `To wake at ${wakeStr} well-rested, aim to be asleep by ${bedStr}.`;
      }

      messages.push({
        to: token,
        title,
        body,
        sound: 'default',
        data: {
          url: type === 'evening' ? 'smartring:///?tab=activity' : 'smartring:///?tab=sleep',
        },
      });
    }

    if (messages.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no matching users for this hour' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Send in batches of 100 (Expo limit)
    const BATCH = 100;
    let totalSent = 0;
    for (let i = 0; i < messages.length; i += BATCH) {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(messages.slice(i, i + BATCH)),
      });
      if (res.ok) totalSent += Math.min(BATCH, messages.length - i);
    }

    return new Response(JSON.stringify({ sent: totalSent, type, utcHour: currentUtcHour }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
