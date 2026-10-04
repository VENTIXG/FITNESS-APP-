import type { Metadata } from "next";
import { ExerciseLibrary } from "@/components/training/exercise-library";
import { getT, getUserContext } from "@/server/context";
import { getExerciseLibrary, getExerciseUsage } from "@/server/queries/training";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).training.exercises };
}

export default async function ExercisesPage() {
  const ctx = await getUserContext();
  const [library, usage] = await Promise.all([getExerciseLibrary(ctx.userId), getExerciseUsage(ctx.userId)]);
  return (
    <ExerciseLibrary
      library={library.map((e) => ({ id: e.id, name: e.name, nameEl: e.nameEl, muscleGroup: e.muscleGroup, secondaryMuscles: e.secondaryMuscles, equipment: e.equipment, category: e.category, trackingType: e.trackingType, userId: e.userId }))}
      usage={usage}
    />
  );
}
