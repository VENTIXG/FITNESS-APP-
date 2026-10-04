import Link from "next/link";
import { ChevronLeft, Clock, Dumbbell, Flame, Layers, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { e1rm, setVolume, totalVolume } from "@/lib/calc/training";
import { format } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { getUserContext } from "@/server/context";
import type { WorkoutDetail } from "@/server/queries/training";
import { WorkoutActions } from "./workout-actions";

export async function WorkoutSummary({ detail, celebrate }: { detail: WorkoutDetail; celebrate: boolean }) {
  const ctx = await getUserContext();
  const { t, fmt, locale } = ctx;
  const tw = t.training.workout;
  const w = detail.workout;
  const includeWarmups = ctx.prefs.training.includeWarmupsInVolume;
  const allSets = detail.exercises.flatMap((e) => e.sets);
  const volume = totalVolume(allSets, includeWarmups);
  const sets = allSets.filter((s) => s.completed && (includeWarmups || s.setType !== "warmup")).length;
  const nameOf = (e: { name: string; nameEl: string | null }) => (locale === "el" && e.nameEl) || e.name;
  const prSetIds = new Set(detail.prs.map((p) => p.setId).filter(Boolean));
  const meaningfulPrs = detail.prs.filter((p) => p.type === "e1rm" || p.type === "weight" || p.type === "reps" || p.type === "session_volume");
  const exById = new Map(detail.exercises.map((e) => [e.exerciseId, e.exercise]));

  const prValue = (p: (typeof detail.prs)[number]) => {
    if (p.type === "e1rm") return fmt.weight(p.value, { decimals: 1 });
    if (p.type === "weight") return fmt.load(p.value);
    if (p.type === "session_volume" || p.type === "set_volume") return fmt.load(p.value);
    if (p.type === "rep_at_weight") return `${fmt.load(p.weightKg ?? 0)} × ${p.reps}`;
    return fmt.int(p.value);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/training/history" className="-ml-1.5 inline-flex items-center gap-0.5 text-sm font-medium text-fg-3 hover:text-fg">
        <ChevronLeft className="size-5" aria-hidden />
        {t.training.historyPage.title}
      </Link>

      {celebrate && (
        <div className="relative overflow-hidden rounded-3xl border border-border bg-surface p-6 text-center shadow-card animate-pop-in">
          <div className="pointer-events-none absolute inset-0 opacity-60 [background:radial-gradient(60%_80%_at_50%_0%,color-mix(in_oklab,var(--accent)_28%,transparent),transparent)]" aria-hidden />
          <div className="relative">
            <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-fg">
              {meaningfulPrs.length ? <Trophy className="size-7" aria-hidden /> : <Dumbbell className="size-7" aria-hidden />}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">{tw.completedTitle}</h1>
            {meaningfulPrs.length > 0 && <p className="mt-1 text-sm text-fg-2">{tw.newPrs}: {fmt.int(meaningfulPrs.length)}</p>}
          </div>
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {!celebrate && <h1 className="truncate text-2xl font-semibold tracking-tight">{w.name}</h1>}
          {celebrate && <h2 className="truncate text-xl font-semibold tracking-tight">{w.name}</h2>}
          <p className="mt-0.5 text-sm text-fg-3">
            {fmt.date(w.date, "weekday")} · {fmt.time(w.startedAt, ctx.timezone)}
          </p>
        </div>
        <WorkoutActions workout={{ id: w.id, name: w.name, date: w.date, durationSeconds: w.durationSeconds, notes: w.notes, sessionRpe: w.sessionRpe }} />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { icon: <Clock />, label: t.training.duration, value: w.durationSeconds ? fmt.duration(w.durationSeconds) : "—" },
          { icon: <Layers />, label: t.training.volume, value: fmt.load(volume) },
          { icon: <Dumbbell />, label: t.training.sets, value: fmt.int(sets) },
          { icon: <Flame />, label: t.training.rpe, value: w.sessionRpe != null ? fmt.number(w.sessionRpe, 1) : "—" },
        ].map((s) => (
          <Card key={s.label} className="p-3.5 sm:p-4">
            <div className="flex items-center gap-1.5 text-xs text-fg-3 [&_svg]:size-3.5">
              {s.icon}
              {s.label}
            </div>
            <div className="mt-1 text-lg font-semibold tabular">{s.value}</div>
          </Card>
        ))}
      </div>

      {meaningfulPrs.length > 0 && (
        <Card>
          <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
            <Trophy className="size-4 text-[var(--series-4)]" aria-hidden />
            {tw.newPrs}
          </h2>
          <ul className="divide-y divide-border">
            {meaningfulPrs.map((p, i) => {
              const ex = exById.get(p.exerciseId);
              return (
                <li key={i} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{ex ? nameOf(ex) : "—"}</span>
                    <span className="text-xs text-fg-3">{t.enums.prType[p.type]}</span>
                  </span>
                  <span className="text-right tabular">
                    <span className="font-semibold">{prValue(p)}</span>
                    {p.previousValue != null && (
                      <span className="block text-xs text-fg-3">{format(t.training.recordsPage.previous, { value: p.type === "reps" ? fmt.int(p.previousValue) : fmt.load(p.previousValue) }, locale)}</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {detail.exercises.map((e) => {
        const tracking = e.exercise.trackingType;
        let n = 0;
        return (
          <Card key={e.id} className="p-0">
            <div className="flex items-baseline justify-between gap-3 px-4 pt-3.5 pb-2 sm:px-5">
              <Link href={`/training/exercises/${e.exerciseId}`} className="truncate font-semibold text-accent hover:underline">
                {nameOf(e.exercise)}
              </Link>
              <span className="shrink-0 text-xs text-fg-3 tabular">{fmt.load(totalVolume(e.sets, includeWarmups))}</span>
            </div>
            {e.notes && <p className="px-4 pb-2 text-[13px] text-fg-2 sm:px-5">{e.notes}</p>}
            <table className="w-full text-sm">
              <thead className="sr-only">
                <tr>
                  <th>{tw.set}</th>
                  <th>{t.training.weight}</th>
                  <th>e1RM</th>
                </tr>
              </thead>
              <tbody>
                {e.sets.map((s) => {
                  if (s.setType !== "warmup") n++;
                  const est = s.weightKg && s.reps ? e1rm(s.weightKg, s.reps) : null;
                  const main =
                    tracking === "duration"
                      ? fmt.clock(s.durationSeconds ?? 0)
                      : tracking === "distance"
                        ? `${fmt.distance(s.distanceM ?? 0)} · ${fmt.clock(s.durationSeconds ?? 0)}`
                        : `${s.weightKg ? fmt.load(s.weightKg) : tracking === "bodyweight_reps" ? "BW" : fmt.load(0)} × ${s.reps ?? 0}`;
                  return (
                    <tr key={s.id} className="border-t border-border">
                      <td className={cn("w-12 py-2.5 pl-4 text-center text-[13px] font-semibold tabular sm:pl-5", s.setType === "warmup" ? "text-[var(--series-4)]" : "text-fg-3")}>
                        {t.enums.setTypeShort[s.setType] || n}
                      </td>
                      <td className="py-2.5 tabular">
                        <span className="font-medium">{main}</span>
                        {s.rir != null && <span className="ml-2 text-xs text-fg-3">{ctx.prefs.training.effortMetric === "rpe" ? `RPE ${fmt.number(10 - s.rir, 1)}` : `RIR ${fmt.number(s.rir, 1)}`}</span>}
                        {prSetIds.has(s.id) && <Trophy className="ml-2 inline size-3.5 text-[var(--series-4)]" aria-label={t.training.prs} />}
                      </td>
                      <td className="py-2.5 pr-4 text-right text-xs text-fg-3 tabular sm:pr-5">{est && s.setType !== "warmup" ? `e1RM ${fmt.weight(est, { decimals: 1 })}` : s.weightKg && s.reps ? fmt.load(setVolume(s)) : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        );
      })}

      {w.notes && (
        <Card>
          <h2 className="mb-1 text-sm font-semibold">{tw.notes}</h2>
          <p className="whitespace-pre-wrap text-sm text-fg-2">{w.notes}</p>
        </Card>
      )}
    </div>
  );
}
