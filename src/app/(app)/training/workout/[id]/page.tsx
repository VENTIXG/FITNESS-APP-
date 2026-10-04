import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WorkoutLoggerGate } from "@/components/training/workout-logger";
import { WorkoutSummary } from "@/components/training/workout-summary";
import { getUserContext } from "@/server/context";
import { getExerciseContexts, getExerciseLibrary, getRecentExerciseIds, getWorkoutDetail } from "@/server/queries/training";

const UUID = /^[0-9a-f-]{36}$/i;

export async function generateMetadata({ params }: PageProps<"/training/workout/[id]">): Promise<Metadata> {
  const { id } = await params;
  const ctx = await getUserContext();
  const d = UUID.test(id) ? await getWorkoutDetail(ctx.userId, id) : null;
  return { title: d?.workout.name ?? ctx.t.training.title };
}

export default async function WorkoutPage({ params, searchParams }: PageProps<"/training/workout/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const sp = await searchParams;
  const ctx = await getUserContext();
  const detail = await getWorkoutDetail(ctx.userId, id);
  if (!detail) notFound();
  const w = detail.workout;

  if (w.status === "in_progress" || sp.edit === "1") {
    const exerciseIds = detail.exercises.map((e) => e.exerciseId);
    const [contexts, library, recentIds] = await Promise.all([getExerciseContexts(ctx.userId, exerciseIds, w.id), getExerciseLibrary(ctx.userId), getRecentExerciseIds(ctx.userId)]);
    return (
      <WorkoutLoggerGate
        workout={{
          id: w.id,
          name: w.name,
          notes: w.notes,
          status: w.status === "completed" ? "completed" : "in_progress",
          startedAt: w.startedAt.toISOString(),
          updatedAtMs: w.updatedAt.getTime(),
          sessionRpe: w.sessionRpe,
          exercises: detail.exercises.map((e) => ({
            id: e.id,
            exerciseId: e.exerciseId,
            notes: e.notes,
            repMin: e.repMin,
            repMax: e.repMax,
            restSeconds: e.restSeconds,
            sets: e.sets.map((s) => ({
              id: s.id,
              setType: s.setType,
              weightKg: s.weightKg,
              reps: s.reps,
              rir: s.rir,
              durationSeconds: s.durationSeconds,
              distanceM: s.distanceM,
              completed: s.completed,
              completedAt: s.completedAt,
            })),
          })),
        }}
        contexts={contexts}
        library={library.map((e) => ({ id: e.id, name: e.name, nameEl: e.nameEl, muscleGroup: e.muscleGroup, secondaryMuscles: e.secondaryMuscles, equipment: e.equipment, category: e.category, trackingType: e.trackingType, userId: e.userId }))}
        recentIds={recentIds}
      />
    );
  }
  return <WorkoutSummary detail={detail} celebrate={sp.done === "1"} />;
}
