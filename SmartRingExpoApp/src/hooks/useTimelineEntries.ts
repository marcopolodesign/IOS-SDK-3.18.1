import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TimelineEntry } from '../types/timeline.types';

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function todayDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function storageKey(date: string): string {
  return `timeline_entries_${date}`;
}

export function useTimelineEntries(date?: string) {
  const targetDate = date ?? todayDateString();
  const [entries, setEntries] = useState<TimelineEntry[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(storageKey(targetDate)).then((raw) => {
      if (raw) {
        try {
          setEntries(JSON.parse(raw));
        } catch {
          setEntries([]);
        }
      }
    });
  }, [targetDate]);

  const addEntry = useCallback(
    async (entry: Omit<TimelineEntry, 'id'>) => {
      const newEntry: TimelineEntry = { ...entry, id: generateId() };
      setEntries((prev) => {
        const updated = [...prev, newEntry].sort((a, b) => a.startTime - b.startTime);
        AsyncStorage.setItem(storageKey(targetDate), JSON.stringify(updated));
        return updated;
      });
    },
    [targetDate]
  );

  const removeEntry = useCallback(
    async (id: string) => {
      setEntries((prev) => {
        const updated = prev.filter((e) => e.id !== id);
        AsyncStorage.setItem(storageKey(targetDate), JSON.stringify(updated));
        return updated;
      });
    },
    [targetDate]
  );

  return { entries, addEntry, removeEntry };
}
