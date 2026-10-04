"use client";

import * as React from "react";
import { ChartCard, RANGE_DAYS, RangeTabs, type RangeKey } from "@/components/charts/chart-card";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { useT } from "@/components/providers/i18n-provider";
import { useFmt, useToday } from "@/components/providers/prefs-provider";
import { Segmented } from "@/components/ui/controls";
import type { TrackingType } from "@/lib/domain";
import { addDays } from "@/lib/dates";
import { toDisplayDistance, toDisplayWeight } from "@/lib/units";

export type SessionPoint = { date: string; e1rm: number | null; weight: number | null; volume: number; reps: number | null; duration: number | null; distance: number | null };
type Metric = "e1rm" | "weight" | "volume" | "reps" | "duration" | "distance";

export function ExerciseCharts({ points, tracking }: { points: SessionPoint[]; tracking: TrackingType }) {
  const t = useT();
  const te = t.training.exercise;
  const fmt = useFmt();
  const today = useToday();
  const metrics: Metric[] =
    tracking === "weight_reps" ? ["e1rm", "weight", "volume", "reps"] : tracking === "bodyweight_reps" ? ["reps", "volume"] : tracking === "duration" ? ["duration"] : ["distance", "duration"];
  const [metric, setMetric] = React.useState<Metric>(metrics[0]);
  const [range, setRange] = React.useState<RangeKey>("6m");
  const labels: Record<Metric, string> = { e1rm: te.chartE1rm, weight: te.chartWeight, volume: te.chartVolume, reps: te.chartReps, duration: t.training.duration, distance: t.cardio.distance };
  const days = RANGE_DAYS[range];
  const start = days ? addDays(today, -(days - 1)) : (points[0]?.date ?? today);
  const conv = (m: Metric, v: number | null) =>
    v == null ? null : m === "e1rm" || m === "weight" || m === "volume" ? toDisplayWeight(v, fmt.units) : m === "distance" ? toDisplayDistance(v, fmt.units) : m === "duration" ? v / 60 : v;
  const rows = points.filter((p) => p.date >= start).map((p) => ({ date: p.date, value: conv(metric, p[metric]) }));
  const valueFmt = (v: number) =>
    metric === "reps"
      ? fmt.int(v)
      : metric === "duration"
        ? fmt.clock(v * 60)
        : metric === "distance"
          ? `${fmt.number(v, 2)} ${fmt.distanceUnit}`
          : `${fmt.number(v, metric === "volume" ? 0 : 1)} ${fmt.weightUnit}`;
  const long = (days ?? 400) > 240;
  return (
    <ChartCard
      title={te.progression}
      subtitle={metric === "e1rm" ? te.e1rmFormula : undefined}
      table={{ columns: [t.common.date, labels[metric]], rows: [...rows].reverse().map((r) => [fmt.date(r.date, "medium"), r.value != null ? valueFmt(r.value) : "—"]) }}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        {metrics.length > 1 && <Segmented size="sm" className="no-scrollbar max-w-full overflow-x-auto" value={metric} onChange={setMetric} options={metrics.map((m) => ({ value: m, label: labels[m] }))} ariaLabel={te.progression} />}
        <RangeTabs value={range} onChange={setRange} />
      </div>
      {rows.length ? (
        <TimeSeriesChart
          ariaLabel={labels[metric]}
          data={rows}
          height={240}
          series={[{ kind: "line", key: "value", label: labels[metric], color: "--series-1", dots: true, connectNulls: true }]}
          formatValue={valueFmt}
          formatAxis={(v) => fmt.number(v, 0)}
          formatTick={(d) => fmt.date(d, long ? "monthShort" : "dayMonth")}
          formatTooltipDate={(d) => fmt.date(d, "weekdayShort")}
        />
      ) : (
        <p className="py-14 text-center text-sm text-fg-3">{t.analytics.noDataRange}</p>
      )}
    </ChartCard>
  );
}
