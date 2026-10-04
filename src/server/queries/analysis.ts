import "server-only";
import { and, asc, desc, eq, gte, isNotNull, lte } from "drizzle-orm";
import { cache } from "react";
import { ageOn, formulaTdee } from "@/lib/calc/body";
import type { DaySummary } from "@/lib/calc/day";
import { forecastWeight } from "@/lib/calc/forecast";
import { generateInsights, type InsightFormatters, type LiftTrend } from "@/lib/calc/insights";
import { estimateAdaptiveTdee } from "@/lib/calc/tdee";
import { e1rm } from "@/lib/calc/training";
import { computeWeightStats, trendWeightAt, type WeightPoint } from "@/lib/calc/weight";
import { addDays, diffDays, type ISODate } from "@/lib/dates";
import type { UserContext } from "@/server/context";
import { db } from "@/server/db";
import { bodyCompositionEntries, exercises, exerciseSets, weightEntries, workoutExercises, workouts } from "@/server/db/schema";
import { getActiveGoal } from "./common";
import { getDaySummaries } from "./days";
import { getTrainingPlan } from "./training";

export const getWeights = cache(async (userId: string, since?: ISODate): Promise<(WeightPoint & { id: string; note: string | null; source: string })[]> => {
  return db
    .select({ id: weightEntries.id, date: weightEntries.date, weightKg: weightEntries.weightKg, note: weightEntries.note, source: weightEntries.source })
    .from(weightEntries)
    .where(since ? and(eq(weightEntries.userId, userId), gte(weightEntries.date, since)) : eq(weightEntries.userId, userId))
    .orderBy(asc(weightEntries.date));
});

export const getLatestBodyFat = cache(async (userId: string) => {
  const row = (
    await db
      .select({ date: bodyCompositionEntries.date, bodyFatPct: bodyCompositionEntries.bodyFatPct })
      .from(bodyCompositionEntries)
      .where(and(eq(bodyCompositionEntries.userId, userId), isNotNull(bodyCompositionEntries.bodyFatPct)))
      .orderBy(desc(bodyCompositionEntries.date))
      .limit(1)
  )[0];
  return row ?? null;
});

/** Formula and data-driven expenditure. */
export async function getEnergy(ctx: UserContext, days: readonly DaySummary[], weights: readonly WeightPoint[]) {
  const stats = computeWeightStats(weights, ctx.today);
  const bf = await getLatestBodyFat(ctx.userId);
  const p = ctx.profile;
  const formula = formulaTdee({
    weightKg: stats.current,
    heightCm: p.heightCm,
    age: p.birthDate ? ageOn(p.birthDate, ctx.today) : null,
    sex: p.sex,
    activityLevel: p.activityLevel,
    bodyFatPct: bf && diffDays(ctx.today, bf.date) <= 60 ? bf.bodyFatPct : null,
  });
  const yesterday = addDays(ctx.today, -1);
  const adaptive = estimateAdaptiveTdee({
    intake: days.filter((d) => d.nutrition.entries > 0 && d.date <= yesterday).map((d) => ({ date: d.date, calories: d.nutrition.totals.calories })),
    weights: weights.map((w) => ({ date: w.date, value: w.weightKg })),
    end: yesterday,
  });
  return { formula, adaptive, stats };
}

/** e1RM trend for frequently trained lifts over the last 6 weeks. */
export async function getLiftTrends(ctx: UserContext): Promise<(LiftTrend & { exerciseId: string })[]> {
  const since = addDays(ctx.today, -42);
  const rows = await db
    .select({
      exerciseId: exercises.id,
      name: exercises.name,
      nameEl: exercises.nameEl,
      date: workouts.date,
      weightKg: exerciseSets.weightKg,
      reps: exerciseSets.reps,
      setType: exerciseSets.setType,
    })
    .from(exerciseSets)
    .innerJoin(workoutExercises, eq(workoutExercises.id, exerciseSets.workoutExerciseId))
    .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
    .innerJoin(exercises, eq(exercises.id, workoutExercises.exerciseId))
    .where(
      and(
        eq(workouts.userId, ctx.userId),
        eq(workouts.status, "completed"),
        gte(workouts.date, since),
        lte(workouts.date, ctx.today),
        eq(exerciseSets.completed, true),
        isNotNull(exerciseSets.weightKg),
      ),
    );
  const byExercise = new Map<string, { name: string; sessions: Map<ISODate, number> }>();
  for (const r of rows) {
    if (r.setType === "warmup") continue;
    const est = r.weightKg && r.reps ? e1rm(r.weightKg, r.reps) : null;
    if (est == null) continue;
    const entry = byExercise.get(r.exerciseId) ?? { name: ctx.locale === "el" && r.nameEl ? r.nameEl : r.name, sessions: new Map() };
    entry.sessions.set(r.date, Math.max(entry.sessions.get(r.date) ?? 0, est));
    byExercise.set(r.exerciseId, entry);
  }
  const out: (LiftTrend & { exerciseId: string })[] = [];
  for (const [exerciseId, e] of byExercise) {
    const sessions = [...e.sessions.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
    if (sessions.length < 3) continue;
    const firstDate = sessions[0][0];
    const lastDate = sessions[sessions.length - 1][0];
    const weeks = Math.round(diffDays(lastDate, firstDate) / 7);
    if (weeks < 3) continue;
    const head = sessions.slice(0, 2).map(([, v]) => v);
    const tail = sessions.slice(-2).map(([, v]) => v);
    const a = head.reduce((x, y) => x + y, 0) / head.length;
    const b = tail.reduce((x, y) => x + y, 0) / tail.length;
    out.push({ exerciseId, exerciseName: e.name, changePct: (b - a) / a, weeks });
  }
  return out;
}

export function insightFormatters(ctx: UserContext): InsightFormatters {
  const { fmt } = ctx;
  return {
    weight: (kg, signed) => fmt.weight(kg, { signed, decimals: Math.abs(kg) < 1 ? 2 : 1 }),
    kcal: (k) => fmt.kcal(k),
    pct: (x) => fmt.pct(x),
    int: (n) => fmt.int(n),
    sleep: (m) => fmt.sleep(m),
  };
}

/**
 * Everything the coach needs, computed once per request: 8 weeks of day
 * summaries, ~6 months of weights, goal, expenditure, forecast and insights.
 */
export const getAnalysis = cache(async (ctx: UserContext) => {
  const start = addDays(ctx.today, -55);
  const [days, weights, goal, plan, lifts] = await Promise.all([
    getDaySummaries(ctx, start, ctx.today),
    getWeights(ctx.userId, addDays(ctx.today, -400)),
    getActiveGoal(ctx.userId),
    getTrainingPlan(ctx.userId, ctx.prefs.training),
    getLiftTrends(ctx),
  ]);
  const energy = await getEnergy(ctx, days, weights);
  const recentIntakeDays = days.filter((d) => d.nutrition.entries > 0 && d.date >= addDays(ctx.today, -14) && d.date < ctx.today);
  const avgIntake = recentIntakeDays.length >= 5 ? recentIntakeDays.reduce((a, d) => a + d.nutrition.totals.calories, 0) / recentIntakeDays.length : null;
  const base = trendWeightAt(weights, ctx.today);
  const forecast =
    base != null
      ? forecastWeight({
          today: ctx.today,
          baseWeightKg: base,
          observedRatePerWeek: energy.stats.ratePerWeek,
          observedRateStdErr: energy.stats.ratePerWeekStdErr,
          avgIntake,
          tdee: energy.adaptive?.tdee ?? null,
          tdeeConfidence: energy.adaptive?.confidence ?? null,
          targetWeightKg: goal?.targetWeightKg ?? null,
          horizonDays: 182,
        })
      : null;
  const insights = generateInsights(
    {
      today: ctx.today,
      weekStartsOn: ctx.weekStartsOn,
      days,
      weights,
      goal: goal ? { startDate: goal.startDate, startWeightKg: goal.startWeightKg, targetWeightKg: goal.targetWeightKg, targetDate: goal.targetDate } : null,
      tdee: energy.adaptive,
      formulaTdee: energy.formula?.tdee ?? null,
      plannedWorkoutsPerWeek: plan.plannedPerWeek,
      cardioMinutesPerWeek: ctx.prefs.goals.cardioMinutesPerWeek,
      liftTrends: lifts,
    },
    insightFormatters(ctx),
  );
  return { days, weights, goal, plan, lifts, energy, forecast, insights, avgIntake, trendWeight: base };
});
