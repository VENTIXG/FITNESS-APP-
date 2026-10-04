/**
 * Weight analytics. Daily weigh-ins are noisy (water, glycogen, sodium), so the app
 * leads with rolling averages and regression-based rates rather than day-to-day deltas.
 */
import { addDays, diffDays, type ISODate } from "../dates";
import { linearRegression, meanInRange, regressionAt, sortPoints, trailingMean, type Point } from "./series";

export type WeightPoint = { date: ISODate; weightKg: number };

export type WeightTrend = "down" | "up" | "stable";

export type WeightStats = {
  latest: WeightPoint | null;
  previous: WeightPoint | null;
  /** latest − previous entry */
  changeFromPrevious: number | null;
  avg7: number | null;
  avg14: number | null;
  avg30: number | null;
  /** 7-day average one week earlier (days 7–13 before asOf). */
  avg7PrevWeek: number | null;
  /** avg7 − avg7PrevWeek */
  weeklyChange: number | null;
  /** avg7 − the 7-day average ending 30 days earlier. */
  monthlyChange: number | null;
  /** Latest 7-day average minus the first recorded weight (or `startWeightKg`). */
  totalChange: number | null;
  /** Regression rate over the last 28 days (kg/week), needs ≥ 6 weigh-ins over ≥ 10 days. */
  ratePerWeek: number | null;
  ratePerWeekStdErr: number | null;
  trend: WeightTrend | null;
  /** Best available "current" weight: 7-day average, else latest entry. */
  current: number | null;
  entriesLast30: number;
};

/** Below this absolute rate (kg/week) the trend is reported as stable. */
export const STABLE_RATE_KG_PER_WEEK = 0.1;

export function toPoints(entries: readonly WeightPoint[]): Point[] {
  return sortPoints(entries).map((e) => ({ date: e.date, value: e.weightKg }));
}

export function weightRate(points: readonly Point[], asOf: ISODate, windowDays = 28) {
  const start = addDays(asOf, -(windowDays - 1));
  const window = points.filter((p) => p.date >= start && p.date <= asOf);
  if (window.length < 6) return null;
  const reg = linearRegression(window);
  if (!reg || reg.spanDays < 10) return null;
  return { perWeek: reg.slopePerDay * 7, stdErrPerWeek: reg.slopeStdErr * 7, regression: reg };
}

export function classifyTrend(ratePerWeek: number | null): WeightTrend | null {
  if (ratePerWeek == null) return null;
  if (ratePerWeek <= -STABLE_RATE_KG_PER_WEEK) return "down";
  if (ratePerWeek >= STABLE_RATE_KG_PER_WEEK) return "up";
  return "stable";
}

export function computeWeightStats(entries: readonly WeightPoint[], asOf: ISODate, startWeightKg?: number | null): WeightStats {
  const sorted = sortPoints(entries).filter((e) => e.date <= asOf);
  const points = sorted.map((e) => ({ date: e.date, value: e.weightKg }));
  const latest = sorted.at(-1) ?? null;
  const previous = sorted.length > 1 ? sorted[sorted.length - 2] : null;

  const avg7 = trailingMean(points, asOf, 7);
  const avg14 = trailingMean(points, asOf, 14);
  const avg30 = trailingMean(points, asOf, 30);
  const avg7PrevWeek = meanInRange(points, addDays(asOf, -13), addDays(asOf, -7));
  const avg7MonthAgo = meanInRange(points, addDays(asOf, -36), addDays(asOf, -30));
  const rate = weightRate(points, asOf);

  const current = avg7 ?? latest?.weightKg ?? null;
  const reference = startWeightKg ?? sorted[0]?.weightKg ?? null;

  return {
    latest,
    previous,
    changeFromPrevious: latest && previous ? latest.weightKg - previous.weightKg : null,
    avg7,
    avg14,
    avg30,
    avg7PrevWeek,
    weeklyChange: avg7 != null && avg7PrevWeek != null ? avg7 - avg7PrevWeek : null,
    monthlyChange: avg7 != null && avg7MonthAgo != null ? avg7 - avg7MonthAgo : null,
    totalChange: current != null && reference != null ? current - reference : null,
    ratePerWeek: rate?.perWeek ?? null,
    ratePerWeekStdErr: rate?.stdErrPerWeek ?? null,
    trend: classifyTrend(rate?.perWeek ?? null),
    current,
    entriesLast30: points.filter((p) => p.date > addDays(asOf, -30)).length,
  };
}

/** Weekly average weight for each week (keyed by week start) — for weekly analytics. */
export function weeklyAverages(entries: readonly WeightPoint[], weekStartOf: (d: ISODate) => ISODate) {
  const buckets = new Map<ISODate, number[]>();
  for (const e of entries) {
    const key = weekStartOf(e.date);
    const list = buckets.get(key) ?? [];
    list.push(e.weightKg);
    buckets.set(key, list);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([weekStart, values]) => ({ weekStart, avg: values.reduce((a, b) => a + b, 0) / values.length, n: values.length }));
}

/** Smoothed value of the regression line at asOf; used as the forecast anchor. */
export function trendWeightAt(entries: readonly WeightPoint[], asOf: ISODate): number | null {
  const points = toPoints(entries).filter((p) => p.date <= asOf);
  const rate = weightRate(points, asOf);
  if (rate) return regressionAt(rate.regression, asOf);
  return trailingMean(points, asOf, 7) ?? points.at(-1)?.value ?? null;
}

/** Days with a weigh-in within the last `days` days. */
export function weighInDays(entries: readonly WeightPoint[], asOf: ISODate, days: number) {
  return entries.filter((e) => diffDays(asOf, e.date) >= 0 && diffDays(asOf, e.date) < days).length;
}
