import { describe, expect, it } from "vitest";
import { suggestProgression } from "./progression";
import {
  bestSet,
  buildExerciseRecords,
  detectPersonalRecords,
  e1rmBrzycki,
  e1rmEpley,
  livePrsForSet,
  repMaxTable,
  setVolume,
  totalVolume,
  volumeByMuscle,
  workoutAdherence,
  type HistorySession,
} from "./training";

const set = (weightKg: number, reps: number, extra: Partial<{ setType: "normal" | "warmup"; completed: boolean }> = {}) => ({
  weightKg,
  reps,
  setType: extra.setType ?? ("normal" as const),
  completed: extra.completed ?? true,
});

describe("e1RM", () => {
  it("Epley", () => {
    expect(e1rmEpley(100, 1)).toBe(100);
    expect(e1rmEpley(100, 8)).toBeCloseTo(126.67, 2);
    expect(e1rmEpley(100, 0)).toBeNull();
    expect(e1rmEpley(100, 20)).toBeNull();
  });
  it("Brzycki", () => {
    expect(e1rmBrzycki(100, 10)).toBeCloseTo(133.33, 2);
  });
});

describe("volume", () => {
  it("volume = Σ weight × reps over completed working sets", () => {
    const sets = [set(60, 10, { setType: "warmup" }), set(100, 8), set(100, 8), set(95, 10), set(100, 5, { completed: false })];
    expect(setVolume({ weightKg: 100, reps: 8 })).toBe(800);
    expect(totalVolume(sets)).toBe(800 + 800 + 950);
    expect(totalVolume(sets, true)).toBe(600 + 800 + 800 + 950);
  });
  it("best set by e1RM", () => {
    expect(bestSet([set(100, 8), set(110, 3), set(95, 10)])).toMatchObject({ weightKg: 100, reps: 8 });
  });
  it("rep-max table", () => {
    const t = repMaxTable([set(100, 8), set(110, 3)], 10);
    expect(t[0]).toBe(110);
    expect(t[2]).toBe(110);
    expect(t[3]).toBe(100);
    expect(t[8]).toBeNull();
  });
  it("muscle distribution gives secondaries half a set", () => {
    const r = volumeByMuscle([{ muscleGroup: "chest", secondaryMuscles: ["triceps"], sets: 4, volume: 3000 }]);
    expect(r.find((m) => m.muscle === "chest")).toMatchObject({ sets: 4, volume: 3000 });
    expect(r.find((m) => m.muscle === "triceps")).toMatchObject({ sets: 2, volume: 0 });
  });
  it("adherence", () => {
    expect(workoutAdherence(4, 5)).toBe(0.8);
    expect(workoutAdherence(6, 5)).toBe(1);
    expect(workoutAdherence(1, 0)).toBeNull();
  });
});

describe("PR detection", () => {
  const session = (id: string, date: string, sets: [number, number][]): HistorySession => ({
    workoutId: id,
    date,
    startedAt: `${date}T10:00:00Z`,
    sets: sets.map(([w, r], i) => ({ id: `${id}-${i}`, weightKg: w, reps: r, setType: "normal", completed: true })),
  });

  it("first session is a baseline, later improvements are PRs", () => {
    const events = detectPersonalRecords([
      session("w1", "2026-01-01", [[100, 8], [100, 8], [95, 10]]),
      session("w2", "2026-01-04", [[100, 9], [100, 9], [100, 8]]),
      session("w3", "2026-01-08", [[102.5, 8], [102.5, 7]]),
    ]);
    expect(events.filter((e) => e.workoutId === "w1")).toHaveLength(0);
    const w2 = events.filter((e) => e.workoutId === "w2").map((e) => e.type);
    expect(w2).toContain("e1rm");
    expect(w2).toContain("rep_at_weight");
    expect(w2).toContain("session_volume");
    expect(w2).not.toContain("weight");
    const w3 = events.filter((e) => e.workoutId === "w3");
    expect(w3.map((e) => e.type)).toContain("weight");
    expect(w3.find((e) => e.type === "weight")).toMatchObject({ value: 102.5, previousValue: 100 });
  });

  it("is chronological regardless of input order", () => {
    const a = detectPersonalRecords([session("w2", "2026-01-04", [[110, 5]]), session("w1", "2026-01-01", [[100, 5]])]);
    expect(a.find((e) => e.type === "weight")?.workoutId).toBe("w2");
  });

  it("live detection while logging", () => {
    const records = buildExerciseRecords([
      { weightKg: 100, reps: 8 },
      { weightKg: 90, reps: 12 },
    ]);
    expect(livePrsForSet(records, 100, 9, "weight_reps")).toEqual(expect.arrayContaining(["e1rm", "rep_at_weight"]));
    expect(livePrsForSet(records, 105, 3, "weight_reps")).toContain("weight");
    expect(livePrsForSet(records, 90, 10, "weight_reps")).toEqual([]);
    expect(livePrsForSet(null, 200, 1, "weight_reps")).toEqual([]);
  });
});

describe("progressive overload", () => {
  const config = { repMin: 8, repMax: 10, incrementKg: 2.5, roundingKg: 1.25 };

  it("adds reps inside the range (spec example)", () => {
    const s = suggestProgression({
      last: { date: "2026-01-01", sets: [{ weightKg: 100, reps: 8 }, { weightKg: 100, reps: 8 }, { weightKg: 100, reps: 7 }] },
      config,
      targetSets: 3,
      tracking: "weight_reps",
    });
    expect(s.kind).toBe("increase_reps");
    expect(s.sets).toEqual([
      { weightKg: 100, reps: 9 },
      { weightKg: 100, reps: 9 },
      { weightKg: 100, reps: 8 },
    ]);
  });

  it("adds load once every set hits the top of the range", () => {
    const s = suggestProgression({
      last: { date: "2026-01-01", sets: [{ weightKg: 100, reps: 10 }, { weightKg: 100, reps: 10 }, { weightKg: 100, reps: 10 }] },
      config,
      targetSets: 3,
      tracking: "weight_reps",
    });
    expect(s.kind).toBe("increase_load");
    expect(s.sets.every((x) => x.weightKg === 102.5 && x.reps === 8)).toBe(true);
  });

  it("holds the load when the top was reached with less RIR than targeted", () => {
    const s = suggestProgression({
      last: { date: "2026-01-01", sets: [{ weightKg: 100, reps: 10, rir: 0 }, { weightKg: 100, reps: 10, rir: 0 }] },
      config: { ...config, targetRir: 2 },
      targetSets: 2,
      tracking: "weight_reps",
    });
    expect(s.kind).toBe("repeat");
  });

  it("suggests a reset after two sessions under the range", () => {
    const s = suggestProgression({
      last: { date: "2026-01-08", sets: [{ weightKg: 100, reps: 6 }, { weightKg: 100, reps: 5 }] },
      previous: { date: "2026-01-04", sets: [{ weightKg: 100, reps: 6 }, { weightKg: 100, reps: 6 }] },
      config,
      targetSets: 2,
      tracking: "weight_reps",
    });
    expect(s.kind).toBe("reset");
    expect(s.sets[0].weightKg).toBe(90);
  });

  it("first time: targets only", () => {
    const s = suggestProgression({ last: null, config, targetSets: 3, tracking: "weight_reps" });
    expect(s.kind).toBe("first_time");
    expect(s.sets).toHaveLength(3);
  });

  it("bodyweight: reps then load", () => {
    const reps = suggestProgression({ last: { date: "d", sets: [{ weightKg: null, reps: 9 }] }, config, targetSets: 2, tracking: "bodyweight_reps" });
    expect(reps.kind).toBe("increase_reps");
    expect(reps.sets).toEqual([
      { weightKg: null, reps: 10 },
      { weightKg: null, reps: 10 },
    ]);
    const load = suggestProgression({ last: { date: "d", sets: [{ weightKg: null, reps: 10 }] }, config, targetSets: 1, tracking: "bodyweight_reps" });
    expect(load.kind).toBe("increase_load");
  });
});
