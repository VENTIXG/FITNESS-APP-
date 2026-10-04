"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { MEASUREMENT_SITES, BODY_FAT_METHODS } from "@/lib/domain";
import { bodyFatPct, circumferenceCm, isoDate, optionalText, uuid, weightKg } from "@/lib/validation";
import { db } from "@/server/db";
import { bodyCompositionEntries, bodyMeasurements, weightEntries } from "@/server/db/schema";
import { ActionError, assertNotFuture, createAction } from "./_lib";

// ── Weight ────────────────────────────────────────────────────────────────

export type LogWeightResult = { status: "saved"; id: string } | { status: "exists"; existingKg: number; id: string };

export const logWeight = createAction(
  z.object({ date: isoDate, weightKg, note: optionalText(500), replace: z.boolean().default(false) }),
  async (input, ctx): Promise<LogWeightResult> => {
    assertNotFuture(input.date, ctx.today);
    const existing = (
      await db
        .select({ id: weightEntries.id, weightKg: weightEntries.weightKg })
        .from(weightEntries)
        .where(and(eq(weightEntries.userId, ctx.userId), eq(weightEntries.date, input.date)))
        .limit(1)
    )[0];
    if (existing && !input.replace) {
      // Never overwrite silently — the client asks for confirmation first.
      return { status: "exists", existingKg: existing.weightKg, id: existing.id };
    }
    if (existing) {
      await db
        .update(weightEntries)
        .set({ weightKg: input.weightKg, note: input.note, source: "manual", isDemo: false, measuredAt: new Date() })
        .where(and(eq(weightEntries.id, existing.id), eq(weightEntries.userId, ctx.userId)));
      return { status: "saved", id: existing.id };
    }
    const [row] = await db
      .insert(weightEntries)
      .values({ userId: ctx.userId, date: input.date, weightKg: input.weightKg, note: input.note, source: "manual", measuredAt: new Date() })
      .returning({ id: weightEntries.id });
    return { status: "saved", id: row.id };
  },
);

export const updateWeight = createAction(
  z.object({ id: uuid, date: isoDate, weightKg, note: optionalText(500) }),
  async (input, ctx) => {
    assertNotFuture(input.date, ctx.today);
    const res = await db
      .update(weightEntries)
      .set({ date: input.date, weightKg: input.weightKg, note: input.note, isDemo: false })
      .where(and(eq(weightEntries.id, input.id), eq(weightEntries.userId, ctx.userId)))
      .returning({ id: weightEntries.id });
    if (!res.length) throw new ActionError("not_found");
    return null;
  },
);

export const deleteWeight = createAction(z.object({ id: uuid }), async (input, ctx) => {
  await db.delete(weightEntries).where(and(eq(weightEntries.id, input.id), eq(weightEntries.userId, ctx.userId)));
  return null;
});

// ── Body composition ──────────────────────────────────────────────────────

export const saveBodyComposition = createAction(
  z
    .object({
      date: isoDate,
      bodyFatPct: bodyFatPct.nullable(),
      leanMassKg: z.number().min(10).max(250).nullable(),
      fatMassKg: z.number().min(1).max(250).nullable(),
      method: z.enum(BODY_FAT_METHODS).nullable(),
      note: optionalText(500),
    })
    .refine((v) => v.bodyFatPct != null || v.leanMassKg != null || v.fatMassKg != null, { message: "empty" }),
  async (input, ctx) => {
    assertNotFuture(input.date, ctx.today);
    const values = {
      bodyFatPct: input.bodyFatPct,
      leanMassKg: input.leanMassKg,
      fatMassKg: input.fatMassKg,
      method: input.method,
      note: input.note,
      source: "manual" as const,
      isDemo: false,
    };
    await db
      .insert(bodyCompositionEntries)
      .values({ userId: ctx.userId, date: input.date, ...values })
      .onConflictDoUpdate({ target: [bodyCompositionEntries.userId, bodyCompositionEntries.date], set: values });
    return null;
  },
);

export const deleteBodyComposition = createAction(z.object({ id: uuid }), async (input, ctx) => {
  await db.delete(bodyCompositionEntries).where(and(eq(bodyCompositionEntries.id, input.id), eq(bodyCompositionEntries.userId, ctx.userId)));
  return null;
});

// ── Measurements ──────────────────────────────────────────────────────────

const siteShape = Object.fromEntries(MEASUREMENT_SITES.map((s) => [s, circumferenceCm.nullable()])) as Record<
  (typeof MEASUREMENT_SITES)[number],
  z.ZodNullable<typeof circumferenceCm>
>;

export const saveMeasurements = createAction(
  z.object({ date: isoDate, note: optionalText(500), ...siteShape }),
  async (input, ctx) => {
    assertNotFuture(input.date, ctx.today);
    const values = {
      waistCm: input.waist,
      chestCm: input.chest,
      neckCm: input.neck,
      shouldersCm: input.shoulders,
      leftArmCm: input.leftArm,
      rightArmCm: input.rightArm,
      hipsCm: input.hips,
      leftThighCm: input.leftThigh,
      rightThighCm: input.rightThigh,
      calfCm: input.calf,
      note: input.note,
      isDemo: false,
    };
    if (Object.entries(values).every(([k, v]) => k === "isDemo" || k === "note" || v == null)) throw new ActionError("validation");
    await db
      .insert(bodyMeasurements)
      .values({ userId: ctx.userId, date: input.date, ...values })
      .onConflictDoUpdate({ target: [bodyMeasurements.userId, bodyMeasurements.date], set: values });
    return null;
  },
);

export const deleteMeasurements = createAction(z.object({ id: uuid }), async (input, ctx) => {
  await db.delete(bodyMeasurements).where(and(eq(bodyMeasurements.id, input.id), eq(bodyMeasurements.userId, ctx.userId)));
  return null;
});

/** Existing measurement row for a date (to prefill the form so edits are explicit). */
export const getMeasurementsForDate = createAction(
  z.object({ date: isoDate }),
  async (input, ctx) => {
    const row = (
      await db
        .select()
        .from(bodyMeasurements)
        .where(and(eq(bodyMeasurements.userId, ctx.userId), eq(bodyMeasurements.date, input.date)))
        .limit(1)
    )[0];
    return row ?? null;
  },
  { revalidate: false },
);
