export type SyncPhase = 'idle' | 'connecting' | 'connected' | 'syncing' | 'complete';
export type MetricKey = 'sleep' | 'battery' | 'heartRate' | 'hrv' | 'steps' | 'vitals' | 'cloud';
export type MetricStatus = 'pending' | 'loading' | 'done' | 'error';

export interface MetricSyncState {
  key: MetricKey;
  label: string;
  status: MetricStatus;
}

export interface SyncProgressState {
  phase: SyncPhase;
  metrics: MetricSyncState[];
  /** Only true on cold-start when ring was not already connected — controls whether SyncStatusSheet opens */
  showSheet: boolean;
}
