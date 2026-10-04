"use server";

import { eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { LOCALE_COOKIE } from "@/lib/config";
import { isValidTimeZone } from "@/lib/dates";
import { ACTIVITY_LEVELS, LOCALES, PRIMARY_GOALS, SEXES, UNIT_SYSTEMS } from "@/lib/domain";
import { goalsPrefsSchema, trainingPrefsSchema } from "@/lib/preferences";
import { lbToKg } from "@/lib/units";
import { bodyFatPct, isoDate, weightKg } from "@/lib/validation";
import { getOnboardingContext } from "@/server/context";
import { db } from "@/server/db";
import { bodyCompositionEntries, goals, nutritionTargets, profiles, userPreferences, weightEntries } from "@/server/db/schema";
import { createDefaultHabits } from "@/server/services/defaults";
import { generateDemoData } from "@/server/services/demo";

const schema = z.object({
  primaryGoal: z.enum(PRIMARY_GOALS),
  sex: z.enum(SEXES).nullable(),
  birthDate: isoDate.nullable(),
  heightCm: z.number().min(50).max(280).nullable(),
  weightKg: weightKg.nullable(),
  bodyFatPct: bodyFatPct.nullable(),
  activityLevel: z.enum(ACTIVITY_LEVELS),
  trainingDaysPerWeek: z.number().int().min(0).max(14).nullable(),
  targetWeightKg: weightKg.nullable(),
  targetDate: isoDate.nullable(),
  calories: z.number().int().min(800).max(8000).nullable(),
  proteinG: z.number().min(0).max(800),
  carbsG: z.number().min(0).max(1500),
  fatG: z.number().min(0).max(500),
  fiberG: z.number().min(0).max(150),
  stepGoal: z.number().int().min(0).max(100000),
  waterGoalMl: z.number().int().min(0).max(10000),
  unitSystem: z.enum(UNIT_SYSTEMS),
  locale: z.enum(LOCALES),
  timezone: z.string().refine(isValidTimeZone),
  loadDemo: z.boolean(),
});

export type OnboardingInput = z.input<typeof schema>;

/** Switches the interface language during onboarding (before the profile is complete). */
export async function setOnboardingLocale(locale: string) {
  const ctx = await getOnboardingContext();
  const parsed = z.enum(LOCALES).safeParse(locale);
  if (!parsed.success) return;
  await db.update(profiles).set({ locale: parsed.data }).where(eq(profiles.userId, ctx.userId));
  (await cookies()).set(LOCALE_COOKIE, parsed.data, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
}

export async function completeOnboarding(raw: OnboardingInput): Promise<{ ok: false; error: string } | never> {
  const ctx = await getOnboardingContext();
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "validation" };
  const v = parsed.data;
  if ((v.birthDate && v.birthDate > ctx.today) || (v.targetDate && v.targetDate <= ctx.today)) return { ok: false, error: "validation" };

  const imperial = v.unitSystem === "imperial";
  const training = trainingPrefsSchema.parse({
    plannedWorkoutsPerWeek: v.trainingDaysPerWeek ?? 4,
    ...(imperial ? { incrementUpperKg: lbToKg(5), incrementLowerKg: lbToKg(10), incrementIsolationKg: lbToKg(5), roundingKg: lbToKg(5) } : {}),
  });
  const goalsPrefs = goalsPrefsSchema.parse({ stepGoal: v.stepGoal, waterGoalMl: v.waterGoalMl });

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(profiles)
        .set({
          primaryGoal: v.primaryGoal,
          sex: v.sex,
          birthDate: v.birthDate,
          heightCm: v.heightCm,
          activityLevel: v.activityLevel,
          trainingDaysPerWeek: v.trainingDaysPerWeek,
          unitSystem: v.unitSystem,
          locale: v.locale,
          timezone: v.timezone,
          onboardingCompletedAt: new Date(),
        })
        .where(eq(profiles.userId, ctx.userId));
      await tx
        .insert(userPreferences)
        .values({ userId: ctx.userId, goals: goalsPrefs, training })
        .onConflictDoUpdate({ target: userPreferences.userId, set: { goals: goalsPrefs, training, updatedAt: sql`now()` } });
      if (v.calories) {
        await tx
          .insert(nutritionTargets)
          .values({ userId: ctx.userId, effectiveFrom: ctx.today, calories: v.calories, proteinG: v.proteinG, carbsG: v.carbsG, fatG: v.fatG, fiberG: v.fiberG })
          .onConflictDoNothing();
      }
      if (v.weightKg) {
        await tx.insert(weightEntries).values({ userId: ctx.userId, date: ctx.today, weightKg: v.weightKg, source: "manual" }).onConflictDoNothing();
      }
      if (v.bodyFatPct) {
        await tx.insert(bodyCompositionEntries).values({ userId: ctx.userId, date: ctx.today, bodyFatPct: v.bodyFatPct }).onConflictDoNothing();
      }
      if (v.weightKg && v.targetWeightKg) {
        await tx
          .insert(goals)
          .values({ userId: ctx.userId, startDate: ctx.today, startWeightKg: v.weightKg, targetWeightKg: v.targetWeightKg, targetDate: v.targetDate })
          .onConflictDoNothing();
      }
      await createDefaultHabits(tx, ctx.userId, v.locale, v.trainingDaysPerWeek);
      if (v.loadDemo) await generateDemoData(tx, ctx.userId, ctx.today);
    });
  } catch (err) {
    console.error("[onboarding]", err);
    return { ok: false, error: "generic" };
  }
  (await cookies()).set(LOCALE_COOKIE, v.locale, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  redirect("/");
}
