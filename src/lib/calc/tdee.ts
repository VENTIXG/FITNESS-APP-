/**
 * Data-driven ("adaptive") TDEE.
 *
 *   expenditure ≈ average intake − (rate of weight change × energy per kg)
 *
 * The weight rate comes from a least-squares fit over the window (so single-day
 * scale noise has little leverage), and intake uses only days that look fully
 * logged. Confidence depends on how much data exists and how tight the fit is.
 */
import { KCAL_PER_KG } from "../config";
import { addDays, type ISODate } from "../dates";
import { ADHERENCE } from "./nutrition";
import { linearRegression, median, type Point } from "./series";

export type TdeeConfidence = "low" | "medium" | "high";

export type TdeeEstimate = {
  tdee: number;
  /** 95 % interval from the weight-slope uncertainty. */
  low: number;
  high: number;
  avgIntake: number;
  /** kg/week from the regression */
  weightRatePerWeek: number;
  intakeDays: number;
  weighIns: number;
  windowDays: number;
  confidence: TdeeConfidence;
  start: ISODate;
  end: ISODate;
};

export const TDEE_MIN_INTAKE_DAYS = 10;
export const TDEE_MIN_WEIGH_INS = 6;
export const TDEE_MIN_SPAN_DAYS = 13;

export type TdeeInput = {
  /** Daily logged calories (one row per logged day). */
  intake: readonly { date: ISODate; calories: number }[];
  weights: readonly Point[];
  /** Last complete day (usually yesterday). */
  end: ISODate;
  windowDays?: number;
};

/** Removes days whose intake is implausibly low relative to the window median (likely partial logs). */
export function completeIntakeDays(intake: readonly { date: ISODate; calories: number }[]) {
  const med = median(intake.map((d) => d.calories));
  if (med == null) return [];
  return intake.filter((d) => d.calories >= med * ADHERENCE.incompleteDayRatio);
}

export function estimateAdaptiveTdee(input: TdeeInput): TdeeEstimate | null {
  const windowDays = input.windowDays ?? 28;
  const start = addDays(input.end, -(windowDays - 1));
  const intakeInWindow = completeIntakeDays(input.intake.filter((d) => d.date >= start && d.date <= input.end));
  const weights = input.weights.filter((p) => p.date >= start && p.date <= input.end);

  if (intakeInWindow.length < TDEE_MIN_INTAKE_DAYS || weights.length < TDEE_MIN_WEIGH_INS) return null;
  const reg = linearRegression(weights);
  if (!reg || reg.spanDays < TDEE_MIN_SPAN_DAYS) return null;

  const avgIntake = intakeInWindow.reduce((a, d) => a + d.calories, 0) / intakeInWindow.length;
  const balance = reg.slopePerDay * KCAL_PER_KG; // kcal/day stored (+) or released (−)
  const tdee = avgIntake - balance;
  const se = reg.slopeStdErr * KCAL_PER_KG;

  let confidence: TdeeConfidence = "low";
  if (intakeInWindow.length >= 21 && weights.length >= 14 && se <= 120) confidence = "high";
  else if (intakeInWindow.length >= 14 && weights.length >= 8 && se <= 250) confidence = "medium";

  return {
    tdee,
    low: tdee - 1.96 * se,
    high: tdee + 1.96 * se,
    avgIntake,
    weightRatePerWeek: reg.slopePerDay * 7,
    intakeDays: intakeInWindow.length,
    weighIns: weights.length,
    windowDays,
    confidence,
    start,
    end: input.end,
  };
}

/**
 * Rolling weekly estimates for a history chart: one estimate per `stepDays`,
 * each using the trailing window. Days without enough data are skipped.
 */
export function adaptiveTdeeHistory(input: Omit<TdeeInput, "end"> & { from: ISODate; to: ISODate; stepDays?: number }) {
  const step = input.stepDays ?? 7;
  const out: { date: ISODate; tdee: number; low: number; high: number; confidence: TdeeConfidence }[] = [];
  for (let d = input.to; d >= input.from; d = addDays(d, -step)) {
    const est = estimateAdaptiveTdee({ intake: input.intake, weights: input.weights, end: d, windowDays: input.windowDays });
    if (est) out.push({ date: d, tdee: est.tdee, low: est.low, high: est.high, confidence: est.confidence });
  }
  return out.reverse();
}
