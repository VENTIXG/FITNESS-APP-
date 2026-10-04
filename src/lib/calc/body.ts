/**
 * Body metrics: BMI, BMR, formula TDEE, body composition.
 * Formulas are population estimates; the app labels them as estimates.
 */
import type { ActivityLevel, Sex } from "../domain";
import { diffDays, type ISODate } from "../dates";

export function bmi(weightKg: number, heightCm: number): number | null {
  if (!(weightKg > 0) || !(heightCm > 0)) return null;
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export type BmiCategory = "underweight" | "normal" | "overweight" | "obese";

/** WHO adult categories. BMI ignores body composition; shown with that caveat. */
export function bmiCategory(value: number): BmiCategory {
  if (value < 18.5) return "underweight";
  if (value < 25) return "normal";
  if (value < 30) return "overweight";
  return "obese";
}

/** Whole years between birth date and `on`. */
export function ageOn(birthDate: ISODate, on: ISODate): number {
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [y, m, d] = on.split("-").map(Number);
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age -= 1;
  return age;
}

/** Mifflin–St Jeor resting energy expenditure (kcal/day). */
export function bmrMifflinStJeor(input: { weightKg: number; heightCm: number; age: number; sex: Sex }): number {
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age;
  return input.sex === "male" ? base + 5 : base - 161;
}

/** Katch–McArdle (needs lean body mass); often better when body fat % is known. */
export function bmrKatchMcArdle(leanMassKg: number): number {
  return 370 + 21.6 * leanMassKg;
}

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export type FormulaTdee = {
  bmr: number;
  tdee: number;
  method: "mifflin" | "katch";
  multiplier: number;
};

/**
 * Formula-based total daily energy expenditure. Uses Katch–McArdle when body fat
 * is known, otherwise Mifflin–St Jeor. Returns null when required inputs are missing.
 */
export function formulaTdee(input: {
  weightKg: number | null;
  heightCm: number | null;
  age: number | null;
  sex: Sex | null;
  activityLevel: ActivityLevel;
  bodyFatPct?: number | null;
}): FormulaTdee | null {
  const multiplier = ACTIVITY_MULTIPLIERS[input.activityLevel];
  if (input.weightKg && input.bodyFatPct != null && input.bodyFatPct > 2 && input.bodyFatPct < 70) {
    const bmr = bmrKatchMcArdle(leanMass(input.weightKg, input.bodyFatPct));
    return { bmr, tdee: bmr * multiplier, method: "katch", multiplier };
  }
  if (!input.weightKg || !input.heightCm || input.age == null || !input.sex) return null;
  const bmr = bmrMifflinStJeor({ weightKg: input.weightKg, heightCm: input.heightCm, age: input.age, sex: input.sex });
  return { bmr, tdee: bmr * multiplier, method: "mifflin", multiplier };
}

export function fatMass(weightKg: number, bodyFatPct: number): number {
  return (weightKg * bodyFatPct) / 100;
}

export function leanMass(weightKg: number, bodyFatPct: number): number {
  return weightKg - fatMass(weightKg, bodyFatPct);
}

/**
 * U.S. Navy circumference method (metric form). Returns body-fat % or null when
 * inputs are missing / out of the formula's domain.
 */
export function navyBodyFat(input: {
  sex: Sex;
  heightCm: number;
  neckCm: number;
  waistCm: number;
  hipsCm?: number | null;
}): number | null {
  const { sex, heightCm, neckCm, waistCm, hipsCm } = input;
  if (!(heightCm > 0 && neckCm > 0 && waistCm > 0)) return null;
  let pct: number;
  if (sex === "male") {
    if (waistCm - neckCm <= 0) return null;
    pct = 495 / (1.0324 - 0.19077 * Math.log10(waistCm - neckCm) + 0.15456 * Math.log10(heightCm)) - 450;
  } else {
    if (!hipsCm || waistCm + hipsCm - neckCm <= 0) return null;
    pct = 495 / (1.29579 - 0.35004 * Math.log10(waistCm + hipsCm - neckCm) + 0.221 * Math.log10(heightCm)) - 450;
  }
  if (!Number.isFinite(pct) || pct < 2 || pct > 70) return null;
  return pct;
}

/** Fills in fat/lean mass from body-fat % and weight when they weren't entered directly. */
export function resolveComposition(entry: {
  weightKg: number | null;
  bodyFatPct: number | null;
  fatMassKg: number | null;
  leanMassKg: number | null;
}) {
  let { bodyFatPct, fatMassKg, leanMassKg } = entry;
  const w = entry.weightKg;
  if (w && bodyFatPct != null) {
    fatMassKg ??= fatMass(w, bodyFatPct);
    leanMassKg ??= leanMass(w, bodyFatPct);
  } else if (w && fatMassKg != null) {
    bodyFatPct ??= (fatMassKg / w) * 100;
    leanMassKg ??= w - fatMassKg;
  } else if (w && leanMassKg != null) {
    fatMassKg ??= w - leanMassKg;
    bodyFatPct ??= ((w - leanMassKg) / w) * 100;
  }
  return { bodyFatPct, fatMassKg, leanMassKg };
}

export function daysBetween(a: ISODate, b: ISODate) {
  return Math.abs(diffDays(a, b));
}
