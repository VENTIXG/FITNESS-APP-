import { describe, expect, it } from "vitest";
import { addDays, startOfWeek } from "../dates";
import { DEFAULT_SCORE_WEIGHTS } from "../preferences";
import { emptyDaySummary, evaluateAutoHabit, isScheduledOn, type DaySummary } from "./day";
import { generateInsights, type InsightFormatters } from "./insights";
import { calorieComponent, dailyScore, weeklyScore } from "./score";
import { dailyStreak, weeklyStreak } from "./streaks";

const goals = { stepGoal: 10000, waterGoalMl: 2500, sleepGoalMinutes: 480, cardioDailyTargetMin: 0 };
const target = { effectiveFrom: "2026-01-01", calories: 2200, proteinG: 200, carbsG: 200, fatG: 70, fiberG: 30 };

function day(date: string, patch: Partial<DaySummary> = {}): DaySummary {
  return { ...emptyDaySummary(date, goals), ...patch };
}

describe("daily score", () => {
  it("calorie component", () => {
    expect(calorieComponent(2200, 2200)).toBe(1);
    expect(calorieComponent(2300, 2200)).toBe(1); // within 5%
    expect(calorieComponent(2200 * 1.3, 2200)).toBeCloseTo(0, 10);
  });

  it("perfect day scores 100 and weight is not a component", () => {
    const d = day("2026-01-05", {
      weightKg: 999,
      nutrition: { entries: 5, totals: { calories: 2200, proteinG: 200, carbsG: 200, fatG: 70, fiberG: 30 }, target },
      steps: 12000,
      workoutPlanned: true,
      workoutsCompleted: 1,
      sleepMinutes: 480,
      waterMl: 3000,
    });
    const s = dailyScore(d, DEFAULT_SCORE_WEIGHTS);
    expect(s.score).toBe(100);
    expect(s.breakdown.map((b) => b.component)).not.toContain("weight" as never);
  });

  it("rest days and missing sleep are excluded, not penalised", () => {
    const d = day("2026-01-05", {
      nutrition: { entries: 3, totals: { calories: 2200, proteinG: 200, carbsG: 0, fatG: 0, fiberG: 0 }, target },
      steps: 10000,
      waterMl: 2500,
    });
    const s = dailyScore(d, DEFAULT_SCORE_WEIGHTS);
    expect(s.breakdown.find((b) => b.component === "workout")?.value).toBeNull();
    expect(s.breakdown.find((b) => b.component === "sleep")?.value).toBeNull();
    expect(s.score).toBe(100);
  });

  it("respects custom weights (0 removes a component)", () => {
    const d = day("2026-01-05", { steps: 0 });
    const weights = { ...DEFAULT_SCORE_WEIGHTS, calories: 0, protein: 0, water: 0, cardio: 0, sleep: 0, workout: 0, steps: 1 };
    expect(dailyScore(d, weights).score).toBe(0);
  });

  it("weekly score averages elapsed days", () => {
    expect(weeklyScore([80, 90, null, 100])).toBe(90);
    expect(weeklyScore([null])).toBeNull();
  });
});

describe("auto habits", () => {
  it("evaluates from data", () => {
    const d = day("2026-01-05", {
      weightKg: 85,
      nutrition: { entries: 2, totals: { calories: 2150, proteinG: 150, carbsG: 0, fatG: 0, fiberG: 0 }, target },
      steps: 9000,
      supplementsDue: 2,
      supplementsTaken: 2,
    });
    expect(evaluateAutoHabit("weight_logged", d)).toBe(true);
    expect(evaluateAutoHabit("calories_target", d)).toBe(true);
    expect(evaluateAutoHabit("protein_target", d)).toBe(false);
    expect(evaluateAutoHabit("steps_target", d)).toBe(false);
    expect(evaluateAutoHabit("supplements", d)).toBe(true);
    expect(evaluateAutoHabit("supplements", day("2026-01-05"))).toBeNull();
  });
  it("schedules", () => {
    expect(isScheduledOn("daily", [], "2026-01-05")).toBe(true);
    expect(isScheduledOn("specific_days", [1, 3, 5], "2026-01-05")).toBe(true); // Monday
    expect(isScheduledOn("specific_days", [1, 3, 5], "2026-01-06")).toBe(false);
  });
});

describe("streaks", () => {
  it("daily streak doesn't break on an unfinished today", () => {
    const today = "2026-01-10";
    const s = new Set([addDays(today, -1), addDays(today, -2), addDays(today, -3), addDays(today, -6)]);
    expect(dailyStreak(s, today, "2026-01-01")).toEqual({ current: 3, best: 3 });
    s.add(today);
    expect(dailyStreak(s, today, "2026-01-01").current).toBe(4);
  });

  it("weekly streak counts weeks meeting the target", () => {
    const today = "2026-01-28"; // Wednesday
    const thisWeek = startOfWeek(today, 1);
    const counts = new Map([
      [addDays(thisWeek, -7), 4],
      [addDays(thisWeek, -14), 4],
      [addDays(thisWeek, -21), 2],
      [thisWeek, 1],
    ]);
    expect(weeklyStreak(counts, 4, today, 1, "2026-01-01").current).toBe(2);
  });
});

describe("insights", () => {
  const f: InsightFormatters = {
    weight: (kg) => `${kg.toFixed(1)} kg`,
    kcal: (k) => `${Math.round(k)} kcal`,
    pct: (x) => `${Math.round(x * 100)}%`,
    int: (n) => String(Math.round(n)),
    sleep: (m) => `${Math.round(m)}m`,
  };

  it("asks for more data instead of over-interpreting", () => {
    const today = "2026-02-01";
    const days = Array.from({ length: 28 }, (_, i) => day(addDays(today, -27 + i)));
    const out = generateInsights(
      { today, weekStartsOn: 1, days, weights: [], goal: null, tdee: null, formulaTdee: null, plannedWorkoutsPerWeek: 4, cardioMinutesPerWeek: 150, liftTrends: [] },
      f,
    );
    expect(out.map((i) => i.id)).toEqual(["gettingStarted"]);
  });

  it("reports protein adherence and faster-than-target loss", () => {
    const today = "2026-03-01";
    const days = Array.from({ length: 28 }, (_, i) => {
      const date = addDays(today, -27 + i);
      return day(date, { nutrition: { entries: 4, totals: { calories: 2200, proteinG: i % 2 ? 190 : 150, carbsG: 0, fatG: 0, fiberG: 0 }, target } });
    });
    const weights = Array.from({ length: 28 }, (_, i) => ({ date: addDays(today, -27 + i), weightKg: 90 - (1.0 / 7) * i }));
    const out = generateInsights(
      {
        today,
        weekStartsOn: 1,
        days,
        weights,
        goal: { startDate: "2026-01-01", startWeightKg: 92, targetWeightKg: 80, targetDate: "2026-09-01" },
        tdee: null,
        formulaTdee: null,
        plannedWorkoutsPerWeek: 0,
        cardioMinutesPerWeek: 0,
        liftTrends: [],
      },
      f,
    );
    const ids = out.map((i) => i.id);
    expect(ids).toContain("weightFasterThanTarget");
    expect(ids).toContain("proteinAdherence");
    expect(ids).toContain("rateAggressive");
  });
});
