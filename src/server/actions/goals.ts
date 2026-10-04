"use server";

import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { targetForDate } from "@/lib/calc/nutrition";
import { bodyFatPct, isoDate, optionalText, uuid, weightKg } from "@/lib/validation";
import { db } from "@/server/db";
import { goals, nutritionTargets } from "@/server/db/schema";
import { ActionError, createAction } from "./_lib";

const goalSchema = z.object({
  startDate: isoDate,
  startWeightKg: weightKg,
  targetWeightKg: weightKg,
  targetBodyFatPct: bodyFatPct.nullable(),
  targetDate: isoDate.nullable(),
  notes: optionalText(1000),
});

/** Creates a new active goal; the previous active goal is archived (kept in history). */
export const createGoal = createAction(goalSchema, async (input, ctx) => {
  if (input.targetDate && input.targetDate <= input.startDate) throw new ActionError("validation");
  await db.transaction(async (tx) => {
    await tx.update(goals).set({ status: "archived" }).where(and(eq(goals.userId, ctx.userId), eq(goals.status, "active")));
    await tx.insert(goals).values({ userId: ctx.userId, ...input });
  });
  return null;
});

export const updateGoal = createAction(goalSchema.extend({ id: uuid }), async ({ id, ...input }, ctx) => {
  if (input.targetDate && input.targetDate <= input.startDate) throw new ActionError("validation");
  const res = await db.update(goals).set({ ...input, isDemo: false }).where(and(eq(goals.id, id), eq(goals.userId, ctx.userId))).returning({ id: goals.id });
  if (!res.length) throw new ActionError("not_found");
  return null;
});

export const setGoalStatus = createAction(z.object({ id: uuid, status: z.enum(["completed", "archived"]) }), async (input, ctx) => {
  await db
    .update(goals)
    .set({ status: input.status, completedAt: input.status === "completed" ? new Date() : null })
    .where(and(eq(goals.id, input.id), eq(goals.userId, ctx.userId)));
  return null;
});

export const deleteGoal = createAction(z.object({ id: uuid }), async (input, ctx) => {
  await db.delete(goals).where(and(eq(goals.id, input.id), eq(goals.userId, ctx.userId)));
  return null;
});

/**
 * Applies a suggested calorie target from today, keeping protein and fat targets
 * and letting carbohydrates absorb the difference. Only runs when the user taps it.
 */
export const applyCalorieSuggestion = createAction(z.object({ calories: z.number().int().min(1000).max(8000) }), async (input, ctx) => {
  const all = await db.select().from(nutritionTargets).where(eq(nutritionTargets.userId, ctx.userId)).orderBy(desc(nutritionTargets.effectiveFrom));
  const current = targetForDate(all, ctx.today);
  const proteinG = current?.proteinG ?? 150;
  const fatG = current?.fatG ?? 70;
  const fiberG = current?.fiberG ?? 30;
  const carbsG = Math.max(0, Math.round((input.calories - proteinG * 4 - fatG * 9) / 4));
  const values = { calories: input.calories, proteinG, carbsG, fatG, fiberG, sugarG: current?.sugarG ?? null, sodiumMg: current?.sodiumMg ?? null };
  await db
    .insert(nutritionTargets)
    .values({ userId: ctx.userId, effectiveFrom: ctx.today, ...values })
    .onConflictDoUpdate({ target: [nutritionTargets.userId, nutritionTargets.effectiveFrom], set: values });
  return null;
});
