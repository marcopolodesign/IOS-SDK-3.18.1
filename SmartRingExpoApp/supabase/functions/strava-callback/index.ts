import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

/**
 * Strava OAuth callback handler.
 *
 * Strava requires an https:// redirect URI, so this edge function acts as a
 * bridge: it receives the code from Strava and immediately deep-links back
 * into the app via the custom scheme.
 *
 * Strava Authorization Callback Domain: pxuemdkxdjuwxtupeqoa.supabase.co
 * Redirect URI in app: https://pxuemdkxdjuwxtupeqoa.supabase.co/functions/v1/strava-callback
 */
serve(async (req: Request) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const state = url.searchParams.get('state');

  const appScheme = 'smartring';
  const appPath = 'strava-auth';

  // Build the deep link back into the app
  const params = new URLSearchParams();
  if (code) params.set('code', code);
  if (error) params.set('error', error);
  if (state) params.set('state', state);

  const deepLink = `${appScheme}://${appPath}?${params.toString()}`;

  // Use HTTP 302 — ASWebAuthenticationSession on iOS only detects custom
  // scheme redirects via real HTTP redirects, not meta-refresh HTML.
  return new Response(null, {
    status: 302,
    headers: {
      'Location': deepLink,
      'Cache-Control': 'no-store',
    },
  });
});
