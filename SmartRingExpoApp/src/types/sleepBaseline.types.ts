export type SleepBaselineTier = 'low' | 'developing' | 'good' | 'optimal';

export interface SleepBaselineState {
  tier: SleepBaselineTier;
  averageScore: number;
  daysInBaseline: number;
  nextTierThreshold: number | null;  // null if already optimal
  pointsToNextTier: number | null;
  advancementTipKey: string | null;  // i18n key
}
