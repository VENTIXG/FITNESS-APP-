import { describe, expect, it } from "vitest";
import { addDays } from "../dates";
import { ewmaTrend, linearRegression, meanInRange, median, rollingMean, trailingMean } from "./series";

const pts = (values: number[], start = "2026-01-01") => values.map((value, i) => ({ date: addDays(start, i), value }));

describe("moving averages", () => {
  it("rolling 7-day mean over consecutive days", () => {
    const r = rollingMean(pts([1, 2, 3, 4, 5, 6, 7, 8]), 7);
    expect(r[0].value).toBe(1);
    expect(r[6].value).toBeCloseTo(4, 10); // mean(1..7)
    expect(r[7].value).toBeCloseTo(5, 10); // mean(2..8)
  });

  it("uses calendar windows, not N points, when days are missing", () => {
    const sparse = [
      { date: "2026-01-01", value: 80 },
      { date: "2026-01-05", value: 82 },
      { date: "2026-01-10", value: 84 },
    ];
    const r = rollingMean(sparse, 7);
    expect(r[1].value).toBe(81); // Jan 1 & 5 within 7 days
    expect(r[2].value).toBe(83); // Jan 5 & 10; Jan 1 dropped
  });

  it("trailing mean ending at a date", () => {
    expect(trailingMean(pts([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), "2026-01-10", 7)).toBeCloseTo(7, 10);
    expect(meanInRange(pts([1, 2, 3]), "2026-02-01", "2026-02-07")).toBeNull();
  });

  it("EWMA moves a fraction toward each new value", () => {
    const r = ewmaTrend(pts([80, 90]), 0.1);
    expect(r[1].value).toBeCloseTo(81, 10);
  });

  it("median", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe("linear regression", () => {
  it("recovers an exact slope", () => {
    const reg = linearRegression(pts([100, 99.9, 99.8, 99.7, 99.6]));
    expect(reg?.slopePerDay).toBeCloseTo(-0.1, 10);
    expect(reg?.r2).toBeCloseTo(1, 10);
    expect(reg?.slopeStdErr).toBeCloseTo(0, 10);
  });

  it("needs at least 3 points", () => {
    expect(linearRegression(pts([1, 2]))).toBeNull();
  });
});
