"use server";

import { eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { z } from "zod";
import { LOCALE_COOKIE } from "@/lib/config";
import { isValidTimeZone } from "@/lib/dates";
import {
  ACTIVITY_LEVELS,
  DASHBOARD_CARDS,
  LOCALES,
  PRIMARY_GOALS,
  SCORE_COMPONENTS,
  SEXES,
  THEMES,
  UNIT_SYSTEMS,
} from "@/lib/domain";
import {
  goalsPrefsSchema,
  mealSlotSchema,
  notificationPrefsSchema,
  trainingPrefsSchema,
} from "@/lib/preferences";
import { isoDate } from "@/lib/validation";
import { db } from "@/server/db";
import { nutritionTargets, profiles, userPreferences } from "@/server/db/schema";
import { ActionError, createAction } from "./_lib";

async function patchPrefs(userId: string, column: "goals" | "training" | "nutrition" | "dashboard" | "scoring" | "notifications", value: unknown) {
  await db
    .insert(userPreferences)
    .values({ userId, [column]: value })
    .onConflictDoUpdate({ target: userPreferences.userId, set: { [column]: value, updatedAt: sql`now()` } });
}

export const saveDashboardLayout = createAction(
  z.object({ order: z.array(z.enum(DASHBOARD_CARDS)).max(20), hidden: z.array(z.enum(DASHBOARD_CARDS)).max(20) }),
  async (input, ctx) => {
    await patchPrefs(ctx.userId, "dashboard", input);
    return null;
  },
  { revalidate: false },
);

export const saveProfile = createAction(
  z.object({
    displayName: z.string().trim().max(80).nullable(),
    sex: z.enum(SEXES).nullable(),
    birthDate: isoDate.nullable(),
    heightCm: z.number().min(50).max(280).nullable(),
    activityLevel: z.enum(ACTIVITY_LEVELS),
    primaryGoal: z.enum(PRIMARY_GOALS),
    trainingDaysPerWeek: z.number().int().min(0).max(14).nullable(),
  }),
  async (input, ctx) => {
    if (input.birthDate && input.birthDate > ctx.today) throw new ActionError("future_date");
    await db.update(profiles).set({ ...input, displayName: input.displayName || null }).where(eq(profiles.userId, ctx.userId));
    return null;
  },
);

export const savePreferences = createAction(
  z.object({
    unitSystem: z.enum(UNIT_SYSTEMS),
    locale: z.enum(LOCALES),
    theme: z.enum(THEMES),
    timezone: z.string().max(80).refine(isValidTimeZone, "invalid_timezone"),
    weekStartsOn: z.union([z.literal(0), z.literal(1)]),
  }),
  async (input, ctx) => {
    await db.update(profiles).set(input).where(eq(profiles.userId, ctx.userId));
    (await cookies()).set(LOCALE_COOKIE, input.locale, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
    return null;
  },
);

export const saveGoalsPrefs = createAction(goalsPrefsSchema, async (input, ctx) => {
  await patchPrefs(ctx.userId, "goals", input);
  return null;
});

export const saveTrainingPrefs = createAction(
  trainingPrefsSchema.refine((v) => v.defaultRepMin <= v.defaultRepMax, { path: ["defaultRepMax"], message: "range" }),
  async (input, ctx) => {
    await patchPrefs(ctx.userId, "training", input);
    return null;
  },
);

export const saveNutritionPrefs = createAction(
  z.object({ mealSlots: z.array(mealSlotSchema).min(1).max(8), showSugar: z.boolean(), showSodium: z.boolean() }),
  async (input, ctx) => {
    const ids = new Set(input.mealSlots.map((s) => s.id));
    if (ids.size !== input.mealSlots.length) throw new ActionError("validation");
    await patchPrefs(ctx.userId, "nutrition", input);
    return null;
  },
);

export const saveScoringPrefs = createAction(
  z.object({ enabled: z.boolean(), weights: z.record(z.enum(SCORE_COMPONENTS), z.number().int().min(0).max(5)) }),
  async (input, ctx) => {
    await patchPrefs(ctx.userId, "scoring", input);
    return null;
  },
);

export const saveNotificationPrefs = createAction(notificationPrefsSchema, async (input, ctx) => {
  await patchPrefs(ctx.userId, "notifications", input);
  return null;
});

/** Adds a nutrition target row effective from a date (history is preserved). */
export const saveNutritionTarget = createAction(
  z.object({
    effectiveFrom: isoDate,
    calories: z.number().int().min(500).max(10000),
    proteinG: z.number().min(0).max(1000),
    carbsG: z.number().min(0).max(2000),
    fatG: z.number().min(0).max(1000),
    fiberG: z.number().min(0).max(300),
    sugarG: z.number().min(0).max(1000).nullable(),
    sodiumMg: z.number().min(0).max(20000).nullable(),
  }),
  async (input, ctx) => {
    const values = { ...input };
    await db
      .insert(nutritionTargets)
      .values({ userId: ctx.userId, ...values })
      .onConflictDoUpdate({ target: [nutritionTargets.userId, nutritionTargets.effectiveFrom], set: values });
    return null;
  },
);
