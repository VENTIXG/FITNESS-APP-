import { and, isNotNull, notInArray, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { BUILTIN_EXERCISES } from "@/data/exercises";
import { BUILTIN_FOODS } from "@/data/foods";
import * as schema from "@/server/db/schema";
import { servingNoun } from "@/lib/food-units";
import { builtinExerciseId, builtinFoodId } from "./stable-id";

type AnyDb = PostgresJsDatabase<typeof schema>;

/**
 * Upserts the built-in exercise and food catalogs. Entries removed from code are
 * archived (never deleted) because user history may reference them.
 */
export async function syncBuiltinCatalog(db: AnyDb) {
  const { exercises, foods } = schema;

  const exerciseRows = BUILTIN_EXERCISES.map((e) => ({
    id: builtinExerciseId(e.key),
    userId: null,
    builtinKey: e.key,
    name: e.name,
    nameEl: e.nameEl,
    muscleGroup: e.muscle,
    secondaryMuscles: e.secondary ?? [],
    equipment: e.equipment,
    category: e.category,
    trackingType: e.tracking ?? "weight_reps",
    archivedAt: null,
  }));

  await db
    .insert(exercises)
    .values(exerciseRows)
    .onConflictDoUpdate({
      target: exercises.builtinKey,
      set: {
        name: sql`excluded.name`,
        nameEl: sql`excluded.name_el`,
        muscleGroup: sql`excluded.muscle_group`,
        secondaryMuscles: sql`excluded.secondary_muscles`,
        equipment: sql`excluded.equipment`,
        category: sql`excluded.category`,
        trackingType: sql`excluded.tracking_type`,
        archivedAt: sql`NULL`,
        updatedAt: sql`now()`,
      },
    });
  await db
    .update(exercises)
    .set({ archivedAt: new Date() })
    .where(
      and(
        isNotNull(exercises.builtinKey),
        notInArray(
          exercises.builtinKey,
          BUILTIN_EXERCISES.map((e) => e.key),
        ),
      ),
    );

  const foodRows = BUILTIN_FOODS.map((f) => ({
    id: builtinFoodId(f.key),
    userId: null,
    builtinKey: f.key,
    name: f.name,
    nameEl: f.nameEl,
    baseUnit: f.unit ?? ("g" as const),
    calories: f.kcal,
    proteinG: f.p,
    carbsG: f.c,
    fatG: f.f,
    fiberG: f.fiber ?? 0,
    sugarG: f.sugar ?? null,
    servings: (f.servings ?? []).map((s) => ({ id: s.id, label: servingNoun(s.label), labelEl: servingNoun(s.labelEl), amount: s.amount })),
    defaultServingId: f.defaultServing ?? null,
    source: "builtin" as const,
    archivedAt: null,
  }));

  await db
    .insert(foods)
    .values(foodRows)
    .onConflictDoUpdate({
      target: foods.builtinKey,
      set: {
        name: sql`excluded.name`,
        nameEl: sql`excluded.name_el`,
        baseUnit: sql`excluded.base_unit`,
        calories: sql`excluded.calories`,
        proteinG: sql`excluded.protein_g`,
        carbsG: sql`excluded.carbs_g`,
        fatG: sql`excluded.fat_g`,
        fiberG: sql`excluded.fiber_g`,
        sugarG: sql`excluded.sugar_g`,
        servings: sql`excluded.servings`,
        defaultServingId: sql`excluded.default_serving_id`,
        archivedAt: sql`NULL`,
        updatedAt: sql`now()`,
      },
    });
  await db
    .update(foods)
    .set({ archivedAt: new Date() })
    .where(
      and(
        isNotNull(foods.builtinKey),
        notInArray(
          foods.builtinKey,
          BUILTIN_FOODS.map((f) => f.key),
        ),
      ),
    );

  return { exercises: exerciseRows.length, foods: foodRows.length };
}
