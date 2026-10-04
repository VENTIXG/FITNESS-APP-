/**
 * Nutrition maths. Foods store nutrients per 100 base units (g or ml); entries
 * store absolute snapshots. Adherence thresholds are centralised here.
 */
import type { ISODate } from "../dates";
import type { PrimaryGoal } from "../domain";

export type Nutrients = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sugarG?: number | null;
  sodiumMg?: number | null;
};

export const ZERO_NUTRIENTS: Nutrients = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0, sodiumMg: 0 };

export const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const;

/** Adherence rules, used consistently by habits, scores, streaks, reports and insights. */
export const ADHERENCE = {
  /** Calories count as "on target" within ±10 % of target. */
  caloriesTolerance: 0.1,
  /** Protein target is hit at ≥ 90 % of target. */
  proteinMinRatio: 0.9,
  /** Fiber target is hit at ≥ 80 % of target. */
  fiberMinRatio: 0.8,
  /** A day with less than this share of the median logged intake is likely incomplete. */
  incompleteDayRatio: 0.5,
} as const;

const addNullable = (a: number | null | undefined, b: number | null | undefined) =>
  a == null && b == null ? null : (a ?? 0) + (b ?? 0);

/** Nutrients for `baseAmount` g/ml of a food whose values are per 100 base units. */
export function scaleNutrients(per100: Nutrients, baseAmount: number): Nutrients {
  const f = baseAmount / 100;
  return {
    calories: per100.calories * f,
    proteinG: per100.proteinG * f,
    carbsG: per100.carbsG * f,
    fatG: per100.fatG * f,
    fiberG: per100.fiberG * f,
    sugarG: per100.sugarG == null ? null : per100.sugarG * f,
    sodiumMg: per100.sodiumMg == null ? null : per100.sodiumMg * f,
  };
}

/** Multiply absolute nutrients by a factor (e.g. servings). */
export function multiplyNutrients(n: Nutrients, factor: number): Nutrients {
  return {
    calories: n.calories * factor,
    proteinG: n.proteinG * factor,
    carbsG: n.carbsG * factor,
    fatG: n.fatG * factor,
    fiberG: n.fiberG * factor,
    sugarG: n.sugarG == null ? null : n.sugarG * factor,
    sodiumMg: n.sodiumMg == null ? null : n.sodiumMg * factor,
  };
}

export function sumNutrients(list: readonly Nutrients[]): Nutrients {
  return list.reduce<Nutrients>(
    (acc, n) => ({
      calories: acc.calories + n.calories,
      proteinG: acc.proteinG + n.proteinG,
      carbsG: acc.carbsG + n.carbsG,
      fatG: acc.fatG + n.fatG,
      fiberG: acc.fiberG + n.fiberG,
      sugarG: addNullable(acc.sugarG, n.sugarG),
      sodiumMg: addNullable(acc.sodiumMg, n.sodiumMg),
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: null, sodiumMg: null },
  );
}

export function macroCalories(n: Pick<Nutrients, "proteinG" | "carbsG" | "fatG">) {
  const protein = n.proteinG * KCAL_PER_G.protein;
  const carbs = n.carbsG * KCAL_PER_G.carbs;
  const fat = n.fatG * KCAL_PER_G.fat;
  return { protein, carbs, fat, total: protein + carbs + fat };
}

/** Share of energy from each macro (0–1). */
export function macroSplit(n: Pick<Nutrients, "proteinG" | "carbsG" | "fatG">) {
  const c = macroCalories(n);
  if (c.total <= 0) return { protein: 0, carbs: 0, fat: 0 };
  return { protein: c.protein / c.total, carbs: c.carbs / c.total, fat: c.fat / c.total };
}

export type TargetLike = {
  effectiveFrom: ISODate;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sugarG?: number | null;
  sodiumMg?: number | null;
};

/** The target in force on `date`: latest row with effectiveFrom ≤ date. */
export function targetForDate<T extends { effectiveFrom: ISODate }>(targets: readonly T[], date: ISODate): T | null {
  let best: T | null = null;
  for (const t of targets) {
    if (t.effectiveFrom <= date && (!best || t.effectiveFrom > best.effectiveFrom)) best = t;
  }
  return best;
}

export type CalorieStatus = "under" | "on_target" | "over";

export function calorieStatus(consumed: number, target: number): CalorieStatus {
  if (target <= 0) return "on_target";
  const ratio = consumed / target;
  if (ratio < 1 - ADHERENCE.caloriesTolerance) return "under";
  if (ratio > 1 + ADHERENCE.caloriesTolerance) return "over";
  return "on_target";
}

export function caloriesOnTarget(consumed: number, target: number) {
  return calorieStatus(consumed, target) === "on_target";
}

export function proteinHit(consumed: number, target: number) {
  return target > 0 && consumed >= target * ADHERENCE.proteinMinRatio;
}

export function fiberHit(consumed: number, target: number) {
  return target > 0 && consumed >= target * ADHERENCE.fiberMinRatio;
}

/** Fraction of `days` meeting `predicate` (null when there are no days). */
export function adherenceRate<T>(days: readonly T[], predicate: (d: T) => boolean): number | null {
  if (!days.length) return null;
  return days.filter(predicate).length / days.length;
}

/** Average nutrients across logged days. */
export function averageNutrients(days: readonly Nutrients[]): Nutrients | null {
  if (!days.length) return null;
  const total = sumNutrients(days);
  return multiplyNutrients(total, 1 / days.length);
}

export type RecipeIngredientInput = { nutrientsPer100: Nutrients; baseAmount: number };

export function recipeNutrition(ingredients: readonly RecipeIngredientInput[], servings: number, totalWeightG?: number | null) {
  const total = sumNutrients(ingredients.map((i) => scaleNutrients(i.nutrientsPer100, i.baseAmount)));
  const rawWeight = ingredients.reduce((a, i) => a + i.baseAmount, 0);
  const s = servings > 0 ? servings : 1;
  const weight = totalWeightG && totalWeightG > 0 ? totalWeightG : rawWeight;
  return {
    total,
    perServing: multiplyNutrients(total, 1 / s),
    /** Per 100 g of the finished dish (cooked weight if provided). */
    per100g: weight > 0 ? multiplyNutrients(total, 100 / weight) : null,
    totalWeightG: weight,
  };
}

/** Calories implied by macros; useful to sanity-check labels. */
export function caloriesFromMacros(n: Pick<Nutrients, "proteinG" | "carbsG" | "fatG">) {
  return macroCalories(n).total;
}

/**
 * Suggested daily macro targets for onboarding (user can edit everything).
 * Protein by bodyweight, fat floor of ~0.8 g/kg (≥ 25 % energy), carbs fill the rest,
 * fiber ≈ 14 g per 1000 kcal.
 */
export function suggestMacroTargets(calories: number, bodyweightKg: number, goal: PrimaryGoal) {
  const proteinPerKg = goal === "lose_fat" ? 2.0 : goal === "build_muscle" ? 1.8 : 1.6;
  const proteinG = Math.round((bodyweightKg * proteinPerKg) / 5) * 5;
  const fatG = Math.round(Math.max(bodyweightKg * 0.8, (calories * 0.25) / 9) / 5) * 5;
  const remaining = calories - proteinG * 4 - fatG * 9;
  const carbsG = Math.max(0, Math.round(remaining / 4 / 5) * 5);
  const fiberG = Math.round((calories / 1000) * 14);
  return { calories: Math.round(calories / 10) * 10, proteinG, carbsG, fatG, fiberG };
}

/**
 * Suggested calorie target from expenditure and goal. Fat loss uses a moderate
 * ~20 % deficit (≤ 750 kcal); muscle gain a small ~8 % surplus.
 */
export function suggestCalorieTarget(tdee: number, goal: PrimaryGoal) {
  let target = tdee;
  if (goal === "lose_fat") target = tdee - Math.min(750, tdee * 0.2);
  else if (goal === "build_muscle") target = tdee * 1.08;
  return Math.round(target / 10) * 10;
}
