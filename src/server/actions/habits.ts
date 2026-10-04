"use server";

import { and, eq, inArray, max } from "drizzle-orm";
import { z } from "zod";
import { AUTO_HABIT_METRICS, HABIT_SCHEDULES, SUPPLEMENT_SCHEDULES, SUPPLEMENT_TIMINGS } from "@/lib/domain";
import { isoDate, optionalText, requiredName, uuid } from "@/lib/validation";
import { db } from "@/server/db";
import { habitLogs, habits, supplementLogs, supplements } from "@/server/db/schema";
import { ActionError, assertNotFuture, createAction } from "./_lib";

const weekdays = z.array(z.number().int().min(0).max(6)).max(7);

const habitSchema = z
  .object({
    name: requiredName(80),
    type: z.enum(["manual", "auto"]),
    autoMetric: z.enum(AUTO_HABIT_METRICS).nullable(),
    schedule: z.enum(HABIT_SCHEDULES),
    daysOfWeek: weekdays,
    icon: z.string().max(40).nullable().default(null),
  })
  .refine((v) => (v.type === "auto") === (v.autoMetric != null), { path: ["autoMetric"], message: "required" })
  .refine((v) => v.schedule === "daily" || v.daysOfWeek.length > 0, { path: ["daysOfWeek"], message: "required" });

export const createHabit = createAction(habitSchema, async (input, ctx) => {
  const [{ m }] = await db.select({ m: max(habits.sortOrder) }).from(habits).where(eq(habits.userId, ctx.userId));
  const [row] = await db
    .insert(habits)
    .values({ userId: ctx.userId, ...input, daysOfWeek: input.schedule === "daily" ? [] : input.daysOfWeek, sortOrder: (m ?? 0) + 1 })
    .returning({ id: habits.id });
  return { id: row.id };
});

export const updateHabit = createAction(habitSchema.and(z.object({ id: uuid, isActive: z.boolean() })), async ({ id, ...input }, ctx) => {
  const res = await db
    .update(habits)
    .set({ ...input, daysOfWeek: input.schedule === "daily" ? [] : input.daysOfWeek, isDemo: false })
    .where(and(eq(habits.id, id), eq(habits.userId, ctx.userId)))
    .returning({ id: habits.id });
  if (!res.length) throw new ActionError("not_found");
  return null;
});

export const deleteHabit = createAction(z.object({ id: uuid }), async (input, ctx) => {
  await db.delete(habits).where(and(eq(habits.id, input.id), eq(habits.userId, ctx.userId)));
  return null;
});

export const reorderHabits = createAction(z.object({ ids: z.array(uuid).max(100) }), async (input, ctx) => {
  await db.transaction(async (tx) => {
    for (const [i, id] of input.ids.entries()) {
      await tx.update(habits).set({ sortOrder: i }).where(and(eq(habits.id, id), eq(habits.userId, ctx.userId)));
    }
  });
  return null;
});

export const toggleHabit = createAction(z.object({ habitId: uuid, date: isoDate, done: z.boolean() }), async (input, ctx) => {
  assertNotFuture(input.date, ctx.today);
  const habit = (await db.select({ type: habits.type }).from(habits).where(and(eq(habits.id, input.habitId), eq(habits.userId, ctx.userId))).limit(1))[0];
  if (!habit) throw new ActionError("not_found");
  if (habit.type !== "manual") throw new ActionError("validation");
  if (input.done) {
    await db.insert(habitLogs).values({ userId: ctx.userId, habitId: input.habitId, date: input.date }).onConflictDoNothing();
  } else {
    await db.delete(habitLogs).where(and(eq(habitLogs.habitId, input.habitId), eq(habitLogs.date, input.date), eq(habitLogs.userId, ctx.userId)));
  }
  return null;
});

// ── Supplements ───────────────────────────────────────────────────────────

const supplementSchema = z
  .object({
    name: requiredName(80),
    dose: z.number().min(0).max(100000).nullable(),
    doseUnit: z.string().trim().max(20).nullable(),
    schedule: z.enum(SUPPLEMENT_SCHEDULES),
    daysOfWeek: weekdays,
    timing: z.enum(SUPPLEMENT_TIMINGS).nullable(),
    notes: optionalText(500),
  })
  .refine((v) => v.schedule !== "specific_days" || v.daysOfWeek.length > 0, { path: ["daysOfWeek"], message: "required" });

export const createSupplement = createAction(supplementSchema, async (input, ctx) => {
  const [{ m }] = await db.select({ m: max(supplements.sortOrder) }).from(supplements).where(eq(supplements.userId, ctx.userId));
  const [row] = await db
    .insert(supplements)
    .values({ userId: ctx.userId, ...input, daysOfWeek: input.schedule === "specific_days" ? input.daysOfWeek : [], sortOrder: (m ?? 0) + 1 })
    .returning({ id: supplements.id });
  return { id: row.id };
});

export const updateSupplement = createAction(supplementSchema.and(z.object({ id: uuid, isActive: z.boolean() })), async ({ id, ...input }, ctx) => {
  const res = await db
    .update(supplements)
    .set({ ...input, daysOfWeek: input.schedule === "specific_days" ? input.daysOfWeek : [], isDemo: false })
    .where(and(eq(supplements.id, id), eq(supplements.userId, ctx.userId)))
    .returning({ id: supplements.id });
  if (!res.length) throw new ActionError("not_found");
  return null;
});

export const deleteSupplement = createAction(z.object({ id: uuid }), async (input, ctx) => {
  await db.delete(supplements).where(and(eq(supplements.id, input.id), eq(supplements.userId, ctx.userId)));
  return null;
});

export const toggleSupplement = createAction(z.object({ supplementId: uuid, date: isoDate, taken: z.boolean() }), async (input, ctx) => {
  assertNotFuture(input.date, ctx.today);
  const owned = await db.select({ id: supplements.id }).from(supplements).where(and(eq(supplements.id, input.supplementId), eq(supplements.userId, ctx.userId)));
  if (!owned.length) throw new ActionError("not_found");
  if (input.taken) {
    await db.insert(supplementLogs).values({ userId: ctx.userId, supplementId: input.supplementId, date: input.date }).onConflictDoNothing();
  } else {
    await db.delete(supplementLogs).where(and(eq(supplementLogs.supplementId, input.supplementId), eq(supplementLogs.date, input.date)));
  }
  return null;
});

/** Mark all supplements due on a date as taken. */
export const takeAllSupplements = createAction(z.object({ ids: z.array(uuid).max(50), date: isoDate }), async (input, ctx) => {
  assertNotFuture(input.date, ctx.today);
  if (!input.ids.length) return null;
  const owned = await db
    .select({ id: supplements.id })
    .from(supplements)
    .where(and(eq(supplements.userId, ctx.userId), inArray(supplements.id, input.ids)));
  if (owned.length) {
    await db
      .insert(supplementLogs)
      .values(owned.map((s) => ({ userId: ctx.userId, supplementId: s.id, date: input.date })))
      .onConflictDoNothing();
  }
  return null;
});
