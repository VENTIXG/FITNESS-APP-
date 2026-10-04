/**
 * Food unit resolution, shared by the server (authoritative) and the client (previews).
 *
 * A food stores nutrients per 100 base units (g or ml) and optional named servings
 * (e.g. "slice" = 30 g). Entries record quantity + unit; the base amount is derived.
 */
import type { FoodServing } from "@/server/db/schema";
import type { Locale } from "./domain";
import { flOzToMl, ozToG } from "./units";

export type FoodUnitInfo = { baseUnit: "g" | "ml"; servings: FoodServing[] };

/** Units offered for a food: its base unit, imperial equivalents and its servings. */
export function unitOptions(food: FoodUnitInfo, locale: Locale) {
  const base = [{ id: food.baseUnit, label: food.baseUnit, amount: 1 }];
  const imperial = food.baseUnit === "g" ? [{ id: "oz", label: "oz", amount: ozToG(1) }] : [{ id: "fl_oz", label: "fl oz", amount: flOzToMl(1) }];
  const servings = food.servings.map((s) => ({ id: s.id, label: (locale === "el" && s.labelEl) || s.label, amount: s.amount }));
  return [...servings, ...base, ...imperial];
}

/** Base amount (g/ml) for a quantity in a unit, or null if the unit isn't valid for the food. */
export function toBaseAmount(food: FoodUnitInfo, quantity: number, unit: string): number | null {
  if (!(quantity > 0)) return null;
  if (unit === food.baseUnit) return quantity;
  if (unit === "oz" && food.baseUnit === "g") return ozToG(quantity);
  if (unit === "fl_oz" && food.baseUnit === "ml") return flOzToMl(quantity);
  const serving = food.servings.find((s) => s.id === unit);
  return serving ? serving.amount * quantity : null;
}

/** Human label for an entry's quantity: "150 g", "2 × slice". */
export function quantityLabel(quantity: number, unit: string, servings: FoodServing[] | null, locale: Locale, fmtNum: (n: number, d?: number) => string) {
  if (unit === "g" || unit === "ml" || unit === "oz" || unit === "fl_oz") return `${fmtNum(quantity, 1)} ${unit === "fl_oz" ? "fl oz" : unit}`;
  const s = servings?.find((x) => x.id === unit);
  const label = s ? (locale === "el" && s.labelEl) || s.label : unit;
  return `${fmtNum(quantity, 2)} × ${label}`;
}

/** Strip a leading "1 " from catalog serving labels ("1 slice" → "slice"). */
export function servingNoun(label: string) {
  return label.replace(/^1\s+/, "");
}
