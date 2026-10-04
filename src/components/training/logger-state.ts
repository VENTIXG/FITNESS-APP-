/**
 * Local-first workout logger state. Inputs are kept as raw strings (in display units)
 * so typing is never fought by formatting; numbers are derived only when syncing.
 */
import { formatForInput, parseDecimal } from "@/components/ui/controls";
import type { SetType, TrackingType, UnitSystem } from "@/lib/domain";
import { fromDisplayDistance, fromDisplayWeight, toDisplayDistance, toDisplayWeight } from "@/lib/units";

export type LSet = {
  id: string;
  setType: SetType;
  weight: string;
  reps: string;
  /** Effort as typed: RIR or RPE depending on preferences. */
  effort: string;
  duration: string;
  distance: string;
  completed: boolean;
  completedAt: string | null;
};

export type LExercise = {
  id: string;
  exerciseId: string;
  notes: string;
  repMin: number | null;
  repMax: number | null;
  restSeconds: number | null;
  sets: LSet[];
};

export type LoggerState = {
  workoutId: string;
  name: string;
  notes: string;
  exercises: LExercise[];
  /** Monotonic local revision; bumped on every edit. */
  rev: number;
  savedRev: number;
  updatedAt: number;
};

export type EffortMetric = "rir" | "rpe";

export const uid = () => crypto.randomUUID();

export function emptySet(type: SetType = "normal"): LSet {
  return { id: uid(), setType: type, weight: "", reps: "", effort: "", duration: "", distance: "", completed: false, completedAt: null };
}

/** RIR is stored; RPE is shown as 10 − RIR. */
export function effortToInput(rir: number | null, metric: EffortMetric) {
  if (rir == null) return "";
  return formatForInput(metric === "rpe" ? 10 - rir : rir, 1);
}

export function inputToRir(raw: string, metric: EffortMetric): number | null {
  const v = parseDecimal(raw);
  if (v == null) return null;
  const rir = metric === "rpe" ? 10 - v : v;
  return Math.max(0, Math.min(10, rir));
}

export function weightToInput(kg: number | null, units: UnitSystem) {
  return kg == null ? "" : formatForInput(toDisplayWeight(kg, units), 2);
}

export function inputToKg(raw: string, units: UnitSystem): number | null {
  const v = parseDecimal(raw);
  return v == null || v < 0 ? null : fromDisplayWeight(v, units);
}

export function distanceToInput(m: number | null, units: UnitSystem) {
  return m == null ? "" : formatForInput(toDisplayDistance(m, units), 2);
}

export function inputToMetres(raw: string, units: UnitSystem): number | null {
  const v = parseDecimal(raw);
  return v == null || v < 0 ? null : fromDisplayDistance(v, units);
}

/** "90", "1:30" or "1:02:03" → seconds. */
export function parseDuration(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return Number(s);
  const parts = s.split(":").map((p) => Number(p));
  if (parts.some((p) => !Number.isFinite(p) || p < 0)) return null;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

export function durationToInput(sec: number | null) {
  if (sec == null) return "";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m ? `${m}:${String(s).padStart(2, "0")}` : String(s);
}

type ServerSet = {
  id: string;
  setType: SetType;
  weightKg: number | null;
  reps: number | null;
  rir: number | null;
  durationSeconds: number | null;
  distanceM: number | null;
  completed: boolean;
  completedAt: Date | string | null;
};

export type ServerWorkout = {
  id: string;
  name: string;
  notes: string | null;
  exercises: { id: string; exerciseId: string; notes: string | null; repMin: number | null; repMax: number | null; restSeconds: number | null; sets: ServerSet[] }[];
};

export function fromServer(w: ServerWorkout, units: UnitSystem, metric: EffortMetric, updatedAt: number): LoggerState {
  return {
    workoutId: w.id,
    name: w.name,
    notes: w.notes ?? "",
    rev: 0,
    savedRev: 0,
    updatedAt,
    exercises: w.exercises.map((e) => ({
      id: e.id,
      exerciseId: e.exerciseId,
      notes: e.notes ?? "",
      repMin: e.repMin,
      repMax: e.repMax,
      restSeconds: e.restSeconds,
      sets: e.sets.map((s) => ({
        id: s.id,
        setType: s.setType,
        weight: weightToInput(s.weightKg, units),
        reps: s.reps == null ? "" : String(s.reps),
        effort: effortToInput(s.rir, metric),
        duration: durationToInput(s.durationSeconds),
        distance: distanceToInput(s.distanceM, units),
        completed: s.completed,
        completedAt: s.completedAt ? new Date(s.completedAt).toISOString() : null,
      })),
    })),
  };
}

/** Converts the local state into the server snapshot payload. */
export function toSnapshot(state: LoggerState, units: UnitSystem, metric: EffortMetric, tracking: (exerciseId: string) => TrackingType) {
  return {
    workoutId: state.workoutId,
    name: state.name.trim() || "Workout",
    notes: state.notes.trim() || null,
    exercises: state.exercises.map((e, i) => {
      const tt = tracking(e.exerciseId);
      return {
        id: e.id,
        exerciseId: e.exerciseId,
        sortOrder: i,
        notes: e.notes.trim() || null,
        repMin: e.repMin,
        repMax: e.repMax,
        restSeconds: e.restSeconds,
        sets: e.sets.map((s, j) => {
          const reps = parseDecimal(s.reps);
          return {
            id: s.id,
            setIndex: j,
            setType: s.setType,
            weightKg: tt === "duration" || tt === "distance" ? null : clampNum(inputToKg(s.weight, units), 0, 1500),
            reps: reps == null || tt === "duration" || tt === "distance" ? null : Math.max(0, Math.min(1000, Math.round(reps))),
            rir: inputToRir(s.effort, metric),
            durationSeconds: clampNum(parseDuration(s.duration), 0, 86400, true),
            distanceM: clampNum(inputToMetres(s.distance, units), 0, 100000),
            completed: s.completed,
            completedAt: s.completedAt,
          };
        }),
      };
    }),
  };
}

function clampNum(v: number | null, min: number, max: number, int = false) {
  if (v == null || !Number.isFinite(v)) return null;
  const c = Math.max(min, Math.min(max, v));
  return int ? Math.round(c) : Math.round(c * 1000) / 1000;
}

const STORAGE_PREFIX = "forge:workout:";

export function loadLocal(workoutId: string): LoggerState | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + workoutId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LoggerState;
    return parsed?.workoutId === workoutId && Array.isArray(parsed.exercises) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveLocal(state: LoggerState) {
  try {
    localStorage.setItem(STORAGE_PREFIX + state.workoutId, JSON.stringify(state));
  } catch {
    // Storage full or blocked — the server copy is still the source of truth.
  }
}

export function clearLocal(workoutId: string) {
  try {
    localStorage.removeItem(STORAGE_PREFIX + workoutId);
  } catch {
    // ignore
  }
}
