/**
 * Types for the Baseline Mode feature.
 * New users go through a baseline period (~3 days) before
 * composite scores become meaningful.
 */

export interface MetricBaselineProgress {
  current: number;   // days with data
  required: number;  // days needed
  ready: boolean;    // current >= required
}

export interface BaselineMetrics {
  sleep: MetricBaselineProgress;
  heartRate: MetricBaselineProgress;
  hrv: MetricBaselineProgress;
  temperature: MetricBaselineProgress;
  spo2: MetricBaselineProgress;
  activity: MetricBaselineProgress;
}

export interface BaselineModeState {
  /** True when the user hasn't collected enough data for meaningful scores */
  isInBaselineMode: boolean;
  /** 0.0 – 1.0 overall progress across all gating metrics */
  overallProgress: number;
  /** Per-metric progress */
  metrics: BaselineMetrics;
  /** Total days with any data */
  daysWithData: number;
  /** ISO date when baseline was completed (null if still in progress) */
  baselineCompletedAt: string | null;
  /** True when sleep + HR + HRV each have >= 3 days */
  canShowScores: boolean;
}
