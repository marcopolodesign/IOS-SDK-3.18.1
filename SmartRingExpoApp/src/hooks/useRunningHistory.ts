import { useEffect, useRef, useState } from 'react';
import { supabase } from '../services/SupabaseService';

const RUN_SPORT_TYPES = ['Run', 'TrailRun', 'VirtualRun', 'Treadmill'];

export interface WeekRunData {
  weekKey: string;   // Monday YYYY-MM-DD
  totalKm: number;
  runCount: number;
  totalTimeSec: number;
  longestRunKm: number;
}

export interface RunningHistoryResult {
  weeks: WeekRunData[];          // most-recent-first, always 8 entries
  isLoading: boolean;
  hasData: boolean;
  avgPaceMinPerKm: number | null;
  longestRunKm: number;
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function getMondayKey(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return toDateStr(d);
}

function buildWeekLabels(count = 8): string[] {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() + diff);
  thisMonday.setHours(0, 0, 0, 0);

  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    const monday = new Date(thisMonday);
    monday.setDate(thisMonday.getDate() - i * 7);
    result.push(toDateStr(monday));
  }
  return result; // most-recent-first
}

export function useRunningHistory(weeks = 8): RunningHistoryResult {
  const [result, setResult] = useState<RunningHistoryResult>({
    weeks: [],
    isLoading: true,
    hasData: false,
    avgPaceMinPerKm: null,
    longestRunKm: 0,
  });
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setResult(r => ({ ...r, isLoading: false }));
        return;
      }

      const since = new Date();
      since.setDate(since.getDate() - weeks * 7);

      const { data: rawData, error } = await supabase
        .from('strava_activities')
        .select('sport_type, start_date, distance_m, moving_time_sec')
        .eq('user_id', user.id)
        .gte('start_date', since.toISOString())
        .order('start_date', { ascending: true });

      const data = (rawData as Array<{
        sport_type: string | null;
        start_date: string | null;
        distance_m: number | null;
        moving_time_sec: number | null;
      }> | null)?.filter(r => r.sport_type && RUN_SPORT_TYPES.includes(r.sport_type));

      if (error || !data) {
        setResult(r => ({ ...r, isLoading: false }));
        return;
      }

      const weekKeys = buildWeekLabels(weeks); // most-recent-first
      const weekMap = new Map<string, WeekRunData>(
        weekKeys.map(k => [k, { weekKey: k, totalKm: 0, runCount: 0, totalTimeSec: 0, longestRunKm: 0 }])
      );

      let totalDistM = 0;
      let totalTimeSec = 0;
      let longestRunKm = 0;

      for (const row of data) {
        if (!row.start_date || !row.distance_m) continue;
        const wk = getMondayKey(row.start_date);
        const entry = weekMap.get(wk);
        const km = (row.distance_m ?? 0) / 1000;
        if (entry) {
          entry.totalKm += km;
          entry.runCount += 1;
          entry.totalTimeSec += row.moving_time_sec ?? 0;
          entry.longestRunKm = Math.max(entry.longestRunKm, km);
        }
        totalDistM += row.distance_m ?? 0;
        totalTimeSec += row.moving_time_sec ?? 0;
        longestRunKm = Math.max(longestRunKm, km);
      }

      const avgPace = totalDistM > 0 && totalTimeSec > 0
        ? (totalTimeSec / 60) / (totalDistM / 1000)
        : null;

      setResult({
        weeks: weekKeys.map(k => weekMap.get(k)!),
        isLoading: false,
        hasData: data.length > 0,
        avgPaceMinPerKm: avgPace,
        longestRunKm,
      });
    })();
  }, [weeks]);

  return result;
}
