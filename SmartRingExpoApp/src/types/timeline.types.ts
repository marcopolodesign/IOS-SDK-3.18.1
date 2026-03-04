export type RecoverySubtype = 'sauna' | 'ice_bath' | 'compression_boots' | 'other';
export type MealSubtype = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface TimelineEntry {
  id: string;                           // uuid
  date: string;                         // YYYY-MM-DD (which day it belongs to)
  type: 'recovery' | 'meal' | 'manual_activity';
  subtype: RecoverySubtype | MealSubtype | string;
  title: string;
  startTime: number;                    // ms epoch
  endTime?: number;                     // ms epoch (optional)
  notes?: string;
}
