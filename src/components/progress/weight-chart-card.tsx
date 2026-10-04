"use client";

import * as React from "react";
import { ChartCard, RANGE_DAYS, RangeTabs, type RangeKey } from "@/components/charts/chart-card";
import { TimeSeriesChart, type SeriesSpec } from "@/components/charts/time-series-chart";
import { useT } from "@/components/providers/i18n-provider";
import { useFmt, useToday } from "@/components/providers/prefs-provider";
import { rollingMean } from "@/lib/calc/series";
import { addDays } from "@/lib/dates";
import { toDisplayWeight } from "@/lib/units";

export function WeightChartCard({
  entries,
  goalKg,
  defaultRange = "3m",
  forecast,
}: {
  entries: { date: string; weightKg: number }[];
  goalKg?: number | null;
  defaultRange?: RangeKey;
  forecast?: { date: string; expected: number; low: number; high: number }[];
}) {
  const t = useT();
  const fmt = useFmt();
  const today = useToday();
  const [range, setRange] = React.useState<RangeKey>(defaultRange);
  const units = fmt.units;

  const avg = React.useMemo(() => new Map(rollingMean(entries.map((e) => ({ date: e.date, value: e.weightKg })), 7).map((p) => [p.date, p.value])), [entries]);
  const days = RANGE_DAYS[range];
  const start = days ? addDays(today, -(days - 1)) : (entries[0]?.date ?? today);
  const rows = entries
    .filter((e) => e.date >= start)
    .map((e) => ({ date: e.date, raw: toDisplayWeight(e.weightKg, units), avg: toDisplayWeight(avg.get(e.date) ?? e.weightKg, units) }));
  const fc = (forecast ?? []).map((p) => ({ date: p.date, expected: toDisplayWeight(p.expected, units), low: toDisplayWeight(p.low, units), high: toDisplayWeight(p.high, units) }));
  const data = [...rows, ...fc.filter((p) => p.date > (rows.at(-1)?.date ?? today))];
  const series: SeriesSpec[] = [
    { kind: "dots", key: "raw", label: t.weight.chartRaw, color: "--chart-muted" },
    { kind: "line", key: "avg", label: t.weight.chartAvg, color: "--series-1" },
  ];
  if (fc.length) {
    series.push({ kind: "band", lowKey: "low", highKey: "high", label: t.goals.forecast, color: "--series-1" });
    series.push({ kind: "line", key: "expected", label: t.goals.atCurrentPace, color: "--series-1", dashed: true });
  }
  const spanDays = data.length > 1 ? (Date.parse(data[data.length - 1].date) - Date.parse(data[0].date)) / 86_400_000 : 0;
  const long = spanDays > 240;
  return (
    <ChartCard
      title={t.weight.title}
      subtitle={t.weight.noiseHint}
      table={{
        columns: [t.common.date, t.weight.daily, t.weight.avg7],
        rows: [...rows].reverse().map((r) => [fmt.date(r.date, "medium"), fmt.number(r.raw, 1, { min: 1 }), fmt.number(r.avg, 1, { min: 1 })]),
      }}
    >
      <div className="mb-3">
        <RangeTabs value={range} onChange={setRange} />
      </div>
      {rows.length ? (
        <TimeSeriesChart
          ariaLabel={t.weight.title}
          data={data}
          series={series}
          height={260}
          showLegend
          refLines={goalKg ? [{ y: toDisplayWeight(goalKg, units), label: t.weight.chartGoal, color: "--good" }] : []}
          formatValue={(v) => `${fmt.number(v, 1, { min: 1 })} ${fmt.weightUnit}`}
          formatAxis={(v) => fmt.number(v, 0)}
          formatTick={(d) => fmt.date(d, long ? "monthShort" : "dayMonth")}
          formatTooltipDate={(d) => fmt.date(d, "weekdayShort")}
        />
      ) : (
        <p className="py-16 text-center text-sm text-fg-3">{t.analytics.noDataRange}</p>
      )}
    </ChartCard>
  );
}
