import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ProgramEditor } from "@/components/training/program-editor";
import { getT, getUserContext } from "@/server/context";
import { getExerciseLibrary, getProgramDetail, getRecentExerciseIds } from "@/server/queries/training";

const UUID = /^[0-9a-f-]{36}$/i;

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).training.program.edit };
}

export default async function ProgramPage({ params }: PageProps<"/training/programs/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const ctx = await getUserContext();
  const [detail, library, recentIds] = await Promise.all([getProgramDetail(ctx.userId, id), getExerciseLibrary(ctx.userId), getRecentExerciseIds(ctx.userId)]);
  if (!detail) notFound();
  const p = detail.program;
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link href="/training/programs" className="-ml-1.5 inline-flex items-center gap-0.5 text-sm font-medium text-fg-3 hover:text-fg">
        <ChevronLeft className="size-5" aria-hidden />
        {ctx.t.training.program.title}
      </Link>
      <ProgramEditor
        key={p.updatedAt.getTime()}
        initial={{
          id: p.id,
          name: p.name,
          description: p.description,
          scheduleType: p.scheduleType,
          daysPerWeek: p.daysPerWeek,
          isActive: p.isActive,
          days: detail.days.map((d) => ({
            id: d.id,
            name: d.name,
            weekdays: d.weekdays,
            notes: d.notes,
            exercises: d.exercises.map((e) => ({ id: e.id, exerciseId: e.exerciseId, targetSets: e.targetSets, repMin: e.repMin, repMax: e.repMax, targetRir: e.targetRir, restSeconds: e.restSeconds, notes: e.notes })),
          })),
        }}
        library={library.map((e) => ({ id: e.id, name: e.name, nameEl: e.nameEl, muscleGroup: e.muscleGroup, secondaryMuscles: e.secondaryMuscles, equipment: e.equipment, category: e.category, trackingType: e.trackingType, userId: e.userId }))}
        recentIds={recentIds}
      />
    </div>
  );
}
