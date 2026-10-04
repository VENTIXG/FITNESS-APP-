import { describe, expect, it } from "vitest";
import { KCAL_PER_KG } from "../config";
import { addDays } from "../dates";
import {
  adherenceRate,
  calorieStatus,
  caloriesFromMacros,
  macroSplit,
  proteinHit,
  recipeNutrition,
  scaleNutrients,
  suggestCalorieTarget,
  suggestMacroTargets,
  sumNutrients,
  targetForDate,
} from "./nutrition";
import { completeIntakeDays, estimateAdaptiveTdee } from "./tdee";

const oats = { calories: 379, proteinG: 13.2, carbsG: 67.7, fatG: 6.5, fiberG: 10.1 };
const whey = { calories: 400, proteinG: 78, carbsG: 8, fatG: 6, fiberG: 0 };

describe("macro totals", () => {
  it("scales per-100 g values", () => {
    const n = scaleNutrients(oats, 50);
    expect(n.calories).toBeCloseTo(189.5, 10);
    expect(n.proteinG).toBeCloseTo(6.6, 10);
  });

  it("sums entries (nullable micros stay null when absent)", () => {
    const total = sumNutrients([scaleNutrients(oats, 50), scaleNutrients(whey, 30)]);
    expect(total.calories).toBeCloseTo(189.5 + 120, 10);
    expect(total.proteinG).toBeCloseTo(6.6 + 23.4, 10);
    expect(total.sugarG).toBeNull();
    expect(sumNutrients([{ ...oats, sugarG: 1 }, { ...whey, sugarG: null }]).sugarG).toBe(1);
  });

  it("macro energy split", () => {
    expect(caloriesFromMacros({ proteinG: 100, carbsG: 200, fatG: 50 })).toBe(400 + 800 + 450);
    const split = macroSplit({ proteinG: 100, carbsG: 200, fatG: 50 });
    expect(split.protein + split.carbs + split.fat).toBeCloseTo(1, 10);
  });

  it("recipe totals and per-serving values", () => {
    const r = recipeNutrition(
      [
        { nutrientsPer100: oats, baseAmount: 80 },
        { nutrientsPer100: whey, baseAmount: 30 },
      ],
      2,
    );
    expect(r.total.calories).toBeCloseTo(379 * 0.8 + 120, 10);
    expect(r.perServing.calories).toBeCloseTo((379 * 0.8 + 120) / 2, 10);
    expect(r.totalWeightG).toBe(110);
  });
});

describe("adherence", () => {
  it("calorie status uses a ±10% band", () => {
    expect(calorieStatus(1900, 2200)).toBe("under");
    expect(calorieStatus(2100, 2200)).toBe("on_target");
    expect(calorieStatus(2500, 2200)).toBe("over");
  });
  it("protein is hit at 90% of target", () => {
    expect(proteinHit(180, 200)).toBe(true);
    expect(proteinHit(179, 200)).toBe(false);
  });
  it("adherence rate", () => {
    expect(adherenceRate([1, 2, 3, 4], (n) => n > 2)).toBe(0.5);
    expect(adherenceRate([], () => true)).toBeNull();
  });
  it("target history: latest target effective on a date", () => {
    const targets = [
      { effectiveFrom: "2026-01-01", calories: 2400 },
      { effectiveFrom: "2026-02-01", calories: 2200 },
    ];
    expect(targetForDate(targets, "2025-12-31")).toBeNull();
    expect(targetForDate(targets, "2026-01-15")?.calories).toBe(2400);
    expect(targetForDate(targets, "2026-02-01")?.calories).toBe(2200);
  });
  it("suggests sane macro targets", () => {
    const t = suggestMacroTargets(2200, 90, "lose_fat");
    expect(t.proteinG).toBe(180);
    expect(t.proteinG * 4 + t.carbsG * 4 + t.fatG * 9).toBeLessThanOrEqual(2200 + 20);
    expect(suggestCalorieTarget(2800, "lose_fat")).toBe(2240);
    expect(suggestCalorieTarget(2800, "maintain")).toBe(2800);
  });
});

describe("adaptive TDEE", () => {
  const end = "2026-03-28";
  const days = Array.from({ length: 28 }, (_, i) => addDays(end, -27 + i));
  // True TDEE 2700, intake 2200 → −500 kcal/day → −500/7700 kg/day.
  const slope = -500 / KCAL_PER_KG;
  const weights = days.map((date, i) => ({ date, value: 90 + slope * i + (i % 3 === 0 ? 0.3 : i % 3 === 1 ? -0.2 : -0.1) }));
  const intake = days.map((date, i) => ({ date, calories: 2200 + (i % 2 ? 100 : -100) }));

  it("recovers expenditure from intake and weight trend", () => {
    const est = estimateAdaptiveTdee({ intake, weights, end })!;
    expect(est).not.toBeNull();
    expect(est.tdee).toBeGreaterThan(2550);
    expect(est.tdee).toBeLessThan(2850);
    expect(est.low).toBeLessThan(est.tdee);
    expect(est.high).toBeGreaterThan(est.tdee);
    expect(est.intakeDays).toBe(28);
    expect(["medium", "high"]).toContain(est.confidence);
  });

  it("refuses to estimate from too little data", () => {
    expect(estimateAdaptiveTdee({ intake: intake.slice(-5), weights, end })).toBeNull();
    expect(estimateAdaptiveTdee({ intake, weights: weights.slice(-4), end })).toBeNull();
  });

  it("drops obviously incomplete logging days", () => {
    const withPartial = [...intake.slice(0, 27), { date: end, calories: 400 }];
    expect(completeIntakeDays(withPartial)).toHaveLength(27);
  });

  it("does not overreact to a single-day scale spike", () => {
    const spiked = weights.map((w, i) => (i === weights.length - 1 ? { ...w, value: w.value + 2 } : w));
    const a = estimateAdaptiveTdee({ intake, weights, end })!;
    const b = estimateAdaptiveTdee({ intake, weights: spiked, end })!;
    expect(Math.abs(a.tdee - b.tdee)).toBeLessThan(450);
  });
});
