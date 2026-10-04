"use server";

import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { minutesBetweenClockTimes } from "@/lib/dates";
import { NOTE_TAGS } from "@/lib/domain";
import { clockTime, isoDate, optionalText, uuid } from "@/lib/validation";
import { db } from "@/server/db";
import { dailyNotes, sleepEntries, stepEntries, waterEntries } from "@/server/db/schema";
import { ActionError, assertNotFuture, createAction } from "./_lib";

// ── Water ─────────────────────────────────────────────────────────────────

export const addWater = createAction(z.object({ date: isoDate, amountMl: z.number().int().min(1).max(5000) }), async (input, ctx) => {
  assertNotFuture(input.date, ctx.today);
  const [row] = await db
    .insert(waterEntries)
    .values({ userId: ctx.userId, date: input.date, amountMl: input.amountMl })
    .returning({ id: waterEntries.id });
  return { id: row.id };
});

export const deleteWater = createAction(z.object({ id: uuid }), async (input, ctx) => {
  await db.delete(waterEntries).where(and(eq(waterEntries.id, input.id), eq(waterEntries.userId, ctx.userId)));
  return null;
});

/** Removes the most recent water entry of a day (undo for quick buttons). */
export const undoLastWater = createAction(z.object({ date: isoDate }), async (input, ctx) => {
  const last = (
    await db
      .select({ id: waterEntries.id })
      .from(waterEntries)
      .where(and(eq(waterEntries.userId, ctx.userId), eq(waterEntries.date, input.date)))
      .orderBy(desc(waterEntries.loggedAt))
      .limit(1)
  )[0];
  if (!last) throw new ActionError("not_found");
  await db.delete(waterEntries).where(eq(waterEntries.id, last.id));
  return null;
});

// ── Steps (manual source only; imported rows are never touched here) ──────

export const setSteps = createAction(
  z.object({ date: isoDate, steps: z.number().int().min(0).max(200000), mode: z.enum(["set", "add"]).default("set") }),
  async (input, ctx) => {
    assertNotFuture(input.date, ctx.today);
    const existing = (
      await db
        .select({ id: stepEntries.id, steps: stepEntries.steps })
        .from(stepEntries)
        .where(and(eq(stepEntries.userId, ctx.userId), eq(stepEntries.date, input.date), eq(stepEntries.source, "manual")))
        .limit(1)
    )[0];
    const steps = input.mode === "add" && existing ? Math.min(200000, existing.steps + input.steps) : input.steps;
    await db
      .insert(stepEntries)
      .values({ userId: ctx.userId, date: input.date, steps, source: "manual" })
      .onConflictDoUpdate({ target: [stepEntries.userId, stepEntries.date, stepEntries.source], set: { steps, isDemo: false } });
    return { steps };
  },
);

export const deleteSteps = createAction(z.object({ id: uuid }), async (input, ctx) => {
  await db.delete(stepEntries).where(and(eq(stepEntries.id, input.id), eq(stepEntries.userId, ctx.userId)));
  return null;
});

// ── Sleep ─────────────────────────────────────────────────────────────────

export const logSleep = createAction(
  z
    .object({
      date: isoDate,
      bedTime: clockTime.nullable(),
      wakeTime: clockTime.nullable(),
      durationMinutes: z.number().int().min(1).max(1440).nullable(),
      quality: z.number().int().min(1).max(5).nullable(),
      note: optionalText(500),
    })
    .refine((v) => (v.bedTime && v.wakeTime) || v.durationMinutes, { message: "duration_required" }),
  async (input, ctx) => {
    assertNotFuture(input.date, ctx.today);
    const durationMinutes =
      input.bedTime && input.wakeTime ? minutesBetweenClockTimes(input.bedTime, input.wakeTime) : (input.durationMinutes as number);
    const values = {
      bedTime: input.bedTime,
      wakeTime: input.wakeTime,
      durationMinutes,
      quality: input.quality,
      note: input.note,
      isDemo: false,
    };
    await db
      .insert(sleepEntries)
      .values({ userId: ctx.userId, date: input.date, source: "manual", ...values })
      .onConflictDoUpdate({ target: [sleepEntries.userId, sleepEntries.date, sleepEntries.source], set: values });
    return { durationMinutes };
  },
);

export const deleteSleep = createAction(z.object({ id: uuid }), async (input, ctx) => {
  await db.delete(sleepEntries).where(and(eq(sleepEntries.id, input.id), eq(sleepEntries.userId, ctx.userId)));
  return null;
});

// ── Daily notes ───────────────────────────────────────────────────────────

export const saveNote = createAction(
  z.object({
    date: isoDate,
    content: z.string().trim().max(4000),
    tags: z.array(z.enum(NOTE_TAGS)).max(10).default([]),
    energy: z.number().int().min(1).max(5).nullable().default(null),
  }),
  async (input, ctx) => {
    assertNotFuture(input.date, ctx.today);
    if (!input.content && !input.tags.length && input.energy == null) {
      await db.delete(dailyNotes).where(and(eq(dailyNotes.userId, ctx.userId), eq(dailyNotes.date, input.date)));
      return null;
    }
    const values = { content: input.content, tags: input.tags, energy: input.energy, isDemo: false };
    await db
      .insert(dailyNotes)
      .values({ userId: ctx.userId, date: input.date, ...values })
      .onConflictDoUpdate({ target: [dailyNotes.userId, dailyNotes.date], set: values });
    return null;
  },
);
