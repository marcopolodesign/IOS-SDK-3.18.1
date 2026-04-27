import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/SupabaseService';

let _subCounter = 0;
import supabaseService from '../services/SupabaseService';
import { reportError } from '../utils/sentry';
import {
  CaffeineDose,
  totalMgAt,
  clearanceHour as computeClearanceHour,
} from '../utils/caffeinePk';
import type { Database } from '../types/supabase.types';

type DrinkRow = Database['public']['Tables']['caffeinated_drinks']['Row'];

function startOfDay(d: Date): Date {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
}

function endOfDay(d: Date): Date {
  const e = new Date(d);
  e.setHours(23, 59, 59, 999);
  return e;
}

function rowToDecimalHour(isoString: string): number {
  const d = new Date(isoString);
  return d.getHours() + d.getMinutes() / 60;
}

export interface UseCaffeineTimeline {
  entries: DrinkRow[];
  doses: CaffeineDose[];
  currentMg: number;
  totalMgToday: number;
  peakMgToday: number;
  clearanceHour: number | null;
  isLoading: boolean;
  addDrink: (drink: {
    drink_type: string;
    name?: string | null;
    caffeine_mg: number;
    consumed_at: string;
  }) => Promise<void>;
  deleteDrink: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useCaffeineTimeline(date: Date = new Date()): UseCaffeineTimeline {
  const channelId = useRef(`caffeine-drinks-${++_subCounter}`);
  const [entries, setEntries] = useState<DrinkRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const rows = await supabaseService.getCaffeineEntriesForRange(
        startOfDay(date).toISOString(),
        endOfDay(date).toISOString(),
      );
      setEntries(rows);
    } catch (e) {
      reportError(e, { op: 'caffeineTimeline.load' });
    } finally {
      setIsLoading(false);
    }
  }, [date.toDateString()]);

  useEffect(() => {
    load();
  }, [load]);

  // Supabase Realtime — bust cache on any caffeinated_drinks change
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled || !user) return;
      channel = supabase
        .channel(channelId.current)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'caffeinated_drinks',
            filter: `user_id=eq.${user.id}`,
          },
          () => { load(); },
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [load]);

  const doses: CaffeineDose[] = entries.map(e => ({
    intakeHour: rowToDecimalHour(e.consumed_at),
    amountMg: e.caffeine_mg,
  }));

  const now = new Date();
  const nowHour = now.getHours() + now.getMinutes() / 60;
  const currentMg = Math.round(totalMgAt(nowHour, doses));

  // Peak: sample every 15 min from first dose to now
  let peakMgToday = 0;
  if (doses.length > 0) {
    const earliest = Math.min(...doses.map(d => d.intakeHour));
    for (let h = earliest; h <= nowHour; h += 0.25) {
      peakMgToday = Math.max(peakMgToday, totalMgAt(h, doses));
    }
    peakMgToday = Math.round(peakMgToday);
  }

  const totalMgToday = Math.round(entries.reduce((s, e) => s + e.caffeine_mg, 0));
  const clearHour = computeClearanceHour(doses);

  const addDrink = useCallback(async (drink: {
    drink_type: string;
    name?: string | null;
    caffeine_mg: number;
    consumed_at: string;
  }) => {
    await supabaseService.insertCaffeineEntry(drink);
    // Realtime fires load(); but also eager-reload as a safety net
    await load();
  }, [load]);

  const deleteDrink = useCallback(async (id: string) => {
    await supabaseService.deleteCaffeineEntry(id);
    await load();
  }, [load]);

  return {
    entries,
    doses,
    currentMg,
    totalMgToday,
    peakMgToday,
    clearanceHour: clearHour,
    isLoading,
    addDrink,
    deleteDrink,
    refresh: load,
  };
}
