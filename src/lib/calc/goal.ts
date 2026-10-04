/**
 * Goal maths: progress, required pace, schedule status and rate-safety notes.
 * Estimates are framed as projections — never guarantees.
 */
import { KCAL_PER_KG } from "../config";
import { addDays, diffDays, type ISODate } from "../dates";
import { clamp } from "../utils";

export type GoalDirection = "lose" | "gain" | "maintain";

export type GoalLike = {
  startDate: ISODate;
  startWeightKg: number;
  targetWeightKg: number;
  targetDate: ISODate | null;
};

/** Within this distance (kg) of target the goal counts as reached / maintained. */
export const GOAL_REACHED_TOLERANCE_KG = 0.3;

export function goalDirection(goal: Pick<GoalLike, "startWeightKg" | "targetWeightKg">): GoalDirection {
  const delta = goal.targetWeightKg - goal.startWeightKg;
  if (Math.abs(delta) < GOAL_REACHED_TOLERANCE_KG) return "maintain";
  return delta < 0 ? "lose" : "gain";
}

export type GoalProgress = {
  direction: GoalDirection;
  /** Signed change required from start to target. */
  totalChangeKg: number;
  /** Signed change achieved so far. */
  achievedChangeKg: number;
  /** Absolute kg left to target (0 when reached/past). */
  remainingKg: number;
  /** 0–100 */
  percent: number;
  reached: boolean;
};

export function goalProgress(goal: GoalLike, currentWeightKg: number): GoalProgress {
  const direction = goalDirection(goal);
  const totalChangeKg = goal.targetWeightKg - goal.startWeightKg;
  const achievedChangeKg = currentWeightKg - goal.startWeightKg;
  const signedRemaining = goal.targetWeightKg - currentWeightKg;

  if (direction === "maintain") {
    const off = Math.abs(signedRemaining);
    return {
      direction,
      totalChangeKg,
      achievedChangeKg,
      remainingKg: off,
      percent: off <= 1 ? 100 : clamp(100 - (off - 1) * 25, 0, 100),
      reached: off <= GOAL_REACHED_TOLERANCE_KG,
    };
  }
  // Kg still to go in the goal's direction (0 once at or past the target).
  const remainingKg = Math.max(0, direction === "lose" ? currentWeightKg - goal.targetWeightKg : goal.targetWeightKg - currentWeightKg);
  const percent = clamp((achievedChangeKg / totalChangeKg) * 100, 0, 100);
  const reached = direction === "lose" ? currentWeightKg <= goal.targetWeightKg + GOAL_REACHED_TOLERANCE_KG : currentWeightKg >= goal.targetWeightKg - GOAL_REACHED_TOLERANCE_KG;
  return {
    direction,
    totalChangeKg,
    achievedChangeKg,
    remainingKg: reached ? 0 : remainingKg,
    percent: reached ? 100 : percent,
    reached,
  };
}

/** Required signed weekly change (kg/week) to hit the target date from today. */
export function requiredWeeklyRate(currentWeightKg: number, targetWeightKg: number, today: ISODate, targetDate: ISODate | null): number | null {
  if (!targetDate) return null;
  const days = diffDays(targetDate, today);
  if (days <= 0) return null;
  return ((targetWeightKg - currentWeightKg) / days) * 7;
}

/** Signed average daily energy balance implied by a weekly rate (negative = deficit). */
export function dailyEnergyBalanceForRate(weeklyRateKg: number): number {
  return (weeklyRateKg * KCAL_PER_KG) / 7;
}

export type RateAssessment = {
  level: "ok" | "aggressive" | "very_aggressive";
  /** Rate as % of bodyweight per week (absolute). */
  pctPerWeek: number;
};

/**
 * Neutral flagging of unusually fast rates. Thresholds follow common guidance:
 * loss ≲ 0.5–1 %/week, gain ≲ 0.25–0.5 %/week.
 */
export function assessRate(weeklyRateKg: number, bodyweightKg: number): RateAssessment {
  const pct = (Math.abs(weeklyRateKg) / bodyweightKg) * 100;
  if (weeklyRateKg < 0) {
    if (pct > 1.5) return { level: "very_aggressive", pctPerWeek: pct };
    if (pct > 1) return { level: "aggressive", pctPerWeek: pct };
    return { level: "ok", pctPerWeek: pct };
  }
  if (pct > 1) return { level: "very_aggressive", pctPerWeek: pct };
  if (pct > 0.5) return { level: "aggressive", pctPerWeek: pct };
  return { level: "ok", pctPerWeek: pct };
}

/** Expected weight today on a straight line from goal start to target. */
export function plannedWeightOn(goal: GoalLike, date: ISODate): number | null {
  if (!goal.targetDate) return null;
  const total = diffDays(goal.targetDate, goal.startDate);
  if (total <= 0) return goal.targetWeightKg;
  const t = clamp(diffDays(date, goal.startDate) / total, 0, 1);
  return goal.startWeightKg + (goal.targetWeightKg - goal.startWeightKg) * t;
}

export type ScheduleStatus = "ahead" | "on_track" | "behind" | "reached" | "no_target_date" | "not_started";

/** Tolerance band (kg) around the planned line that counts as "on track". */
export const SCHEDULE_TOLERANCE_KG = 0.5;

export function scheduleStatus(goal: GoalLike, today: ISODate, currentTrendKg: number | null): ScheduleStatus {
  if (currentTrendKg == null) return "not_started";
  const progress = goalProgress(goal, currentTrendKg);
  if (progress.reached && progress.direction !== "maintain") return "reached";
  if (!goal.targetDate) return "no_target_date";
  const planned = plannedWeightOn(goal, today);
  if (planned == null) return "no_target_date";
  // Positive = further along than planned.
  const lead = progress.direction === "gain" ? currentTrendKg - planned : planned - currentTrendKg;
  if (progress.direction === "maintain") return Math.abs(currentTrendKg - goal.targetWeightKg) <= 1 ? "on_track" : "behind";
  if (lead > SCHEDULE_TOLERANCE_KG) return "ahead";
  if (lead < -SCHEDULE_TOLERANCE_KG) return "behind";
  return "on_track";
}

export type GoalEta = {
  /** Expected date at the current rate. */
  date: ISODate;
  /** Optimistic / pessimistic dates from the rate's uncertainty (may be null if unbounded). */
  early: ISODate | null;
  late: ISODate | null;
  weeks: number;
};

/** Smallest rate (kg/week) considered meaningful movement toward a goal. */
export const MIN_PROGRESS_RATE = 0.05;

/**
 * Estimated date to reach the target at the current rate. Returns null when the
 * trend isn't moving toward the target (no false promises).
 */
export function estimateGoalDate(input: {
  currentKg: number;
  targetKg: number;
  ratePerWeek: number;
  rateStdErrPerWeek?: number | null;
  today: ISODate;
}): GoalEta | null {
  const remaining = input.targetKg - input.currentKg;
  if (Math.abs(remaining) < GOAL_REACHED_TOLERANCE_KG) return { date: input.today, early: input.today, late: input.today, weeks: 0 };
  const rate = input.ratePerWeek;
  if (Math.sign(rate) !== Math.sign(remaining) || Math.abs(rate) < MIN_PROGRESS_RATE) return null;
  const weeks = remaining / rate;
  const days = Math.round(weeks * 7);
  if (days > 5 * 365) return null;
  const se = input.rateStdErrPerWeek ?? 0;
  const fast = Math.abs(rate) + 1.96 * se;
  const slow = Math.abs(rate) - 1.96 * se;
  const early = addDays(input.today, Math.round((Math.abs(remaining) / fast) * 7));
  const late = slow >= MIN_PROGRESS_RATE ? addDays(input.today, Math.round((Math.abs(remaining) / slow) * 7)) : null;
  return { date: addDays(input.today, days), early, late, weeks };
}
