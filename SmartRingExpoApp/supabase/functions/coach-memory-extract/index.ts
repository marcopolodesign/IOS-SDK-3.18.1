import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXTRACTION_PROMPT = `You are extracting persistent facts about a user from their health coach conversation.

Read the conversation below and extract up to 3 facts that would help the coach personalise future sessions.

Good facts to extract:
- Training goals (races, events, targets)
- Recurring patterns the user mentioned (sleep habits, workout times, injury history)
- Preferences about coaching style or focus areas
- Named context (sport type, life situation affecting training)

Rules:
- Only extract facts the user explicitly stated or strongly implied
- Ignore one-off questions about today's data (HRV, steps, etc.) — those are already available from the ring
- Keep each value under 20 words
- Use a stable snake_case key (e.g. "training_goal", "injury_history", "preferred_workout_time")
- Omit facts that are obvious or already in the biometric data
- If there are no useful persistent facts to extract, return an empty array

Respond ONLY with a JSON array, no prose:
[{"key":"...","value":"..."},...]`;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { messages } = await req.json() as {
      messages: { role: string; content: string }[];
    };

    if (!Array.isArray(messages) || messages.length < 2) {
      return new Response(JSON.stringify({ extracted: 0 }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const conversationText = messages
      .map(m => `${m.role === 'user' ? 'User' : 'Coach'}: ${m.content}`)
      .join('\n');

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY not set');

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        system: EXTRACTION_PROMPT,
        messages: [{ role: 'user', content: conversationText }],
      }),
    });

    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);

    const anthropicData = await res.json();
    const rawText: string = anthropicData.content?.[0]?.text ?? '[]';

    let facts: { key: string; value: string }[] = [];
    try {
      const clean = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      facts = JSON.parse(clean);
      if (!Array.isArray(facts)) facts = [];
    } catch {
      facts = [];
    }

    if (facts.length === 0) {
      return new Response(JSON.stringify({ extracted: 0 }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const now = new Date().toISOString();
    const rows = facts
      .filter(f => f.key && f.value && typeof f.key === 'string' && typeof f.value === 'string')
      .map(f => ({ user_id: user.id, key: f.key, value: f.value, updated_at: now }));

    if (rows.length > 0) {
      const { error: upsertError } = await supabase
        .from('coach_memories')
        .upsert(rows, { onConflict: 'user_id,key' });

      if (upsertError) throw upsertError;
    }

    return new Response(JSON.stringify({ extracted: rows.length }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    console.error('[coach-memory-extract] error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
