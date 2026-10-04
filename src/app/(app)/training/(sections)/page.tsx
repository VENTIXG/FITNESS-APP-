import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, ChevronRight, Dumbbell, Moon, Play } from "lucide-react";
import { StartWorkoutButton } from "@/components/dashboard/islands";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, EmptyState, Meter, Stat } from "@/components/ui/data-display";
import { volumeByMuscle } from "@/lib/calc/training";
import { addDays, startOfWeek } from "@/lib/dates";
import { format } from "@/lib/i18n";
import { getT, getUserContext } from "@/server/context";
import { getActiveWorkout, getExerciseSetCounts, getPlannedDay, getTrainingPlan, getWorkoutAggregates } from "@/server/queries/training";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).training.title };
}

export default async function TrainingPage() {
  const ctx = await getUserContext();
  const { t, fmt, locale } = ctx;
  const tt = t.training;
  const weekStart = startOfWeek(ctx.today, ctx.weekStartsOn);
  const includeWarmups = ctx.prefs.training.includeWarmupsInVolume;
  const [active, planned, plan, week, recent, muscleRows] = await Promise.all([
    getActiveWorkout(ctx.userId),
    getPlannedDay(ctx.userId, ctx.today),
    getTrainingPlan(ctx.userId, ctx.prefs.training),
    getWorkoutAggregates(ctx.userId, weekStart, ctx.today, includeWarmups),
    getWorkoutAggregates(ctx.userId, addDays(ctx.today, -90), ctx.today, includeWarmups),
    getExerciseSetCounts(ctx.userId, weekStart, ctx.today, includeWarmups),
  ]);
  const muscles = volumeByMuscle(muscleRows);
  const maxSets = Math.max(10, ...muscles.map((m) => m.sets));
  const weekSets = week.reduce((a, w) => a + w.sets, 0);
  const weekVolume = week.reduce((a, w) => a + w.volume, 0);
  const program = planned.program;
  const exName = (e: { name: string; nameEl: string | null }) => (locale === "el" && e.nameEl) || e.name;

  const dayCard = (day: NonNullable<typeof planned.day>, label: string) => (
    <div>
      <div className="mb-1 text-xs font-medium tracking-wide text-fg-3 uppercase">{label}</div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-xl font-semibold tracking-tight">{day.name}</h3>
          <p className="text-[13px] text-fg-3">{format(tt.workout.fromProgram, { program: program!.name }, locale)}</p>
        </div>
        {!active && (
          <StartWorkoutButton programDayId={day.id} variant="accent">
            {tt.startWorkout}
          </StartWorkoutButton>
        )}
      </div>
      {day.exercises.length > 0 && (
        <ul className="mt-4 divide-y divide-border">
          {day.exercises.map((e) => (
            <li key={e.pe.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="truncate">{exName(e)}</span>
              <span className="shrink-0 text-fg-3 tabular">
                {e.pe.targetSets} × {e.pe.repMin ?? "?"}
                {e.pe.repMax && e.pe.repMax !== e.pe.repMin ? `–${e.pe.repMax}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {active && (
          <Card className="border-accent/50 bg-accent-soft">
            <div className="flex items-center gap-3">
              <span className="relative flex size-3">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" />
                <span className="relative inline-flex size-3 rounded-full bg-accent" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-fg-3">{tt.inProgress}</div>
                <div className="truncate font-semibold">{active.name}</div>
              </div>
              <Button asChild variant="accent">
                <Link href={`/training/workout/${active.id}`}>
                  <Play aria-hidden className="fill-current" />
                  {tt.resume}
                </Link>
              </Button>
            </div>
          </Card>
        )}

        <Card>
          {!program ? (
            <EmptyState
              icon={<Dumbbell />}
              title={tt.noProgram}
              body={tt.noProgramBody}
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  {!active && (
                    <StartWorkoutButton programDayId={null} variant="accent">
                      {tt.startEmpty}
                    </StartWorkoutButton>
                  )}
                  <Button asChild variant="secondary">
                    <Link href="/training/programs">{tt.programs}</Link>
                  </Button>
                </div>
              }
            />
          ) : planned.day ? (
            dayCard(planned.day, tt.today)
          ) : (
            <div>
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-surface-2 text-fg-3">
                  <Moon className="size-5" aria-hidden />
                </div>
                <div>
                  <h3 className="text-xl font-semibold tracking-tight">{tt.restDay}</h3>
                  <p className="text-[13px] text-fg-3">{program.name}</p>
                </div>
              </div>
              {planned.nextDay && <div className="mt-5 border-t border-border pt-4">{dayCard(planned.nextDay, tt.upNext)}</div>}
            </div>
          )}
          {program && !active && (
            <div className="mt-4 border-t border-border pt-3">
              <StartWorkoutButton programDayId={null} variant="ghost" size="sm">
                {tt.startEmpty}
              </StartWorkoutButton>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title={tt.recentWorkouts} href="/training/history" />
          {recent.length ? (
            <ul className="-mx-1 divide-y divide-border">
              {recent.slice(0, 6).map((w) => (
                <li key={w.workoutId}>
                  <Link href={`/training/workout/${w.workoutId}`} className="flex items-center gap-3 rounded-xl px-1 py-3 transition hover:bg-surface-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{w.name}</div>
                      <div className="text-xs text-fg-3">
                        {fmt.date(w.date, "weekdayShort")}
                        {w.durationSeconds ? ` · ${fmt.duration(w.durationSeconds)}` : ""}
                      </div>
                    </div>
                    <div className="text-right text-xs text-fg-3 tabular">
                      <div className="text-sm font-semibold text-fg">{fmt.load(w.volume)}</div>
                      {format(t.common.sets, { count: w.sets }, locale)}
                    </div>
                    <ChevronRight className="size-4 text-fg-3" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-fg-3">{tt.noWorkoutsBody}</p>
          )}
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader title={tt.thisWeek} icon={<CalendarClock />} />
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            <Stat
              label={tt.workouts}
              value={plan.plannedPerWeek ? format(tt.workoutsDone, { done: week.length, planned: plan.plannedPerWeek }, locale) : format(tt.workoutsDoneNoPlan, { count: week.length }, locale)}
            />
            <Stat label={tt.sets} value={fmt.int(weekSets)} />
            <Stat label={tt.volume} value={fmt.load(weekVolume, false)} unit={fmt.weightUnit} />
            <Stat label={tt.duration} value={fmt.duration(week.reduce((a, w) => a + (w.durationSeconds ?? 0), 0))} />
          </div>
          {plan.plannedPerWeek > 0 && <Meter className="mt-4" value={week.length} max={plan.plannedPerWeek} label={tt.thisWeek} />}
        </Card>

        <Card>
          <CardHeader title={tt.setsPerMuscle} subtitle={tt.setsPerMuscleHint} />
          {muscles.length ? (
            <ul className="space-y-2.5">
              {muscles.map((m) => (
                <li key={m.muscle}>
                  <div className="mb-1 flex justify-between text-[13px]">
                    <span className="text-fg-2">{t.enums.muscle[m.muscle]}</span>
                    <span className="font-semibold tabular">{fmt.number(m.sets, m.sets % 1 ? 1 : 0)}</span>
                  </div>
                  <Meter value={m.sets} max={maxSets} height={6} color="var(--series-1)" showOverflow={false} label={t.enums.muscle[m.muscle]} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-4 text-center text-sm text-fg-3">{t.common.noData}</p>
          )}
        </Card>

        {program && (
          <Card>
            <CardHeader title={tt.programDays} href={`/training/programs/${program.id}`} subtitle={program.name} />
            <ul className="divide-y divide-border">
              {program.days.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{d.name}</div>
                    <div className="text-xs text-fg-3">
                      {format(tt.workout.exerciseCount, { count: d.exercises.length }, locale)}
                      {d.weekdays.length > 0 && ` · ${d.weekdays.map((w) => fmt.weekdayShort(w)).join(", ")}`}
                    </div>
                  </div>
                  {planned.day?.id === d.id && <Badge tone="accent">{tt.today}</Badge>}
                  {!active && (
                    <StartWorkoutButton programDayId={d.id} variant="secondary" size="sm">
                      {tt.program.startThisDay}
                    </StartWorkoutButton>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
