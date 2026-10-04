import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  diffDays,
  eachDay,
  endOfMonth,
  isISODate,
  isoWeek,
  minutesBetweenClockTimes,
  startOfWeek,
  todayInTimeZone,
  weekday,
} from "./dates";
import { fmtNumber, fmtWeight } from "./format";
import { cmToFeetInches, fromDisplayWeight, kgToLb, lbToKg, paceSeconds, roundToIncrement, toDisplayDistance } from "./units";

describe("dates", () => {
  it("validates ISO dates", () => {
    expect(isISODate("2026-02-28")).toBe(true);
    expect(isISODate("2026-02-30")).toBe(false);
    expect(isISODate("2026-2-3")).toBe(false);
  });
  it("arithmetic across month/year boundaries and DST", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-29", 1)).toBe("2026-03-30"); // EU DST change day
    expect(diffDays("2026-03-01", "2026-02-01")).toBe(28);
    expect(eachDay("2026-01-30", "2026-02-02")).toEqual(["2026-01-30", "2026-01-31", "2026-02-01", "2026-02-02"]);
    expect(endOfMonth("2028-02-10")).toBe("2028-02-29");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
  });
  it("weeks", () => {
    expect(weekday("2026-10-04")).toBe(0); // Sunday
    expect(startOfWeek("2026-10-04", 1)).toBe("2026-09-28");
    expect(startOfWeek("2026-10-04", 0)).toBe("2026-10-04");
    expect(isoWeek("2026-01-01")).toEqual({ year: 2026, week: 1 });
  });
  it("today in a timezone", () => {
    const instant = new Date("2026-10-04T22:30:00Z");
    expect(todayInTimeZone("Europe/Athens", instant)).toBe("2026-10-05");
    expect(todayInTimeZone("America/New_York", instant)).toBe("2026-10-04");
    expect(todayInTimeZone("Not/AZone", instant)).toBe("2026-10-04");
  });
  it("sleep duration across midnight", () => {
    expect(minutesBetweenClockTimes("23:30", "07:00")).toBe(450);
    expect(minutesBetweenClockTimes("01:00", "08:15")).toBe(435);
  });
});

describe("units", () => {
  it("weight round-trips", () => {
    expect(kgToLb(100)).toBeCloseTo(220.462, 3);
    expect(lbToKg(kgToLb(83.4))).toBeCloseTo(83.4, 10);
    expect(fromDisplayWeight(225, "imperial")).toBeCloseTo(102.058, 3);
  });
  it("distance, pace and height", () => {
    expect(toDisplayDistance(5000, "metric")).toBe(5);
    expect(paceSeconds(1500, 5000, "metric")).toBe(300);
    expect(paceSeconds(1500, null, "metric")).toBeNull();
    expect(cmToFeetInches(180)).toEqual({ feet: 5, inches: 11 });
  });
  it("rounds to plate increments", () => {
    expect(roundToIncrement(101.3, 1.25)).toBeCloseTo(101.25, 10);
    expect(roundToIncrement(101.9, 2.5)).toBe(102.5);
  });
});

describe("formatting", () => {
  it("formats by locale", () => {
    expect(fmtNumber("en", 1640)).toBe("1,640");
    expect(fmtNumber("el", 1640)).toBe("1.640");
    expect(fmtWeight("el", "metric", 84.25)).toBe("84,3 kg");
    expect(fmtWeight("en", "imperial", 100)).toBe("220.5 lb");
    expect(fmtWeight("en", "metric", -0.5, { signed: true })).toBe("−0.5 kg");
  });
});
