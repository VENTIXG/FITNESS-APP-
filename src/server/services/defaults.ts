import "server-only";
import { eq } from "drizzle-orm";
import type { AutoHabitMetric, Locale } from "@/lib/domain";
import { getDictionary } from "@/lib/i18n";
import type { DbOrTx } from "@/server/db";
import { habits } from "@/server/db/schema";

/** Spread N training days across the week (Mon-first), e.g. 4 → Mon, Tue, Thu, Fri. */
export function defaultTrainingWeekdays(n: number): number[] {
  const presets: Record<number, number[]> = {
    1: [3],
    2: [1, 4],
    3: [1, 3, 5],
    4: [1, 2, 4, 5],
    5: [1, 2, 3, 5, 6],
    6: [1, 2, 3, 4, 5, 6],
    7: [0, 1, 2, 3, 4, 5, 6],
  };
  return presets[Math.max(1, Math.min(7, Math.round(n)))] ?? [1, 3, 5];
}

/** Creates the standard automatic habits once (no-op if the user already has habits). */
export async function createDefaultHabits(tx: DbOrTx, userId: string, locale: Locale, trainingDaysPerWeek: number | null) {
  const existing = await tx.select({ id: habits.id }).from(habits).where(eq(habits.userId, userId)).limit(1);
  if (existing.length) return;
  const t = getDictionary(locale);
  const metrics: AutoHabitMetric[] = ["weight_logged", "protein_target", "calories_target", "steps_target", "workout", "cardio", "water_target", "supplements", "sleep_target"];
  const trainingDays = trainingDaysPerWeek ? defaultTrainingWeekdays(trainingDaysPerWeek) : [1, 3, 5];
  await tx.insert(habits).values(
    metrics.map((metric, i) => ({
      userId,
      name: t.enums.autoHabit[metric],
      type: "auto" as const,
      autoMetric: metric,
      schedule: metric === "workout" ? ("specific_days" as const) : ("daily" as const),
      daysOfWeek: metric === "workout" ? trainingDays : [],
      sortOrder: i,
      // Cardio isn't a daily expectation by default; keep it but inactive until the user opts in.
      isActive: metric !== "cardio",
    })),
  );
}
