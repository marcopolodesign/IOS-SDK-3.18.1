// Focus screen types -- readiness, illness watch, last run context

export type ReadinessRecommendation = 'GO' | 'EASY' | 'REST';

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

export type IllnessStatus = 'CLEAR' | 'WATCH' | 'SICK';

export interface IllnessSignals {
  tempDeviation: boolean;
  restingHRElevated: boolean;
  hrvSuppressed: boolean;
  respiratoryRateElevated: boolean;
  sleepFragmented: boolean;
}

export interface IllnessWatchDetails {
  hrvDelta: string | null;   // e.g. "−22%" (negative = suppressed)
  hrDelta: string | null;    // e.g. "+7 bpm"
  tempDelta: string | null;  // e.g. "+0.8°C"
}

export interface IllnessWatch {
  status: IllnessStatus;
  signals: IllnessSignals;
  summary: string;
  details: IllnessWatchDetails;
}

export type EffortVerdict = 'as_expected' | 'harder_than_expected' | 'easier_than_expected';

export interface LastRunContext {
  runName: string;
  runDate: string;        // ISO date string
  distanceKm: number;
  paceMinsPerKm: number;
  avgHR: number;
  expectedHR: number;
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
