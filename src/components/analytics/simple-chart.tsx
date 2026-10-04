"use client";

import * as React from "react";
import { ChartCard } from "@/components/charts/chart-card";
import { TimeSeriesChart, type ChartRow, type SeriesSpec } from "@/components/charts/time-series-chart";
import { useT } from "@/components/providers/i18n-provider";
import { useFmt } from "@/components/providers/prefs-provider";
import { addDays } from "@/lib/dates";

/** How values are formatted. Weight/distance values must already be in display units. */
export type ValueKind = "kcal" | "g" | "weight" | "weightDelta" | "int" | "minutes" | "sleep" | "ml" | "pct" | "distance" | "bpm" | "score";

export function useValueFormatter(kind: ValueKind) {
  const fmt = useFmt();
  const t = useT();
  return React.useCallback(
    (v: number) => {
      switch (kind) {
        case "kcal":
          return fmt.kcal(v);
        case "g":
          return `${fmt.int(v)} g`;
        case "weight":
          return `${fmt.number(v, 1, { min: 1 })} ${fmt.weightUnit}`;
        case "weightDelta":
          return `${fmt.number(v, 2, { signed: true })} ${fmt.weightUnit}`;
        case "minutes":
          return `${fmt.int(v)} ${t.common.minutesShort}`;
        case "sleep":
          return fmt.sleep(v);
        case "ml":
          return fmt.volume(v);
        case "pct":
          return fmt.pct(v);
        case "distance":
          return `${fmt.number(v, 1)} ${fmt.distanceUnit}`;
        case "bpm":
          return `${fmt.int(v)} ${t.cardio.bpm}`;
        default:
          return fmt.int(v);
      }
    },
    [fmt, kind, t],
  );
}

export function SimpleChartCard({
  title,
  subtitle,
  rows,
  series,
  kind,
  refLines,
  zero = true,
  height = 220,
  weekly,
  footer,
  axisDecimals = 0,
}: {
  title: string;
  subtitle?: string;
  rows: ChartRow[];
  series: SeriesSpec[];
  kind: ValueKind;
  refLines?: { y: number; label: string; color: string }[];
  zero?: boolean;
  height?: number;
  /** Rows are week starts; tooltip shows the week range. */
  weekly?: boolean;
  footer?: React.ReactNode;
  axisDecimals?: number;
}) {
  const t = useT();
  const fmt = useFmt();
  const fv = useValueFormatter(kind);
  const span = rows.length > 1 ? (Date.parse(rows[rows.length - 1].date) - Date.parse(rows[0].date)) / 86_400_000 : 0;
  const keyed = series.flatMap((s) => (s.kind === "band" ? [] : [s]));
  const hasData = rows.some((r) => keyed.some((s) => typeof r[s.key] === "number"));
  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      footer={footer}
      table={{
        columns: [t.common.date, ...keyed.map((s) => s.label)],
        rows: [...rows]
          .reverse()
          .filter((r) => keyed.some((s) => typeof r[s.key] === "number"))
          .map((r) => [fmt.date(r.date, "medium"), ...keyed.map((s) => (typeof r[s.key] === "number" ? fv(r[s.key] as number) : "—"))]),
      }}
    >
      {hasData ? (
        <TimeSeriesChart
          ariaLabel={title}
          data={rows}
          series={series}
          height={height}
          yDomain={zero ? "zero" : "auto"}
          showLegend={keyed.length > 1 || (refLines?.length ?? 0) > 0}
          refLines={refLines}
          formatValue={fv}
          formatAxis={(v) => (kind === "sleep" ? fmt.number(v / 60, 0) + "h" : kind === "pct" ? fmt.pct(v) : Math.abs(v) >= 10000 ? `${fmt.number(v / 1000, 0)}k` : fmt.number(v, axisDecimals))}
          formatTick={(d) => fmt.date(d, span > 200 ? "monthShort" : "dayMonth")}
          formatTooltipDate={(d) => (weekly ? `${fmt.date(d, "dayMonth")} – ${fmt.date(addDays(d, 6), "dayMonth")}` : fmt.date(d, "weekdayShort"))}
        />
      ) : (
        <p className="py-14 text-center text-sm text-fg-3">{t.analytics.noDataRange}</p>
      )}
    </ChartCard>
  );
}
