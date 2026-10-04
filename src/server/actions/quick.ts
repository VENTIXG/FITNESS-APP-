"use server";

import { and, desc, eq, sum } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { stepEntries, waterEntries, weightEntries } from "@/server/db/schema";
import { createAction } from "./_lib";

/** Small read used to prefill quick-add forms (last weight, today's water/steps). */
export const getQuickAddDefaults = createAction(
  z.object({}),
  async (_input, ctx) => {
    const [lastWeight, water, steps] = await Promise.all([
      db
        .select({ weightKg: weightEntries.weightKg })
        .from(weightEntries)
        .where(eq(weightEntries.userId, ctx.userId))
        .orderBy(desc(weightEntries.date))
        .limit(1),
      db
        .select({ total: sum(waterEntries.amountMl) })
        .from(waterEntries)
        .where(and(eq(waterEntries.userId, ctx.userId), eq(waterEntries.date, ctx.today))),
      db
        .select({ steps: stepEntries.steps })
        .from(stepEntries)
        .where(and(eq(stepEntries.userId, ctx.userId), eq(stepEntries.date, ctx.today), eq(stepEntries.source, "manual")))
        .limit(1),
    ]);
    return {
      lastWeightKg: lastWeight[0]?.weightKg ?? null,
      waterMl: Number(water[0]?.total ?? 0),
      manualSteps: steps[0]?.steps ?? null,
    };
  },
  { revalidate: false },
);
