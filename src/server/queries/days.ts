import "server-only";
import { and, count, eq, gte, lte, sql, sum } from "drizzle-orm";
import { emptyDaySummary, type DaySummary } from "@/lib/calc/day";
import { targetForDate } from "@/lib/calc/nutrition";
import { dateOfInstant, eachDay, weekday, type ISODate } from "@/lib/dates";
import { IMPORTED_SOURCES } from "@/lib/domain";
import type { UserContext } from "@/server/context";
import { db } from "@/server/db";
import {
  cardioSessions,
  dailyNotes,
  foodEntries,
  sleepEntries,
  stepEntries,
  supplementLogs,
  supplements,
  waterEntries,
  weightEntries,
  workouts,
} from "@/server/db/schema";
import { getTargets } from "./common";
import { getTrainingPlan, isPlannedOn } from "./training";

/**
 * Consolidated per-day data for [start, end]. A handful of grouped queries,
 * independent of range length.
 *
 * Source preference: steps use imported (device) data when present, else manual;
 * sleep uses the manual entry when present (it carries quality), else imported.
 */
export async function getDaySummaries(ctx: UserContext, start: ISODate, end: ISODate): Promise<DaySummary[]> {
  const uid = ctx.userId;
  const goals = ctx.prefs.goals;
  const [weights, food, steps, wos, cardio, water, sleep, supps, suppLogs, targets, plan] = await Promise.all([
    db
      .select({ date: weightEntries.date, weightKg: weightEntries.weightKg })
      .from(weightEntries)
      .where(and(eq(weightEntries.userId, uid), gte(weightEntries.date, start), lte(weightEntries.date, end))),
    db
      .select({
        date: foodEntries.date,
        entries: count(),
        calories: sum(foodEntries.calories).mapWith(Number),
        proteinG: sum(foodEntries.proteinG).mapWith(Number),
        carbsG: sum(foodEntries.carbsG).mapWith(Number),
        fatG: sum(foodEntries.fatG).mapWith(Number),
        fiberG: sum(foodEntries.fiberG).mapWith(Number),
        sugarG: sum(foodEntries.sugarG).mapWith(Number),
        sodiumMg: sum(foodEntries.sodiumMg).mapWith(Number),
      })
      .from(foodEntries)
      .where(and(eq(foodEntries.userId, uid), gte(foodEntries.date, start), lte(foodEntries.date, end)))
      .groupBy(foodEntries.date),
    db
      .select({ date: stepEntries.date, steps: stepEntries.steps, source: stepEntries.source })
      .from(stepEntries)
      .where(and(eq(stepEntries.userId, uid), gte(stepEntries.date, start), lte(stepEntries.date, end))),
    db
      .select({ date: workouts.date, n: count() })
      .from(workouts)
      .where(and(eq(workouts.userId, uid), eq(workouts.status, "completed"), gte(workouts.date, start), lte(workouts.date, end)))
      .groupBy(workouts.date),
    db
      .select({ date: cardioSessions.date, n: count(), seconds: sum(cardioSessions.durationSeconds).mapWith(Number) })
      .from(cardioSessions)
      .where(and(eq(cardioSessions.userId, uid), gte(cardioSessions.date, start), lte(cardioSessions.date, end)))
      .groupBy(cardioSessions.date),
    db
      .select({ date: waterEntries.date, ml: sum(waterEntries.amountMl).mapWith(Number) })
      .from(waterEntries)
      .where(and(eq(waterEntries.userId, uid), gte(waterEntries.date, start), lte(waterEntries.date, end)))
      .groupBy(waterEntries.date),
    db
      .select({ date: sleepEntries.date, minutes: sleepEntries.durationMinutes, source: sleepEntries.source })
      .from(sleepEntries)
      .where(and(eq(sleepEntries.userId, uid), gte(sleepEntries.date, start), lte(sleepEntries.date, end))),
    db
      .select({ id: supplements.id, schedule: supplements.schedule, daysOfWeek: supplements.daysOfWeek, isActive: supplements.isActive, createdAt: supplements.createdAt })
      .from(supplements)
      .where(eq(supplements.userId, uid)),
    db
      .select({ date: supplementLogs.date, n: count() })
      .from(supplementLogs)
      .where(and(eq(supplementLogs.userId, uid), gte(supplementLogs.date, start), lte(supplementLogs.date, end)))
      .groupBy(supplementLogs.date),
    getTargets(uid),
    getTrainingPlan(uid, ctx.prefs.training),
  ]);

  const byDate = new Map<ISODate, DaySummary>();
  const cardioDaily = goals.cardioMinutesPerWeek / 7;
  for (const d of eachDay(start, end)) {
    const s = emptyDaySummary(d, {
      stepGoal: goals.stepGoal,
      waterGoalMl: goals.waterGoalMl,
      sleepGoalMinutes: goals.sleepGoalMinutes,
      cardioDailyTargetMin: cardioDaily,
    });
    s.nutrition.target = targetForDate(targets, d);
    s.workoutPlanned = isPlannedOn(plan.plannedWeekdays, d);
    byDate.set(d, s);
  }

  for (const w of weights) {
    const s = byDate.get(w.date);
    if (s) s.weightKg = w.weightKg;
  }
  for (const f of food) {
    const s = byDate.get(f.date);
    if (!s) continue;
    s.nutrition.entries = f.entries;
    s.nutrition.totals = {
      calories: f.calories ?? 0,
      proteinG: f.proteinG ?? 0,
      carbsG: f.carbsG ?? 0,
      fatG: f.fatG ?? 0,
      fiberG: f.fiberG ?? 0,
      sugarG: f.sugarG ?? null,
      sodiumMg: f.sodiumMg ?? null,
    };
  }
  const stepsByDate = new Map<ISODate, { imported: number | null; manual: number | null }>();
  for (const r of steps) {
    const cur = stepsByDate.get(r.date) ?? { imported: null, manual: null };
    if (IMPORTED_SOURCES.includes(r.source)) cur.imported = Math.max(cur.imported ?? 0, r.steps);
    else cur.manual = r.steps;
    stepsByDate.set(r.date, cur);
  }
  for (const [date, v] of stepsByDate) {
    const s = byDate.get(date);
    if (s) s.steps = v.imported ?? v.manual;
  }
  for (const w of wos) {
    const s = byDate.get(w.date);
    if (s) s.workoutsCompleted = w.n;
  }
  for (const c of cardio) {
    const s = byDate.get(c.date);
    if (!s) continue;
    s.cardioSessions = c.n;
    s.cardioMinutes = (c.seconds ?? 0) / 60;
  }
  for (const w of water) {
    const s = byDate.get(w.date);
    if (s) s.waterMl = w.ml ?? 0;
  }
  for (const r of sleep) {
    const s = byDate.get(r.date);
    if (!s) continue;
    if (r.source === "manual" || s.sleepMinutes == null) s.sleepMinutes = r.minutes;
  }

  // Supplements due: active, scheduled that weekday, and existing on that date.
  const activeSupps = supps
    .filter((x) => x.isActive && x.schedule !== "as_needed")
    .map((x) => ({ ...x, since: dateOfInstant(x.createdAt, ctx.timezone) }));
  for (const s of byDate.values()) {
    const wd = weekday(s.date);
    s.supplementsDue = activeSupps.filter((x) => x.since <= s.date && (x.schedule === "daily" || x.daysOfWeek.includes(wd))).length;
  }
  for (const l of suppLogs) {
    const s = byDate.get(l.date);
    if (s) s.supplementsTaken = l.n;
  }

  return [...byDate.values()];
}

/** Earliest date with any logged data (bounds streak calculations). */
export async function getFirstDataDate(userId: string): Promise<ISODate | null> {
  const rows = await db.execute<{ d: string | null }>(sql`
    select least(
      (select min(date) from ${weightEntries} where user_id = ${userId}),
      (select min(date) from ${foodEntries} where user_id = ${userId}),
      (select min(date) from ${workouts} where user_id = ${userId}),
      (select min(date) from ${stepEntries} where user_id = ${userId}),
      (select min(date) from ${cardioSessions} where user_id = ${userId})
    )::text as d`);
  return rows[0]?.d ?? null;
}

/** Sleep entry, note and weight entry for one date. */
export async function getDayExtras(userId: string, date: ISODate) {
  const [sleep, note, weight] = await Promise.all([
    db.select().from(sleepEntries).where(and(eq(sleepEntries.userId, userId), eq(sleepEntries.date, date))).orderBy(sql`case when ${sleepEntries.source} = 'manual' then 0 else 1 end`).limit(1),
    db.select().from(dailyNotes).where(and(eq(dailyNotes.userId, userId), eq(dailyNotes.date, date))).limit(1),
    db.select().from(weightEntries).where(and(eq(weightEntries.userId, userId), eq(weightEntries.date, date))).limit(1),
  ]);
  return { sleep: sleep[0] ?? null, note: note[0] ?? null, weight: weight[0] ?? null };
}

export async function getWaterEntries(userId: string, date: ISODate) {
  return db.select().from(waterEntries).where(and(eq(waterEntries.userId, userId), eq(waterEntries.date, date))).orderBy(sql`${waterEntries.loggedAt} desc`);
}

export async function getSleepEntries(userId: string, start: ISODate, end: ISODate) {
  return db
    .select()
    .from(sleepEntries)
    .where(and(eq(sleepEntries.userId, userId), gte(sleepEntries.date, start), lte(sleepEntries.date, end)))
    .orderBy(sql`${sleepEntries.date} desc`);
}
