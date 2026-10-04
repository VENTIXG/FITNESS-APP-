import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { detectPersonalRecords, type HistorySession } from "@/lib/calc/training";
import type { DbOrTx } from "@/server/db";
import { exercises, exerciseSets, personalRecords, workoutExercises, workouts } from "@/server/db/schema";

/**
 * Rebuilds the PR history of the given exercises from scratch by replaying every
 * completed session. Called after a workout is finished, edited or deleted.
 */
export async function recomputeRecords(tx: DbOrTx, userId: string, exerciseIds: readonly string[]) {
  const ids = [...new Set(exerciseIds)];
  if (!ids.length) return;
  const [rows, exRows] = await Promise.all([
    tx
      .select({
        exerciseId: workoutExercises.exerciseId,
        workoutId: workouts.id,
        date: workouts.date,
        startedAt: workouts.startedAt,
        setId: exerciseSets.id,
        weightKg: exerciseSets.weightKg,
        reps: exerciseSets.reps,
        setType: exerciseSets.setType,
        completed: exerciseSets.completed,
      })
      .from(exerciseSets)
      .innerJoin(workoutExercises, eq(workoutExercises.id, exerciseSets.workoutExerciseId))
      .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
      .where(and(eq(workouts.userId, userId), eq(workouts.status, "completed"), inArray(workoutExercises.exerciseId, ids)))
      .orderBy(asc(workouts.date), asc(workouts.startedAt), asc(exerciseSets.setIndex)),
    tx.select({ id: exercises.id, trackingType: exercises.trackingType }).from(exercises).where(inArray(exercises.id, ids)),
  ]);
  const tracking = new Map(exRows.map((e) => [e.id, e.trackingType]));

  await tx.delete(personalRecords).where(and(eq(personalRecords.userId, userId), inArray(personalRecords.exerciseId, ids)));

  for (const exerciseId of ids) {
    const sessions = new Map<string, HistorySession>();
    for (const r of rows) {
      if (r.exerciseId !== exerciseId) continue;
      let s = sessions.get(r.workoutId);
      if (!s) {
        s = { workoutId: r.workoutId, date: r.date, startedAt: r.startedAt.toISOString(), sets: [] };
        sessions.set(r.workoutId, s);
      }
      s.sets.push({ id: r.setId, weightKg: r.weightKg, reps: r.reps, setType: r.setType, completed: r.completed });
    }
    const events = detectPersonalRecords([...sessions.values()], tracking.get(exerciseId) ?? "weight_reps");
    if (events.length) {
      await tx.insert(personalRecords).values(
        events.map((e) => ({
          userId,
          exerciseId,
          workoutId: e.workoutId,
          setId: e.setId,
          type: e.type,
          value: e.value,
          previousValue: e.previousValue,
          weightKg: e.weightKg,
          reps: e.reps,
          date: e.date,
        })),
      );
    }
  }
}
