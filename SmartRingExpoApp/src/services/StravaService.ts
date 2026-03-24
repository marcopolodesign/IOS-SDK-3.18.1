import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { supabase } from './SupabaseService';
import {
  StravaTokens,
  StravaTokenResponse,
  StravaActivity,
  StravaActivityDetail,
  StravaHRZones,
  StravaActivityStats,
  StravaAthlete,
  StravaScope,
} from '../types/strava.types';
// Strava API configuration - using process.env for Expo SDK 54
const STRAVA_CLIENT_ID = process.env.EXPO_PUBLIC_STRAVA_CLIENT_ID || '';
const STRAVA_CLIENT_SECRET = process.env.EXPO_PUBLIC_STRAVA_CLIENT_SECRET || '';

const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
const STRAVA_API_URL = 'https://www.strava.com/api/v3';

// OAuth scopes we need
const REQUIRED_SCOPES: StravaScope[] = [
  'read',
  'activity:read_all',
  'profile:read_all',
];

WebBrowser.maybeCompleteAuthSession();

class StravaService {
  private _tokens: StravaTokens | null = null;
  private _athlete: StravaAthlete | null = null;
  private _isConnected: boolean = false;

  constructor() {
    // DISABLED: Strava token loading on startup to reduce startup noise
    // Token loading will happen when user accesses Strava features
    // this.loadTokensFromDatabase();
  }

  // ============================================
  // GETTERS
  // ============================================

  get isConnected(): boolean {
    return this._isConnected;
  }

  get athlete(): StravaAthlete | null {
    return this._athlete;
  }

  // ============================================
  // OAUTH FLOW
  // ============================================

  async connect(): Promise<{ success: boolean; error?: string }> {
    try {
      // Strava requires an https:// redirect URI (no custom schemes).
      // We use a Supabase Edge Function as the callback bridge:
      //   1. Strava redirects to the edge function with ?code=xxx
      //   2. The function immediately deep-links back: smartring://strava-auth?code=xxx
      //   3. iOS opens the app and openAuthSessionAsync returns the URL
      //
      // IMPORTANT: Set Strava's "Authorization Callback Domain" to:
      //   pxuemdkxdjuwxtupeqoa.supabase.co

      const callbackUri = 'https://pxuemdkxdjuwxtupeqoa.supabase.co/functions/v1/strava-callback';
      // The deep link the edge function will redirect to — watched by openAuthSessionAsync
      const returnUrl = 'smartring://strava-auth';

      const params = new URLSearchParams({
        client_id: STRAVA_CLIENT_ID || '192408',
        redirect_uri: callbackUri,
        response_type: 'code',
        approval_prompt: 'auto',
        scope: REQUIRED_SCOPES.join(','),
      });

      const authUrl = `${STRAVA_AUTH_URL}?${params.toString()}`;

      console.log('🔗 Strava OAuth Debug:');
      console.log('  Client ID:', STRAVA_CLIENT_ID || '192408');
      console.log('  Redirect URI:', callbackUri);
      console.log('  Return URL:', returnUrl);
      console.log('  Auth URL:', authUrl);

      // Open browser for OAuth
      const result = await WebBrowser.openAuthSessionAsync(authUrl, returnUrl);
      
      console.log('  Result type:', result.type);

      if (result.type === 'success' && result.url) {
        console.log('  Result URL:', result.url);
        
        // Parse the URL to extract code
        const url = new URL(result.url);
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        if (error) {
          return { success: false, error: `Strava authorization denied: ${error}` };
        }

        if (code) {
          console.log('  Got authorization code!');
          return await this.exchangeCodeForTokens(code);
        }

        return { success: false, error: 'No authorization code received' };
      }

      if (result.type === 'cancel') {
        return { success: false, error: 'Authorization cancelled by user' };
      }

      return { success: false, error: 'Authorization failed' };
    } catch (e) {
      const error = e as Error;
      console.error('Strava connect error:', error);
      return { success: false, error: error.message };
    }
  }

  async exchangeCodeForTokens(code: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(STRAVA_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: STRAVA_CLIENT_ID || '192408',
          client_secret: STRAVA_CLIENT_SECRET,
          code,
          grant_type: 'authorization_code',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return { success: false, error: errorData.message || 'Token exchange failed' };
      }

      const data: StravaTokenResponse = await response.json();

      this._tokens = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at,
        expires_in: data.expires_in,
        token_type: data.token_type,
        athlete: data.athlete,
      };

      this._athlete = data.athlete || null;
      this._isConnected = true;

      // Save tokens to database
      await this.saveTokensToDatabase();

      return { success: true };
    } catch (e) {
      const error = e as Error;
      return { success: false, error: error.message };
    }
  }

  async refreshAccessToken(): Promise<boolean> {
    if (!this._tokens?.refresh_token) {
      return false;
    }

    try {
      const response = await fetch(STRAVA_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: STRAVA_CLIENT_ID || '192408',
          client_secret: STRAVA_CLIENT_SECRET,
          refresh_token: this._tokens.refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        return false;
      }

      const data: StravaTokenResponse = await response.json();

      this._tokens = {
        ...this._tokens,
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at,
        expires_in: data.expires_in,
      };

      await this.saveTokensToDatabase();
      return true;
    } catch {
      return false;
    }
  }

  private async ensureValidToken(): Promise<boolean> {
    if (!this._tokens) {
      return false;
    }

    // Check if token is expired (with 5 minute buffer)
    const now = Math.floor(Date.now() / 1000);
    if (this._tokens.expires_at < now + 300) {
      return await this.refreshAccessToken();
    }

    return true;
  }

  // ============================================
  // DATABASE OPERATIONS
  // ============================================

  /** Get current supabase user ID — replaces stale authService.currentUser reference */
  private async getCurrentUserId(): Promise<string | undefined> {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id;
  }

  private async loadTokensFromDatabase() {
    const userId = await this.getCurrentUserId();
    if (!userId) {
      console.log('[StravaService] loadTokensFromDatabase: no authenticated user');
      return;
    }
    console.log('[StravaService] loadTokensFromDatabase: userId =', userId);

    try {
      console.log('[StravaService] Querying strava_tokens for user:', userId);
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout after 10s')), 10000)
      );
      
      const queryPromise = supabase
        .from('strava_tokens')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any;

      console.log('[StravaService] Query result - error:', error?.message, 'data:', !!data);

      if (error || !data) {
        this._isConnected = false;
        console.log('[StravaService] No tokens found, not connected');
        return;
      }

      this._tokens = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Math.floor(new Date(data.expires_at).getTime() / 1000),
        expires_in: 0,
        token_type: 'Bearer',
      };

      this._isConnected = true;
      console.log('[StravaService] Tokens loaded, connected!');

      // Try to get athlete info
      console.log('[StravaService] Getting athlete info...');
      await this.getAthlete();
      console.log('[StravaService] Athlete loaded:', this._athlete?.firstname);
    } catch (e) {
      console.error('[StravaService] Error loading tokens:', e);
      this._isConnected = false;
    }
  }

  private async saveTokensToDatabase(): Promise<boolean> {
    const userId = await this.getCurrentUserId();
    if (!userId || !this._tokens) {
      console.error('[StravaService] saveTokensToDatabase: no userId or tokens');
      return false;
    }
    console.log('[StravaService] saveTokensToDatabase: saving for userId =', userId);

    try {
      const { error } = await supabase
        .from('strava_tokens')
        .upsert({
          user_id: userId,
          access_token: this._tokens.access_token,
          refresh_token: this._tokens.refresh_token,
          expires_at: new Date(this._tokens.expires_at * 1000).toISOString(),
          athlete_id: this._athlete?.id || null,
          scope: REQUIRED_SCOPES.join(','),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (error) {
        console.error('Error saving Strava tokens:', error);
        return false;
      }

      // Also update profile with athlete ID
      if (this._athlete?.id) {
        await supabase
          .from('profiles')
          .update({ strava_athlete_id: this._athlete.id })
          .eq('id', userId);
      }

      return true;
    } catch {
      return false;
    }
  }

  // ============================================
  // API CALLS
  // ============================================

  private async apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T | null> {
    if (!(await this.ensureValidToken())) {
      console.error('Failed to ensure valid Strava token');
      return null;
    }

    try {
      const response = await fetch(`${STRAVA_API_URL}${endpoint}`, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${this._tokens!.access_token}`,
        },
      });

      if (!response.ok) {
        console.error('Strava API error:', response.status, await response.text());
        return null;
      }

      return await response.json();
    } catch (e) {
      console.error('Strava API request failed:', e);
      return null;
    }
  }

  async getAthlete(): Promise<StravaAthlete | null> {
    const data = await this.apiRequest<StravaAthlete>('/athlete');
    if (data) {
      this._athlete = data;
    }
    return data;
  }

  async getAthleteStats(): Promise<StravaActivityStats | null> {
    if (!this._athlete?.id) {
      await this.getAthlete();
    }

    if (!this._athlete?.id) {
      return null;
    }

    return await this.apiRequest<StravaActivityStats>(`/athletes/${this._athlete.id}/stats`);
  }

  async getActivities(
    page: number = 1,
    perPage: number = 30,
    after?: Date,
    before?: Date
  ): Promise<StravaActivity[]> {
    const params = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString(),
    });

    if (after) {
      params.append('after', Math.floor(after.getTime() / 1000).toString());
    }

    if (before) {
      params.append('before', Math.floor(before.getTime() / 1000).toString());
    }

    const data = await this.apiRequest<StravaActivity[]>(`/athlete/activities?${params.toString()}`);
    return data || [];
  }

  async getActivity(activityId: number): Promise<StravaActivity | null> {
    return await this.apiRequest<StravaActivity>(`/activities/${activityId}`);
  }

  // ============================================
  // SYNC TO SUPABASE
  // ============================================

  // ============================================
  // ACTIVITY DETAIL FETCH
  // ============================================

  async getActivityDetail(activityId: number): Promise<{ detail: StravaActivityDetail | null; zones: StravaHRZones | null }> {
    const [detail, zones] = await Promise.all([
      this.apiRequest<StravaActivityDetail>(`/activities/${activityId}`),
      this.apiRequest<StravaHRZones>(`/activities/${activityId}/zones`),
    ]);
    return { detail, zones };
  }

  async syncAllActivityDetails(
    userId: string,
    onProgress?: (synced: number, total: number) => void
  ): Promise<{ synced: number; failed: number }> {
    console.log('[StravaService] syncAllActivityDetails: checking for unfetched activities');
    // Find activities without detail
    const { data: pending, error } = await supabase
      .from('strava_activities')
      .select('id')
      .eq('user_id', userId)
      .is('detail_fetched_at', null)
      .order('start_date', { ascending: false });

    if (error) {
      console.error('[StravaService] syncAllActivityDetails: query error', error);
      return { synced: 0, failed: 0 };
    }
    if (!pending || pending.length === 0) {
      console.log('[StravaService] syncAllActivityDetails: all activities already have details');
      return { synced: 0, failed: 0 };
    }
    console.log('[StravaService] syncAllActivityDetails: fetching details for', pending.length, 'activities');

    let synced = 0;
    let failed = 0;
    const total = pending.length;

    for (let i = 0; i < pending.length; i++) {
      const activityId = pending[i].id;
      try {
        console.log(`[StravaService] detail fetch ${i + 1}/${total}: activity ${activityId}`);
        const { detail, zones } = await this.getActivityDetail(activityId);

        if (!detail) {
          console.warn(`[StravaService] detail fetch failed for ${activityId}`);
          failed++;
        } else {
          await supabase
            .from('strava_activities')
            .update({
              suffer_score: detail.suffer_score ?? null,
              average_cadence: detail.average_cadence ?? null,
              average_speed: detail.average_speed ?? null,
              max_speed: detail.max_speed ?? null,
              pr_count: detail.pr_count ?? null,
              elev_high: detail.elev_high ?? null,
              elev_low: detail.elev_low ?? null,
              zones_json: zones ?? null,
              splits_metric_json: detail.splits_metric ?? null,
              laps_json: detail.laps ?? null,
              best_efforts_json: detail.best_efforts ?? null,
              detail_fetched_at: new Date().toISOString(),
            } as Record<string, unknown>)
            .eq('id', activityId);
          synced++;
        }
      } catch {
        failed++;
      }

      onProgress?.(synced + failed, total);

      // Rate-limit: 1 req-pair/sec to stay under Strava's 100/15min
      if (i < pending.length - 1) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    console.log(`[StravaService] syncAllActivityDetails complete: synced=${synced} failed=${failed}`);
    return { synced, failed };
  }

  async syncActivitiesToSupabase(days: number = 60): Promise<{ success: boolean; count: number }> {
    const userId = await this.getCurrentUserId();
    if (!userId) {
      console.error('[StravaService] syncActivitiesToSupabase: no authenticated user');
      return { success: false, count: 0 };
    }

    if (!(await this.ensureValidToken())) {
      console.error('[StravaService] syncActivitiesToSupabase: no valid token');
      return { success: false, count: 0 };
    }

    console.log('[StravaService] syncActivitiesToSupabase: fetching last', days, 'days for user', userId);

    try {
      const after = new Date();
      after.setDate(after.getDate() - days);

      let allActivities: StravaActivity[] = [];
      let page = 1;
      let hasMore = true;

      // Fetch all activities (paginated)
      while (hasMore) {
        const activities = await this.getActivities(page, 100, after);
        if (activities.length === 0) {
          hasMore = false;
        } else {
          allActivities = [...allActivities, ...activities];
          page++;
          if (activities.length < 100) {
            hasMore = false;
          }
        }
      }

      console.log('[StravaService] syncActivitiesToSupabase: fetched', allActivities.length, 'activities');

      if (allActivities.length === 0) {
        return { success: true, count: 0 };
      }

      // Transform and upsert activities
      const activitiesToInsert = allActivities.map(activity => ({
        id: activity.id,
        user_id: userId,
        name: activity.name,
        sport_type: activity.sport_type,
        distance_m: activity.distance,
        moving_time_sec: activity.moving_time,
        elapsed_time_sec: activity.elapsed_time,
        total_elevation_gain_m: activity.total_elevation_gain,
        start_date: activity.start_date,
        average_heartrate: activity.average_heartrate || null,
        max_heartrate: activity.max_heartrate || null,
        calories: activity.calories || null,
        raw_data: activity as unknown as Record<string, unknown>,
      }));

      const { error } = await supabase
        .from('strava_activities')
        .upsert(activitiesToInsert, { onConflict: 'id' });

      if (error) {
        console.error('Error syncing Strava activities:', error);
        return { success: false, count: 0 };
      }

      console.log('[StravaService] syncActivitiesToSupabase: upserted', allActivities.length, 'activities');
      return { success: true, count: allActivities.length };
    } catch (e) {
      console.error('[StravaService] syncActivitiesToSupabase error:', e);
      return { success: false, count: 0 };
    }
  }

  // ============================================
  // DISCONNECT
  // ============================================

  async disconnect(): Promise<boolean> {
    const userId = await this.getCurrentUserId();
    if (!userId) {
      return false;
    }

    try {
      // Remove tokens from database
      const { error } = await supabase
        .from('strava_tokens')
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error('Error removing Strava tokens:', error);
        return false;
      }

      // Clear local state
      this._tokens = null;
      this._athlete = null;
      this._isConnected = false;

      // Update profile
      await supabase
        .from('profiles')
        .update({ strava_athlete_id: null })
        .eq('id', userId);

      return true;
    } catch {
      return false;
    }
  }

  // ============================================
  // BACKGROUND SYNC (fire-and-forget from app load)
  // ============================================

  /**
   * Load tokens + sync recent activities in one call.
   * Safe to call fire-and-forget — never throws, logs errors internally.
   * Returns quickly if user has no Strava connection.
   */
  async backgroundSync(days: number = 7): Promise<{ success: boolean; count: number }> {
    try {
      if (!this._isConnected) {
        await this.loadTokensFromDatabase();
      }
      if (!this._isConnected) {
        return { success: false, count: 0 };
      }
      return await this.syncActivitiesToSupabase(days);
    } catch (error) {
      console.log('[StravaService] backgroundSync error (non-fatal):', error);
      return { success: false, count: 0 };
    }
  }

  // ============================================
  // RELOAD (after auth state change)
  // ============================================

  async reload() {
    console.log('[StravaService] reload() called');
    await this.loadTokensFromDatabase();
    console.log('[StravaService] reload() complete');
  }
}

export const stravaService = new StravaService();
export default stravaService;

