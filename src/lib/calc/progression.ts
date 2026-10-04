/**
 * Progressive-overload suggestions (double progression).
 *
 * - Work inside a rep range (e.g. 8–10) at a fixed load.
 * - When every working set reaches the top of the range, add load and restart at the
 *   bottom of the range.
 * - Otherwise add a rep to sets that haven't reached the top.
 * - Two consecutive sessions under the bottom of the range → suggest a ~10 % reset.
 *
 * Suggestions are never applied automatically; the logger shows them and the user
 * chooses to apply them.
 */
import type { Equipment, ExerciseCategory, MuscleGroup, TrackingType } from "../domain";
import type { TrainingPrefs } from "../preferences";
import { roundToIncrement } from "../units";

export type ProgressionConfig = {
  repMin: number;
  repMax: number;
  incrementKg: number;
  roundingKg: number;
  /** If set, sets logged with RIR below this are treated as "too hard" for a load jump. */
  targetRir?: number | null;
};

export type SessionSets = {
  date: string;
  sets: { weightKg: number | null; reps: number | null; rir?: number | null }[];
};

export type SuggestionKind = "increase_load" | "increase_reps" | "repeat" | "reset" | "first_time";

export type ProgressionSuggestion = {
  kind: SuggestionKind;
  sets: { weightKg: number | null; reps: number }[];
  /** Load used last time (for display). */
  lastWeightKg: number | null;
  repMin: number;
  repMax: number;
};

const LOWER_BODY: MuscleGroup[] = ["quads", "hamstrings", "glutes"];

/** Default load increment for an exercise from the user's training preferences. */
export function defaultIncrementKg(
  ex: { category: ExerciseCategory; muscleGroup: MuscleGroup; equipment: Equipment },
  prefs: Pick<TrainingPrefs, "incrementLowerKg" | "incrementUpperKg" | "incrementIsolationKg">,
): number {
  if (ex.category === "isolation") return prefs.incrementIsolationKg;
  if (ex.equipment === "dumbbell") return Math.min(prefs.incrementUpperKg, 2);
  return LOWER_BODY.includes(ex.muscleGroup) ? prefs.incrementLowerKg : prefs.incrementUpperKg;
}

function workingSets(session: SessionSets | null) {
  return (session?.sets ?? []).filter((s) => (s.reps ?? 0) > 0);
}

export function suggestProgression(input: {
  last: SessionSets | null;
  previous?: SessionSets | null;
  config: ProgressionConfig;
  targetSets: number;
  tracking: TrackingType;
}): ProgressionSuggestion {
  const { config, targetSets } = input;
  const repMin = Math.max(1, Math.min(config.repMin, config.repMax));
  const repMax = Math.max(repMin, config.repMax);
  const base = { repMin, repMax };
  const last = workingSets(input.last);

  if (!last.length) {
    return { ...base, kind: "first_time", lastWeightKg: null, sets: Array.from({ length: targetSets }, () => ({ weightKg: null, reps: repMin })) };
  }

  const fill = <T>(arr: T[], n: number) => {
    const out = [...arr];
    while (out.length < n) out.push(out[out.length - 1]);
    return out.slice(0, Math.max(n, 1));
  };
  const count = Math.max(targetSets, 1);

  // Bodyweight: progress reps to the top of the range, then suggest adding load.
  if (input.tracking === "bodyweight_reps" && last.every((s) => !s.weightKg)) {
    const allTop = last.every((s) => (s.reps ?? 0) >= repMax);
    const sets = fill(
      last.map((s) => ({ weightKg: allTop ? config.incrementKg : null, reps: allTop ? repMin : Math.min(repMax, (s.reps ?? 0) + 1) })),
      count,
    );
    return { ...base, kind: allTop ? "increase_load" : "increase_reps", lastWeightKg: null, sets };
  }

  const topWeight = Math.max(...last.map((s) => s.weightKg ?? 0));
  const atTop = last.filter((s) => (s.weightKg ?? 0) >= topWeight - 1e-6);
  const allReachedMax = atTop.length >= Math.min(targetSets, last.length) && atTop.every((s) => (s.reps ?? 0) >= repMax);
  const rirOk =
    config.targetRir == null ||
    atTop.every((s) => s.rir == null || s.rir >= config.targetRir! - 0.5);

  if (allReachedMax && rirOk) {
    let next = roundToIncrement(topWeight + config.incrementKg, config.roundingKg);
    if (next <= topWeight) next = topWeight + config.roundingKg;
    return { ...base, kind: "increase_load", lastWeightKg: topWeight, sets: Array.from({ length: count }, () => ({ weightKg: next, reps: repMin })) };
  }

  const belowMin = (s: SessionSets["sets"][number]) => (s.reps ?? 0) < repMin;
  const prev = workingSets(input.previous ?? null);
  const lastStruggled = atTop.filter(belowMin).length > atTop.length / 2;
  const prevTop = prev.length ? Math.max(...prev.map((s) => s.weightKg ?? 0)) : null;
  const prevStruggled = prev.length > 0 && prevTop != null && prevTop >= topWeight - 1e-6 && prev.filter(belowMin).length > prev.length / 2;

  if (lastStruggled && prevStruggled && topWeight > 0) {
    const reset = roundToIncrement(topWeight * 0.9, config.roundingKg);
    return { ...base, kind: "reset", lastWeightKg: topWeight, sets: Array.from({ length: count }, () => ({ weightKg: reset, reps: repMin })) };
  }

  if (allReachedMax && !rirOk) {
    return { ...base, kind: "repeat", lastWeightKg: topWeight, sets: Array.from({ length: count }, () => ({ weightKg: topWeight, reps: repMax })) };
  }

  const sets = fill(
    atTop.map((s) => ({ weightKg: topWeight, reps: Math.min(repMax, Math.max(repMin, (s.reps ?? 0) + 1)) })),
    count,
  );
  return { ...base, kind: "increase_reps", lastWeightKg: topWeight, sets };
}
