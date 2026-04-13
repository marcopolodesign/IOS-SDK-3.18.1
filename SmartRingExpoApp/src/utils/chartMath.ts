/**
 * Shared SVG chart math utilities used across detail page trend charts.
 */

/** Parse a YYYY-MM-DD date string as a local midnight Date (avoids UTC offset shifting the day). */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** SVG path for a rect with independent top and bottom corner radii. */
export function roundedBar(
  x: number,
  y: number,
  w: number,
  h: number,
  rTop: number,
  rBot: number,
): string {
  const rt = Math.min(rTop, h / 2, w / 2);
  const rb = Math.min(rBot, h / 2, w / 2);
  return [
    `M ${x + rt} ${y}`,
    `H ${x + w - rt}`,
    `Q ${x + w} ${y} ${x + w} ${y + rt}`,
    `V ${y + h - rb}`,
    `Q ${x + w} ${y + h} ${x + w - rb} ${y + h}`,
    `H ${x + rb}`,
    `Q ${x} ${y + h} ${x} ${y + h - rb}`,
    `V ${y + rt}`,
    `Q ${x} ${y} ${x + rt} ${y}`,
    `Z`,
  ].join(' ');
}

/** 5-day centered rolling average. Skips zero values. Returns null if no valid values in window. */
export function rollingAvg(values: number[], i: number, window = 5): number | null {
  const half = Math.floor(window / 2);
  const from = Math.max(0, i - half);
  const to = Math.min(values.length - 1, i + half);
  const valid = values.slice(from, to + 1).filter(v => v > 0);
  return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
}

/** Fritsch-Carlson monotone cubic spline path through the given points. */
export function monotoneCubicPath(pts: Array<{ x: number; y: number }>): string {
  if (pts.length < 2) return '';
  const n = pts.length;
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    d.push((pts[i + 1].y - pts[i].y) / (pts[i + 1].x - pts[i].x));
  }
  const m: number[] = new Array(n).fill(0);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  }
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const alpha = m[i] / d[i];
    const beta = m[i + 1] / d[i];
    const r = alpha * alpha + beta * beta;
    if (r > 9) {
      const t = 3 / Math.sqrt(r);
      m[i] = t * alpha * d[i];
      m[i + 1] = t * beta * d[i];
    }
  }
  let path = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const dx = (pts[i + 1].x - pts[i].x) / 3;
    path += ` C ${pts[i].x + dx} ${pts[i].y + m[i] * dx} ${pts[i + 1].x - dx} ${pts[i + 1].y - m[i + 1] * dx} ${pts[i + 1].x} ${pts[i + 1].y}`;
  }
  return path;
}
