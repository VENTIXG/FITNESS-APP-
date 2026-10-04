/**
 * Strength-training maths: estimated 1RM, volume, PR detection and adherence.
 */
import type { ISODate } from "../dates";
import type { MuscleGroup, PrType, SetType, TrackingType } from "../domain";

/** e1RM is only reported for 1–12 reps; beyond that the formulas lose accuracy. */
export const E1RM_MAX_REPS = 12;

/** Epley: weight × (1 + reps / 30). */
export function e1rmEpley(weightKg: number, reps: number): number | null {
  if (!(weightKg > 0) || !(reps >= 1) || reps > E1RM_MAX_REPS) return null;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

/** Brzycki: weight × 36 / (37 − reps). Shown as an alternative on exercise pages. */
export function e1rmBrzycki(weightKg: number, reps: number): number | null {
  if (!(weightKg > 0) || !(reps >= 1) || reps > E1RM_MAX_REPS) return null;
  return (weightKg * 36) / (37 - reps);
}

export const e1rm = e1rmEpley;

export type SetLike = {
  weightKg: number | null;
  reps: number | null;
  setType: SetType;
  completed: boolean;
  rir?: number | null;
  durationSeconds?: number | null;
  distanceM?: number | null;
};

export function isWorkingSet(s: SetLike) {
  return s.completed && s.setType !== "warmup";
}

/** Volume load = weight × reps (external load only). */
export function setVolume(s: Pick<SetLike, "weightKg" | "reps">): number {
  if (!s.weightKg || !s.reps) return 0;
  return s.weightKg * s.reps;
}

export function totalVolume(sets: readonly SetLike[], includeWarmups = false): number {
  return sets.reduce((acc, s) => (s.completed && (includeWarmups || s.setType !== "warmup") ? acc + setVolume(s) : acc), 0);
}

export function completedSetCount(sets: readonly SetLike[], includeWarmups = false) {
  return sets.filter((s) => s.completed && (includeWarmups || s.setType !== "warmup")).length;
}

/** The set with the highest e1RM (falls back to heaviest weight). */
export function bestSet<T extends SetLike>(sets: readonly T[]): T | null {
  let best: T | null = null;
  let bestScore = -Infinity;
  for (const s of sets) {
    if (!isWorkingSet(s) || !s.weightKg || !s.reps) continue;
    const score = e1rm(s.weightKg, s.reps) ?? s.weightKg;
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return best;
}

/** Best weight achieved for each rep count 1..maxReps (a set of N reps also counts for fewer reps). */
export function repMaxTable(sets: readonly Pick<SetLike, "weightKg" | "reps">[], maxReps = 12): (number | null)[] {
  const table: (number | null)[] = Array.from({ length: maxReps }, () => null);
  for (const s of sets) {
    if (!s.weightKg || !s.reps) continue;
    for (let r = 1; r <= Math.min(s.reps, maxReps); r++) {
      if (table[r - 1] == null || s.weightKg > (table[r - 1] as number)) table[r - 1] = s.weightKg;
    }
  }
  return table;
}

export type MuscleVolumeInput = {
  muscleGroup: MuscleGroup;
  secondaryMuscles: readonly MuscleGroup[];
  sets: number;
  volume: number;
};

/**
 * Sets and volume per muscle group. Primary muscle gets full credit; secondary
 * muscles get half a set (common hypertrophy-volume convention). Volume load is
 * attributed to the primary muscle only.
 */
export function volumeByMuscle(entries: readonly MuscleVolumeInput[]) {
  const map = new Map<MuscleGroup, { sets: number; volume: number }>();
  const add = (m: MuscleGroup, sets: number, volume: number) => {
    const cur = map.get(m) ?? { sets: 0, volume: 0 };
    cur.sets += sets;
    cur.volume += volume;
    map.set(m, cur);
  };
  for (const e of entries) {
    add(e.muscleGroup, e.sets, e.volume);
    for (const s of e.secondaryMuscles) if (s !== e.muscleGroup) add(s, e.sets * 0.5, 0);
  }
  return [...map.entries()].map(([muscle, v]) => ({ muscle, ...v })).sort((a, b) => b.sets - a.sets);
}

// ---------------------------------------------------------------------------
// Personal records
// ---------------------------------------------------------------------------

export type HistorySet = {
  id: string;
  weightKg: number | null;
  reps: number | null;
  setType: SetType;
  completed: boolean;
};

export type HistorySession = {
  workoutId: string;
  date: ISODate;
  /** Used to order sessions on the same date. */
  startedAt: string;
  sets: HistorySet[];
};

export type PrEvent = {
  type: PrType;
  workoutId: string;
  setId: string | null;
  date: ISODate;
  value: number;
  previousValue: number | null;
  weightKg: number | null;
  reps: number | null;
};

const EPS = 1e-6;

type Bests = {
  e1rm: number | null;
  weight: number | null;
  setVolume: number | null;
  sessionVolume: number | null;
  reps: number | null;
  /** All historical (weight, reps) working sets — for rep-at-weight records. */
  history: { weightKg: number; reps: number }[];
};

function maxRepsAtOrAbove(history: Bests["history"], weightKg: number): number | null {
  let best: number | null = null;
  for (const h of history) if (h.weightKg >= weightKg - EPS && (best == null || h.reps > best)) best = h.reps;
  return best;
}

/**
 * Replays an exercise's history in chronological order and emits a PR event every
 * time a record is beaten. The first session establishes baselines (no events),
 * so a brand-new exercise doesn't "celebrate" ordinary sets.
 */
export function detectPersonalRecords(sessions: readonly HistorySession[], tracking: TrackingType = "weight_reps"): PrEvent[] {
  const ordered = [...sessions].sort((a, b) => (a.date === b.date ? a.startedAt.localeCompare(b.startedAt) : a.date < b.date ? -1 : 1));
  const bests: Bests = { e1rm: null, weight: null, setVolume: null, sessionVolume: null, reps: null, history: [] };
  const events: PrEvent[] = [];
  let first = true;

  for (const session of ordered) {
    const working = session.sets.filter((s) => s.completed && s.setType !== "warmup" && (s.reps ?? 0) > 0);
    if (!working.length) continue;

    let sE1rm: { v: number; set: HistorySet } | null = null;
    let sWeight: { v: number; set: HistorySet } | null = null;
    let sSetVol: { v: number; set: HistorySet } | null = null;
    let sReps: { v: number; set: HistorySet } | null = null;
    let sessionVolume = 0;
    let repPr: { set: HistorySet; previous: number } | null = null;

    for (const s of working) {
      const w = s.weightKg ?? 0;
      const r = s.reps ?? 0;
      if (w > 0) {
        const est = e1rm(w, r);
        if (est != null && (!sE1rm || est > sE1rm.v)) sE1rm = { v: est, set: s };
        if (!sWeight || w > sWeight.v) sWeight = { v: w, set: s };
        const vol = w * r;
        if (!sSetVol || vol > sSetVol.v) sSetVol = { v: vol, set: s };
        sessionVolume += vol;
        if (!first) {
          const prev = maxRepsAtOrAbove(bests.history, w);
          if (prev != null && r > prev && (!repPr || w > (repPr.set.weightKg ?? 0))) repPr = { set: s, previous: prev };
        }
      }
      if (!sReps || r > sReps.v) sReps = { v: r, set: s };
    }

    if (!first) {
      const push = (type: PrType, cur: { v: number; set: HistorySet } | null, prev: number | null, value?: number) => {
        const v = value ?? cur?.v;
        if (v == null || prev == null || v <= prev + EPS) return;
        events.push({
          type,
          workoutId: session.workoutId,
          setId: cur?.set.id ?? null,
          date: session.date,
          value: v,
          previousValue: prev,
          weightKg: cur?.set.weightKg ?? null,
          reps: cur?.set.reps ?? null,
        });
      };
      if (tracking === "weight_reps" || (sWeight && sWeight.v > 0)) {
        push("e1rm", sE1rm, bests.e1rm);
        push("weight", sWeight, bests.weight);
        push("set_volume", sSetVol, bests.setVolume);
        if (bests.sessionVolume != null && sessionVolume > bests.sessionVolume + EPS) {
          events.push({
            type: "session_volume",
            workoutId: session.workoutId,
            setId: null,
            date: session.date,
            value: sessionVolume,
            previousValue: bests.sessionVolume,
            weightKg: null,
            reps: null,
          });
        }
        if (repPr) {
          events.push({
            type: "rep_at_weight",
            workoutId: session.workoutId,
            setId: repPr.set.id,
            date: session.date,
            value: repPr.set.reps ?? 0,
            previousValue: repPr.previous,
            weightKg: repPr.set.weightKg,
            reps: repPr.set.reps,
          });
        }
      }
      if (tracking === "bodyweight_reps") push("reps", sReps, bests.reps);
    }

    if (sE1rm) bests.e1rm = Math.max(bests.e1rm ?? 0, sE1rm.v);
    if (sWeight) bests.weight = Math.max(bests.weight ?? 0, sWeight.v);
    if (sSetVol) bests.setVolume = Math.max(bests.setVolume ?? 0, sSetVol.v);
    if (sessionVolume > 0) bests.sessionVolume = Math.max(bests.sessionVolume ?? 0, sessionVolume);
    if (sReps) bests.reps = Math.max(bests.reps ?? 0, sReps.v);
    for (const s of working) if (s.weightKg && s.reps) bests.history.push({ weightKg: s.weightKg, reps: s.reps });
    first = false;
  }
  return events;
}

/** Compact record snapshot used by the live workout logger to flag PRs as sets complete. */
export type ExerciseRecords = {
  e1rm: number | null;
  weight: number | null;
  reps: number | null;
  /** Sorted by weight desc: max reps achieved at or above each weight. */
  repLadder: { weightKg: number; reps: number }[];
};

export function buildExerciseRecords(sets: readonly { weightKg: number | null; reps: number | null }[]): ExerciseRecords {
  let best1rm: number | null = null;
  let bestW: number | null = null;
  let bestReps: number | null = null;
  const byWeight = new Map<number, number>();
  for (const s of sets) {
    if (!s.reps) continue;
    bestReps = Math.max(bestReps ?? 0, s.reps);
    if (!s.weightKg) continue;
    const est = e1rm(s.weightKg, s.reps);
    if (est != null) best1rm = Math.max(best1rm ?? 0, est);
    bestW = Math.max(bestW ?? 0, s.weightKg);
    byWeight.set(s.weightKg, Math.max(byWeight.get(s.weightKg) ?? 0, s.reps));
  }
  const weights = [...byWeight.keys()].sort((a, b) => b - a);
  const repLadder: ExerciseRecords["repLadder"] = [];
  let running = 0;
  for (const w of weights) {
    running = Math.max(running, byWeight.get(w) ?? 0);
    repLadder.push({ weightKg: w, reps: running });
  }
  return { e1rm: best1rm, weight: bestW, reps: bestReps, repLadder };
}

export type LivePr = "e1rm" | "weight" | "rep_at_weight" | "reps";

/** Which records a just-completed set would beat (history must exist). */
export function livePrsForSet(records: ExerciseRecords | null, weightKg: number | null, reps: number | null, tracking: TrackingType): LivePr[] {
  if (!records || !reps) return [];
  const out: LivePr[] = [];
  if (weightKg && weightKg > 0) {
    const est = e1rm(weightKg, reps);
    if (est != null && records.e1rm != null && est > records.e1rm + EPS) out.push("e1rm");
    if (records.weight != null && weightKg > records.weight + EPS) out.push("weight");
    const atOrAbove = records.repLadder.filter((r) => r.weightKg >= weightKg - EPS);
    const prevReps = atOrAbove.length ? Math.max(...atOrAbove.map((r) => r.reps)) : null;
    if (prevReps != null && reps > prevReps && !out.includes("weight")) out.push("rep_at_weight");
  }
  if (tracking === "bodyweight_reps" && records.reps != null && reps > records.reps) out.push("reps");
  return out;
}

// ---------------------------------------------------------------------------
// Adherence
// ---------------------------------------------------------------------------

/** Completed / planned (capped at 1). Null when nothing was planned. */
export function workoutAdherence(completed: number, planned: number): number | null {
  if (planned <= 0) return null;
  return Math.min(1, completed / planned);
}

export function averageSessionDuration(durationsSeconds: readonly number[]) {
  const valid = durationsSeconds.filter((d) => d > 0);
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}
