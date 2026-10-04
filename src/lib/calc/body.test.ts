import { describe, expect, it } from "vitest";
import {
  ageOn,
  bmi,
  bmiCategory,
  bmrKatchMcArdle,
  bmrMifflinStJeor,
  fatMass,
  formulaTdee,
  leanMass,
  navyBodyFat,
  resolveComposition,
} from "./body";

describe("BMI", () => {
  it("computes kg/m²", () => {
    expect(bmi(80, 180)).toBeCloseTo(24.69, 2);
  });
  it("returns null for missing inputs", () => {
    expect(bmi(0, 180)).toBeNull();
    expect(bmi(80, 0)).toBeNull();
  });
  it("categorises", () => {
    expect(bmiCategory(17)).toBe("underweight");
    expect(bmiCategory(22)).toBe("normal");
    expect(bmiCategory(27)).toBe("overweight");
    expect(bmiCategory(31)).toBe("obese");
  });
});

describe("age", () => {
  it("handles birthdays not yet reached this year", () => {
    expect(ageOn("1990-10-05", "2026-10-04")).toBe(35);
    expect(ageOn("1990-10-04", "2026-10-04")).toBe(36);
  });
});

describe("BMR", () => {
  it("Mifflin–St Jeor male", () => {
    // 10*90 + 6.25*180 - 5*30 + 5 = 1880
    expect(bmrMifflinStJeor({ weightKg: 90, heightCm: 180, age: 30, sex: "male" })).toBeCloseTo(1880, 5);
  });
  it("Mifflin–St Jeor female", () => {
    // 10*65 + 6.25*165 - 5*30 - 161 = 1370.25
    expect(bmrMifflinStJeor({ weightKg: 65, heightCm: 165, age: 30, sex: "female" })).toBeCloseTo(1370.25, 5);
  });
  it("Katch–McArdle", () => {
    expect(bmrKatchMcArdle(70)).toBeCloseTo(370 + 21.6 * 70, 5);
  });
});

describe("formula TDEE", () => {
  it("uses Mifflin with activity multiplier", () => {
    const r = formulaTdee({ weightKg: 90, heightCm: 180, age: 30, sex: "male", activityLevel: "moderate" });
    expect(r?.method).toBe("mifflin");
    expect(r?.tdee).toBeCloseTo(1880 * 1.55, 5);
  });
  it("prefers Katch–McArdle when body fat is known", () => {
    const r = formulaTdee({ weightKg: 90, heightCm: 180, age: 30, sex: "male", activityLevel: "sedentary", bodyFatPct: 20 });
    expect(r?.method).toBe("katch");
    expect(r?.tdee).toBeCloseTo((370 + 21.6 * 72) * 1.2, 5);
  });
  it("returns null without required inputs", () => {
    expect(formulaTdee({ weightKg: 90, heightCm: null, age: 30, sex: "male", activityLevel: "moderate" })).toBeNull();
  });
});

describe("body composition", () => {
  it("fat and lean mass", () => {
    expect(fatMass(90, 20)).toBeCloseTo(18, 10);
    expect(leanMass(90, 20)).toBeCloseTo(72, 10);
  });
  it("resolves missing fields from what was entered", () => {
    expect(resolveComposition({ weightKg: 80, bodyFatPct: 25, fatMassKg: null, leanMassKg: null })).toEqual({
      bodyFatPct: 25,
      fatMassKg: 20,
      leanMassKg: 60,
    });
    const fromLean = resolveComposition({ weightKg: 80, bodyFatPct: null, fatMassKg: null, leanMassKg: 64 });
    expect(fromLean.bodyFatPct).toBeCloseTo(20, 10);
    expect(fromLean.fatMassKg).toBeCloseTo(16, 10);
  });
  it("Navy method returns a plausible percentage", () => {
    const male = navyBodyFat({ sex: "male", heightCm: 180, neckCm: 39, waistCm: 88 });
    expect(male).not.toBeNull();
    expect(male!).toBeGreaterThan(14);
    expect(male!).toBeLessThan(20);
    expect(navyBodyFat({ sex: "female", heightCm: 165, neckCm: 33, waistCm: 75 })).toBeNull(); // hips required
  });
});
