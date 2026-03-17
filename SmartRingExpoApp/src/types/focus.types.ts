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

export interface IllnessWatch {
  status: IllnessStatus;
  signals: IllnessSignals;
  summary: string;
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
    sleepScore: number | null;
    hrvVsNorm: 'above' | 'below' | 'normal' | null;
  };
}

export interface FocusBaselines {
  hrv: number[];
  restingHR: number[];
  temperature: number[];
  sleepScore: number[];
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
