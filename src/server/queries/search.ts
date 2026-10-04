import "server-only";
import { and, desc, eq, isNull, or, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { normalizeSearch } from "@/lib/utils";
import { db } from "@/server/db";
import { exercises, foods, programs, recipes, savedMeals, workouts } from "@/server/db/schema";

/** lower() + Greek accent folding in SQL, mirroring normalizeSearch() on the client. */
export function folded(col: AnyPgColumn | SQL) {
  return sql`translate(lower(coalesce(${col}, '')), 'άέήίόύώϊϋΐΰς', 'αεηιουωιυιυσ')`;
}

export function likePattern(q: string) {
  return `%${normalizeSearch(q).replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export type SearchResults = {
  exercises: { id: string; name: string; nameEl: string | null; muscleGroup: string }[];
  foods: { id: string; name: string; nameEl: string | null; brand: string | null; calories: number; baseUnit: string }[];
  meals: { id: string; name: string }[];
  recipes: { id: string; name: string }[];
  workouts: { id: string; name: string; date: string }[];
  programs: { id: string; name: string }[];
};

export async function globalSearch(userId: string, q: string, limit = 6): Promise<SearchResults> {
  const p = likePattern(q);
  const [ex, fo, me, re, wo, pr] = await Promise.all([
    db
      .select({ id: exercises.id, name: exercises.name, nameEl: exercises.nameEl, muscleGroup: exercises.muscleGroup })
      .from(exercises)
      .where(
        and(
          or(isNull(exercises.userId), eq(exercises.userId, userId)),
          isNull(exercises.archivedAt),
          or(sql`${folded(exercises.name)} like ${p}`, sql`${folded(exercises.nameEl)} like ${p}`),
        ),
      )
      .orderBy(exercises.name)
      .limit(limit),
    db
      .select({ id: foods.id, name: foods.name, nameEl: foods.nameEl, brand: foods.brand, calories: foods.calories, baseUnit: foods.baseUnit })
      .from(foods)
      .where(
        and(
          or(isNull(foods.userId), eq(foods.userId, userId)),
          isNull(foods.archivedAt),
          or(sql`${folded(foods.name)} like ${p}`, sql`${folded(foods.nameEl)} like ${p}`, sql`${folded(foods.brand)} like ${p}`),
        ),
      )
      .orderBy(sql`${foods.userId} is null`, foods.name)
      .limit(limit),
    db
      .select({ id: savedMeals.id, name: savedMeals.name })
      .from(savedMeals)
      .where(and(eq(savedMeals.userId, userId), sql`${folded(savedMeals.name)} like ${p}`))
      .limit(limit),
    db
      .select({ id: recipes.id, name: recipes.name })
      .from(recipes)
      .where(and(eq(recipes.userId, userId), isNull(recipes.archivedAt), sql`${folded(recipes.name)} like ${p}`))
      .limit(limit),
    db
      .select({ id: workouts.id, name: workouts.name, date: workouts.date })
      .from(workouts)
      .where(and(eq(workouts.userId, userId), sql`${folded(workouts.name)} like ${p}`))
      .orderBy(desc(workouts.date))
      .limit(limit),
    db
      .select({ id: programs.id, name: programs.name })
      .from(programs)
      .where(and(eq(programs.userId, userId), isNull(programs.archivedAt), sql`${folded(programs.name)} like ${p}`))
      .limit(limit),
  ]);
  return { exercises: ex, foods: fo, meals: me, recipes: re, workouts: wo, programs: pr };
}
