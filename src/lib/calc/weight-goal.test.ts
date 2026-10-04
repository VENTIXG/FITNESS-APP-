import { describe, expect, it } from "vitest";
import { addDays } from "../dates";
import {
  assessRate,
  dailyEnergyBalanceForRate,
  estimateGoalDate,
  goalProgress,
  plannedWeightOn,
  requiredWeeklyRate,
  scheduleStatus,
} from "./goal";
import { forecastWeight } from "./forecast";
import { computeWeightStats } from "./weight";

/** Zero-mean "water" noise with a 7-day period, so every 7-day window carries the same noise. */
const NOISE = [0.4, -0.3, 0.1, -0.4, 0.3, 0.2, -0.3];

/** 60 days losing 0.5 kg/week plus day-to-day noise. */
function syntheticWeights(days = 60, start = 90, perWeek = -0.5) {
  return Array.from({ length: days }, (_, i) => ({
    date: addDays("2026-01-01", i),
    weightKg: start + (perWeek / 7) * i + NOISE[i % 7],
  }));
}

describe("weight stats", () => {
  const entries = syntheticWeights();
  const asOf = entries.at(-1)!.date;
  const s = computeWeightStats(entries, asOf);

  it("daily change uses the previous entry", () => {
    expect(s.latest?.date).toBe(asOf);
    expect(s.changeFromPrevious).toBeCloseTo(-0.5 / 7 + NOISE[59 % 7] - NOISE[58 % 7], 6);
  });

  it("7-day average smooths noise", () => {
    expect(s.avg7).not.toBeNull();
    // True mid-window value ≈ start − (0.5/7)·56
    expect(s.avg7!).toBeCloseTo(90 - (0.5 / 7) * 56, 0);
  });

  it("weekly change ≈ target rate", () => {
    expect(s.weeklyChange!).toBeCloseTo(-0.5, 1);
  });

  it("regression rate recovers the underlying trend", () => {
    expect(s.ratePerWeek!).toBeCloseTo(-0.5, 1);
    expect(s.trend).toBe("down");
  });

  it("total change vs first entry", () => {
    expect(s.totalChange!).toBeLessThan(-3);
  });

  it("handles no data", () => {
    const empty = computeWeightStats([], "2026-01-01");
    expect(empty.latest).toBeNull();
    expect(empty.avg7).toBeNull();
    expect(empty.trend).toBeNull();
  });
});

describe("goal progress", () => {
  const goal = { startDate: "2026-01-01", startWeightKg: 90, targetWeightKg: 80, targetDate: "2026-07-01" };

  it("percent and remaining", () => {
    const p = goalProgress(goal, 85);
    expect(p.direction).toBe("lose");
    expect(p.percent).toBeCloseTo(50, 10);
    expect(p.remainingKg).toBeCloseTo(5, 10);
    expect(p.reached).toBe(false);
  });

  it("clamps when moving the wrong way and when past target", () => {
    expect(goalProgress(goal, 92).percent).toBe(0);
    const past = goalProgress(goal, 79.5);
    expect(past.percent).toBe(100);
    expect(past.remainingKg).toBe(0);
    expect(past.reached).toBe(true);
  });

  it("supports gain goals", () => {
    const g = goalProgress({ ...goal, startWeightKg: 70, targetWeightKg: 75 }, 72.5);
    expect(g.direction).toBe("gain");
    expect(g.percent).toBeCloseTo(50, 10);
  });

  it("required weekly rate and energy balance", () => {
    const r = requiredWeeklyRate(85, 80, "2026-04-01", "2026-05-01")!; // 30 days
    expect(r).toBeCloseTo((-5 / 30) * 7, 10);
    expect(dailyEnergyBalanceForRate(-0.5)).toBeCloseTo(-550, 6);
    expect(requiredWeeklyRate(85, 80, "2026-05-02", "2026-05-01")).toBeNull();
  });

  it("schedule status against the planned line", () => {
    const mid = "2026-04-01";
    const planned = plannedWeightOn(goal, mid)!;
    expect(scheduleStatus(goal, mid, planned)).toBe("on_track");
    expect(scheduleStatus(goal, mid, planned - 1)).toBe("ahead");
    expect(scheduleStatus(goal, mid, planned + 1)).toBe("behind");
    expect(scheduleStatus({ ...goal, targetDate: null }, mid, 85)).toBe("no_target_date");
    expect(scheduleStatus(goal, mid, 79.8)).toBe("reached");
  });

  it("flags unusually aggressive rates neutrally", () => {
    expect(assessRate(-0.5, 90).level).toBe("ok");
    expect(assessRate(-1.1, 90).level).toBe("aggressive");
    expect(assessRate(-1.5, 90).level).toBe("very_aggressive");
    expect(assessRate(0.6, 80).level).toBe("aggressive");
  });

  it("estimates goal date only when trending toward target", () => {
    const eta = estimateGoalDate({ currentKg: 85, targetKg: 80, ratePerWeek: -0.5, rateStdErrPerWeek: 0.05, today: "2026-01-01" });
    expect(eta?.weeks).toBeCloseTo(10, 10);
    expect(eta?.date).toBe(addDays("2026-01-01", 70));
    expect(eta!.early! < eta!.date).toBe(true);
    expect(eta!.late! > eta!.date).toBe(true);
    expect(estimateGoalDate({ currentKg: 85, targetKg: 80, ratePerWeek: 0.2, today: "2026-01-01" })).toBeNull();
    expect(estimateGoalDate({ currentKg: 85, targetKg: 80, ratePerWeek: -0.01, today: "2026-01-01" })).toBeNull();
  });
});

describe("forecast", () => {
  it("projects the trend with a widening band", () => {
    const f = forecastWeight({ today: "2026-03-01", baseWeightKg: 85, observedRatePerWeek: -0.5, observedRateStdErr: 0.05, targetWeightKg: 80 })!;
    expect(f.basis).toBe("trend");
    const m1 = f.at(28);
    const m3 = f.at(91);
    expect(m1.expected).toBeCloseTo(83, 6);
    expect(m3.expected).toBeCloseTo(85 - 0.5 * 13, 6);
    expect(m3.high - m3.low).toBeGreaterThan(m1.high - m1.low);
    expect(m1.low).toBeLessThan(m1.expected);
    expect(f.goalEta?.weeks).toBeCloseTo(10, 6);
  });

  it("combines trend with energy balance when TDEE is reliable", () => {
    const f = forecastWeight({
      today: "2026-03-01",
      baseWeightKg: 85,
      observedRatePerWeek: -0.4,
      observedRateStdErr: 0.05,
      avgIntake: 2200,
      tdee: 2800,
      tdeeConfidence: "medium",
    })!;
    expect(f.basis).toBe("combined");
    const energyRate = ((2200 - 2800) / 7700) * 7;
    expect(f.ratePerWeek).toBeCloseTo((-0.4 + energyRate) / 2, 10);
  });

  it("returns null without any rate", () => {
    expect(forecastWeight({ today: "2026-03-01", baseWeightKg: 85, observedRatePerWeek: null })).toBeNull();
  });
});
