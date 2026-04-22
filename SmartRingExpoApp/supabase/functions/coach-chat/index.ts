import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RingWorkout {
  sport_type: string;
  start_time: string;
  duration_minutes: number | null;
  distance_m: number | null;
  calories: number | null;
  avg_heart_rate: number | null;
  max_heart_rate: number | null;
}

function fmt(date: string) {
  return new Date(date).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' });
}

function hm(minutes: number) {
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response('Unauthorized', { status: 401 });
    }
    const jwt = authHeader.slice(7);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized', detail: authError?.message }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { message, history, readiness, illness } = await req.json() as {
      message: string;
      history: { role: string; content: string }[];
      readiness: {
        score: number;
        recommendation: 'GO' | 'EASY' | 'REST';
        components: { hrv: number | null; sleep: number | null; restingHR: number | null; trainingLoad: number | null };
        confidence: 'high' | 'medium' | 'low';
      } | null;
      illness: {
        status: 'CLEAR' | 'WATCH' | 'SICK';
        signals: { tempDeviation: boolean; restingHRElevated: boolean; hrvSuppressed: boolean; sleepFragmented: boolean };
        summary: string;
        details: { hrvDelta: string | null; hrDelta: string | null; tempDelta: string | null };
      } | null;
    };

    if (!message?.trim()) {
      return new Response(JSON.stringify({ error: 'message required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgoDate = sevenDaysAgo.split('T')[0];
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Fetch all available health data in parallel
    const [
      sleepResult,
      dailyResult,
      stravaResult,
      sportResult,
      spo2Result,
      tempResult,
      hrvResult,
      stressResult,
      profileResult,
      todayStepsResult,
    ] = await Promise.all([
      // Last 7 sleep sessions (full nightly breakdown)
      supabase
        .from('sleep_sessions')
        .select('start_time, end_time, deep_min, light_min, rem_min, awake_min, sleep_score')
        .eq('user_id', user.id)
        .order('start_time', { ascending: false })
        .limit(7),

      // 7-day daily summaries (steps, HR, HRV averages per day)
      supabase
        .from('daily_summaries')
        .select('date, total_steps, sleep_total_min, hrv_avg, hr_avg, hr_min')
        .eq('user_id', user.id)
        .gte('date', sevenDaysAgoDate)
        .order('date', { ascending: false })
        .limit(7),

      // Last 5 Strava activities (14-day window)
      supabase
        .from('strava_activities')
        .select('name, sport_type, start_date, distance_m, moving_time_sec, total_elevation_gain_m, average_heartrate, calories, suffer_score')
        .eq('user_id', user.id)
        .gte('start_date', fourteenDaysAgo)
        .order('start_date', { ascending: false })
        .limit(5),

      // Last 5 ring-tracked workouts (14-day window)
      supabase
        .from('sport_records')
        .select('sport_type, start_time, end_time, duration_minutes, distance_m, calories, avg_heart_rate, max_heart_rate')
        .eq('user_id', user.id)
        .gte('start_time', fourteenDaysAgo)
        .order('start_time', { ascending: false })
        .limit(5),

      // Latest SpO2 reading
      supabase
        .from('spo2_readings')
        .select('spo2, recorded_at')
        .eq('user_id', user.id)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle(),

      // Temperature readings (last 7 days for trend)
      supabase
        .from('temperature_readings')
        .select('temperature_c, recorded_at')
        .eq('user_id', user.id)
        .gte('recorded_at', sevenDaysAgo)
        .order('recorded_at', { ascending: false })
        .limit(7),

      // HRV readings (last 7 days — rmssd is the key metric)
      supabase
        .from('hrv_readings')
        .select('sdnn, rmssd, recorded_at')
        .eq('user_id', user.id)
        .gte('recorded_at', sevenDaysAgo)
        .order('recorded_at', { ascending: false })
        .limit(14),

      // Latest stress reading
      supabase
        .from('stress_readings')
        .select('stress_level, recorded_at')
        .eq('user_id', user.id)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle(),

      // Profile (for sleep target / sleep debt calculation)
      supabase
        .from('profiles')
        .select('sleep_target_min')
        .eq('id', user.id)
        .maybeSingle(),

      // Steps in last 24h as fallback when daily_summaries hasn't rolled up yet.
      // Rolling window avoids UTC-vs-local-date mismatches.
      supabase
        .from('steps_readings')
        .select('steps')
        .eq('user_id', user.id)
        .gte('recorded_at', twentyFourHoursAgo),
    ]);

    const sleepSessions = sleepResult.data ?? [];
    const dailies = dailyResult.data ?? [];
    const runs = stravaResult.data ?? [];
    const ringWorkouts = sportResult.data ?? [];
    const latestSpo2 = spo2Result.data;
    const temps = tempResult.data ?? [];
    const hrvReadings = hrvResult.data ?? [];
    const latestStress = stressResult.data;
    const profile = profileResult.data;
    const todayStepRows = todayStepsResult.data ?? [];
    const latestDay = dailies[0] ?? null;
    const latestSleep = sleepSessions[0] ?? null;

    const todayStepsFromReadings = todayStepRows.reduce((sum: number, r: { steps: number }) => sum + (r.steps ?? 0), 0);

    // ── Build context sections ────────────────────────────────────────────────

    const sections: string[] = [];

    // ── 0. READINESS SCORE (client-computed, passed in request) ──────────────
    if (readiness) {
      const rec = readiness.recommendation === 'GO' ? 'Go — ready to train'
        : readiness.recommendation === 'EASY' ? 'Easy — light activity only'
        : 'Rest — recovery day';

      // Compute raw baselines from already-fetched data so the coach can cite actual numbers
      const med = (arr: number[]) => {
        if (arr.length === 0) return null;
        const s = [...arr].sort((a, b) => a - b);
        const m = Math.floor(s.length / 2);
        return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
      };

      const hrvRmssds = hrvReadings.filter(h => h.rmssd).map(h => h.rmssd as number);
      const medianHRV = med(hrvRmssds);
      const todayHRV = hrvReadings[0]?.rmssd ?? null;

      const restingHRs = dailies.filter(d => d.hr_min).map(d => d.hr_min as number);
      const medianRestingHR = med(restingHRs);
      const todayRestingHR = latestDay?.hr_min ?? null;

      const sleepMins = sleepSessions
        .map(s => (s.deep_min ?? 0) + (s.light_min ?? 0) + (s.rem_min ?? 0))
        .filter(m => m > 0);
      const medianSleepMin = med(sleepMins);
      const lastNightSleepMin = sleepMins[0] ?? null;

      const compLabel = (val: number | null, weight: string, rawDetail: string | null) => {
        if (val == null) return `no data (${weight} weight)`;
        const trend = val >= 70 ? 'good' : val >= 50 ? 'near baseline' : 'below baseline';
        return rawDetail
          ? `${Math.round(val)}/100 (${trend}, ${weight} weight) — ${rawDetail}`
          : `${Math.round(val)}/100 (${trend}, ${weight} weight)`;
      };

      const hrvDetail = todayHRV && medianHRV
        ? `today ${Math.round(todayHRV)}ms vs 14-day median ${Math.round(medianHRV)}ms`
        : todayHRV ? `today ${Math.round(todayHRV)}ms, no baseline yet` : null;

      const hrDetail = todayRestingHR && medianRestingHR
        ? `today ${Math.round(todayRestingHR)}bpm vs 7-day median ${Math.round(medianRestingHR)}bpm`
        : todayRestingHR ? `today ${Math.round(todayRestingHR)}bpm, no baseline yet` : null;

      const sleepDetail = lastNightSleepMin && medianSleepMin
        ? `last night ${hm(lastNightSleepMin)} vs 7-night median ${hm(Math.round(medianSleepMin))}`
        : lastNightSleepMin ? `last night ${hm(lastNightSleepMin)}, no baseline yet` : null;

      const compLines = [
        `  • HRV: ${compLabel(readiness.components.hrv, '35%', hrvDetail)}`,
        `  • Sleep: ${compLabel(readiness.components.sleep, '25%', sleepDetail)}`,
        `  • Resting HR: ${compLabel(readiness.components.restingHR, '20%', hrDetail)}`,
        `  • Training load: ${compLabel(readiness.components.trainingLoad, '20%', null)}`,
      ];

      // Identify what's dragging the score down most
      const scored = (Object.entries(readiness.components) as [string, number | null][])
        .filter(([, v]) => v != null) as [string, number][];
      const lowest = [...scored].sort((a, b) => a[1] - b[1])[0];
      const nameMap: Record<string, string> = { hrv: 'HRV', sleep: 'sleep', restingHR: 'resting HR', trainingLoad: 'training load' };
      const driverNote = lowest && lowest[1] < 60
        ? `Primary drag on score: ${nameMap[lowest[0]] ?? lowest[0]} (${Math.round(lowest[1])}/100).`
        : 'All components are near or above baseline.';

      const confidenceNote = readiness.confidence === 'low' ? 'less than 5 days of baseline data — scores will improve as baseline builds'
        : readiness.confidence === 'medium' ? '5–9 days of baseline data'
        : '10+ days of baseline data';

      sections.push(
        `Readiness score: ${readiness.score}/100 — ${rec}\nConfidence: ${readiness.confidence} (${confidenceNote})\nComponent breakdown:\n${compLines.join('\n')}\n${driverNote}`
      );

      if (illness && illness.status !== 'CLEAR') {
        const activeSignals = Object.entries(illness.signals)
          .filter(([, v]) => v)
          .map(([k]) => k.replace(/([A-Z])/g, ' $1').toLowerCase().trim());
        const deltas = [illness.details.hrvDelta, illness.details.hrDelta, illness.details.tempDelta].filter(Boolean);
        sections.push(
          `Illness watch: ${illness.status}\nActive signals: ${activeSignals.join(', ')}\nDeltas vs baseline: ${deltas.join(', ')}\nSummary: ${illness.summary}`
        );
      }
    }

    // ── 1. SLEEP HISTORY ────────────────────────────────────────────────────
    if (sleepSessions.length > 0) {
      const nightLines = sleepSessions.map(s => {
        const totalMin = (s.deep_min ?? 0) + (s.light_min ?? 0) + (s.rem_min ?? 0);
        const awake = s.awake_min ?? 0;
        const date = fmt(s.start_time);
        const duration = totalMin > 0 ? hm(totalMin) : null;
        const stages = totalMin > 0
          ? `deep: ${s.deep_min ?? 0}m, light: ${s.light_min ?? 0}m, REM: ${s.rem_min ?? 0}m, awake: ${awake}m`
          : null;
        const score = s.sleep_score ? `, score: ${s.sleep_score}/100` : '';
        return duration
          ? `  • ${date}: ${duration}${score} (${stages})`
          : `  • ${date}: no data`;
      });
      sections.push(`Sleep history (last ${sleepSessions.length} nights):\n${nightLines.join('\n')}`);

      // Sleep debt (vs 8h target)
      const targetMin = profile?.sleep_target_min ?? 480;
      const sessionsWithData = sleepSessions.filter(s => (s.deep_min ?? 0) + (s.light_min ?? 0) + (s.rem_min ?? 0) > 0);
      if (sessionsWithData.length >= 3) {
        const totalDebt = sessionsWithData.reduce((debt, s) => {
          const actual = (s.deep_min ?? 0) + (s.light_min ?? 0) + (s.rem_min ?? 0);
          return debt + Math.max(0, targetMin - actual);
        }, 0);
        sections.push(`Sleep debt (last ${sessionsWithData.length} nights vs ${hm(targetMin)} target): ${hm(Math.round(totalDebt / sessionsWithData.length))} avg deficit per night`);
      }
    } else if (dailies.some(d => d.sleep_total_min)) {
      // Fallback to daily_summaries if sleep_sessions empty
      const sleepLines = dailies
        .filter(d => d.sleep_total_min)
        .map(d => `  • ${d.date}: ${hm(d.sleep_total_min!)}`);
      sections.push(`Sleep history:\n${sleepLines.join('\n')}`);
    }

    // ── 2. TODAY'S KEY METRICS ────────────────────────────────────────────────
    const todayMetrics: string[] = [];

    // HRV — prefer rmssd from raw readings, fall back to daily summary
    const latestHrv = hrvReadings[0];
    const rmssd = latestHrv?.rmssd ?? null;
    const sdnn = latestHrv?.sdnn ?? null;
    if (rmssd || sdnn) {
      const parts = [];
      if (rmssd) parts.push(`RMSSD: ${Math.round(rmssd)}ms`);
      if (sdnn) parts.push(`SDNN: ${Math.round(sdnn)}ms`);
      todayMetrics.push(`HRV — ${parts.join(', ')}`);
    } else if (latestDay?.hrv_avg) {
      todayMetrics.push(`HRV: ${Math.round(latestDay.hrv_avg)}ms (daily avg)`);
    }

    // Resting HR
    if (latestDay?.hr_min) {
      todayMetrics.push(`Resting HR: ${Math.round(latestDay.hr_min)} bpm`);
    } else if (latestDay?.hr_avg) {
      todayMetrics.push(`Avg HR today: ${Math.round(latestDay.hr_avg)} bpm`);
    }

    // SpO2
    if (latestSpo2?.spo2) {
      todayMetrics.push(`SpO2: ${latestSpo2.spo2}% (as of ${fmt(latestSpo2.recorded_at)})`);
    }

    const stepsToday = latestDay?.total_steps ?? (todayStepsFromReadings > 0 ? todayStepsFromReadings : null);
    if (stepsToday) {
      todayMetrics.push(`Steps today: ${stepsToday.toLocaleString()}`);
    }

    // Stress
    if (latestStress?.stress_level != null) {
      todayMetrics.push(`Stress level: ${latestStress.stress_level}/100`);
    }

    // Temperature trend
    if (temps.length >= 2) {
      const latest = temps[0].temperature_c;
      const older = temps.slice(1);
      const avg = older.reduce((s, t) => s + t.temperature_c, 0) / older.length;
      const delta = latest - avg;
      const sign = delta > 0 ? '+' : '';
      todayMetrics.push(`Body temp: ${latest.toFixed(1)}°C (${sign}${delta.toFixed(1)}° vs 7-day avg)`);
    } else if (temps[0]) {
      todayMetrics.push(`Body temp: ${temps[0].temperature_c.toFixed(1)}°C`);
    }

    if (todayMetrics.length > 0) {
      sections.push(`Today's metrics:\n${todayMetrics.map(m => `  • ${m}`).join('\n')}`);
    }

    // ── 3. 7-DAY TRENDS ──────────────────────────────────────────────────────
    const trends: string[] = [];

    const sleepDays = dailies.filter(d => d.sleep_total_min && d.sleep_total_min > 0);
    if (sleepDays.length >= 3) {
      const avg = sleepDays.reduce((s, d) => s + d.sleep_total_min!, 0) / sleepDays.length;
      trends.push(`Avg sleep: ${hm(Math.round(avg))}/night`);
    }

    const hrvDays = hrvReadings.filter(h => h.rmssd);
    if (hrvDays.length >= 3) {
      const avg = hrvDays.reduce((s, h) => s + h.rmssd!, 0) / hrvDays.length;
      trends.push(`Avg HRV (RMSSD): ${Math.round(avg)}ms`);
    } else {
      const dailyHrvDays = dailies.filter(d => d.hrv_avg);
      if (dailyHrvDays.length >= 3) {
        const avg = dailyHrvDays.reduce((s, d) => s + d.hrv_avg!, 0) / dailyHrvDays.length;
        trends.push(`Avg HRV: ${Math.round(avg)}ms`);
      }
    }

    const stepDays = dailies.filter(d => d.total_steps && d.total_steps > 0);
    if (stepDays.length >= 3) {
      const avg = stepDays.reduce((s, d) => s + d.total_steps!, 0) / stepDays.length;
      trends.push(`Avg daily steps: ${Math.round(avg).toLocaleString()}`);
    }

    if (trends.length > 0) {
      sections.push(`7-day trends:\n${trends.map(t => `  • ${t}`).join('\n')}`);
    }

    // ── 4. STRAVA ACTIVITIES ─────────────────────────────────────────────────
    if (runs.length > 0) {
      const runLines = runs.map(r => {
        const km = r.distance_m ? `${(r.distance_m / 1000).toFixed(1)}km` : '';
        const min = r.moving_time_sec ? `${Math.round(r.moving_time_sec / 60)}min` : '';
        const pace = r.distance_m && r.moving_time_sec
          ? `${(r.moving_time_sec / 60 / (r.distance_m / 1000)).toFixed(1)} min/km pace`
          : '';
        const elev = r.total_elevation_gain_m ? `${Math.round(r.total_elevation_gain_m)}m elev` : '';
        const hr = r.average_heartrate ? `${Math.round(r.average_heartrate)}bpm avg HR` : '';
        const suffer = r.suffer_score ? `suffer ${r.suffer_score}` : '';
        const date = r.start_date ? fmt(r.start_date) : '';
        const parts = [km, min, pace, elev, hr, suffer].filter(Boolean).join(', ');
        return `  • ${r.name ?? r.sport_type} (${date}): ${parts}`;
      });
      sections.push(`Training / Strava (last 14 days):\n${runLines.join('\n')}`);
    }

    // ── 5. RING WORKOUTS ─────────────────────────────────────────────────────
    if (ringWorkouts.length > 0) {
      const workoutLines = ringWorkouts.map((w: RingWorkout) => {
        const dur = w.duration_minutes ? `${w.duration_minutes}min` : '';
        const km = w.distance_m ? `${(w.distance_m / 1000).toFixed(1)}km` : '';
        const cal = w.calories ? `${Math.round(w.calories)}kcal` : '';
        const hr = w.avg_heart_rate ? `${Math.round(w.avg_heart_rate)}bpm avg HR` : '';
        const date = w.start_time ? fmt(w.start_time) : '';
        const parts = [dur, km, cal, hr].filter(Boolean).join(', ');
        return `  • ${w.sport_type} (${date}): ${parts}`;
      });
      sections.push(`Ring-tracked workouts (last 14 days):\n${workoutLines.join('\n')}`);
    }

    const healthContext = sections.length > 0
      ? sections.join('\n\n')
      : 'No health data synced yet.';

    // ── System prompt ─────────────────────────────────────────────────────────
    const systemPrompt = `You are a personal health coach for a smart ring app called Focus. You have access to the user's full biometric data from their smart ring and Strava.

${healthContext}

Guidelines:
- Answer questions using the specific data above — always cite actual numbers
- Speak in second person ("You slept...", "Your HRV is...")
- Keep answers concise (2-5 sentences) and actionable
- If asked about data not in the snapshot, say so honestly
- Never invent values not listed above
- Tone: warm, direct, science-informed

IMPORTANT: Always respond with a valid JSON object in this exact format:
{
  "message": "your full response here",
  "follow_ups": ["short question 1", "short question 2", "short question 3"],
  "artifact": { "type": "..." }
}

Rules for follow_ups:
- Exactly 2-3 natural follow-up questions the user might want to ask next
- Each question must be under 8 words
- Derive them from what you discussed in your response
- Never repeat the user's current question

Rules for artifact (OPTIONAL — omit the field entirely for short factual answers):
Only include "artifact" when a visual genuinely adds information the text cannot convey.
Named artifact types (no data field needed — the app renders the full card automatically):
  "sleep_hypnogram"      → last night's sleep stages chart
  "readiness_score"      → readiness ring (score + recommendation)
  "readiness_breakdown"  → readiness component breakdown (HRV/sleep/HR/load)
  "illness_watch"        → illness-watch signal card (5 body signals)
  "last_run"             → last run/workout context card (effort verdict, body state)
  "training_insights"    → HR zone distribution + training load donut
  "daily_timeline"       → today's chronological activity/sleep timeline
  "nap"                  → today's nap session card
  "heart_rate"           → today's hourly heart rate chart
  "sleep_trend"          → 7-day sleep duration trend
  "sleep_debt"           → sleep debt gauge
  "steps"                → today's step gauge

Generative artifact types (you supply the data from the snapshot above — NEVER invent values):
  { "type": "bar_chart",  "data": { "points": [{"label":"Mon","value":62},...], "title":"...", "unit":"ms", "accent":"#6B8EFF", "maxValue":100 } }
  { "type": "line_chart", "data": { "points": [62,58,71,...], "title":"...", "unit":"ms", "accent":"#6B8EFF" } }
  { "type": "stat_grid",  "data": { "cells": [{"label":"HRV","value":"62","unit":"ms","accent":"#6B8EFF"},...], "title":"..." } }
  { "type": "gauge",      "data": { "value": 7200, "goal": 10000, "label": "STEPS", "message": "72% of daily goal" } }

Generative rules:
- Max 7 points for line_chart, 10 for bar_chart, 6 cells for stat_grid
- bar_chart labels: short date labels ("Mon", "Tue") or metric names
- accent hex suggestions: blue #6B8EFF, orange #FF753F, red #AC0D0D, amber #FFB84D
- For trend charts (HRV, temperature, sleep score over days), use bar_chart or line_chart
- For a quick multi-metric snapshot (SpO2 + temp + stress), use stat_grid
- Omit "artifact" entirely if the answer is a simple yes/no, short fact, or advice-only`;

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY secret not set');

    const chatHistory = (history ?? []).map(m => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.content,
    }));

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [...chatHistory, { role: 'user', content: message }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      throw new Error(`Anthropic API error ${anthropicRes.status}: ${errText}`);
    }

    const anthropicData = await anthropicRes.json();
    const rawText: string = anthropicData.content?.[0]?.text ?? '';

    let reply: string = rawText;
    let followUps: string[] = [];
    let claudeArtifact: { type: string; data?: unknown } | undefined;
    try {
      // Claude may wrap the JSON in a code fence — strip it first
      const jsonStr = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      const parsed = JSON.parse(jsonStr);
      if (typeof parsed.message === 'string') reply = parsed.message;
      if (Array.isArray(parsed.follow_ups)) followUps = parsed.follow_ups.slice(0, 3);
      if (parsed.artifact && typeof parsed.artifact.type === 'string') {
        claudeArtifact = parsed.artifact;
      }
    } catch {
      // Non-JSON fallback: use raw text as message, no follow-ups
      reply = rawText || "I'm having trouble responding right now. Please try again.";
    }

    // Trust Claude-emitted artifact when present; fall back to keyword matching
    let artifact = claudeArtifact;

    if (!artifact) {
      const msgLower = message.toLowerCase();
      const latestSleepTotal = latestSleep
        ? (latestSleep.deep_min ?? 0) + (latestSleep.light_min ?? 0) + (latestSleep.rem_min ?? 0)
        : 0;

      const artifactChecks: { type: string; keywords: string[]; guard?: boolean }[] = [
        { type: 'sleep_hypnogram',     keywords: ['sleep', 'slept', 'last night', 'rem', 'deep sleep', 'sleep stage', 'woke', 'bedtime', 'hypnogram', 'how long did i sleep'], guard: latestSleepTotal > 0 },
        { type: 'readiness_breakdown', keywords: ['why my score', 'why is my readiness', 'readiness breakdown', 'what\'s dragging', 'components', 'what\'s pulling down'], guard: readiness != null },
        { type: 'readiness_score',     keywords: ['readiness', 'focus score', 'recovery score', 'ready to train', 'score breakdown', 'my score'], guard: readiness != null },
        { type: 'illness_watch',       keywords: ['sick', 'illness', 'feeling off', 'immune', 'fighting something', 'fever', 'getting sick'] },
        { type: 'last_run',            keywords: ['last run', 'last workout', 'how was my run', 'yesterday\'s training', 'last training'] },
        { type: 'training_insights',   keywords: ['hr zones', 'heart rate zones', 'training zones', 'training load', 'zone distribution'] },
        { type: 'daily_timeline',      keywords: ['today\'s events', 'chronology', 'what happened today', 'my day', 'daily timeline'] },
        { type: 'nap',                 keywords: ['my nap', 'napping', 'did i nap', 'nap today'] },
        { type: 'heart_rate',          keywords: ['heart rate', 'hr trend', 'bpm', 'pulse', 'resting heart', 'heart rate today', 'my heart'] },
        { type: 'sleep_trend',         keywords: ['sleep trend', 'sleep this week', 'weekly sleep', '7 day sleep', 'sleep average', 'sleep history'] },
        { type: 'sleep_debt',          keywords: ['sleep debt', 'sleep deficit', 'catch up on sleep', 'owe sleep', 'how much sleep do i owe'] },
        { type: 'steps',               keywords: ['steps today', 'step count', 'step goal', 'how many steps', 'activity today', 'daily steps'] },
      ];

      const matched = artifactChecks.find(a =>
        (a.guard === undefined || a.guard) && a.keywords.some(kw => msgLower.includes(kw))
      );
      if (matched) artifact = { type: matched.type };
    }

    return new Response(JSON.stringify({ message: reply, artifact, followUps }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    console.error('[coach-chat] error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
