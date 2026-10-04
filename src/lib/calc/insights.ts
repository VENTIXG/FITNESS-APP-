/**
 * Rule-based coaching insights.
 *
 * Deterministic interpretations of the user's own data. Every rule has a minimum-data
 * guard so conclusions aren't drawn from a few days of noise. Insights describe and
 * interpret — they never diagnose or give medical advice.
 */
import { addDays, startOfWeek, weekday, type ISODate } from "../dates";
import { mean } from "../utils";
import type { DaySummary } from "./day";
import { sleepHit } from "./day";
import { assessRate, goalDirection, requiredWeeklyRate, type GoalLike } from "./goal";
import { caloriesOnTarget, proteinHit } from "./nutrition";
import { coefficientOfVariation } from "./series";
import type { TdeeEstimate } from "./tdee";
import { weightRate, type WeightPoint } from "./weight";

export type InsightTone = "positive" | "neutral" | "attention";
export type InsightCategory = "weight" | "nutrition" | "training" | "activity" | "recovery" | "consistency";

export type InsightKey =
  | "gettingStarted"
  | "weightFasterThanTarget"
  | "weightOnPace"
  | "weightSlowerThanTarget"
  | "plateau"
  | "rateAggressive"
  | "proteinAdherence"
  | "calorieAdherence"
  | "workoutsWeek"
  | "stepsUp"
  | "stepsDown"
  | "liftProgress"
  | "liftDecline"
  | "sleepBelowGoal"
  | "sleepOnGoal"
  | "loggingGaps"
  | "tdeeEstimate"
  | "weekendIntake"
  | "cardioGoalMet"
  | "waterLow";

export type Insight = {
  id: InsightKey;
  tone: InsightTone;
  category: InsightCategory;
  priority: number;
  params: Record<string, string>;
};

export type InsightFormatters = {
  weight: (kg: number, signed?: boolean) => string;
  kcal: (kcal: number) => string;
  pct: (fraction: number) => string;
  int: (n: number) => string;
  sleep: (minutes: number) => string;
};

export type LiftTrend = { exerciseName: string; changePct: number; weeks: number };

export type InsightInput = {
  today: ISODate;
  weekStartsOn: number;
  /** Daily summaries, ascending, ending today (≥ 28 days recommended). */
  days: readonly DaySummary[];
  weights: readonly WeightPoint[];
  goal: GoalLike | null;
  tdee: TdeeEstimate | null;
  formulaTdee: number | null;
  plannedWorkoutsPerWeek: number;
  cardioMinutesPerWeek: number;
  liftTrends: readonly LiftTrend[];
};

function daysIn(days: readonly DaySummary[], start: ISODate, end: ISODate) {
  return days.filter((d) => d.date >= start && d.date <= end);
}

export function generateInsights(input: InsightInput, f: InsightFormatters): Insight[] {
  const out: Insight[] = [];
  const { today } = input;
  const yesterday = addDays(today, -1);
  // "Last 7 days" excludes today, which is still in progress.
  const last7 = daysIn(input.days, addDays(today, -7), yesterday);
  const prev7 = daysIn(input.days, addDays(today, -14), addDays(today, -8));
  const points = [...input.weights].sort((a, b) => (a.date < b.date ? -1 : 1)).map((w) => ({ date: w.date, value: w.weightKg }));
  const rate = weightRate(points, today);
  const current = points.at(-1)?.value ?? null;

  const loggedFood = input.days.filter((d) => d.nutrition.entries > 0).length;
  if (points.length < 5 && loggedFood < 5) {
    out.push({ id: "gettingStarted", tone: "neutral", category: "consistency", priority: 100, params: {} });
  }

  // --- weight vs goal pace -------------------------------------------------
  if (rate && input.goal && current != null) {
    const required = requiredWeeklyRate(current, input.goal.targetWeightKg, today, input.goal.targetDate);
    const dir = goalDirection(input.goal);
    if (required != null && dir !== "maintain" && Math.abs(required) >= 0.05) {
      const ratio = rate.perWeek / required; // >1 = faster than needed, <0 = wrong direction
      const params = { actual: f.weight(rate.perWeek, true), required: f.weight(required, true) };
      if (ratio > 1.25) out.push({ id: "weightFasterThanTarget", tone: "neutral", category: "weight", priority: 90, params });
      else if (ratio >= 0.75) out.push({ id: "weightOnPace", tone: "positive", category: "weight", priority: 85, params });
      else out.push({ id: "weightSlowerThanTarget", tone: "attention", category: "weight", priority: 88, params });
    }
  }

  // --- plateau: flat trend with consistent intake ----------------------------
  if (input.goal && goalDirection(input.goal) !== "maintain") {
    const r21 = weightRate(points, today, 21);
    const window = daysIn(input.days, addDays(today, -21), yesterday).filter((d) => d.nutrition.entries > 0);
    const cv = coefficientOfVariation(window.map((d) => d.nutrition.totals.calories));
    if (r21 && r21.regression.n >= 10 && Math.abs(r21.perWeek) < 0.1 && window.length >= 14 && cv != null && cv < 0.12) {
      const avg = mean(window.map((d) => d.nutrition.totals.calories)) ?? 0;
      out.push({ id: "plateau", tone: "neutral", category: "weight", priority: 92, params: { days: f.int(r21.regression.spanDays + 1), kcal: f.kcal(avg) } });
    }
  }

  // --- rate safety -----------------------------------------------------------
  const r21 = weightRate(points, today, 21);
  if (r21 && current != null && r21.perWeek < 0) {
    const a = assessRate(r21.perWeek, current);
    if (a.level !== "ok") {
      out.push({ id: "rateAggressive", tone: "attention", category: "weight", priority: 95, params: { rate: f.weight(r21.perWeek, true), pct: f.pct(a.pctPerWeek / 100) } });
    }
  }

  // --- nutrition adherence ---------------------------------------------------
  const logged7 = last7.filter((d) => d.nutrition.entries > 0 && d.nutrition.target);
  if (logged7.length >= 3) {
    const hit = logged7.filter((d) => proteinHit(d.nutrition.totals.proteinG, d.nutrition.target!.proteinG)).length;
    const ratio = hit / logged7.length;
    out.push({
      id: "proteinAdherence",
      tone: ratio >= 0.8 ? "positive" : ratio >= 0.5 ? "neutral" : "attention",
      category: "nutrition",
      priority: 70,
      params: { pct: f.pct(ratio), hit: f.int(hit), days: f.int(logged7.length) },
    });
    const calHit = logged7.filter((d) => caloriesOnTarget(d.nutrition.totals.calories, d.nutrition.target!.calories)).length;
    const calRatio = calHit / logged7.length;
    out.push({
      id: "calorieAdherence",
      tone: calRatio >= 0.7 ? "positive" : calRatio >= 0.4 ? "neutral" : "attention",
      category: "nutrition",
      priority: 68,
      params: { pct: f.pct(calRatio), hit: f.int(calHit), days: f.int(logged7.length) },
    });
  }
  const loggedDays7 = last7.filter((d) => d.nutrition.entries > 0).length;
  if (loggedDays7 < 4 && input.days.some((d) => d.nutrition.entries > 0)) {
    out.push({ id: "loggingGaps", tone: "neutral", category: "consistency", priority: 60, params: { days: f.int(loggedDays7) } });
  }

  // --- weekend pattern -------------------------------------------------------
  const last28 = daysIn(input.days, addDays(today, -28), yesterday).filter((d) => d.nutrition.entries > 0);
  const weekend = last28.filter((d) => [0, 6].includes(weekday(d.date)));
  const weekdays = last28.filter((d) => ![0, 6].includes(weekday(d.date)));
  if (weekend.length >= 4 && weekdays.length >= 10) {
    const we = mean(weekend.map((d) => d.nutrition.totals.calories)) ?? 0;
    const wd = mean(weekdays.map((d) => d.nutrition.totals.calories)) ?? 0;
    if (we - wd > 250 && we > wd * 1.15) {
      out.push({ id: "weekendIntake", tone: "neutral", category: "nutrition", priority: 55, params: { kcal: f.kcal(we - wd) } });
    }
  }

  // --- expenditure ------------------------------------------------------------
  if (input.tdee && input.tdee.confidence !== "low") {
    out.push({
      id: "tdeeEstimate",
      tone: "neutral",
      category: "nutrition",
      priority: 50,
      params: {
        tdee: f.kcal(input.tdee.tdee),
        confidence: input.tdee.confidence,
        formula: input.formulaTdee != null ? f.kcal(input.formulaTdee) : "",
      },
    });
  }

  // --- training ---------------------------------------------------------------
  const thisWeekStart = startOfWeek(today, input.weekStartsOn);
  const lastWeekStart = addDays(thisWeekStart, -7);
  const lastWeek = daysIn(input.days, lastWeekStart, addDays(thisWeekStart, -1));
  if (input.plannedWorkoutsPerWeek > 0 && lastWeek.length === 7) {
    const done = lastWeek.reduce((a, d) => a + d.workoutsCompleted, 0);
    if (done > 0 || input.days.some((d) => d.workoutsCompleted > 0)) {
      out.push({
        id: "workoutsWeek",
        tone: done >= input.plannedWorkoutsPerWeek ? "positive" : done >= input.plannedWorkoutsPerWeek - 1 ? "neutral" : "attention",
        category: "training",
        priority: 75,
        params: { done: f.int(done), planned: f.int(input.plannedWorkoutsPerWeek) },
      });
    }
  }
  const bestLift = [...input.liftTrends].filter((l) => l.weeks >= 3).sort((a, b) => b.changePct - a.changePct)[0];
  if (bestLift && bestLift.changePct >= 0.025) {
    out.push({ id: "liftProgress", tone: "positive", category: "training", priority: 72, params: { exercise: bestLift.exerciseName, pct: f.pct(bestLift.changePct), weeks: f.int(bestLift.weeks) } });
  }
  const worstLift = [...input.liftTrends].filter((l) => l.weeks >= 3).sort((a, b) => a.changePct - b.changePct)[0];
  if (worstLift && worstLift.changePct <= -0.05) {
    out.push({ id: "liftDecline", tone: "neutral", category: "training", priority: 65, params: { exercise: worstLift.exerciseName, pct: f.pct(Math.abs(worstLift.changePct)), weeks: f.int(worstLift.weeks) } });
  }

  // --- activity ---------------------------------------------------------------
  const steps7 = last7.filter((d) => d.steps != null).map((d) => d.steps as number);
  const stepsPrev = prev7.filter((d) => d.steps != null).map((d) => d.steps as number);
  if (steps7.length >= 4 && stepsPrev.length >= 4) {
    const a = mean(steps7)!;
    const b = mean(stepsPrev)!;
    if (b > 0) {
      const change = (a - b) / b;
      if (change >= 0.1) out.push({ id: "stepsUp", tone: "positive", category: "activity", priority: 62, params: { pct: f.pct(change), avg: f.int(a), prev: f.int(b) } });
      else if (change <= -0.1) out.push({ id: "stepsDown", tone: "neutral", category: "activity", priority: 58, params: { pct: f.pct(-change), avg: f.int(a), prev: f.int(b) } });
    }
  }
  const cardioMin = last7.reduce((a, d) => a + d.cardioMinutes, 0);
  if (input.cardioMinutesPerWeek > 0 && cardioMin >= input.cardioMinutesPerWeek) {
    out.push({ id: "cardioGoalMet", tone: "positive", category: "activity", priority: 52, params: { minutes: f.int(cardioMin), goal: f.int(input.cardioMinutesPerWeek) } });
  }

  // --- recovery ---------------------------------------------------------------
  const sleep7 = last7.filter((d) => d.sleepMinutes != null);
  if (sleep7.length >= 4) {
    const avg = mean(sleep7.map((d) => d.sleepMinutes as number))!;
    const goal = sleep7[0].sleepGoalMinutes;
    if (goal > 0 && avg < goal - 30) {
      out.push({ id: "sleepBelowGoal", tone: "attention", category: "recovery", priority: 66, params: { avg: f.sleep(avg), diff: f.sleep(goal - avg) } });
    } else if (goal > 0 && sleep7.filter((d) => sleepHit(d.sleepMinutes, d.sleepGoalMinutes)).length >= sleep7.length * 0.7) {
      out.push({ id: "sleepOnGoal", tone: "positive", category: "recovery", priority: 45, params: { avg: f.sleep(avg) } });
    }
  }
  const water7 = last7.filter((d) => d.waterMl > 0);
  if (water7.length >= 4 && water7[0].waterGoalMl > 0) {
    const avg = mean(water7.map((d) => d.waterMl))!;
    if (avg < water7[0].waterGoalMl * 0.7) out.push({ id: "waterLow", tone: "neutral", category: "recovery", priority: 40, params: { pct: f.pct(avg / water7[0].waterGoalMl) } });
  }

  return out.sort((a, b) => b.priority - a.priority);
}
