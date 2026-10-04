import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, Droplets, Dumbbell, Footprints, HeartPulse, Moon, NotebookPen, Pill, Scale, Utensils } from "lucide-react";
import { HabitCheck } from "@/components/dashboard/islands";
import { DayLogButton } from "@/components/day/day-actions";
import { WaterQuickAdd } from "@/components/forms/lifestyle-forms";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, Meter, ProgressRing } from "@/components/ui/data-display";
import { PageHeader } from "@/components/ui/page";
import { dailyScore } from "@/lib/calc/score";
import { addDays, type ISODate } from "@/lib/dates";
import { format } from "@/lib/i18n";
import { groupBy } from "@/lib/utils";
import { getUserContext } from "@/server/context";
import { getCardioSessions } from "@/server/queries/cardio";
import { getDayExtras, getDaySummaries } from "@/server/queries/days";
import { getHabitStatuses, getSupplementsForDate } from "@/server/queries/habits";
import { getDiary } from "@/server/queries/nutrition";
import { getWorkoutAggregates } from "@/server/queries/training";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export async function generateMetadata({ params }: PageProps<"/day/[date]">): Promise<Metadata> {
  const { date } = await params;
  const ctx = await getUserContext();
  return { title: ISO.test(date) ? ctx.fmt.date(date as ISODate, "long") : ctx.t.day.title };
}

export default async function DayPage({ params }: PageProps<"/day/[date]">) {
  const { date: raw } = await params;
  if (!ISO.test(raw) || Number.isNaN(Date.parse(raw))) notFound();
  const ctx = await getUserContext();
  const date = raw as ISODate;
  if (date > ctx.today) notFound();
  const { t, fmt, locale } = ctx;
  const td = t.day;
  const [[summary], diary, workouts, cardio, extras, supplements] = await Promise.all([
    getDaySummaries(ctx, date, date),
    getDiary(ctx.userId, date),
    getWorkoutAggregates(ctx.userId, date, date, ctx.prefs.training.includeWarmupsInVolume),
    getCardioSessions(ctx.userId, date, date),
    getDayExtras(ctx.userId, date),
    getSupplementsForDate(ctx, date),
  ]);
  const habits = await getHabitStatuses(ctx, [summary]);
  const score = ctx.prefs.scoring.enabled ? dailyScore(summary, ctx.prefs.scoring.weights) : null;
  const target = diary.target;
  const bySlot = groupBy(diary.entries, (e) => e.mealSlot);
  const slotName = (id: string) => ctx.prefs.nutrition.mealSlots.find((s) => s.id === id)?.name || (t.enums.meal as Record<string, string>)[id] || id;
  const next = addDays(date, 1);
  const isToday = date === ctx.today;
  const edit = t.common.edit;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow={isToday ? t.common.today : date === addDays(ctx.today, -1) ? t.common.yesterday : td.title}
        title={fmt.date(date, "long")}
        actions={
          <div className="flex items-center gap-1">
            <Button asChild variant="secondary" size="icon" aria-label={td.previousDay}>
              <Link href={`/day/${addDays(date, -1)}`}>
                <ChevronLeft />
              </Link>
            </Button>
            {next <= ctx.today ? (
              <Button asChild variant="secondary" size="icon" aria-label={td.nextDay}>
                <Link href={`/day/${next}`}>
                  <ChevronRight />
                </Link>
              </Button>
            ) : (
              <Button variant="secondary" size="icon" disabled aria-label={td.nextDay}>
                <ChevronRight />
              </Button>
            )}
          </div>
        }
      />

      <div className="columns-1 gap-4 md:columns-2 lg:columns-3 [&>*]:mb-4 [&>*]:break-inside-avoid">
        {score && (
          <Card>
            <CardHeader title={t.enums.dashboardCard.score} />
            <div className="flex items-center gap-4">
              <ProgressRing value={(score.score ?? 0) / 100} size={76} stroke={7} label={`${t.enums.dashboardCard.score}: ${score.score ?? "—"}`}>
                <span className="text-xl font-semibold">{score.score ?? "—"}</span>
              </ProgressRing>
              <ul className="min-w-0 flex-1 space-y-1.5">
                {score.breakdown
                  .filter((b) => b.weight > 0 && b.value != null)
                  .map((b) => (
                    <li key={b.component} className="flex items-center gap-2 text-xs">
                      <span className="w-16 shrink-0 truncate text-fg-3">{t.enums.scoreComponent[b.component]}</span>
                      <Meter value={b.value ?? 0} max={1} height={5} showOverflow={false} label={t.enums.scoreComponent[b.component]} />
                    </li>
                  ))}
              </ul>
            </div>
          </Card>
        )}

        <Card>
          <CardHeader title={t.weight.title} icon={<Scale />} action={<DayLogButton kind="weight" date={date} label={extras.weight ? edit : t.common.add} variant="ghost" initial={{ weight: extras.weight }} />} />
          {extras.weight ? (
            <div className="text-3xl font-semibold tracking-tight tabular">
              {fmt.weight(extras.weight.weightKg, { unit: false })}
              <span className="ml-1 text-base font-normal text-fg-3">{fmt.weightUnit}</span>
            </div>
          ) : (
            <p className="text-sm text-fg-3">{td.noWeight}</p>
          )}
        </Card>

        <Card>
          <CardHeader title={t.nutrition.title} icon={<Utensils />} href={`/nutrition?date=${date}`} />
          <div className="flex items-baseline justify-between">
            <div className="text-3xl font-semibold tracking-tight tabular">
              {fmt.int(diary.totals.calories)}
              <span className="ml-1 text-base font-normal text-fg-3">kcal</span>
            </div>
            {target && <span className="text-sm text-fg-3 tabular">/ {fmt.int(target.calories)}</span>}
          </div>
          {target && <Meter className="mt-2" value={diary.totals.calories} max={target.calories} color="var(--c-calories)" label={t.nutrition.calories} />}
          <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
            {[
              [t.nutrition.protein, diary.totals.proteinG, target?.proteinG],
              [t.nutrition.carbs, diary.totals.carbsG, target?.carbsG],
              [t.nutrition.fat, diary.totals.fatG, target?.fatG],
              [t.nutrition.fiber, diary.totals.fiberG, target?.fiberG],
            ].map(([label, v, tg]) => (
              <div key={label as string} className="rounded-lg bg-surface-2 px-1 py-2">
                <div className="truncate text-fg-3">{label}</div>
                <div className="font-semibold tabular">
                  {fmt.int(v as number)}
                  {tg != null && <span className="font-normal text-fg-3">/{fmt.int(tg as number)}</span>}
                </div>
              </div>
            ))}
          </div>
          {diary.entries.length ? (
            <div className="mt-4 space-y-3">
              {[...bySlot.entries()].map(([slot, list]) => (
                <div key={slot}>
                  <div className="mb-1 flex justify-between text-xs font-semibold text-fg-2">
                    <span>{slotName(slot)}</span>
                    <span className="tabular">{fmt.int(list.reduce((a, e) => a + e.calories, 0))}</span>
                  </div>
                  <ul className="space-y-0.5 text-[13px] text-fg-3">
                    {list.map((e) => (
                      <li key={e.id} className="flex justify-between gap-2">
                        <span className="truncate">{e.name}</span>
                        <span className="tabular">{fmt.int(e.calories)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-fg-3">{td.nothingLogged}</p>
          )}
          <Button asChild variant="secondary" size="sm" className="mt-4">
            <Link href={`/nutrition?date=${date}`}>{td.openDiary}</Link>
          </Button>
        </Card>

        <Card>
          <CardHeader title={t.training.title} icon={<Dumbbell />} />
          {workouts.length ? (
            <ul className="divide-y divide-border">
              {workouts.map((w) => (
                <li key={w.workoutId}>
                  <Link href={`/training/workout/${w.workoutId}`} className="flex items-center justify-between gap-2 py-2 text-sm hover:text-accent">
                    <span className="truncate font-medium">{w.name}</span>
                    <span className="text-xs text-fg-3 tabular">
                      {format(t.common.sets, { count: w.sets }, locale)} · {fmt.load(w.volume)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-fg-3">
              {td.noWorkout}
              {summary.workoutPlanned && (
                <Badge tone="outline" className="ml-2">
                  {t.training.upNext}
                </Badge>
              )}
            </p>
          )}
        </Card>

        <Card>
          <CardHeader title={t.cardio.title} icon={<HeartPulse />} href="/cardio" />
          {cardio.length ? (
            <ul className="space-y-1.5 text-sm">
              {cardio.map((c) => (
                <li key={c.id} className="flex justify-between gap-2">
                  <span>{t.enums.cardio[c.activity]}</span>
                  <span className="text-fg-3 tabular">
                    {fmt.duration(c.durationSeconds)}
                    {c.distanceM ? ` · ${fmt.distance(c.distanceM)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-fg-3">{td.noCardio}</p>
          )}
        </Card>

        <Card>
          <CardHeader title={t.steps.title} icon={<Footprints />} action={<DayLogButton kind="steps" date={date} label={t.steps.set} variant="ghost" />} />
          {summary.steps != null ? (
            <>
              <div className="text-3xl font-semibold tracking-tight tabular">{fmt.int(summary.steps)}</div>
              <Meter className="mt-2" value={summary.steps} max={summary.stepGoal} color="var(--series-2)" showOverflow={false} label={t.steps.title} />
            </>
          ) : (
            <p className="text-sm text-fg-3">{td.noSteps}</p>
          )}
        </Card>

        <Card>
          <CardHeader title={t.water.title} icon={<Droplets />} href="/habits/water" />
          <WaterQuickAdd totalMl={summary.waterMl} date={date} compact />
        </Card>

        <Card>
          <CardHeader
            title={t.sleep.title}
            icon={<Moon />}
            action={
              <DayLogButton
                kind="sleep"
                date={date}
                label={extras.sleep ? edit : t.sleep.log}
                variant="ghost"
                initial={{ sleep: extras.sleep ? { date: extras.sleep.date, bedTime: extras.sleep.bedTime, wakeTime: extras.sleep.wakeTime, quality: extras.sleep.quality, note: extras.sleep.note } : null }}
              />
            }
          />
          {extras.sleep ? (
            <>
              <div className="text-3xl font-semibold tracking-tight tabular">{fmt.sleep(extras.sleep.durationMinutes)}</div>
              <p className="mt-1 text-[13px] text-fg-3 tabular">
                {extras.sleep.bedTime?.slice(0, 5)} → {extras.sleep.wakeTime?.slice(0, 5)}
                {extras.sleep.quality != null && ` · ${t.sleep.quality}: ${(t.sleep.qualityLabels as Record<string, string>)[String(extras.sleep.quality)]}`}
              </p>
            </>
          ) : (
            <p className="text-sm text-fg-3">{td.noSleep}</p>
          )}
        </Card>

        {supplements.some((s) => s.dueToday || s.taken) && (
          <Card>
            <CardHeader title={t.supplements.title} icon={<Pill />} href="/habits/supplements" />
            <ul className="space-y-1.5 text-sm">
              {supplements
                .filter((s) => s.dueToday || s.taken)
                .map((s) => (
                  <li key={s.id} className="flex justify-between gap-2">
                    <span className="truncate">{s.name}</span>
                    <span className={s.taken ? "text-good-text" : "text-fg-3"}>{s.taken ? t.common.done : "—"}</span>
                  </li>
                ))}
            </ul>
          </Card>
        )}

        {habits.length > 0 && (
          <Card>
            <CardHeader title={t.habits.title} href="/habits" />
            <ul className="space-y-1">
              {habits
                .filter((h) => h.history[0]?.scheduled)
                .map((h) => {
                  const label = h.type === "auto" && h.autoMetric ? h.name || t.enums.autoHabit[h.autoMetric as keyof typeof t.enums.autoHabit] : h.name;
                  const done = h.history[0]?.done ?? null;
                  return (
                    <li key={h.id} className="flex items-center gap-3 py-1">
                      <HabitCheck habitId={h.id} date={date} done={done} manual={h.type === "manual"} label={label} />
                      <span className={done ? "truncate text-sm text-fg-3" : "truncate text-sm"}>{label}</span>
                    </li>
                  );
                })}
            </ul>
          </Card>
        )}

        <Card>
          <CardHeader
            title={t.notes.title}
            icon={<NotebookPen />}
            action={
              <DayLogButton
                kind="note"
                date={date}
                label={extras.note ? edit : t.notes.add}
                variant="ghost"
                initial={{ note: extras.note ? { content: extras.note.content, tags: extras.note.tags, energy: extras.note.energy } : null }}
              />
            }
          />
          {extras.note ? (
            <>
              {extras.note.content && <p className="whitespace-pre-wrap text-sm text-fg-2">{extras.note.content}</p>}
              {(extras.note.tags.length > 0 || extras.note.energy != null) && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {extras.note.tags.map((tag) => (
                    <Badge key={tag} tone="outline">
                      {(t.enums.noteTag as Record<string, string>)[tag] ?? tag}
                    </Badge>
                  ))}
                  {extras.note.energy != null && (
                    <Badge tone="outline">
                      {t.notes.energy} {extras.note.energy}/5
                    </Badge>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-fg-3">{t.notes.placeholder}</p>
          )}
        </Card>
      </div>
    </div>
  );
}
