import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PrintButton, ReflectionForm } from "@/components/reports/report-client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, ProgressRing, Stat } from "@/components/ui/data-display";
import { addDays, startOfWeek, type ISODate } from "@/lib/dates";
import { format } from "@/lib/i18n";
import { getUserContext } from "@/server/context";
import { interpretWeek } from "@/server/queries/report-text";
import { getWeeklyReport } from "@/server/queries/reports";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export async function generateMetadata({ params }: PageProps<"/reports/[week]">): Promise<Metadata> {
  const { week } = await params;
  const ctx = await getUserContext();
  return { title: ISO.test(week) ? format(ctx.t.reports.weekOf, { date: ctx.fmt.date(week as ISODate, "medium") }, ctx.locale) : ctx.t.reports.title };
}

export default async function ReportPage({ params }: PageProps<"/reports/[week]">) {
  const { week } = await params;
  if (!ISO.test(week) || Number.isNaN(Date.parse(week))) notFound();
  const ctx = await getUserContext();
  const { t, fmt, locale } = ctx;
  const tr = t.reports;
  const weekStart = startOfWeek(week as ISODate, ctx.weekStartsOn);
  if (weekStart > ctx.today) notFound();
  const r = await getWeeklyReport(ctx, weekStart);
  const lines = interpretWeek(ctx, r);
  const next = addDays(weekStart, 7);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between gap-2 print:hidden">
        <Link href="/reports" className="-ml-1.5 inline-flex items-center gap-0.5 text-sm font-medium text-fg-3 hover:text-fg">
          <ChevronLeft className="size-5" aria-hidden />
          {tr.title}
        </Link>
        <div className="flex items-center gap-1">
          <PrintButton />
          <Button asChild variant="ghost" size="icon" aria-label={t.common.previous}>
            <Link href={`/reports/${addDays(weekStart, -7)}`}>
              <ChevronLeft />
            </Link>
          </Button>
          {next <= ctx.today ? (
            <Button asChild variant="ghost" size="icon" aria-label={t.common.next}>
              <Link href={`/reports/${next}`}>
                <ChevronRight />
              </Link>
            </Button>
          ) : (
            <span className="size-10" />
          )}
        </div>
      </div>

      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{format(tr.week, { week: r.week.week }, locale)}</h1>
            {r.inProgress && <Badge tone="accent">{tr.inProgress}</Badge>}
          </div>
          <p className="mt-1 text-sm text-fg-3">
            {fmt.date(r.weekStart, "long")} – {fmt.date(r.weekEnd, "long")}
          </p>
        </div>
        {r.score != null && (
          <ProgressRing value={r.score / 100} size={72} stroke={7} label={`${tr.score}: ${r.score}`}>
            <span className="text-lg font-semibold">{r.score}</span>
          </ProgressRing>
        )}
      </header>

      <Card>
        <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
          <Stat label={tr.avgWeight} value={r.avgWeight != null ? fmt.weight(r.avgWeight, { unit: false }) : tr.noData} unit={r.avgWeight != null ? fmt.weightUnit : undefined} />
          <Stat label={tr.weeklyChange} value={r.weightChange != null ? fmt.weight(r.weightChange, { signed: true, unit: false }) : tr.noData} unit={r.weightChange != null ? fmt.weightUnit : undefined} />
          <Stat label={tr.avgCalories} value={r.avgCalories != null ? fmt.int(r.avgCalories) : tr.noData} unit={r.avgCalories != null ? "kcal" : undefined} sub={r.calorieTarget ? <span className="text-fg-3">{t.nutrition.target} {fmt.int(r.calorieTarget)}</span> : undefined} />
          <Stat label={tr.avgProtein} value={r.avgProtein != null ? fmt.int(r.avgProtein) : tr.noData} unit={r.avgProtein != null ? "g" : undefined} />
          <Stat label={tr.avgSteps} value={r.avgSteps != null ? fmt.int(r.avgSteps) : tr.noData} />
          <Stat label={tr.workouts} value={`${r.workouts}${r.plannedWorkouts ? ` / ${r.plannedWorkouts}` : ""}`} />
          <Stat label={tr.cardio} value={`${fmt.int(r.cardioMinutes)}`} unit={t.common.minutesShort} sub={<span className="text-fg-3">{format(t.common.sessions, { count: r.cardioSessions }, locale)}</span>} />
          <Stat label={tr.sleep} value={r.avgSleep != null ? fmt.sleep(r.avgSleep) : tr.noData} />
        </div>
      </Card>

      <Card>
        <CardHeader title={tr.interpretation} />
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-fg-2 marker:text-fg-3">
          {lines.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      </Card>

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-fg-3">
                <th className="py-2.5 pl-4 font-medium sm:pl-5">{t.common.date}</th>
                <th className="py-2.5 text-right font-medium">{t.weight.title}</th>
                <th className="py-2.5 text-right font-medium">kcal</th>
                <th className="py-2.5 text-right font-medium">{t.nutrition.protein}</th>
                <th className="py-2.5 text-right font-medium">{t.steps.title}</th>
                <th className="py-2.5 text-right font-medium">{t.training.title}</th>
                <th className="py-2.5 text-right font-medium">{t.sleep.title}</th>
                <th className="py-2.5 pr-4 text-right font-medium sm:pr-5">{t.enums.dashboardCard.score}</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {r.days.map((d) => (
                <tr key={d.date} className="border-b border-border last:border-0">
                  <td className="py-2.5 pl-4 sm:pl-5">
                    <Link href={`/day/${d.date}`} className="hover:text-accent">
                      {fmt.date(d.date, "weekdayShort")}
                    </Link>
                  </td>
                  <td className="py-2.5 text-right">{d.weightKg != null ? fmt.weight(d.weightKg, { unit: false }) : "—"}</td>
                  <td className="py-2.5 text-right">{d.nutrition.entries ? fmt.int(d.nutrition.totals.calories) : "—"}</td>
                  <td className="py-2.5 text-right">{d.nutrition.entries ? fmt.int(d.nutrition.totals.proteinG) : "—"}</td>
                  <td className="py-2.5 text-right">{d.steps != null ? fmt.int(d.steps) : "—"}</td>
                  <td className="py-2.5 text-right">{d.workoutsCompleted || "—"}</td>
                  <td className="py-2.5 text-right">{d.sleepMinutes != null ? fmt.sleep(d.sleepMinutes) : "—"}</td>
                  <td className="py-2.5 pr-4 text-right sm:pr-5">{d.score ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <ReflectionForm weekStart={weekStart} reflection={r.reflection} rating={r.rating} />
      </Card>
    </div>
  );
}
