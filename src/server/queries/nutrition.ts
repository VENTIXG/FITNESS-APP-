import "server-only";
import { and, asc, desc, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { recipeNutrition, sumNutrients, targetForDate, type Nutrients } from "@/lib/calc/nutrition";
import type { ISODate } from "@/lib/dates";
import { db } from "@/server/db";
import { favoriteFoods, foodEntries, foods, recipeIngredients, recipes, savedMealItems, savedMeals, type Food } from "@/server/db/schema";
import { getTargets } from "./common";

export type PickerFood = {
  id: string;
  name: string;
  nameEl: string | null;
  brand: string | null;
  baseUnit: "g" | "ml";
  per100: Nutrients;
  servings: Food["servings"];
  defaultServingId: string | null;
  source: Food["source"];
  mine: boolean;
  favorite: boolean;
  barcode: string | null;
};

export function toPickerFood(f: Food, favorite = false): PickerFood {
  return {
    id: f.id,
    name: f.name,
    nameEl: f.nameEl,
    brand: f.brand,
    baseUnit: f.baseUnit,
    per100: { calories: f.calories, proteinG: f.proteinG, carbsG: f.carbsG, fatG: f.fatG, fiberG: f.fiberG, sugarG: f.sugarG, sodiumMg: f.sodiumMg },
    servings: f.servings,
    defaultServingId: f.defaultServingId,
    source: f.source,
    mine: f.userId != null,
    favorite,
    barcode: f.barcode,
  };
}

export async function getDiary(userId: string, date: ISODate) {
  const [entries, targets] = await Promise.all([
    db
      .select({ entry: foodEntries, servings: foods.servings })
      .from(foodEntries)
      .leftJoin(foods, eq(foods.id, foodEntries.foodId))
      .where(and(eq(foodEntries.userId, userId), eq(foodEntries.date, date)))
      .orderBy(asc(foodEntries.sortOrder), asc(foodEntries.loggedAt)),
    getTargets(userId),
  ]);
  const list = entries.map((e) => ({ ...e.entry, servings: e.servings ?? [] }));
  return { entries: list, totals: sumNutrients(list), target: targetForDate(targets, date) };
}

export type DiaryEntry = Awaited<ReturnType<typeof getDiary>>["entries"][number];

/** Everything the "Add food" sheet needs, filtered instantly on the client. */
export async function getPickerData(userId: string) {
  const [allFoods, favs, recentRows, meals, recipeRows] = await Promise.all([
    db
      .select()
      .from(foods)
      .where(and(or(isNull(foods.userId), eq(foods.userId, userId)), isNull(foods.archivedAt)))
      .orderBy(asc(foods.name)),
    db.select({ foodId: favoriteFoods.foodId }).from(favoriteFoods).where(eq(favoriteFoods.userId, userId)),
    db
      .select({
        foodId: foodEntries.foodId,
        recipeId: foodEntries.recipeId,
        last: sql<string>`max(${foodEntries.loggedAt})`,
        quantity: sql<number>`(array_agg(${foodEntries.quantity} order by ${foodEntries.loggedAt} desc))[1]`,
        unit: sql<string>`(array_agg(${foodEntries.unit} order by ${foodEntries.loggedAt} desc))[1]`,
        uses: sql<number>`count(*)`.mapWith(Number),
      })
      .from(foodEntries)
      .where(and(eq(foodEntries.userId, userId), or(isNotNull(foodEntries.foodId), isNotNull(foodEntries.recipeId)), sql`${foodEntries.loggedAt} > now() - interval '90 days'`))
      .groupBy(foodEntries.foodId, foodEntries.recipeId)
      .orderBy(sql`max(${foodEntries.loggedAt}) desc`)
      .limit(40),
    db.select().from(savedMeals).where(eq(savedMeals.userId, userId)).orderBy(desc(savedMeals.isFavorite), desc(savedMeals.lastUsedAt), asc(savedMeals.name)),
    db.select().from(recipes).where(and(eq(recipes.userId, userId), isNull(recipes.archivedAt))).orderBy(desc(recipes.isFavorite), asc(recipes.name)),
  ]);
  const favSet = new Set(favs.map((f) => f.foodId));
  const foodMap = new Map(allFoods.map((f) => [f.id, f]));
  const pickerFoods = allFoods.map((f) => toPickerFood(f, favSet.has(f.id)));

  // Saved meal items + recipe ingredients need food data (including archived foods they reference).
  const mealItems = meals.length ? await db.select().from(savedMealItems).where(inArray(savedMealItems.savedMealId, meals.map((m) => m.id))).orderBy(asc(savedMealItems.sortOrder)) : [];
  const ingredients = recipeRows.length ? await db.select().from(recipeIngredients).where(inArray(recipeIngredients.recipeId, recipeRows.map((r) => r.id))).orderBy(asc(recipeIngredients.sortOrder)) : [];
  const missing = [...new Set([...mealItems.map((i) => i.foodId), ...ingredients.map((i) => i.foodId)].filter((id): id is string => !!id && !foodMap.has(id)))];
  if (missing.length) for (const f of await db.select().from(foods).where(inArray(foods.id, missing))) foodMap.set(f.id, f);

  const per100 = (f: Food): Nutrients => ({ calories: f.calories, proteinG: f.proteinG, carbsG: f.carbsG, fatG: f.fatG, fiberG: f.fiberG, sugarG: f.sugarG, sodiumMg: f.sodiumMg });
  const pickerRecipes = recipeRows.map((r) => {
    const ing = ingredients.filter((i) => i.recipeId === r.id && foodMap.has(i.foodId));
    const n = recipeNutrition(ing.map((i) => ({ nutrientsPer100: per100(foodMap.get(i.foodId)!), baseAmount: i.baseAmount })), r.servings, r.totalWeightG);
    return { id: r.id, name: r.name, servings: r.servings, totalWeightG: n.totalWeightG, perServing: n.perServing, favorite: r.isFavorite, ingredientCount: ing.length };
  });
  const recipeMap = new Map(pickerRecipes.map((r) => [r.id, r]));

  const pickerMeals = meals.map((m) => {
    const items = mealItems
      .filter((i) => i.savedMealId === m.id)
      .map((i) => {
        if (i.foodId && foodMap.has(i.foodId)) {
          const f = foodMap.get(i.foodId)!;
          const base = i.baseAmount ?? i.quantity;
          const k = base / 100;
          return { name: f.name, nameEl: f.nameEl, n: { calories: f.calories * k, proteinG: f.proteinG * k, carbsG: f.carbsG * k, fatG: f.fatG * k, fiberG: f.fiberG * k } as Nutrients };
        }
        const r = i.recipeId ? recipeMap.get(i.recipeId) : null;
        if (r) {
          const k = i.quantity;
          return { name: r.name, nameEl: null, n: { calories: r.perServing.calories * k, proteinG: r.perServing.proteinG * k, carbsG: r.perServing.carbsG * k, fatG: r.perServing.fatG * k, fiberG: r.perServing.fiberG * k } as Nutrients };
        }
        return null;
      })
      .filter((x): x is NonNullable<typeof x> => !!x);
    return { id: m.id, name: m.name, mealSlot: m.mealSlot, favorite: m.isFavorite, useCount: m.useCount, items: items.map((i) => ({ name: i.name, nameEl: i.nameEl })), totals: sumNutrients(items.map((i) => i.n)) };
  });

  const recent = recentRows
    .map((r) => ({ foodId: r.foodId, recipeId: r.recipeId, quantity: Number(r.quantity), unit: r.unit, uses: r.uses }))
    .filter((r) => (r.foodId && foodMap.has(r.foodId)) || (r.recipeId && recipeMap.has(r.recipeId)));

  return { foods: pickerFoods, recent, meals: pickerMeals, recipes: pickerRecipes };
}

export type PickerData = Awaited<ReturnType<typeof getPickerData>>;
