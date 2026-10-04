import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/server/db";
import { goals, nutritionTargets, profiles } from "@/server/db/schema";

export const getTargets = cache(async (userId: string) =>
  db.select().from(nutritionTargets).where(eq(nutritionTargets.userId, userId)).orderBy(asc(nutritionTargets.effectiveFrom)),
);

export const getActiveGoal = cache(async (userId: string) => {
  const rows = await db
    .select()
    .from(goals)
    .where(and(eq(goals.userId, userId), eq(goals.status, "active")))
    .orderBy(desc(goals.createdAt))
    .limit(1);
  return rows[0] ?? null;
});

export const getProfile = cache(async (userId: string) => {
  const rows = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  return rows[0] ?? null;
});
