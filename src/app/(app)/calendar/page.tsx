import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Stat } from "@/components/ui/data-display";
import { PageHeader } from "@/components/ui/page";
import { dayIndicators } from "@/lib/calc/day";
import { dailyScore } from "@/lib/calc/score";
import { addDays, addMonths, eachDay, endOfMonth, startOfMonth, startOfWeek, type ISODate } from "@/lib/dates";
import { cn, mean } from "@/lib/utils";
import { getT, getUserContext } from "@/server/context";
import { getDaySummaries } from "@/server/queries/days";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).calendar.title };
}

/** Indicator order/colours follow the fixed categorical order; each also has a text label in the legend and cell aria-label. */
const INDICATORS = [
  { key: "weight", color: "var(--series-1)" },
  { key: "nutrition", color: "var(--series-3)" },
  { key: "workout", color: "var(--series-2)" },
  { key: "cardio", color: "var(--series-5)" },
  { key: "steps", color: "var(--series-6)" },
] as const;

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const ctx = await getUserContext();
  const { t, fmt } = ctx;
  const tc = t.calendar;
  const sp = await searchParams;
  const thisMonth = startOfMonth(ctx.today);
  const requested = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? (`${sp.month}-01` as ISODate) : thisMonth;
  const month = requested > thisMonth ? thisMonth : requested;
  const monthEnd = endOfMonth(month);
  const gridStart = startOfWeek(month, ctx.weekStartsOn);
  const gridEnd = addDays(startOfWeek(monthEnd, ctx.weekStartsOn), 6);
  const days = await getDaySummaries(ctx, gridStart, gridEnd < ctx.today ? gridEnd : ctx.today);
  const byDate = new Map(days.map((d) => [d.date, d]));
  const cells = eachDay(gridStart, gridEnd);
  const inMonth = days.filter((d) => d.date >= month && d.date <= monthEnd);
  const prev = addMonths(month, -1).slice(0, 7);
  const next = addMonths(month, 1);
  const weekdayIdx = Array.from({ length: 7 }, (_, i) => (ctx.weekStartsOn + i) % 7);
  const ind = tc as Record<string, string>;

  const foodDays = inMonth.filter((d) => d.nutrition.entries > 0);
  const weights = inMonth.map((d) => d.weightKg).filter((w): w is number => w != null);
  const avgCalories = mean(foodDays.filter((d) => d.date < ctx.today).map((d) => d.nutrition.totals.calories));
  const avgWeight = mean(weights);

  return (
    <>
      <PageHeader
        title={tc.title}
        actions={
          month !== thisMonth ? (
            <Button asChild variant="secondary" size="sm">
              <Link href="/calendar">{tc.today}</Link>
            </Button>
          ) : undefined
        }
      />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="p-3 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <Button asChild variant="ghost" size="icon" aria-label={t.common.previous}>
              <Link href={`/calendar?month=${prev}`}>
                <ChevronLeft />
              </Link>
            </Button>
            <h2 className="text-lg font-semibold tracking-tight">{fmt.date(month, "monthYear")}</h2>
            {next <= thisMonth ? (
              <Button asChild variant="ghost" size="icon" aria-label={t.common.next}>
                <Link href={`/calendar?month=${next.slice(0, 7)}`}>
                  <ChevronRight />
                </Link>
              </Button>
            ) : (
              <span className="size-10" />
            )}
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-fg-3 uppercase" aria-hidden>
            {weekdayIdx.map((w) => (
              <div key={w} className="py-1">
                {fmt.weekdayShort(w)}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1" role="grid" aria-label={fmt.date(month, "monthYear")}>
            {cells.map((date) => {
              const d = byDate.get(date);
              const out = date < month || date > monthEnd;
              const future = date > ctx.today;
              const flags = d ? dayIndicators(d) : null;
              const active = INDICATORS.filter((i) => flags?.[i.key]);
              const score = d && ctx.prefs.scoring.enabled ? dailyScore(d, ctx.prefs.scoring.weights).score : null;
              const label = `${fmt.date(date, "long")}${active.length ? `: ${active.map((i) => ind[i.key]).join(", ")}` : ""}${score != null ? ` · ${t.enums.dashboardCard.score} ${score}` : ""}`;
              const content = (
                <>
                  <span className={cn("text-[13px] font-medium tabular sm:text-sm", date === ctx.today && "flex size-6 items-center justify-center rounded-full bg-accent text-accent-fg")}>
                    {Number(date.slice(8))}
                  </span>
                  <span className="mt-auto flex min-h-2 flex-wrap justify-center gap-0.5 sm:gap-1">
                    {active.map((i) => (
                      <span key={i.key} className="size-1.5 rounded-full sm:size-2" style={{ background: i.color }} />
                    ))}
                  </span>
                  {score != null && <span className="hidden text-[10px] text-fg-3 tabular sm:block">{score}</span>}
                </>
              );
              const cls = cn(
                "flex aspect-square flex-col items-center gap-1 rounded-xl p-1 pt-1.5 transition sm:aspect-[1/0.9] sm:p-1.5",
                out && "opacity-35",
                future ? "cursor-default opacity-30" : "hover:bg-surface-2",
              );
              return future ? (
                <div key={date} className={cls} role="gridcell" aria-label={label} aria-disabled>
                  {content}
                </div>
              ) : (
                <Link key={date} href={`/day/${date}`} className={cls} role="gridcell" aria-label={label} aria-current={date === ctx.today ? "date" : undefined}>
                  {content}
                </Link>
              );
            })}
          </div>
          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-border pt-3 text-xs text-fg-2" aria-label={tc.legend}>
            {INDICATORS.map((i) => (
              <li key={i.key} className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: i.color }} aria-hidden />
                {ind[i.key]}
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title={tc.monthSummary} />
          <div className="grid grid-cols-2 gap-x-4 gap-y-5">
            <Stat label={tc.daysLogged} value={fmt.int(foodDays.length)} />
            <Stat label={tc.workouts} value={fmt.int(inMonth.reduce((a, d) => a + d.workoutsCompleted, 0))} />
            <Stat label={tc.cardioSessions} value={fmt.int(inMonth.reduce((a, d) => a + d.cardioSessions, 0))} />
            <Stat label={tc.stepGoalDays} value={fmt.int(inMonth.filter((d) => dayIndicators(d).steps).length)} />
            <Stat label={tc.avgCalories} value={avgCalories != null ? fmt.int(avgCalories) : "—"} unit={avgCalories != null ? "kcal" : undefined} />
            <Stat label={tc.avgWeight} value={avgWeight != null ? fmt.weight(avgWeight, { unit: false }) : "—"} unit={avgWeight != null ? fmt.weightUnit : undefined} />
          </div>
        </Card>
      </div>
    </>
  );
}
