/**
 * Time-series helpers over daily points. Points are assumed sorted by date ascending
 * with at most one point per date (callers aggregate first).
 */
import { addDays, diffDays, type ISODate } from "../dates";

export type Point = { date: ISODate; value: number };

export function sortPoints<T extends { date: ISODate }>(points: readonly T[]): T[] {
  return [...points].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Mean of point values whose date falls in [start, end]; null if none. */
export function meanInRange(points: readonly Point[], start: ISODate, end: ISODate): number | null {
  let total = 0;
  let n = 0;
  for (const p of points) {
    if (p.date >= start && p.date <= end) {
      total += p.value;
      n += 1;
    }
  }
  return n ? total / n : null;
}

export function countInRange(points: readonly { date: ISODate }[], start: ISODate, end: ISODate): number {
  let n = 0;
  for (const p of points) if (p.date >= start && p.date <= end) n += 1;
  return n;
}

/** Trailing calendar-window mean ending at `end` (inclusive), e.g. the 7-day average. */
export function trailingMean(points: readonly Point[], end: ISODate, windowDays: number): number | null {
  return meanInRange(points, addDays(end, -(windowDays - 1)), end);
}

/**
 * For each point, the mean of all points within the preceding `windowDays` calendar days
 * (inclusive). Robust to missing days — a 7-day average with 3 weigh-ins uses those 3.
 */
export function rollingMean(points: readonly Point[], windowDays: number): Point[] {
  const out: Point[] = [];
  let startIdx = 0;
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    total += points[i].value;
    const windowStart = addDays(points[i].date, -(windowDays - 1));
    while (points[startIdx].date < windowStart) {
      total -= points[startIdx].value;
      startIdx += 1;
    }
    out.push({ date: points[i].date, value: total / (i - startIdx + 1) });
  }
  return out;
}

/**
 * Exponentially-weighted trend (Hacker's Diet style). Each new observation moves the
 * trend by `alpha` of the gap; days without data simply carry the trend.
 */
export function ewmaTrend(points: readonly Point[], alpha = 0.1): Point[] {
  const out: Point[] = [];
  let trend: number | null = null;
  for (const p of points) {
    trend = trend == null ? p.value : trend + alpha * (p.value - trend);
    out.push({ date: p.date, value: trend });
  }
  return out;
}

export type Regression = {
  /** Change in value per day. */
  slopePerDay: number;
  /** Fitted value at `origin`. */
  intercept: number;
  origin: ISODate;
  /** Standard error of the slope (per day). */
  slopeStdErr: number;
  /** Residual standard deviation. */
  residualSd: number;
  r2: number;
  n: number;
  spanDays: number;
};

/** Ordinary least squares of value against days since `origin` (defaults to first point). */
export function linearRegression(points: readonly Point[], origin?: ISODate): Regression | null {
  const n = points.length;
  if (n < 3) return null;
  const o = origin ?? points[0].date;
  const xs = points.map((p) => diffDays(p.date, o));
  const ys = points.map((p) => p.value);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  let sse = 0;
  for (let i = 0; i < n; i++) {
    const r = ys[i] - (intercept + slope * xs[i]);
    sse += r * r;
  }
  const residualVar = sse / (n - 2);
  return {
    slopePerDay: slope,
    intercept,
    origin: o,
    slopeStdErr: Math.sqrt(residualVar / sxx),
    residualSd: Math.sqrt(residualVar),
    r2: syy === 0 ? 1 : 1 - sse / syy,
    n,
    spanDays: xs[n - 1] - xs[0],
  };
}

/** Value of a regression line at a date. */
export function regressionAt(reg: Regression, date: ISODate): number {
  return reg.intercept + reg.slopePerDay * diffDays(date, reg.origin);
}

export function standardDeviation(values: readonly number[]): number | null {
  if (values.length < 2) return null;
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  const v = values.reduce((a, b) => a + (b - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(v);
}

/** Coefficient of variation (sd / mean). */
export function coefficientOfVariation(values: readonly number[]): number | null {
  const sd = standardDeviation(values);
  if (sd == null) return null;
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  return m === 0 ? null : sd / Math.abs(m);
}

export function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Points restricted to [start, end]. */
export function inRange<T extends { date: ISODate }>(points: readonly T[], start: ISODate, end: ISODate): T[] {
  return points.filter((p) => p.date >= start && p.date <= end);
}
