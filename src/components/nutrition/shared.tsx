"use client";

import * as React from "react";
import { useT } from "@/components/providers/i18n-provider";
import { useFmt, usePrefs } from "@/components/providers/prefs-provider";
import { multiplyNutrients, scaleNutrients, type Nutrients } from "@/lib/calc/nutrition";
import type { Locale } from "@/lib/domain";
import { toBaseAmount } from "@/lib/food-units";
import { cn } from "@/lib/utils";
import type { PickerData, PickerFood } from "@/server/queries/nutrition";

export type PickerRecipe = PickerData["recipes"][number];
export type PickerMeal = PickerData["meals"][number];

export const MACRO_COLORS = {
  calories: "var(--c-calories)",
  protein: "var(--c-protein)",
  carbs: "var(--c-carbs)",
  fat: "var(--c-fat)",
  fiber: "var(--c-fiber)",
} as const;

export function foodName(f: { name: string; nameEl?: string | null }, locale: Locale) {
  return (locale === "el" && f.nameEl) || f.name;
}

/** The portion a one-tap "+" logs: last used amount, else the default serving, else 100 g/ml. */
export function defaultPortion(food: PickerFood, recent?: { quantity: number; unit: string } | null) {
  if (recent && toBaseAmount(food, recent.quantity, recent.unit) != null) return { quantity: recent.quantity, unit: recent.unit };
  const serving = food.servings.find((s) => s.id === food.defaultServingId) ?? null;
  if (serving) return { quantity: 1, unit: serving.id };
  return { quantity: 100, unit: food.baseUnit };
}

export function foodPreview(food: PickerFood, quantity: number, unit: string): Nutrients | null {
  const base = toBaseAmount(food, quantity, unit);
  return base == null ? null : scaleNutrients(food.per100, base);
}

export function recipePreview(recipe: PickerRecipe, quantity: number, unit: string): Nutrients | null {
  if (!(quantity > 0)) return null;
  if (unit === "serving") return multiplyNutrients(recipe.perServing, quantity);
  if (unit === "g" && recipe.totalWeightG > 0) return multiplyNutrients(recipe.perServing, (quantity / recipe.totalWeightG) * recipe.servings);
  return null;
}

/** Localized meal slot name (custom name when the user renamed it). */
export function useSlotName() {
  const t = useT();
  const prefs = usePrefs();
  return React.useCallback(
    (id: string) => prefs.mealSlots.find((s) => s.id === id)?.name || (t.enums.meal as Record<string, string>)[id] || id,
    [prefs.mealSlots, t],
  );
}

/** "P 32 · C 40 · F 12" with coloured dots (identity is also carried by the letter). */
export function MacroLine({ n, className }: { n: Pick<Nutrients, "proteinG" | "carbsG" | "fatG">; className?: string }) {
  const t = useT();
  const fmt = useFmt();
  const items = [
    { k: "p", label: t.nutrition.protein, short: t.nutrition.protein[0], v: n.proteinG, c: MACRO_COLORS.protein },
    { k: "c", label: t.nutrition.carbs, short: t.nutrition.carbs[0], v: n.carbsG, c: MACRO_COLORS.carbs },
    { k: "f", label: t.nutrition.fat, short: t.nutrition.fat[0], v: n.fatG, c: MACRO_COLORS.fat },
  ];
  return (
    <span className={cn("inline-flex items-center gap-2.5 text-xs text-fg-3 tabular", className)}>
      {items.map((i) => (
        <span key={i.k} className="inline-flex items-center gap-1" title={i.label}>
          <span className="size-1.5 rounded-full" style={{ background: i.c }} aria-hidden />
          <span className="sr-only">{i.label}</span>
          <span aria-hidden>{i.short}</span>
          {fmt.int(i.v)}
        </span>
      ))}
    </span>
  );
}

/** Five-cell nutrient readout used in amount previews and detail pages. */
export function NutrientGrid({ n, className }: { n: Nutrients; className?: string }) {
  const t = useT();
  const fmt = useFmt();
  const prefs = usePrefs();
  const cells: { k: string; label: string; value: string; unit: string; c: string }[] = [
    { k: "kcal", label: t.nutrition.calories, value: fmt.int(n.calories), unit: "kcal", c: MACRO_COLORS.calories },
    { k: "p", label: t.nutrition.protein, value: fmt.number(n.proteinG, 1), unit: "g", c: MACRO_COLORS.protein },
    { k: "c", label: t.nutrition.carbs, value: fmt.number(n.carbsG, 1), unit: "g", c: MACRO_COLORS.carbs },
    { k: "f", label: t.nutrition.fat, value: fmt.number(n.fatG, 1), unit: "g", c: MACRO_COLORS.fat },
    { k: "fi", label: t.nutrition.fiber, value: fmt.number(n.fiberG, 1), unit: "g", c: MACRO_COLORS.fiber },
  ];
  if (prefs.showSugar && n.sugarG != null) cells.push({ k: "s", label: t.nutrition.sugar, value: fmt.number(n.sugarG, 1), unit: "g", c: "var(--chart-muted)" });
  if (prefs.showSodium && n.sodiumMg != null) cells.push({ k: "na", label: t.nutrition.sodium, value: fmt.int(n.sodiumMg), unit: "mg", c: "var(--chart-muted)" });
  return (
    <dl className={cn("grid grid-cols-3 gap-2 sm:grid-cols-5", className)}>
      {cells.map((c) => (
        <div key={c.k} className="rounded-xl bg-surface-2 px-3 py-2.5">
          <dt className="flex items-center gap-1.5 text-[11px] font-medium text-fg-3">
            <span className="size-1.5 shrink-0 rounded-full" style={{ background: c.c }} aria-hidden />
            <span className="truncate">{c.label}</span>
          </dt>
          <dd className="mt-0.5 text-[15px] font-semibold tabular text-fg">
            {c.value}
            <span className="ml-0.5 text-xs font-normal text-fg-3">{c.unit}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
