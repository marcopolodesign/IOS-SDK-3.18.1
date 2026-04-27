export function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((sum, v) => sum + (v - m) ** 2, 0) / arr.length);
}

/** Returns ±1σ band around the mean, or null if fewer than 3 samples (still calibrating). */
export function bandFromBaseline(arr: number[]): { min: number; max: number; mean: number } | null {
  if (arr.length < 3) return null;
  const m = mean(arr);
  const s = stdDev(arr);
  return { mean: m, min: m - s, max: m + s };
}

/**
 * Compares the avg of the most-recent `recentCount` values vs the rest.
 * Input must be ordered most-recent-first (index 0 = today).
 * Returns 'stable' if fewer than recentCount+1 valid values exist.
 */
export function trendDirection(
  values: number[],
  recentCount = 3,
): 'up' | 'down' | 'stable' {
  const valid = values.filter(v => v > 0);
  if (valid.length < recentCount + 1) return 'stable';
  const recent = mean(valid.slice(0, recentCount));
  const older = mean(valid.slice(recentCount));
  const ratio = (recent - older) / (older || 1);
  if (ratio > 0.05) return 'up';
  if (ratio < -0.05) return 'down';
  return 'stable';
}
