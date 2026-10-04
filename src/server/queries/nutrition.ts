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
      .select({ entry: foodEntries, servings: foods.servings, baseUnit: foods.baseUnit })
      .from(foodEntries)
      .leftJoin(foods, eq(foods.id, foodEntries.foodId))
      .where(and(eq(foodEntries.userId, userId), eq(foodEntries.date, date)))
      .orderBy(asc(foodEntries.sortOrder), asc(foodEntries.loggedAt)),
    getTargets(userId),
  ]);
  const list = entries.map((e) => ({ ...e.entry, servings: e.servings ?? [], baseUnit: e.baseUnit }));
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

export async function countEntries(userId: string, date: ISODate) {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(foodEntries)
    .where(and(eq(foodEntries.userId, userId), eq(foodEntries.date, date)));
  return n;
}

/** Daily totals for a date range (only days with entries) plus the target in force each day. */
export async function getNutritionHistory(userId: string, start: ISODate, end: ISODate) {
  const [rows, targets] = await Promise.all([
    db
      .select({
        date: foodEntries.date,
        calories: sql<number>`sum(${foodEntries.calories})`.mapWith(Number),
        proteinG: sql<number>`sum(${foodEntries.proteinG})`.mapWith(Number),
        carbsG: sql<number>`sum(${foodEntries.carbsG})`.mapWith(Number),
        fatG: sql<number>`sum(${foodEntries.fatG})`.mapWith(Number),
        fiberG: sql<number>`sum(${foodEntries.fiberG})`.mapWith(Number),
        entries: sql<number>`count(*)`.mapWith(Number),
      })
      .from(foodEntries)
      .where(and(eq(foodEntries.userId, userId), sql`${foodEntries.date} between ${start} and ${end}`))
      .groupBy(foodEntries.date)
      .orderBy(asc(foodEntries.date)),
    getTargets(userId),
  ]);
  return rows.map((r) => ({ ...r, target: targetForDate(targets, r.date) }));
}

export async function getFoodDetail(userId: string, id: string) {
  const f = (await db.select().from(foods).where(and(eq(foods.id, id), or(isNull(foods.userId), eq(foods.userId, userId)))).limit(1))[0];
  if (!f) return null;
  const [fav, usage] = await Promise.all([
    db.select({ id: favoriteFoods.foodId }).from(favoriteFoods).where(and(eq(favoriteFoods.userId, userId), eq(favoriteFoods.foodId, id))),
    db
      .select({ uses: sql<number>`count(*)`.mapWith(Number), last: sql<string | null>`max(${foodEntries.date})` })
      .from(foodEntries)
      .where(and(eq(foodEntries.userId, userId), eq(foodEntries.foodId, id))),
  ]);
  return { food: f, favorite: fav.length > 0, uses: usage[0]?.uses ?? 0, lastUsed: usage[0]?.last ?? null };
}

export async function getSavedMeal(userId: string, id: string) {
  const meal = (await db.select().from(savedMeals).where(and(eq(savedMeals.id, id), eq(savedMeals.userId, userId))).limit(1))[0];
  if (!meal) return null;
  const items = await db.select().from(savedMealItems).where(eq(savedMealItems.savedMealId, id)).orderBy(asc(savedMealItems.sortOrder));
  return { meal, items };
}

export async function getRecipe(userId: string, id: string) {
  const recipe = (await db.select().from(recipes).where(and(eq(recipes.id, id), eq(recipes.userId, userId))).limit(1))[0];
  if (!recipe) return null;
  const items = await db.select().from(recipeIngredients).where(eq(recipeIngredients.recipeId, id)).orderBy(asc(recipeIngredients.sortOrder));
  return { recipe, items };
}

/** Picker-shaped foods by id, including archived ones still referenced by meals/recipes. */
export async function getPickerFoodsByIds(userId: string, ids: string[]) {
  if (!ids.length) return [];
  const rows = await db.select().from(foods).where(and(inArray(foods.id, ids), or(isNull(foods.userId), eq(foods.userId, userId))));
  return rows.map((f) => toPickerFood(f));
}
