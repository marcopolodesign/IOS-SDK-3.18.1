import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'sleep_time_override_v1';

export interface SleepTimeOverride {
  bedTime: string;
  wakeTime: string;
}

type Store = Record<string, SleepTimeOverride>;

function dateKey(date?: Date): string {
  const d = date ?? new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function getStore(): Promise<Store> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : {};
}

export async function getSleepOverride(date?: Date): Promise<SleepTimeOverride | null> {
  const store = await getStore();
  return store[dateKey(date)] ?? null;
}

export async function setSleepOverride(bedTime: Date, wakeTime: Date, date?: Date): Promise<void> {
  const store = await getStore();
  store[dateKey(date)] = { bedTime: bedTime.toISOString(), wakeTime: wakeTime.toISOString() };
  await AsyncStorage.setItem(KEY, JSON.stringify(store));
}

export async function clearSleepOverride(date?: Date): Promise<void> {
  const store = await getStore();
  delete store[dateKey(date)];
  await AsyncStorage.setItem(KEY, JSON.stringify(store));
}
