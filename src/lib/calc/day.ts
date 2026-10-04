/**
 * A day's consolidated data, used by habits, the calendar, scores, streaks and reports.
 */
import type { ISODate } from "../dates";
import { weekday } from "../dates";
import type { AutoHabitMetric, HabitSchedule } from "../domain";
import { caloriesOnTarget, proteinHit, type Nutrients, type TargetLike } from "./nutrition";

export type DaySummary = {
  date: ISODate;
  weightKg: number | null;
  nutrition: { entries: number; totals: Nutrients; target: TargetLike | null };
  steps: number | null;
  stepGoal: number;
  workoutsCompleted: number;
  workoutPlanned: boolean;
  cardioMinutes: number;
  cardioSessions: number;
  /** Daily share of the weekly cardio goal (minutes). */
  cardioDailyTargetMin: number;
  waterMl: number;
  waterGoalMl: number;
  sleepMinutes: number | null;
  sleepGoalMinutes: number;
  supplementsDue: number;
  supplementsTaken: number;
};

/** Sleep counts as meeting the goal within 15 minutes of it. */
export const SLEEP_TOLERANCE_MIN = 15;

export function sleepHit(minutes: number | null, goal: number) {
  return minutes != null && goal > 0 && minutes >= goal - SLEEP_TOLERANCE_MIN;
}

export function stepsHit(steps: number | null, goal: number) {
  return steps != null && goal > 0 && steps >= goal;
}

export function waterHit(ml: number, goal: number) {
  return goal > 0 && ml >= goal;
}

/**
 * Evaluates an automatic habit for a day. Returns null when the habit doesn't
 * apply (e.g. no supplements were due), true/false otherwise.
 */
export function evaluateAutoHabit(metric: AutoHabitMetric, d: DaySummary): boolean | null {
  const n = d.nutrition;
  switch (metric) {
    case "weight_logged":
      return d.weightKg != null;
    case "nutrition_logged":
      return n.entries > 0;
    case "calories_target":
      return n.entries > 0 && n.target != null && caloriesOnTarget(n.totals.calories, n.target.calories);
    case "protein_target":
      return n.entries > 0 && n.target != null && proteinHit(n.totals.proteinG, n.target.proteinG);
    case "steps_target":
      return stepsHit(d.steps, d.stepGoal);
    case "workout":
      return d.workoutsCompleted > 0;
    case "cardio":
      return d.cardioSessions > 0;
    case "water_target":
      return waterHit(d.waterMl, d.waterGoalMl);
    case "sleep_target":
      return sleepHit(d.sleepMinutes, d.sleepGoalMinutes);
    case "supplements":
      return d.supplementsDue > 0 ? d.supplementsTaken >= d.supplementsDue : null;
  }
}

export function isScheduledOn(schedule: HabitSchedule, daysOfWeek: readonly number[], date: ISODate) {
  if (schedule === "daily") return true;
  return daysOfWeek.includes(weekday(date));
}

/** Quick flags for calendar cells. */
export function dayIndicators(d: DaySummary) {
  return {
    weight: d.weightKg != null,
    nutrition: d.nutrition.entries > 0,
    workout: d.workoutsCompleted > 0,
    cardio: d.cardioSessions > 0,
    steps: stepsHit(d.steps, d.stepGoal),
  };
}

export function emptyDaySummary(date: ISODate, goals: { stepGoal: number; waterGoalMl: number; sleepGoalMinutes: number; cardioDailyTargetMin: number }): DaySummary {
  return {
    date,
    weightKg: null,
    nutrition: { entries: 0, totals: { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 }, target: null },
    steps: null,
    stepGoal: goals.stepGoal,
    workoutsCompleted: 0,
    workoutPlanned: false,
    cardioMinutes: 0,
    cardioSessions: 0,
    cardioDailyTargetMin: goals.cardioDailyTargetMin,
    waterMl: 0,
    waterGoalMl: goals.waterGoalMl,
    sleepMinutes: null,
    sleepGoalMinutes: goals.sleepGoalMinutes,
    supplementsDue: 0,
    supplementsTaken: 0,
  };
}
