import type { Metadata } from "next";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { SimpleChartCard } from "@/components/analytics/simple-chart";
import { RangeLinks, parseRange, rangeStart, weekStarts } from "@/components/analytics/range";
import { Card, CardHeader } from "@/components/ui/card";
import { Meter } from "@/components/ui/data-display";
import { volumeByMuscle } from "@/lib/calc/training";
import { addDays, diffDays } from "@/lib/dates";
import { toDisplayWeight } from "@/lib/units";
import { getT, getUserContext } from "@/server/context";
import { getE1rmSeries, getExerciseSetCounts, getRecordsOverview, getTrainingPlan, getWorkoutAggregates } from "@/server/queries/training";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).analytics.tabs.training };
}

export default async function TrainingAnalyticsPage({ searchParams }: PageProps<"/analytics/training">) {
  const ctx = await getUserContext();
  const { t, fmt, locale } = ctx;
  const ta = t.analytics;
  const range = parseRange(await searchParams, 90);
  const start = rangeStart(ctx.today, range);
  const warm = ctx.prefs.training.includeWarmupsInVolume;
  const [aggs, setCounts, lifts, records, plan] = await Promise.all([
    getWorkoutAggregates(ctx.userId, start, ctx.today, warm),
    getExerciseSetCounts(ctx.userId, start, ctx.today, warm),
    getE1rmSeries(ctx.userId, start, ctx.today),
    getRecordsOverview(ctx.userId),
    getTrainingPlan(ctx.userId, ctx.prefs.training),
  ]);
  const weeks = weekStarts(start, ctx.today, ctx.weekStartsOn).map((w) => {
    const list = aggs.filter((a) => a.date >= w && a.date <= addDays(w, 6));
    return {
      date: w,
      workouts: list.length,
      sets: list.reduce((s, a) => s + a.sets, 0),
      volume: Math.round(toDisplayWeight(list.reduce((s, a) => s + a.volume, 0), fmt.units)),
    };
  });
  const weeksInRange = Math.max(1, diffDays(ctx.today, start) / 7);
  const muscles = volumeByMuscle(setCounts).map((m) => ({ ...m, perWeek: m.sets / weeksInRange }));
  const maxPerWeek = Math.max(10, ...muscles.map((m) => m.perWeek));
  const nameOf = (e: { name: string; nameEl: string | null }) => (locale === "el" && e.nameEl) || e.name;
  const liftRows = new Map<string, Record<string, number | string>>();
  lifts.forEach((l, i) => {
    for (const p of l.points) {
      const row = liftRows.get(p.date) ?? { date: p.date };
      row[`l${i}`] = Math.round(toDisplayWeight(p.value, fmt.units) * 10) / 10;
      liftRows.set(p.date, row);
    }
  });
  const liftData = [...liftRows.values()].sort((a, b) => ((a.date as string) < (b.date as string) ? -1 : 1)) as { date: string }[];

  return (
    <div className="space-y-4">
      <RangeLinks base="/analytics/training" value={range} label={ta.range} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SimpleChartCard
          title={ta.workoutsPerWeek}
          kind="int"
          weekly
          height={180}
          rows={weeks}
          series={[{ kind: "bar", key: "workouts", label: ta.workoutsPerWeek, color: "--series-1" }]}
          refLines={plan.plannedPerWeek ? [{ y: plan.plannedPerWeek, label: t.common.target, color: "--fg-2" }] : []}
        />
        <SimpleChartCard title={ta.setsPerWeek} kind="int" weekly height={180} rows={weeks} series={[{ kind: "bar", key: "sets", label: ta.setsPerWeek, color: "--series-2" }]} />
        <SimpleChartCard title={`${ta.volumePerWeek} (${fmt.weightUnit})`} kind="int" weekly height={180} rows={weeks} series={[{ kind: "bar", key: "volume", label: ta.volumePerWeek, color: "--series-3" }]} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SimpleChartCard
            title={ta.e1rmProgress}
            subtitle={t.training.exercise.e1rmFormula}
            kind="weight"
            zero={false}
            height={260}
            rows={liftData}
            series={lifts.map((l, i) => ({ kind: "line" as const, key: `l${i}`, label: nameOf(l), color: `--series-${i + 1}`, connectNulls: true, dots: true }))}
          />
        </div>
        <Card>
          <CardHeader title={ta.volumeByMuscle} subtitle={ta.volumeByMuscleHint} />
          {muscles.length ? (
            <ul className="space-y-2.5">
              {muscles.map((m) => (
                <li key={m.muscle}>
                  <div className="mb-1 flex justify-between text-[13px]">
                    <span className="text-fg-2">{t.enums.muscle[m.muscle]}</span>
                    <span className="font-semibold tabular">
                      {fmt.number(m.perWeek, 1)} <span className="font-normal text-fg-3">/ {t.common.perWeek}</span>
                    </span>
                  </div>
                  <Meter value={m.perWeek} max={maxPerWeek} height={6} color="var(--series-1)" showOverflow={false} label={t.enums.muscle[m.muscle]} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-fg-3">{ta.noDataRange}</p>
          )}
        </Card>
      </div>
      <Card>
        <CardHeader title={ta.recentPrs} icon={<Trophy />} href="/training/records" />
        {records.recent.length ? (
          <ul className="grid gap-x-6 sm:grid-cols-2">
            {records.recent.slice(0, 10).map((r, i) => (
              <li key={i} className="flex items-center justify-between gap-3 border-b border-border py-2 text-sm">
                <Link href={`/training/exercises/${r.exerciseId}`} className="min-w-0 truncate hover:text-accent">
                  {nameOf(r)}
                  <span className="ml-2 text-xs text-fg-3">{t.enums.prType[r.type]}</span>
                </Link>
                <span className="shrink-0 tabular">
                  <span className="font-semibold">{r.type === "reps" ? fmt.int(r.value) : r.type === "e1rm" ? fmt.weight(r.value) : fmt.load(r.value)}</span>
                  <span className="ml-2 text-xs text-fg-3">{fmt.date(r.date, "dayMonth")}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-fg-3">{t.training.recordsPage.emptyBody}</p>
        )}
      </Card>
    </div>
  );
}
