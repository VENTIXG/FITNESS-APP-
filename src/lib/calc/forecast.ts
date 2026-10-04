/**
 * Weight forecast with an explicit uncertainty band.
 *
 * Rate sources (combined when both exist):
 *  1. Observed trend — regression slope of recent weigh-ins.
 *  2. Energy balance — (recent average intake − estimated TDEE) / kcal per kg.
 *
 * The band widens with time: slope uncertainty grows linearly and a random-walk
 * term (~0.25 kg per √week) reflects that real-world rates drift (adaptation,
 * adherence, water). The forecast never claims more precision than the data has.
 */
import { KCAL_PER_KG } from "../config";
import { addDays, type ISODate } from "../dates";
import { estimateGoalDate, type GoalEta } from "./goal";

export const DRIFT_KG_PER_SQRT_WEEK = 0.25;

export type ForecastInput = {
  today: ISODate;
  /** Current smoothed weight (regression value or 7-day average). */
  baseWeightKg: number;
  observedRatePerWeek: number | null;
  observedRateStdErr?: number | null;
  /** Recent average intake (kcal/day) and adaptive TDEE, when available. */
  avgIntake?: number | null;
  tdee?: number | null;
  tdeeConfidence?: "low" | "medium" | "high" | null;
  targetWeightKg?: number | null;
  horizonDays?: number;
};

export type ForecastPoint = { date: ISODate; expected: number; low: number; high: number };

export type Forecast = {
  ratePerWeek: number;
  rateStdErrPerWeek: number;
  basis: "trend" | "energy" | "combined";
  points: ForecastPoint[];
  at: (days: number) => ForecastPoint;
  goalEta: GoalEta | null;
};

export function forecastWeight(input: ForecastInput): Forecast | null {
  const horizon = input.horizonDays ?? 120;
  const energyRate =
    input.avgIntake != null && input.tdee != null && input.tdeeConfidence && input.tdeeConfidence !== "low"
      ? ((input.avgIntake - input.tdee) / KCAL_PER_KG) * 7
      : null;

  let rate: number;
  let se: number;
  let basis: Forecast["basis"];
  if (input.observedRatePerWeek != null && energyRate != null) {
    rate = (input.observedRatePerWeek + energyRate) / 2;
    se = Math.max(input.observedRateStdErr ?? 0.1, Math.abs(input.observedRatePerWeek - energyRate) / 2, 0.05);
    basis = "combined";
  } else if (input.observedRatePerWeek != null) {
    rate = input.observedRatePerWeek;
    se = Math.max(input.observedRateStdErr ?? 0.1, 0.05);
    basis = "trend";
  } else if (energyRate != null) {
    rate = energyRate;
    se = 0.15;
    basis = "energy";
  } else {
    return null;
  }

  const at = (days: number): ForecastPoint => {
    const weeks = days / 7;
    const expected = input.baseWeightKg + rate * weeks;
    const spread = 1.96 * Math.sqrt((se * weeks) ** 2 + DRIFT_KG_PER_SQRT_WEEK ** 2 * weeks);
    return { date: addDays(input.today, days), expected, low: expected - spread, high: expected + spread };
  };

  const points: ForecastPoint[] = [];
  for (let d = 0; d <= horizon; d += 7) points.push(at(d));

  const goalEta =
    input.targetWeightKg != null
      ? estimateGoalDate({
          currentKg: input.baseWeightKg,
          targetKg: input.targetWeightKg,
          ratePerWeek: rate,
          rateStdErrPerWeek: se,
          today: input.today,
        })
      : null;

  return { ratePerWeek: rate, rateStdErrPerWeek: se, basis, points, at, goalEta };
}
