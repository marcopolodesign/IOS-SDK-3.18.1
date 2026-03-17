export type SleepDebtCategory = 'none' | 'low' | 'moderate' | 'high';

export interface DailyDeficit {
  date: string;
  actualMin: number;
  targetMin: number;
  deficitMin: number;
}

export interface SleepDebtState {
  totalDebtMin: number;
  averageSleepMin: number;
  category: SleepDebtCategory;
  dailyDeficits: DailyDeficit[];
  targetMin: number;
  daysWithData: number;
  isReady: boolean;
  recoverySuggestionKey: string | null;
}
