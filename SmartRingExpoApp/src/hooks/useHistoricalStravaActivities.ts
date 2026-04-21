import { useEffect, useRef, useState } from 'react';
import { supabase } from '../services/SupabaseService';
import { stravaToUnified } from '../services/ActivityDeduplicator';
import type { UnifiedActivity } from '../types/activity.types';

// Returns Strava activities from the past 30 days, keyed by local 'YYYY-MM-DD'.
export function useHistoricalStravaActivities(): Map<string, UnifiedActivity[]> {
  const [byDay, setByDay] = useState<Map<string, UnifiedActivity[]>>(new Map());
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const since = new Date();
      since.setDate(since.getDate() - 30);

      const { data, error } = await supabase
        .from('strava_activities')
        .select('id, name, sport_type, start_date, distance_m, moving_time_sec, average_heartrate, max_heartrate, suffer_score, calories, splits_metric_json, zones_json')
        .eq('user_id', user.id)
        .gte('start_date', since.toISOString())
        .order('start_date', { ascending: false });

      if (error || !data) return;

      const map = new Map<string, UnifiedActivity[]>();
      for (const row of data) {
        const unified = stravaToUnified(row as any);
        const dayKey = unified.startDate.slice(0, 10);
        const existing = map.get(dayKey) ?? [];
        existing.push(unified);
        map.set(dayKey, existing);
      }
      setByDay(map);
    })();
  }, []);

  return byDay;
}
