"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ChartCard, RangeTabs, RANGE_DAYS, type RangeKey } from "@/components/charts/chart-card";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { useLocale, useT } from "@/components/providers/i18n-provider";
import { useFmt, useToday } from "@/components/providers/prefs-provider";
import { Card } from "@/components/ui/card";
import { Stat } from "@/components/ui/data-display";
import { caloriesOnTarget, macroCalories, proteinHit } from "@/lib/calc/nutrition";
import { addDays } from "@/lib/dates";
import { format } from "@/lib/i18n";
import { mean } from "@/lib/utils";
import { MacroLine } from "./shared";

type Day = { date: string; calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number; entries: number; target: { calories: number; proteinG: number } | null };

const RANGES = ["7d", "30d", "3m", "6m", "1y"] as const;

export function NutritionHistory({ days }: { days: Day[] }) {
  const t = useT();
  const th = t.nutrition.history;
  const locale = useLocale();
  const fmt = useFmt();
  const today = useToday();
  const [range, setRange] = React.useState<RangeKey>("30d");
  const span = RANGE_DAYS[range] ?? 365;
  const start = addDays(today, -(span - 1));
  const list = days.filter((d) => d.date >= start);
  // Today is still in progress, so it is left out of averages and adherence.
  const complete = list.filter((d) => d.date < today);
  const totalDays = span - 1;

  const withTarget = complete.filter((d) => d.target);
  const onTarget = withTarget.filter((d) => caloriesOnTarget(d.calories, d.target!.calories)).length;
  const protein = withTarget.filter((d) => proteinHit(d.proteinG, d.target!.proteinG)).length;
  const pct = (n: number, of: number) => (of ? fmt.pct(n / of) : "—");

  const rows = list.map((d) => {
    const m = macroCalories(d);
    return { date: d.date, calories: Math.round(d.calories), target: d.target?.calories ?? null, protein: Math.round(m.protein), carbs: Math.round(m.carbs), fat: Math.round(m.fat) };
  });
  const long = span > 120;
  const tick = (d: string) => fmt.date(d, long ? "monthShort" : "dayMonth");

  return (
    <div className="space-y-4">
      <RangeTabs value={range} onChange={setRange} options={RANGES} />
      <Card>
        <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
          <Stat label={th.avgCalories} value={complete.length ? fmt.int(mean(complete.map((d) => d.calories))!) : "—"} unit={complete.length ? "kcal" : undefined} />
          <Stat label={th.avgProtein} value={complete.length ? fmt.int(mean(complete.map((d) => d.proteinG))!) : "—"} unit={complete.length ? "g" : undefined} />
          <Stat label={th.daysLogged} value={format(th.ofDays, { count: complete.length, total: totalDays }, locale)} />
          <Stat label={th.onTarget} value={pct(onTarget, withTarget.length)} sub={<span className="text-fg-3">{th.proteinHit}: {pct(protein, withTarget.length)}</span>} />
        </div>
        <p className="mt-4 border-t border-border pt-3 text-xs text-fg-3">{th.loggedOnlyHint}</p>
      </Card>

      {list.length ? (
        <>
          <ChartCard
            title={th.caloriesChart}
            table={{
              columns: [t.common.date, t.nutrition.calories, t.nutrition.target],
              rows: [...rows].reverse().map((r) => [fmt.date(r.date, "medium"), fmt.int(r.calories), r.target != null ? fmt.int(r.target) : "—"]),
            }}
          >
            <TimeSeriesChart
              ariaLabel={th.caloriesChart}
              data={rows}
              yDomain="zero"
              showLegend
              series={[
                { kind: "bar", key: "calories", label: t.nutrition.calories, color: "--series-1" },
                { kind: "line", key: "target", label: t.nutrition.target, color: "--fg-2", dashed: true },
              ]}
              formatValue={(v) => fmt.kcal(v)}
              formatAxis={(v) => fmt.int(v)}
              formatTick={tick}
              formatTooltipDate={(d) => fmt.date(d, "weekdayShort")}
            />
          </ChartCard>
          <ChartCard
            title={th.macroChart}
            table={{
              columns: [t.common.date, t.nutrition.protein, t.nutrition.carbs, t.nutrition.fat],
              rows: [...rows].reverse().map((r) => [fmt.date(r.date, "medium"), fmt.int(r.protein), fmt.int(r.carbs), fmt.int(r.fat)]),
            }}
          >
            <TimeSeriesChart
              ariaLabel={th.macroChart}
              data={rows}
              yDomain="zero"
              showLegend
              series={[
                { kind: "bar", key: "protein", label: t.nutrition.protein, color: "--series-2", stackId: "m" },
                { kind: "bar", key: "carbs", label: t.nutrition.carbs, color: "--series-3", stackId: "m" },
                { kind: "bar", key: "fat", label: t.nutrition.fat, color: "--series-4", stackId: "m" },
              ]}
              formatValue={(v) => fmt.kcal(v)}
              formatAxis={(v) => fmt.int(v)}
              formatTick={tick}
              formatTooltipDate={(d) => fmt.date(d, "weekdayShort")}
            />
          </ChartCard>
          <Card className="p-0">
            <ul className="divide-y divide-border">
              {[...list].reverse().map((d) => {
                const diff = d.target ? d.calories - d.target.calories : null;
                return (
                  <li key={d.date}>
                    <Link href={`/nutrition?date=${d.date}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2 sm:px-5">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{fmt.date(d.date, "weekdayShort")}</div>
                        <MacroLine n={d} />
                      </div>
                      <div className="text-right text-sm tabular">
                        <div className="font-semibold">{fmt.kcal(d.calories)}</div>
                        {diff != null && <div className="text-xs text-fg-3">{fmt.number(diff, 0, { signed: true })}</div>}
                      </div>
                      <ChevronRight className="size-4 text-fg-3" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        </>
      ) : (
        <Card>
          <p className="py-10 text-center text-sm text-fg-3">{th.noLogs}</p>
        </Card>
      )}
    </div>
  );
}
