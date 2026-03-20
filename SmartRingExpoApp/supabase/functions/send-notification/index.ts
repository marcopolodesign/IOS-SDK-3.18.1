import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * send-notification — manual or server-triggered push via Expo Push API.
 *
 * Authorization: Bearer focus-notify-2026
 *
 * Body (JSON):
 *   user_id?  — send to a specific user (omit to broadcast to ALL users)
 *   title     — notification title
 *   body      — notification body
 *   data?     — arbitrary payload; { url: "smartring:///?tab=sleep" } triggers deeplink
 */
serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Auth: require notification secret
    const authHeader = req.headers.get('Authorization') ?? '';
    const secret = Deno.env.get('NOTIFICATION_SECRET') ?? '';
    if (!authHeader.startsWith('Bearer ') || authHeader.slice(7) !== secret) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body_text = await req.text();
    const { user_id, title, body, data } = JSON.parse(body_text) as {
      user_id?: string;
      title: string;
      body: string;
      data?: Record<string, unknown>;
    };

    if (!title || !body) {
      return new Response(JSON.stringify({ error: 'title and body are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: 'Missing Supabase env vars', url: !!supabaseUrl, key: !!supabaseKey }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    let query = supabase.from('push_tokens').select('token');
    if (user_id) query = query.eq('user_id', user_id);

    const { data: rows, error } = await query;
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (!rows || rows.length === 0) {
      return new Response(JSON.stringify({ error: 'No push tokens found for this user. Make sure the app is installed and opened at least once after the latest update.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const messages = rows.map(({ token }: { token: string }) => ({
      to: token,
      title,
      body,
      data: data ?? {},
      sound: 'default',
    }));

    const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const result = await expoResponse.json();
    return new Response(JSON.stringify({ sent: messages.length, result }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
