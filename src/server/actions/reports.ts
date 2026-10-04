"use server";

import { z } from "zod";
import { isoDate, optionalText } from "@/lib/validation";
import { db } from "@/server/db";
import { weeklyReports } from "@/server/db/schema";
import { createAction } from "./_lib";

export const saveWeeklyReflection = createAction(
  z.object({ weekStart: isoDate, reflection: optionalText(4000), rating: z.number().int().min(1).max(5).nullable() }),
  async (input, ctx) => {
    await db
      .insert(weeklyReports)
      .values({ userId: ctx.userId, weekStart: input.weekStart, reflection: input.reflection, rating: input.rating })
      .onConflictDoUpdate({ target: [weeklyReports.userId, weeklyReports.weekStart], set: { reflection: input.reflection, rating: input.rating } });
    return null;
  },
);
