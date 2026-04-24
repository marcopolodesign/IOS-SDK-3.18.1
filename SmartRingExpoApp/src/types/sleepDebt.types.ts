export type SleepDebtCategory = 'none' | 'low' | 'moderate' | 'high';

export interface DailyDeficit {
  date: string;
  actualMin: number;
  targetMin: number;
  deficitMin: number;
}

export interface NightlyPoint {
  date: string;
  actualMin: number;
  targetMin: number;
  deficitMin: number;
  /** 7-day trailing window sum of deficits ending on this night. */
  runningDebtMin: number;
  /** Recommended sleep for this night = target + min(90, priorDebt/3), based on debt entering that night. */
  recommendedMin: number;
}

export interface TonightRecommendation {
  recommendedMin: number;
  extraPerNight: number;
  rationaleKey: string;
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
  last30?: NightlyPoint[];
  last7?: NightlyPoint[];
  tonight?: TonightRecommendation;
}
