import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { caloriesOnTarget, proteinHit } from "@/lib/calc/nutrition";
import { sleepHit, stepsHit, waterHit, type DaySummary } from "@/lib/calc/day";
import { dailyScore, weeklyScore } from "@/lib/calc/score";
import { addDays, isoWeek, startOfWeek, type ISODate } from "@/lib/dates";
import { mean } from "@/lib/utils";
import type { UserContext } from "@/server/context";
import { db } from "@/server/db";
import { weeklyReports } from "@/server/db/schema";
import { getDaySummaries, getFirstDataDate } from "./days";
import { getTrainingPlan } from "./training";

export type WeekReport = ReturnType<typeof summarizeWeek>;

/** Aggregates a week's day summaries (only elapsed days count). */
export function summarizeWeek(ctx: UserContext, weekStart: ISODate, days: DaySummary[], prevDays: DaySummary[], plannedPerWeek: number) {
  const elapsed = days.filter((d) => d.date <= ctx.today);
  const complete = elapsed.filter((d) => d.date < ctx.today);
  const avgWeight = (list: DaySummary[]) => mean(list.map((d) => d.weightKg).filter((w): w is number => w != null));
  const weight = avgWeight(elapsed);
  const prevWeight = avgWeight(prevDays);
  const food = complete.filter((d) => d.nutrition.entries > 0);
  const withTarget = food.filter((d) => d.nutrition.target);
  const stepDays = elapsed.filter((d) => d.steps != null);
  const sleepDays = elapsed.filter((d) => d.sleepMinutes != null);
  const scores = elapsed.map((d) => dailyScore(d, ctx.prefs.scoring.weights).score);
  const target = withTarget.at(-1)?.nutrition.target ?? null;
  return {
    weekStart,
    weekEnd: addDays(weekStart, 6),
    week: isoWeek(weekStart),
    inProgress: addDays(weekStart, 6) >= ctx.today,
    daysElapsed: elapsed.length,
    avgWeight: weight,
    weightChange: weight != null && prevWeight != null ? weight - prevWeight : null,
    weighIns: elapsed.filter((d) => d.weightKg != null).length,
    foodDays: food.length,
    avgCalories: mean(food.map((d) => d.nutrition.totals.calories)),
    avgProtein: mean(food.map((d) => d.nutrition.totals.proteinG)),
    calorieTarget: target?.calories ?? null,
    calorieHits: withTarget.filter((d) => caloriesOnTarget(d.nutrition.totals.calories, d.nutrition.target!.calories)).length,
    proteinHits: withTarget.filter((d) => proteinHit(d.nutrition.totals.proteinG, d.nutrition.target!.proteinG)).length,
    targetDays: withTarget.length,
    avgSteps: mean(stepDays.map((d) => d.steps!)),
    stepGoalDays: elapsed.filter((d) => stepsHit(d.steps, d.stepGoal)).length,
    workouts: elapsed.reduce((a, d) => a + d.workoutsCompleted, 0),
    plannedWorkouts: plannedPerWeek,
    cardioMinutes: Math.round(elapsed.reduce((a, d) => a + d.cardioMinutes, 0)),
    cardioSessions: elapsed.reduce((a, d) => a + d.cardioSessions, 0),
    avgSleep: mean(sleepDays.map((d) => d.sleepMinutes!)),
    sleepGoalDays: elapsed.filter((d) => sleepHit(d.sleepMinutes, d.sleepGoalMinutes)).length,
    waterGoalDays: elapsed.filter((d) => waterHit(d.waterMl, d.waterGoalMl)).length,
    score: ctx.prefs.scoring.enabled ? weeklyScore(scores) : null,
    days: days.map((d, i) => ({ ...d, score: d.date <= ctx.today && ctx.prefs.scoring.enabled ? scores[i] ?? null : null })),
  };
}

/** Reports for the last `count` weeks (newest first), plus saved reflections. */
export async function getWeeklyReports(ctx: UserContext, count = 12) {
  const thisWeek = startOfWeek(ctx.today, ctx.weekStartsOn);
  const first = await getFirstDataDate(ctx.userId);
  const earliest = addDays(thisWeek, -7 * count);
  const start = first && first > earliest ? startOfWeek(first, ctx.weekStartsOn) : earliest;
  const [days, plan] = await Promise.all([getDaySummaries(ctx, addDays(start, -7), ctx.today), getTrainingPlan(ctx.userId, ctx.prefs.training)]);
  const weeks: ISODate[] = [];
  for (let w = thisWeek; w >= start; w = addDays(w, -7)) weeks.push(w);
  const notes = weeks.length
    ? await db.select().from(weeklyReports).where(and(eq(weeklyReports.userId, ctx.userId), inArray(weeklyReports.weekStart, weeks)))
    : [];
  return weeks.map((w) => {
    const inWeek = days.filter((d) => d.date >= w && d.date <= addDays(w, 6));
    const prev = days.filter((d) => d.date >= addDays(w, -7) && d.date < w);
    const note = notes.find((n) => n.weekStart === w);
    return { ...summarizeWeek(ctx, w, inWeek, prev, plan.plannedPerWeek), reflection: note?.reflection ?? null, rating: note?.rating ?? null };
  });
}

export async function getWeeklyReport(ctx: UserContext, weekStart: ISODate) {
  const [days, plan, note] = await Promise.all([
    getDaySummaries(ctx, addDays(weekStart, -7), addDays(weekStart, 6) < ctx.today ? addDays(weekStart, 6) : ctx.today),
    getTrainingPlan(ctx.userId, ctx.prefs.training),
    db.select().from(weeklyReports).where(and(eq(weeklyReports.userId, ctx.userId), eq(weeklyReports.weekStart, weekStart))).limit(1),
  ]);
  const inWeek = days.filter((d) => d.date >= weekStart);
  const prev = days.filter((d) => d.date < weekStart);
  return { ...summarizeWeek(ctx, weekStart, inWeek, prev, plan.plannedPerWeek), reflection: note[0]?.reflection ?? null, rating: note[0]?.rating ?? null };
}
