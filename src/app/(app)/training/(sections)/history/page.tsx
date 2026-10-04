import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, History } from "lucide-react";
import { StartWorkoutButton } from "@/components/dashboard/islands";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/data-display";
import { addDays, startOfWeek } from "@/lib/dates";
import { format } from "@/lib/i18n";
import { groupBy } from "@/lib/utils";
import { getT, getUserContext } from "@/server/context";
import { getWorkoutAggregates } from "@/server/queries/training";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).training.historyPage.title };
}

export default async function TrainingHistoryPage({ searchParams }: PageProps<"/training/history">) {
  const ctx = await getUserContext();
  const { t, fmt, locale } = ctx;
  const sp = await searchParams;
  const weeks = Math.min(520, Math.max(12, Number(sp.weeks) || 16));
  const start = startOfWeek(addDays(ctx.today, -(weeks - 1) * 7), ctx.weekStartsOn);
  const rows = await getWorkoutAggregates(ctx.userId, start, ctx.today, ctx.prefs.training.includeWarmupsInVolume);
  const byWeek = [...groupBy(rows, (r) => startOfWeek(r.date, ctx.weekStartsOn)).entries()];

  if (!rows.length) {
    return (
      <Card>
        <EmptyState
          icon={<History />}
          title={t.training.historyPage.empty}
          body={t.training.noWorkoutsBody}
          action={
            <StartWorkoutButton programDayId={null} variant="accent">
              {t.training.startEmpty}
            </StartWorkoutButton>
          }
        />
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {byWeek.map(([week, list]) => {
        const sets = list.reduce((a, w) => a + w.sets, 0);
        const volume = list.reduce((a, w) => a + w.volume, 0);
        return (
          <section key={week}>
            <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
              <h2 className="text-sm font-semibold">
                {fmt.date(week, "dayMonth")} – {fmt.date(addDays(week, 6), "dayMonth")}
              </h2>
              <span className="text-xs text-fg-3 tabular">
                {format(t.training.workoutsDoneNoPlan, { count: list.length }, locale)} · {format(t.common.sets, { count: sets }, locale)} · {fmt.load(volume)}
              </span>
            </div>
            <Card className="p-0">
              <ul className="divide-y divide-border">
                {list.map((w) => (
                  <li key={w.workoutId}>
                    <Link href={`/training/workout/${w.workoutId}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2 sm:px-5">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{w.name}</div>
                        <div className="text-xs text-fg-3">
                          {fmt.date(w.date, "weekdayShort")}
                          {w.durationSeconds ? ` · ${fmt.duration(w.durationSeconds)}` : ""} · {format(t.training.workout.exerciseCount, { count: w.exercises }, locale)}
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
            </Card>
          </section>
        );
      })}
      <div className="flex justify-center">
        <Button asChild variant="secondary">
          <Link href={`/training/history?weeks=${weeks + 16}`} scroll={false}>
            {t.common.more}
          </Link>
        </Button>
      </div>
    </div>
  );
}
