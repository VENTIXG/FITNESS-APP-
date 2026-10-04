import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, Dumbbell, Trophy } from "lucide-react";
import { CustomExerciseActions, ExerciseSettingsForm } from "@/components/training/exercise-library";
import { ExerciseCharts, type SessionPoint } from "@/components/training/exercise-charts";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, EmptyState, Stat } from "@/components/ui/data-display";
import { defaultIncrementKg } from "@/lib/calc/progression";
import { bestSet, e1rm, repMaxTable, setVolume } from "@/lib/calc/training";
import { getUserContext } from "@/server/context";
import { getExerciseHistory } from "@/server/queries/training";

const UUID = /^[0-9a-f-]{36}$/i;

export async function generateMetadata({ params }: PageProps<"/training/exercises/[id]">): Promise<Metadata> {
  const { id } = await params;
  const ctx = await getUserContext();
  const h = UUID.test(id) ? await getExerciseHistory(ctx.userId, id) : null;
  return { title: h ? (ctx.locale === "el" && h.exercise.nameEl) || h.exercise.name : ctx.t.training.exercises };
}

export default async function ExerciseDetailPage({ params }: PageProps<"/training/exercises/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const ctx = await getUserContext();
  const { t, fmt, locale } = ctx;
  const te = t.training.exercise;
  const h = await getExerciseHistory(ctx.userId, id);
  if (!h) notFound();
  const ex = h.exercise;
  const name = (locale === "el" && ex.nameEl) || ex.name;
  const tracking = ex.trackingType;

  const points: SessionPoint[] = h.sessions.map((s) => {
    const working = s.sets.filter((x) => x.setType !== "warmup");
    const best = bestSet(working.map((x) => ({ ...x, completed: true })));
    return {
      date: s.date,
      e1rm: best?.weightKg && best.reps ? e1rm(best.weightKg, best.reps) : null,
      weight: working.reduce<number | null>((m, x) => (x.weightKg ? Math.max(m ?? 0, x.weightKg) : m), null),
      volume: working.reduce((a, x) => a + setVolume(x), 0),
      reps: working.reduce<number | null>((m, x) => (x.reps ? Math.max(m ?? 0, x.reps) : m), null),
      duration: working.reduce<number | null>((m, x) => (x.durationSeconds ? Math.max(m ?? 0, x.durationSeconds) : m), null),
      distance: working.reduce<number | null>((m, x) => (x.distanceM ? Math.max(m ?? 0, x.distanceM) : m), null),
    };
  });
  const max = (k: keyof SessionPoint) => points.reduce<number | null>((m, p) => (typeof p[k] === "number" && p[k] != null ? Math.max(m ?? 0, p[k] as number) : m), null);
  const allWorking = h.sessions.flatMap((s) => s.sets.filter((x) => x.setType !== "warmup"));
  const repMaxes = tracking === "weight_reps" ? repMaxTable(allWorking, 12) : [];
  const last = h.sessions[h.sessions.length - 1];
  const prefs = ctx.prefs.training;
  const defaults = {
    repMin: prefs.defaultRepMin,
    repMax: prefs.defaultRepMax,
    incrementKg: defaultIncrementKg(ex, prefs),
    restSeconds: prefs.defaultRestSeconds,
  };
  const prLabel = (p: (typeof h.prs)[number]) =>
    p.type === "e1rm" ? fmt.weight(p.value, { decimals: 1 }) : p.type === "reps" ? fmt.int(p.value) : p.type === "rep_at_weight" ? `${fmt.load(p.weightKg ?? 0)} × ${p.reps}` : fmt.load(p.value);

  return (
    <div className="space-y-4">
      <Link href="/training/exercises" className="-ml-1.5 inline-flex items-center gap-0.5 text-sm font-medium text-fg-3 hover:text-fg">
        <ChevronLeft className="size-5" aria-hidden />
        {t.training.exercises}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold tracking-tight">{name}</h2>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Badge tone="outline">{t.enums.muscle[ex.muscleGroup]}</Badge>
            {ex.secondaryMuscles.map((m) => (
              <Badge key={m} tone="outline" className="opacity-70">
                {t.enums.muscle[m]}
              </Badge>
            ))}
            <Badge tone="outline">{t.enums.equipment[ex.equipment]}</Badge>
            <Badge tone="outline">{t.enums.category[ex.category]}</Badge>
            {ex.userId && <Badge tone="accent">{te.custom}</Badge>}
          </div>
        </div>
        {ex.userId === ctx.userId && (
          <CustomExerciseActions
            exercise={{ id: ex.id, name: ex.name, muscleGroup: ex.muscleGroup, secondaryMuscles: ex.secondaryMuscles, equipment: ex.equipment, category: ex.category, trackingType: ex.trackingType, instructions: ex.instructions }}
          />
        )}
      </div>
      {ex.instructions && <p className="max-w-2xl whitespace-pre-wrap text-sm text-fg-2">{ex.instructions}</p>}

      {!h.sessions.length ? (
        <Card>
          <EmptyState icon={<Dumbbell />} title={te.noHistory} body={te.noHistoryBody} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card>
              <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
                {tracking === "weight_reps" && <Stat label={te.bestE1rm} value={max("e1rm") != null ? fmt.weight(max("e1rm")!, { decimals: 1, unit: false }) : "—"} unit={fmt.weightUnit} />}
                {tracking === "weight_reps" && <Stat label={te.maxWeight} value={max("weight") != null ? fmt.load(max("weight")!, false) : "—"} unit={fmt.weightUnit} />}
                {(tracking === "weight_reps" || tracking === "bodyweight_reps") && <Stat label={te.bestVolume} value={fmt.load(max("volume") ?? 0, false)} unit={fmt.weightUnit} />}
                {tracking === "bodyweight_reps" && <Stat label={t.enums.prType.reps} value={fmt.int(max("reps") ?? 0)} />}
                {tracking === "duration" && <Stat label={t.training.duration} value={fmt.clock(max("duration") ?? 0)} />}
                {tracking === "distance" && <Stat label={t.cardio.distance} value={fmt.distance(max("distance") ?? 0)} />}
                <Stat label={te.sessions} value={fmt.int(h.sessions.length)} sub={last ? <span className="text-fg-3">{te.lastPerformed}: {fmt.date(last.date, "dayMonth")}</span> : undefined} />
              </div>
            </Card>
            <ExerciseCharts points={points} tracking={tracking} />
            <Card className="p-0">
              <div className="px-4 pt-4 sm:px-5">
                <CardHeader title={te.allSessions} />
              </div>
              <ul className="divide-y divide-border">
                {[...h.sessions].reverse().slice(0, 30).map((s) => (
                  <li key={s.workoutId}>
                    <Link href={`/training/workout/${s.workoutId}`} className="flex items-start gap-3 px-4 py-3 transition hover:bg-surface-2 sm:px-5">
                      <div className="w-24 shrink-0">
                        <div className="text-sm font-medium">{fmt.date(s.date, "dayMonth")}</div>
                        <div className="truncate text-xs text-fg-3">{s.name}</div>
                      </div>
                      <div className="min-w-0 flex-1 text-[13px] text-fg-2 tabular">
                        {s.sets
                          .map((x) =>
                            tracking === "duration"
                              ? fmt.clock(x.durationSeconds ?? 0)
                              : tracking === "distance"
                                ? fmt.distance(x.distanceM ?? 0)
                                : `${x.setType === "warmup" ? "W " : ""}${x.weightKg ? fmt.load(x.weightKg, false) : "BW"}×${x.reps ?? 0}`,
                          )
                          .join(" · ")}
                      </div>
                      <ChevronRight className="mt-0.5 size-4 shrink-0 text-fg-3" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
          <div className="space-y-4">
            {repMaxes.some((v) => v != null) && (
              <Card>
                <CardHeader title={te.repMaxes} subtitle={te.repMaxesHint} />
                <table className="w-full text-sm">
                  <tbody>
                    {repMaxes.map((w, i) =>
                      w != null ? (
                        <tr key={i} className="border-t border-border first:border-0">
                          <td className="py-1.5 text-fg-3">{i + 1} RM</td>
                          <td className="py-1.5 text-right font-semibold tabular">{fmt.load(w)}</td>
                        </tr>
                      ) : null,
                    )}
                  </tbody>
                </table>
              </Card>
            )}
            {h.prs.length > 0 && (
              <Card>
                <CardHeader title={t.training.records} icon={<Trophy />} />
                <ul className="divide-y divide-border">
                  {h.prs.filter((p) => p.type !== "set_volume").slice(0, 12).map((p, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate">{t.enums.prType[p.type]}</span>
                        <span className="text-xs text-fg-3">{fmt.date(p.date, "medium")}</span>
                      </span>
                      <span className="font-semibold tabular">{prLabel(p)}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            <Card>
              <CardHeader title={te.settings} />
              <ExerciseSettingsForm exerciseId={ex.id} initial={h.settings} defaults={defaults} />
            </Card>
          </div>
        </div>
      )}
      {!h.sessions.length && (
        <Card>
          <CardHeader title={te.settings} />
          <ExerciseSettingsForm
            exerciseId={ex.id}
            initial={h.settings}
            defaults={defaults}
          />
        </Card>
      )}
    </div>
  );
}
