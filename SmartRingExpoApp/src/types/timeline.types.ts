export type RecoverySubtype = 'sauna' | 'ice_bath' | 'compression_boots' | 'other';

export interface TimelineEntry {
  id: string;                           // uuid
  date: string;                         // YYYY-MM-DD (which day it belongs to)
  type: 'recovery' | 'manual_activity';
  subtype: RecoverySubtype | string;
  title: string;
  startTime: number;                    // ms epoch
  endTime?: number;                     // ms epoch (optional)
  notes?: string;
}
