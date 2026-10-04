"use server";

import { and, asc, eq, inArray, isNull, max, or, sql } from "drizzle-orm";
import { z } from "zod";
import { multiplyNutrients, recipeNutrition, scaleNutrients, type Nutrients } from "@/lib/calc/nutrition";
import { BASE_UNITS } from "@/lib/domain";
import { toBaseAmount } from "@/lib/food-units";
import { isoDate, nutrientsSchema, optionalText, requiredName, uuid } from "@/lib/validation";
import type { UserContext } from "@/server/context";
import { db, type DbOrTx } from "@/server/db";
import {
  favoriteFoods,
  foodEntries,
  foods,
  recipeIngredients,
  recipes,
  savedMealItems,
  savedMeals,
  type Food,
} from "@/server/db/schema";
import { ActionError, assertNotFuture, createAction } from "./_lib";

const slotId = z.string().min(1).max(40);

async function visibleFood(tx: DbOrTx, userId: string, foodId: string): Promise<Food> {
  const f = (await tx.select().from(foods).where(and(eq(foods.id, foodId), or(isNull(foods.userId), eq(foods.userId, userId)))).limit(1))[0];
  if (!f) throw new ActionError("not_found");
  return f;
}

const per100 = (f: Food): Nutrients => ({ calories: f.calories, proteinG: f.proteinG, carbsG: f.carbsG, fatG: f.fatG, fiberG: f.fiberG, sugarG: f.sugarG, sodiumMg: f.sodiumMg });

/** Per-serving nutrition of a recipe computed from current ingredient data. */
async function recipeInfo(tx: DbOrTx, userId: string, recipeId: string) {
  const r = (await tx.select().from(recipes).where(and(eq(recipes.id, recipeId), eq(recipes.userId, userId))).limit(1))[0];
  if (!r) throw new ActionError("not_found");
  const ing = await tx.select({ i: recipeIngredients, f: foods }).from(recipeIngredients).innerJoin(foods, eq(foods.id, recipeIngredients.foodId)).where(eq(recipeIngredients.recipeId, recipeId));
  const n = recipeNutrition(ing.map(({ i, f }) => ({ nutrientsPer100: per100(f), baseAmount: i.baseAmount })), r.servings, r.totalWeightG);
  return { recipe: r, ...n };
}

async function nextSort(tx: DbOrTx, userId: string, date: string) {
  const [{ m }] = await tx.select({ m: max(foodEntries.sortOrder) }).from(foodEntries).where(and(eq(foodEntries.userId, userId), eq(foodEntries.date, date)));
  return (m ?? 0) + 1;
}

type EntryInput = { date: string; mealSlot: string; foodId?: string | null; recipeId?: string | null; quantity: number; unit: string };

/** Builds an entry snapshot from authoritative data (client nutrient values are never trusted). */
async function buildEntry(tx: DbOrTx, ctx: UserContext, input: EntryInput) {
  if (input.foodId) {
    const f = await visibleFood(tx, ctx.userId, input.foodId);
    const base = toBaseAmount(f, input.quantity, input.unit);
    if (base == null) throw new ActionError("validation");
    const n = scaleNutrients(per100(f), base);
    return { foodId: f.id, recipeId: null, name: ctx.locale === "el" && f.nameEl ? f.nameEl : f.name, brand: f.brand, baseAmount: base, ...n };
  }
  if (input.recipeId) {
    const info = await recipeInfo(tx, ctx.userId, input.recipeId);
    let servingsEaten: number;
    if (input.unit === "serving") servingsEaten = input.quantity;
    else if (input.unit === "g" && info.totalWeightG > 0) servingsEaten = (input.quantity / info.totalWeightG) * info.recipe.servings;
    else throw new ActionError("validation");
    const n = multiplyNutrients(info.perServing, servingsEaten);
    return { foodId: null, recipeId: info.recipe.id, name: info.recipe.name, brand: null, baseAmount: input.unit === "g" ? input.quantity : null, ...n };
  }
  throw new ActionError("validation");
}

const entryInput = z
  .object({
    date: isoDate,
    mealSlot: slotId,
    foodId: uuid.nullable().optional(),
    recipeId: uuid.nullable().optional(),
    quantity: z.number().positive().max(100000),
    unit: z.string().min(1).max(40),
  })
  .refine((v) => !!v.foodId !== !!v.recipeId, { message: "food_or_recipe" });

export const addFoodEntry = createAction(entryInput, async (input, ctx) => {
  assertNotFuture(input.date, ctx.today);
  return db.transaction(async (tx) => {
    const snap = await buildEntry(tx, ctx, input);
    const [row] = await tx
      .insert(foodEntries)
      .values({ userId: ctx.userId, date: input.date, mealSlot: input.mealSlot, quantity: input.quantity, unit: input.unit, sortOrder: await nextSort(tx, ctx.userId, input.date), ...snap })
      .returning({ id: foodEntries.id });
    return { id: row.id };
  });
});

export const quickAddEntry = createAction(
  nutrientsSchema.extend({ date: isoDate, mealSlot: slotId, name: z.string().trim().max(120).optional() }),
  async (input, ctx) => {
    assertNotFuture(input.date, ctx.today);
    const [row] = await db
      .insert(foodEntries)
      .values({
        userId: ctx.userId,
        date: input.date,
        mealSlot: input.mealSlot,
        name: input.name || ctx.t.nutrition.quickAddName,
        quantity: 1,
        unit: "serving",
        calories: input.calories,
        proteinG: input.proteinG,
        carbsG: input.carbsG,
        fatG: input.fatG,
        fiberG: input.fiberG,
        sortOrder: await nextSort(db, ctx.userId, input.date),
      })
      .returning({ id: foodEntries.id });
    return { id: row.id };
  },
);

/** Change quantity / unit / meal / date. Nutrients are rescaled from the food (or the snapshot). */
export const updateFoodEntry = createAction(
  z.object({ id: uuid, quantity: z.number().positive().max(100000), unit: z.string().min(1).max(40), mealSlot: slotId, date: isoDate }),
  async (input, ctx) => {
    assertNotFuture(input.date, ctx.today);
    await db.transaction(async (tx) => {
      const e = (await tx.select().from(foodEntries).where(and(eq(foodEntries.id, input.id), eq(foodEntries.userId, ctx.userId))).limit(1))[0];
      if (!e) throw new ActionError("not_found");
      let values: Partial<typeof foodEntries.$inferInsert>;
      const food = e.foodId ? (await tx.select().from(foods).where(eq(foods.id, e.foodId)).limit(1))[0] : null;
      if (food) {
        const base = toBaseAmount(food, input.quantity, input.unit);
        if (base == null) throw new ActionError("validation");
        values = { quantity: input.quantity, unit: input.unit, baseAmount: base, ...scaleNutrients(per100(food), base) };
      } else {
        // Quick-add / recipe / deleted food: scale the snapshot proportionally (unit unchanged).
        const factor = input.quantity / e.quantity;
        values = {
          quantity: input.quantity,
          baseAmount: e.baseAmount != null ? e.baseAmount * factor : null,
          ...multiplyNutrients({ calories: e.calories, proteinG: e.proteinG, carbsG: e.carbsG, fatG: e.fatG, fiberG: e.fiberG, sugarG: e.sugarG, sodiumMg: e.sodiumMg }, factor),
        };
      }
      await tx.update(foodEntries).set({ ...values, mealSlot: input.mealSlot, date: input.date, isDemo: false }).where(eq(foodEntries.id, e.id));
    });
    return null;
  },
);

export const deleteFoodEntry = createAction(z.object({ id: uuid }), async (input, ctx) => {
  await db.delete(foodEntries).where(and(eq(foodEntries.id, input.id), eq(foodEntries.userId, ctx.userId)));
  return null;
});

export const duplicateFoodEntry = createAction(z.object({ id: uuid }), async (input, ctx) => {
  const e = (await db.select().from(foodEntries).where(and(eq(foodEntries.id, input.id), eq(foodEntries.userId, ctx.userId))).limit(1))[0];
  if (!e) throw new ActionError("not_found");
  const { id: _id, createdAt: _c, updatedAt: _u, loggedAt: _l, ...rest } = e;
  void _id; void _c; void _u; void _l;
  await db.insert(foodEntries).values({ ...rest, isDemo: false, sortOrder: e.sortOrder + 1 });
  return null;
});

/** Copies entries from one day (optionally one meal) into another, re-snapshotting nothing (same values). */
export const copyEntries = createAction(
  z.object({ fromDate: isoDate, toDate: isoDate, fromSlot: slotId.nullable(), toSlot: slotId.nullable() }),
  async (input, ctx) => {
    assertNotFuture(input.toDate, ctx.today);
    const src = await db
      .select()
      .from(foodEntries)
      .where(and(eq(foodEntries.userId, ctx.userId), eq(foodEntries.date, input.fromDate), input.fromSlot ? eq(foodEntries.mealSlot, input.fromSlot) : undefined))
      .orderBy(asc(foodEntries.sortOrder));
    if (!src.length) return { count: 0 };
    let order = await nextSort(db, ctx.userId, input.toDate);
    await db.insert(foodEntries).values(
      src.map((e) => {
        const { id: _id, createdAt: _c, updatedAt: _u, loggedAt: _l, ...rest } = e;
        void _id; void _c; void _u; void _l;
        return { ...rest, date: input.toDate, mealSlot: input.toSlot ?? e.mealSlot, sortOrder: order++, isDemo: false };
      }),
    );
    return { count: src.length };
  },
);

export const clearMeal = createAction(z.object({ date: isoDate, mealSlot: slotId }), async (input, ctx) => {
  await db.delete(foodEntries).where(and(eq(foodEntries.userId, ctx.userId), eq(foodEntries.date, input.date), eq(foodEntries.mealSlot, input.mealSlot)));
  return null;
});

// ── Saved meals ─────────────────────────────────────────────────────────────

export const saveMealFromDiary = createAction(z.object({ name: requiredName(80), date: isoDate, mealSlot: slotId }), async (input, ctx) => {
  const src = await db
    .select()
    .from(foodEntries)
    .where(and(eq(foodEntries.userId, ctx.userId), eq(foodEntries.date, input.date), eq(foodEntries.mealSlot, input.mealSlot)))
    .orderBy(asc(foodEntries.sortOrder));
  const items = src.filter((e) => e.foodId || e.recipeId);
  if (!items.length) throw new ActionError("validation");
  return db.transaction(async (tx) => {
    const [meal] = await tx.insert(savedMeals).values({ userId: ctx.userId, name: input.name, mealSlot: input.mealSlot }).returning({ id: savedMeals.id });
    await tx.insert(savedMealItems).values(
      items.map((e, i) => ({ savedMealId: meal.id, foodId: e.foodId, recipeId: e.foodId ? null : e.recipeId, quantity: e.quantity, unit: e.unit, baseAmount: e.baseAmount, sortOrder: i })),
    );
    return { id: meal.id };
  });
});

export const logSavedMeal = createAction(z.object({ mealId: uuid, date: isoDate, mealSlot: slotId }), async (input, ctx) => {
  assertNotFuture(input.date, ctx.today);
  return db.transaction(async (tx) => {
    const meal = (await tx.select().from(savedMeals).where(and(eq(savedMeals.id, input.mealId), eq(savedMeals.userId, ctx.userId))).limit(1))[0];
    if (!meal) throw new ActionError("not_found");
    const items = await tx.select().from(savedMealItems).where(eq(savedMealItems.savedMealId, meal.id)).orderBy(asc(savedMealItems.sortOrder));
    let order = await nextSort(tx, ctx.userId, input.date);
    for (const item of items) {
      const snap = await buildEntry(tx, ctx, { date: input.date, mealSlot: input.mealSlot, foodId: item.foodId, recipeId: item.recipeId, quantity: item.quantity, unit: item.unit });
      await tx.insert(foodEntries).values({ userId: ctx.userId, date: input.date, mealSlot: input.mealSlot, quantity: item.quantity, unit: item.unit, sortOrder: order++, ...snap });
    }
    await tx.update(savedMeals).set({ useCount: sql`${savedMeals.useCount} + 1`, lastUsedAt: new Date() }).where(eq(savedMeals.id, meal.id));
    return { count: items.length };
  });
});

const mealSchema = z.object({
  name: requiredName(80),
  mealSlot: slotId.nullable(),
  isFavorite: z.boolean(),
  items: z
    .array(z.object({ foodId: uuid.nullable(), recipeId: uuid.nullable(), quantity: z.number().positive().max(100000), unit: z.string().min(1).max(40) }))
    .min(1)
    .max(40),
});

async function writeMealItems(tx: DbOrTx, ctx: UserContext, mealId: string, items: z.infer<typeof mealSchema>["items"]) {
  await tx.delete(savedMealItems).where(eq(savedMealItems.savedMealId, mealId));
  const rows = [];
  for (const [i, item] of items.entries()) {
    if (!!item.foodId === !!item.recipeId) throw new ActionError("validation");
    let baseAmount: number | null = null;
    if (item.foodId) {
      const f = await visibleFood(tx, ctx.userId, item.foodId);
      baseAmount = toBaseAmount(f, item.quantity, item.unit);
      if (baseAmount == null) throw new ActionError("validation");
    } else {
      await recipeInfo(tx, ctx.userId, item.recipeId!);
    }
    rows.push({ savedMealId: mealId, foodId: item.foodId, recipeId: item.recipeId, quantity: item.quantity, unit: item.unit, baseAmount, sortOrder: i });
  }
  await tx.insert(savedMealItems).values(rows);
}

export const createSavedMeal = createAction(mealSchema, async (input, ctx) =>
  db.transaction(async (tx) => {
    const [meal] = await tx.insert(savedMeals).values({ userId: ctx.userId, name: input.name, mealSlot: input.mealSlot, isFavorite: input.isFavorite }).returning({ id: savedMeals.id });
    await writeMealItems(tx, ctx, meal.id, input.items);
    return { id: meal.id };
  }),
);

export const updateSavedMeal = createAction(mealSchema.extend({ id: uuid }), async ({ id, ...input }, ctx) =>
  db.transaction(async (tx) => {
    const res = await tx.update(savedMeals).set({ name: input.name, mealSlot: input.mealSlot, isFavorite: input.isFavorite, isDemo: false }).where(and(eq(savedMeals.id, id), eq(savedMeals.userId, ctx.userId))).returning({ id: savedMeals.id });
    if (!res.length) throw new ActionError("not_found");
    await writeMealItems(tx, ctx, id, input.items);
    return { id };
  }),
);

export const deleteSavedMeal = createAction(z.object({ id: uuid }), async (input, ctx) => {
  await db.delete(savedMeals).where(and(eq(savedMeals.id, input.id), eq(savedMeals.userId, ctx.userId)));
  return null;
});

// ── Foods ───────────────────────────────────────────────────────────────────

export const toggleFavoriteFood = createAction(z.object({ foodId: uuid, favorite: z.boolean() }), async (input, ctx) => {
  await visibleFood(db, ctx.userId, input.foodId);
  if (input.favorite) await db.insert(favoriteFoods).values({ userId: ctx.userId, foodId: input.foodId }).onConflictDoNothing();
  else await db.delete(favoriteFoods).where(and(eq(favoriteFoods.userId, ctx.userId), eq(favoriteFoods.foodId, input.foodId)));
  return null;
});

const foodSchema = nutrientsSchema.extend({
  name: requiredName(160),
  brand: z.string().trim().max(120).nullable(),
  barcode: z
    .string()
    .trim()
    .regex(/^\d{6,14}$/)
    .nullable(),
  baseUnit: z.enum(BASE_UNITS),
  calories: z.number().min(0).max(1000),
  servings: z
    .array(z.object({ id: z.string().min(1).max(40), label: z.string().trim().min(1).max(60), amount: z.number().positive().max(10000) }))
    .max(10),
  defaultServingId: z.string().max(40).nullable(),
  source: z.enum(["custom", "openfoodfacts"]).default("custom"),
  externalId: z.string().max(80).nullable().default(null),
});

export const createFood = createAction(foodSchema, async (input, ctx) => {
  const [row] = await db.insert(foods).values({ userId: ctx.userId, ...input }).returning({ id: foods.id });
  return { id: row.id };
});

export const updateFood = createAction(foodSchema.extend({ id: uuid }), async ({ id, ...input }, ctx) => {
  const res = await db.update(foods).set({ ...input, isDemo: false }).where(and(eq(foods.id, id), eq(foods.userId, ctx.userId))).returning({ id: foods.id });
  if (!res.length) throw new ActionError("not_found");
  return null;
});

/** Deletes a custom food, or archives it when meals/recipes reference it (history keeps its snapshots). */
export const deleteFood = createAction(z.object({ id: uuid }), async (input, ctx) => {
  const owned = await db.select({ id: foods.id }).from(foods).where(and(eq(foods.id, input.id), eq(foods.userId, ctx.userId)));
  if (!owned.length) throw new ActionError("not_found");
  const used = await db.execute(sql`select 1 from ${recipeIngredients} where food_id = ${input.id} union all select 1 from ${savedMealItems} where food_id = ${input.id} limit 1`);
  if (used.length) {
    await db.update(foods).set({ archivedAt: new Date() }).where(eq(foods.id, input.id));
    return { archived: true };
  }
  await db.delete(foods).where(eq(foods.id, input.id));
  return { archived: false };
});

// ── Recipes ─────────────────────────────────────────────────────────────────

const recipeSchema = z.object({
  name: requiredName(120),
  servings: z.number().positive().max(100),
  totalWeightG: z.number().positive().max(50000).nullable(),
  instructions: optionalText(8000),
  isFavorite: z.boolean(),
  ingredients: z
    .array(z.object({ foodId: uuid, quantity: z.number().positive().max(100000), unit: z.string().min(1).max(40) }))
    .min(1)
    .max(60),
});

async function writeIngredients(tx: DbOrTx, ctx: UserContext, recipeId: string, items: z.infer<typeof recipeSchema>["ingredients"]) {
  await tx.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, recipeId));
  const rows = [];
  for (const [i, item] of items.entries()) {
    const f = await visibleFood(tx, ctx.userId, item.foodId);
    const base = toBaseAmount(f, item.quantity, item.unit);
    if (base == null) throw new ActionError("validation");
    rows.push({ recipeId, foodId: item.foodId, quantity: item.quantity, unit: item.unit, baseAmount: base, sortOrder: i });
  }
  await tx.insert(recipeIngredients).values(rows);
}

export const createRecipe = createAction(recipeSchema, async (input, ctx) =>
  db.transaction(async (tx) => {
    const [r] = await tx
      .insert(recipes)
      .values({ userId: ctx.userId, name: input.name, servings: input.servings, totalWeightG: input.totalWeightG, instructions: input.instructions, isFavorite: input.isFavorite })
      .returning({ id: recipes.id });
    await writeIngredients(tx, ctx, r.id, input.ingredients);
    return { id: r.id };
  }),
);

export const updateRecipe = createAction(recipeSchema.extend({ id: uuid }), async ({ id, ...input }, ctx) =>
  db.transaction(async (tx) => {
    const res = await tx
      .update(recipes)
      .set({ name: input.name, servings: input.servings, totalWeightG: input.totalWeightG, instructions: input.instructions, isFavorite: input.isFavorite, isDemo: false })
      .where(and(eq(recipes.id, id), eq(recipes.userId, ctx.userId)))
      .returning({ id: recipes.id });
    if (!res.length) throw new ActionError("not_found");
    await writeIngredients(tx, ctx, id, input.ingredients);
    return { id };
  }),
);

export const deleteRecipe = createAction(z.object({ id: uuid }), async (input, ctx) => {
  const used = await db.select({ id: savedMealItems.id }).from(savedMealItems).where(eq(savedMealItems.recipeId, input.id)).limit(1);
  if (used.length) {
    await db.update(recipes).set({ archivedAt: new Date() }).where(and(eq(recipes.id, input.id), eq(recipes.userId, ctx.userId)));
    return { archived: true };
  }
  await db.delete(recipes).where(and(eq(recipes.id, input.id), eq(recipes.userId, ctx.userId)));
  return { archived: false };
});

/** Loads foods by id (for editors that need full unit info). */
export const getFoodsByIds = createAction(
  z.object({ ids: z.array(uuid).max(100) }),
  async (input, ctx) => {
    if (!input.ids.length) return [];
    return db.select().from(foods).where(and(inArray(foods.id, input.ids), or(isNull(foods.userId), eq(foods.userId, ctx.userId))));
  },
  { revalidate: false },
);
