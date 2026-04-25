export const ABSORPTION_H = 0.75;  // 45 min linear ramp to peak
export const HALF_LIFE_H  = 5;     // hours
export const SLEEP_THRESHOLD_MG = 100; // max mg compatible with sleep onset
export const MAX_CAFFEINE_MG     = 400; // daily tolerance ceiling shown in charts

export interface CaffeineDose {
  intakeHour: number;  // decimal hours from midnight, e.g. 8.5 = 8:30 AM
  amountMg: number;
}

export function doseMgAt(h: number, dose: CaffeineDose): number {
  if (h <= dose.intakeHour) return 0;
  const peak = dose.intakeHour + ABSORPTION_H;
  if (h < peak) return dose.amountMg * (h - dose.intakeHour) / ABSORPTION_H;
  return dose.amountMg * Math.pow(0.5, (h - peak) / HALF_LIFE_H);
}

export function totalMgAt(h: number, doses: CaffeineDose[]): number {
  return doses.reduce((sum, d) => sum + doseMgAt(h, d), 0);
}

export function clearanceHour(
  doses: CaffeineDose[],
  threshold = SLEEP_THRESHOLD_MG,
  endHour = 26,
): number | null {
  if (doses.length === 0) return null;
  const latestIntake = Math.max(...doses.map(d => d.intakeHour));
  for (let h = latestIntake + ABSORPTION_H; h <= endHour; h += 0.1) {
    if (totalMgAt(h, doses) < threshold) return h;
  }
  return null;
}

// Huberman protocol: delay caffeine 2h after waking (cortisol peak clears naturally);
// stop 8h before bed (5h half-life → ~25 mg remaining at bedtime, well below threshold).
export function recommendedWindow(
  wakeHour: number,
  bedHour: number = 23,
): { start: number; end: number } {
  const start = Math.max(wakeHour + 2, 6);    // 2h post-wake delay
  const end   = Math.max(start, bedHour - 8); // 8h before bed
  return { start, end };
}

export function buildMultiDoseCurvePath(
  doses: CaffeineDose[],
  innerW: number,
  chartPadL: number,
  timeStart: number,
  timeEnd: number,
  curveTopY: number,
  curveBotY: number,
  yScaleMg = 400,
): string {
  const timeSpan = timeEnd - timeStart;
  const pts: string[] = [];
  for (let t = timeStart; t <= timeEnd + 0.05; t += 0.12) {
    const tc  = Math.min(t, timeEnd);
    const mg  = totalMgAt(tc, doses);
    const conc = Math.min(mg / yScaleMg, 1);
    const x   = (chartPadL + ((tc - timeStart) / timeSpan) * innerW).toFixed(1);
    const y   = (curveTopY + (1 - conc) * (curveBotY - curveTopY)).toFixed(1);
    pts.push(pts.length === 0 ? `M${x},${y}` : `L${x},${y}`);
  }
  return pts.join(' ');
}

// Samples the total mg curve across the day and returns the peak value.
// Used to set a dynamic Y-axis scale so the curve always reaches the top of the chart.
export function peakMgForDoses(
  doses: CaffeineDose[],
  timeStart = 6,
  timeEnd = 23,
): number {
  if (doses.length === 0) return 0;
  let peak = 0;
  for (let h = timeStart; h <= timeEnd; h += 0.1) {
    peak = Math.max(peak, totalMgAt(h, doses));
  }
  return peak;
}

// Default predicted dose used as a baseline curve even before any drinks are logged.
// Represents the expected morning coffee taken at wake + 90 min.
export const DEFAULT_DOSE_MG = 95;

// Returns logged doses with a predicted baseline prepended (wake+90 min, 95 mg).
// Chart always shows this so the curve is never empty; logged drinks stack on top.
export function withDefaultDose(
  loggedDoses: CaffeineDose[],
  wakeHour: number,
): CaffeineDose[] {
  const defaultIntakeHour = Math.max(wakeHour + 1.5, 6.5); // clamp to at least 6:30 AM
  return [{ intakeHour: defaultIntakeHour, amountMg: DEFAULT_DOSE_MG }, ...loggedDoses];
}

// Preset drinks with default caffeine content
export const CAFFEINE_PRESETS = [
  { key: 'espresso',     emoji: '☕', defaultMg: 63  },
  { key: 'coffee',       emoji: '☕', defaultMg: 95  },
  { key: 'flat_white',   emoji: '☕', defaultMg: 130 },
  { key: 'black_tea',    emoji: '🍵', defaultMg: 47  },
  { key: 'green_tea',    emoji: '🍵', defaultMg: 30  },
  { key: 'matcha',       emoji: '🍵', defaultMg: 70  },
  { key: 'energy_drink', emoji: '⚡', defaultMg: 80  },
  { key: 'soda',         emoji: '🥤', defaultMg: 35  },
  { key: 'custom',       emoji: '✏️', defaultMg: 100 },
] as const;

export type DrinkPresetKey = typeof CAFFEINE_PRESETS[number]['key'];
