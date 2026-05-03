// Focus screen types -- readiness, illness watch, last run context

export type ReadinessRecommendation = 'GO' | 'EASY' | 'REST';

// ─── Unified per-day metric value ─────────────────────────────────────────────

/** A single metric's raw reading, 0-100 score, baseline context, and deviation label. */
export interface DayMetricValue {
  raw: number | null;              // bpm, ms, minutes, /min, etc. — null when ring didn't provide it
  score: number | null;            // 0-100 component score (null when raw is null)
  baselineMedian: number | null;   // personal baseline median (null < 3 days of history)
  deviationLabel: string | null;   // e.g. "+3 bpm vs norm", "Within norm"
}

/** All metrics for a single day — single source of truth consumed by every screen. */
export interface DayMetrics {
  dateKey: string;                   // YYYY-MM-DD
  readiness: ReadinessScore | null;  // includes score, components, recommendation, confidence
  restingHR: DayMetricValue;
  hrv: DayMetricValue;
  sleepScore: DayMetricValue;
  sleepMinutes: DayMetricValue;
  respiratoryRate: DayMetricValue;
  temperature: DayMetricValue;
  spo2Min: DayMetricValue;
  isToday: boolean;
  source: 'ring' | 'supabase' | 'mixed';
}

export interface ReadinessComponents {
  hrv: number | null;      // 0-100 component score
  sleep: number | null;
  restingHR: number | null;
  trainingLoad: number | null;
}

export interface ReadinessScore {
  score: number;                          // 0-100
  recommendation: ReadinessRecommendation;
  components: ReadinessComponents;
  confidence: 'high' | 'medium' | 'low'; // based on daysLogged
  computedAt: string;                     // ISO date string
}

export type IllnessStatus = 'PEAK' | 'CLEAR' | 'WATCH' | 'SICK';

export interface IllnessSignals {
  tempDeviation: boolean;
  restingHRElevated: boolean;   // nocturnal HR elevated vs 14-day baseline
  hrvSuppressed: boolean;
  spo2Low: boolean;             // replaces respiratoryRateElevated (never available from ring)
  sleepFragmented: boolean;
}

export interface IllnessWatchDetails {
  hrvDelta: string | null;    // e.g. "−22%"
  hrDelta: string | null;     // e.g. "+19 bpm"
  tempDelta: string | null;   // e.g. "+0.8°C"
  spo2Delta: string | null;   // e.g. "Min 89%"
  sleepDelta: string | null;  // e.g. "59 min awake"
}

export interface IllnessWatch {
  status: IllnessStatus;
  score: number;              // 0–100 continuous score (0 = healthy)
  signals: IllnessSignals;
  summary: string;
  details: IllnessWatchDetails;
  stale?: boolean;            // true when last ring sync was >48h ago
  computedAt?: string;        // ISO timestamp from server computation
}

export type EffortVerdict = 'as_expected' | 'harder_than_expected' | 'easier_than_expected';

export interface LastRunContext {
  stravaActivityId: number;
  runName: string;
  runDate: string;        // ISO date string
  distanceKm: number;
  paceMinsPerKm: number;
  avgHR: number;
  expectedHR: number;
  hrRangeLow: number;
  hrRangeHigh: number;
  effortVerdict: EffortVerdict;
  explanation: string;
  bodyStateAtRun: {
    readinessScore: number | null;
    sleepMinutes: number | null;  // sleep_score is never stored; use total minutes instead
    hrvVsNorm: 'above' | 'below' | 'normal' | null;
  };
}

export interface FocusBaselines {
  hrv: number[];
  restingHR: number[];
  temperature: number[];
  sleepScore: number[];
  sleepMinutes: number[];
  respiratoryRate: number[];
  // Extended for server-side illness score (also kept client-side as fallback)
  spo2Min: number[];
  sleepAwakeMin: number[];
  nocturnalHR: number[];
  updatedAt: string | null;  // ISO date string (YYYY-MM-DD)
  daysLogged: number;
}

export interface FocusState {
  readiness: ReadinessScore | null;
  illness: IllnessWatch | null;
  lastRun: LastRunContext | null;
  isLoading: boolean;
  error: string | null;
  baselines: FocusBaselines | null;
  refresh: () => void;
}

export type CoachMode = 'coach' | 'analyst';
