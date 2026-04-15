import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * whatsapp-checkin — 3× daily WhatsApp health check-in via Twilio + Claude AI.
 *
 * Accepts { "type": "morning" | "evening" | "night" } in POST body.
 * Defaults to "morning" when body is empty (backward-compatible).
 *
 * Schedule (pg_cron → trigger_whatsapp_checkin):
 *   morning  — 12:03 UTC  (9:03 AM ART)  sleep recap + coaching
 *   evening  — 23:03 UTC  (8:03 PM ART)  activity recap
 *   night    — 01:33 UTC (10:33 PM ART)  wind-down / bedtime nudge
 *
 * Required Supabase secrets:
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM
 *   ANTHROPIC_API_KEY, NOTIFICATION_SECRET
 *
 * app_config keys:
 *   whatsapp_recipient, whatsapp_app_link (optional),
 *   edge_function_url, notification_secret
 */

const VALID_TYPES = ['morning', 'evening', 'night'] as const;
type CheckinType = typeof VALID_TYPES[number];

const BASE_PROMPTS: Record<CheckinType, string> = {
  morning:
    'You are a concise health coach for a smart ring user. Based on their biometric data, write ONE WhatsApp message (2-3 sentences, under 300 characters total). Be warm, cite specific numbers from the data, and give one actionable tip for the day. Use plain text — no markdown, no bullet points. One emoji at the very start is ok. Do not greet by name.',
  evening:
    'You are a concise health coach for a smart ring user. Based on their daily activity data, write ONE WhatsApp message (2-3 sentences, under 300 characters total). Recap the day — cite steps, heart rate, or other numbers. Acknowledge effort or suggest gentle improvement. Use plain text — no markdown, no bullet points. One emoji at the very start is ok. Do not greet by name.',
  night:
    'You are a concise health coach for a smart ring user. Based on their sleep trend data, write ONE WhatsApp message (2-3 sentences, under 300 characters total). Encourage winding down for the night. Reference their sleep average or deficit if available. Be calming and supportive. Use plain text — no markdown, no bullet points. One emoji at the very start is ok. Do not greet by name.',
};

function systemPrompt(type: CheckinType, lang: string): string {
  const base = BASE_PROMPTS[type];
  if (lang === 'es') return base + ' Write entirely in natural Latin American Spanish.';
  return base;
}

const USER_PROMPTS: Record<CheckinType, string> = {
  morning: "Here is today's health snapshot:\n\n{snapshot}\n\nWrite the morning check-in message.",
  evening: "Here is today's activity snapshot:\n\n{snapshot}\n\nWrite the evening recap message.",
  night: "Here is the sleep trend snapshot:\n\n{snapshot}\n\nWrite the wind-down / bedtime nudge message.",
};

const FALLBACK_MESSAGES: Record<string, Record<CheckinType, string>> = {
  en: {
    morning: '🌅 Good morning! Open Focus to check your health summary for today.',
    evening: '🌆 Day is wrapping up! Open Focus to review your activity.',
    night: '🌙 Time to wind down. Open Focus to check your sleep trends.',
  },
  es: {
    morning: '🌅 ¡Buen día! Abrí Focus para ver tu resumen de salud.',
    evening: '🌆 ¡Se termina el día! Abrí Focus para ver tu actividad.',
    night: '🌙 Hora de relajarse. Abrí Focus para ver tus tendencias de sueño.',
  },
};

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

    // Parse type from body (default: morning for backward compat)
    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* empty body is fine */ }
    const type = (VALID_TYPES.includes(body.type as CheckinType) ? body.type : 'morning') as CheckinType;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')!;
    const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID')!;
    const twilioToken = Deno.env.get('TWILIO_AUTH_TOKEN')!;
    const twilioFrom = Deno.env.get('TWILIO_WHATSAPP_FROM')!;

    if (!twilioSid || !twilioToken || !twilioFrom) {
      return new Response(JSON.stringify({ error: 'Missing Twilio secrets' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Read config: recipient, app link, user_id
    const { data: configRows } = await supabase
      .from('app_config')
      .select('key, value')
      .in('key', ['whatsapp_recipient', 'whatsapp_app_link', 'whatsapp_user_id', 'whatsapp_language']);

    const cfg: Record<string, string> = {};
    for (const row of configRows ?? []) cfg[row.key] = row.value;

    const recipient = cfg['whatsapp_recipient'];
    if (!recipient) {
      return new Response(JSON.stringify({ error: 'whatsapp_recipient not set in app_config' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const appLink = cfg['whatsapp_app_link'] ?? null;
    const lang = cfg['whatsapp_language'] ?? 'en';

    // Resolve user_id
    let userId: string | null = cfg['whatsapp_user_id'] ?? null;
    if (!userId) {
      const { data: recentSummary } = await supabase
        .from('daily_summaries')
        .select('user_id')
        .order('date', { ascending: false })
        .limit(1);
      userId = recentSummary?.[0]?.user_id ?? null;
    }

    const now = new Date();
    const todayUtc = now.toISOString().slice(0, 10);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgoDate = sevenDaysAgo.split('T')[0];

    // ── Data queries ────────────────────────────────────────────────────────
    const [
      { data: sleepRows },
      { data: dailies },
      { data: hrvRows },
      { data: illnessRows },
    ] = await Promise.all([
      supabase
        .from('sleep_sessions')
        .select('start_time, end_time, deep_min, light_min, rem_min, awake_min, sleep_score')
        .eq('user_id', userId)
        .order('start_time', { ascending: false })
        .limit(1),
      supabase
        .from('daily_summaries')
        .select('date, total_steps, sleep_total_min, hr_avg, hr_min, hrv_avg')
        .eq('user_id', userId)
        .gte('date', sevenDaysAgoDate)
        .order('date', { ascending: false })
        .limit(7),
      supabase
        .from('hrv_readings')
        .select('rmssd, recorded_at')
        .eq('user_id', userId)
        .gte('recorded_at', sevenDaysAgo)
        .order('recorded_at', { ascending: false })
        .limit(14),
      supabase
        .from('illness_scores')
        .select('score, status')
        .eq('user_id', userId)
        .eq('score_date', todayUtc)
        .limit(1),
    ]);

    // ── Derived metrics ─────────────────────────────────────────────────────
    const sleep = sleepRows?.[0];
    const today = dailies?.[0];
    const illness = illnessRows?.[0];

    const fallbackSleepRow = (dailies ?? []).find(d => d.sleep_total_min);
    const sleepMin = sleep
      ? (sleep.deep_min ?? 0) + (sleep.light_min ?? 0) + (sleep.rem_min ?? 0)
      : (fallbackSleepRow?.sleep_total_min ?? null);
    const sleepH = sleepMin != null ? Math.floor(sleepMin / 60) : null;
    const sleepM = sleepMin != null ? sleepMin % 60 : null;

    const hrvValues = (hrvRows ?? []).map(r => r.rmssd).filter(Boolean);
    const hrvLatest = hrvValues[0] ?? null;
    const hrv7dAvg = hrvValues.length
      ? Math.round(hrvValues.reduce((a, b) => a + b, 0) / hrvValues.length)
      : null;

    const sleepDays = (dailies ?? []).filter(d => d.sleep_total_min);
    const sleep7dAvgMin = sleepDays.length
      ? Math.round(sleepDays.reduce((a, b) => a + b.sleep_total_min!, 0) / sleepDays.length)
      : null;

    const stepsDays = (dailies ?? []).filter(d => d.total_steps);
    const steps7dAvg = stepsDays.length
      ? Math.round(stepsDays.reduce((a, b) => a + (b.total_steps ?? 0), 0) / stepsDays.length)
      : null;

    // ── Build snapshot per type ─────────────────────────────────────────────
    const snapshot = buildSnapshot(type, {
      sleep, sleepMin, sleepH, sleepM, today, illness,
      hrvLatest, hrv7dAvg, sleep7dAvgMin, steps7dAvg,
    });

    // ── Claude AI message ───────────────────────────────────────────────────
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        system: systemPrompt(type, lang),
        messages: [
          { role: 'user', content: USER_PROMPTS[type].replace('{snapshot}', snapshot) },
        ],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      throw new Error(`Anthropic API error ${anthropicRes.status}: ${errText}`);
    }

    const anthropicData = await anthropicRes.json();
    const fallbacks = FALLBACK_MESSAGES[lang] ?? FALLBACK_MESSAGES['en'];
    let message: string = anthropicData.content?.[0]?.text ?? fallbacks[type];

    // Append app link if configured
    if (appLink) {
      message += `\n\n📲 ${appLink}`;
    }

    // ── Send via Twilio ─────────────────────────────────────────────────────
    const twilioBody = new URLSearchParams({
      From: twilioFrom,
      To: recipient,
      Body: message,
    });

    const twilioRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${twilioSid}:${twilioToken}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: twilioBody.toString(),
      },
    );

    if (!twilioRes.ok) {
      const errText = await twilioRes.text();
      throw new Error(`Twilio error ${twilioRes.status}: ${errText}`);
    }

    const twilioData = await twilioRes.json();

    return new Response(
      JSON.stringify({
        sent: true,
        type,
        to: recipient,
        userId,
        messageSid: twilioData.sid,
        messagePreview: message.slice(0, 100) + (message.length > 100 ? '…' : ''),
        snapshot,
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

// ── Snapshot builders per type ────────────────────────────────────────────────

interface SnapshotData {
  sleep: Record<string, unknown> | null | undefined;
  sleepMin: number | null;
  sleepH: number | null;
  sleepM: number | null;
  today: Record<string, unknown> | null | undefined;
  illness: Record<string, unknown> | null | undefined;
  hrvLatest: number | null;
  hrv7dAvg: number | null;
  sleep7dAvgMin: number | null;
  steps7dAvg: number | null;
}

function buildSnapshot(type: CheckinType, d: SnapshotData): string {
  const parts: string[] = [];

  if (type === 'morning') {
    // Sleep recap + HRV + illness
    if (d.sleepMin != null && d.sleepMin > 0) {
      parts.push(
        `Last night: slept ${d.sleepH}h ${d.sleepM}m` +
        (d.sleep?.sleep_score ? ` (score ${d.sleep.sleep_score}/100)` : '') +
        (d.sleep?.deep_min ? `, deep sleep ${d.sleep.deep_min}m` : '') +
        '.',
      );
    } else {
      parts.push('Last night: no sleep data synced yet.');
    }

    if (d.hrvLatest && d.hrv7dAvg) {
      parts.push(`HRV: latest ${Math.round(d.hrvLatest)}ms, 7-day average ${d.hrv7dAvg}ms.`);
    }

    if (d.sleep7dAvgMin) {
      const h = Math.floor(d.sleep7dAvgMin / 60);
      const m = d.sleep7dAvgMin % 60;
      parts.push(`7-day sleep average: ${h}h ${m}m/night.`);
    }

    parts.push(`Illness watch: ${(d.illness as Record<string, unknown>)?.status ?? 'CLEAR'}.`);

  } else if (type === 'evening') {
    // Activity recap
    const t = d.today as Record<string, unknown> | null;
    if (t?.total_steps || t?.hr_avg || t?.hr_min) {
      const bits: string[] = [];
      if (t.total_steps) bits.push(`${Number(t.total_steps).toLocaleString('en-US')} steps`);
      if (t.hr_avg) bits.push(`avg HR ${t.hr_avg} bpm`);
      if (t.hr_min) bits.push(`resting HR ${t.hr_min} bpm`);
      parts.push(`Today: ${bits.join(', ')}.`);
    } else {
      parts.push('Today: no activity data synced yet.');
    }

    if (d.steps7dAvg) {
      parts.push(`7-day step average: ${d.steps7dAvg.toLocaleString('en-US')} steps/day.`);
    }

    if (d.hrvLatest) {
      parts.push(`Latest HRV: ${Math.round(d.hrvLatest)}ms.`);
    }

    parts.push(`Illness watch: ${(d.illness as Record<string, unknown>)?.status ?? 'CLEAR'}.`);

  } else {
    // night — wind-down / bedtime nudge
    if (d.sleepMin != null && d.sleepMin > 0) {
      parts.push(`Last night you slept ${d.sleepH}h ${d.sleepM}m.`);
    }

    if (d.sleep7dAvgMin) {
      const h = Math.floor(d.sleep7dAvgMin / 60);
      const m = d.sleep7dAvgMin % 60;
      const deficit = 480 - d.sleep7dAvgMin; // vs 8h target
      parts.push(`Your 7-day sleep average is ${h}h ${m}m/night.`);
      if (deficit > 15) {
        parts.push(`You have a ~${Math.round(deficit)}min/night sleep deficit vs the 8h target.`);
      }
    }

    if (d.hrvLatest && d.hrv7dAvg) {
      const delta = d.hrvLatest - d.hrv7dAvg;
      if (Math.abs(delta) > 5) {
        parts.push(`HRV is ${delta > 0 ? 'up' : 'down'} today (${Math.round(d.hrvLatest)}ms vs ${d.hrv7dAvg}ms avg).`);
      }
    }

    if (parts.length === 0) {
      parts.push('Time to wind down for the night. Aim for 8 hours of quality sleep.');
    }
  }

  return parts.join('\n');
}
