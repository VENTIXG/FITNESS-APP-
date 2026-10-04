/**
 * Daily and weekly adherence scores (0–100).
 *
 * Built only from behaviours the user controls (calories, protein, steps, training,
 * cardio, sleep, water) — body weight is deliberately excluded. Weights are
 * user-configurable; a weight of 0 removes a component.
 */
import type { ScoreComponent } from "../domain";
import { clamp } from "../utils";
import type { DaySummary } from "./day";

export type ScoreBreakdown = {
  component: ScoreComponent;
  weight: number;
  /** 0–1, or null when the component doesn't apply today (excluded from the average). */
  value: number | null;
};

export type DayScore = {
  score: number | null;
  breakdown: ScoreBreakdown[];
};

/** Calories: full marks within ±5 %, falling to 0 at ±30 %. */
export function calorieComponent(consumed: number, target: number) {
  if (target <= 0) return null;
  const dev = Math.abs(consumed - target) / target;
  return clamp(1 - Math.max(0, dev - 0.05) / 0.25, 0, 1);
}

export function ratioComponent(actual: number, goal: number, fullAt = 1) {
  if (goal <= 0) return null;
  return clamp(actual / (goal * fullAt), 0, 1);
}

export function dailyScore(day: DaySummary, weights: Record<ScoreComponent, number>): DayScore {
  const n = day.nutrition;
  const values: Record<ScoreComponent, number | null> = {
    calories: n.target ? (n.entries > 0 ? calorieComponent(n.totals.calories, n.target.calories) : 0) : null,
    protein: n.target ? (n.entries > 0 ? ratioComponent(n.totals.proteinG, n.target.proteinG, 0.95) : 0) : null,
    steps: day.stepGoal > 0 ? ratioComponent(day.steps ?? 0, day.stepGoal) : null,
    // Rest days don't count against you; an unplanned workout counts in your favour.
    workout: day.workoutPlanned ? (day.workoutsCompleted > 0 ? 1 : 0) : day.workoutsCompleted > 0 ? 1 : null,
    cardio: day.cardioDailyTargetMin > 0 ? ratioComponent(day.cardioMinutes, day.cardioDailyTargetMin) : null,
    // Sleep is often not tracked; missing sleep data is excluded rather than scored 0.
    sleep: day.sleepMinutes != null && day.sleepGoalMinutes > 0 ? ratioComponent(day.sleepMinutes, day.sleepGoalMinutes, 0.97) : null,
    water: day.waterGoalMl > 0 ? ratioComponent(day.waterMl, day.waterGoalMl) : null,
  };

  const breakdown: ScoreBreakdown[] = (Object.keys(values) as ScoreComponent[]).map((component) => ({
    component,
    weight: weights[component] ?? 0,
    value: values[component],
  }));

  let num = 0;
  let den = 0;
  for (const b of breakdown) {
    if (b.weight <= 0 || b.value == null) continue;
    num += b.weight * b.value;
    den += b.weight;
  }
  return { score: den > 0 ? Math.round((num / den) * 100) : null, breakdown };
}

/** Weekly score = mean of daily scores for elapsed days. */
export function weeklyScore(dayScores: readonly (number | null)[]): number | null {
  const valid = dayScores.filter((s): s is number => s != null);
  if (!valid.length) return null;
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
}

export type ScoreBand = "excellent" | "good" | "fair" | "low";

export function scoreBand(score: number): ScoreBand {
  if (score >= 85) return "excellent";
  if (score >= 70) return "good";
  if (score >= 50) return "fair";
  return "low";
}
