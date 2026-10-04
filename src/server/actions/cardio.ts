"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { CARDIO_ACTIVITIES } from "@/lib/domain";
import { isoDate, optionalText, uuid } from "@/lib/validation";
import { db } from "@/server/db";
import { cardioSessions } from "@/server/db/schema";
import { ActionError, assertNotFuture, createAction } from "./_lib";

const cardioSchema = z.object({
  date: isoDate,
  activity: z.enum(CARDIO_ACTIVITIES),
  durationSeconds: z.number().int().min(1).max(86400),
  distanceM: z.number().min(0).max(1_000_000).nullable(),
  avgHeartRate: z.number().int().min(30).max(250).nullable(),
  maxHeartRate: z.number().int().min(30).max(250).nullable(),
  calories: z.number().int().min(0).max(10000).nullable(),
  inclinePct: z.number().min(-10).max(40).nullable(),
  speedKmh: z.number().min(0).max(100).nullable(),
  notes: optionalText(1000),
});

export const createCardio = createAction(cardioSchema, async (input, ctx) => {
  assertNotFuture(input.date, ctx.today);
  const [row] = await db
    .insert(cardioSessions)
    .values({ userId: ctx.userId, ...input, source: "manual" })
    .returning({ id: cardioSessions.id });
  return { id: row.id };
});

export const updateCardio = createAction(cardioSchema.extend({ id: uuid }), async ({ id, ...input }, ctx) => {
  assertNotFuture(input.date, ctx.today);
  const res = await db
    .update(cardioSessions)
    .set({ ...input, isDemo: false })
    .where(and(eq(cardioSessions.id, id), eq(cardioSessions.userId, ctx.userId)))
    .returning({ id: cardioSessions.id });
  if (!res.length) throw new ActionError("not_found");
  return null;
});

export const deleteCardio = createAction(z.object({ id: uuid }), async (input, ctx) => {
  await db.delete(cardioSessions).where(and(eq(cardioSessions.id, input.id), eq(cardioSessions.userId, ctx.userId)));
  return null;
});
