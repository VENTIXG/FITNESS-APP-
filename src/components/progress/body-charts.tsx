"use client";

import * as React from "react";
import { ChartCard } from "@/components/charts/chart-card";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { useT } from "@/components/providers/i18n-provider";
import { useFmt } from "@/components/providers/prefs-provider";
import { Select } from "@/components/ui/controls";
import { MEASUREMENT_SITES, type MeasurementSite } from "@/lib/domain";
import { toDisplayLength, toDisplayWeight } from "@/lib/units";

type CompRow = { date: string; bodyFatPct: number | null; fatMassKg: number | null; leanMassKg: number | null };

export function BodyFatChart({ rows }: { rows: CompRow[] }) {
  const t = useT();
  const fmt = useFmt();
  const data = rows.filter((r) => r.bodyFatPct != null).map((r) => ({ date: r.date, bf: r.bodyFatPct }));
  return (
    <ChartCard title={t.analytics.bodyFatChart} table={{ columns: [t.common.date, t.body.bodyFatPct], rows: [...data].reverse().map((r) => [fmt.date(r.date), `${fmt.number(r.bf!, 1)}%`]) }}>
      <TimeSeriesChart
        ariaLabel={t.analytics.bodyFatChart}
        data={data}
        series={[{ kind: "line", key: "bf", label: t.body.bodyFatPct, color: "--series-1", dots: true }]}
        formatValue={(v) => `${fmt.number(v, 1)}%`}
        formatAxis={(v) => `${fmt.number(v, 0)}%`}
        formatTick={(d) => fmt.date(d, "dayMonth")}
        formatTooltipDate={(d) => fmt.date(d, "medium")}
        height={220}
      />
    </ChartCard>
  );
}

/** Lean and fat mass as two charts (never a dual axis — they share kg but differ greatly in scale). */
export function MassCharts({ rows }: { rows: CompRow[] }) {
  const t = useT();
  const fmt = useFmt();
  const data = rows
    .filter((r) => r.leanMassKg != null && r.fatMassKg != null)
    .map((r) => ({ date: r.date, lean: toDisplayWeight(r.leanMassKg!, fmt.units), fat: toDisplayWeight(r.fatMassKg!, fmt.units) }));
  if (data.length < 2) return null;
  const common = {
    formatValue: (v: number) => `${fmt.number(v, 1)} ${fmt.weightUnit}`,
    formatAxis: (v: number) => fmt.number(v, 0),
    formatTick: (d: string) => fmt.date(d, "dayMonth"),
    formatTooltipDate: (d: string) => fmt.date(d, "medium"),
    height: 180,
  };
  return (
    <ChartCard
      title={t.analytics.leanFatChart}
      subtitle={t.body.calculatedFromWeight}
      table={{ columns: [t.common.date, t.body.leanMass, t.body.fatMass], rows: [...data].reverse().map((r) => [fmt.date(r.date), fmt.number(r.lean, 1), fmt.number(r.fat, 1)]) }}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <div className="mb-2 text-xs font-medium text-fg-2">{t.body.leanMass}</div>
          <TimeSeriesChart ariaLabel={t.body.leanMass} data={data} series={[{ kind: "line", key: "lean", label: t.body.leanMass, color: "--series-2", dots: true }]} {...common} />
        </div>
        <div>
          <div className="mb-2 text-xs font-medium text-fg-2">{t.body.fatMass}</div>
          <TimeSeriesChart ariaLabel={t.body.fatMass} data={data} series={[{ kind: "line", key: "fat", label: t.body.fatMass, color: "--series-4", dots: true }]} {...common} />
        </div>
      </div>
    </ChartCard>
  );
}

const COL: Record<MeasurementSite, string> = {
  waist: "waistCm",
  chest: "chestCm",
  neck: "neckCm",
  shoulders: "shouldersCm",
  leftArm: "leftArmCm",
  rightArm: "rightArmCm",
  hips: "hipsCm",
  leftThigh: "leftThighCm",
  rightThigh: "rightThighCm",
  calf: "calfCm",
};

export function MeasurementChart({ rows }: { rows: Record<string, unknown>[] }) {
  const t = useT();
  const fmt = useFmt();
  const available = MEASUREMENT_SITES.filter((s) => rows.some((r) => r[COL[s]] != null));
  const [site, setSite] = React.useState<MeasurementSite>(available[0] ?? "waist");
  const data = rows
    .filter((r) => r[COL[site]] != null)
    .map((r) => ({ date: r.date as string, v: toDisplayLength(r[COL[site]] as number, fmt.units) }));
  return (
    <ChartCard
      title={t.analytics.measurementsChart}
      action={
        <Select value={site} onChange={(e) => setSite(e.target.value as MeasurementSite)} aria-label={t.analytics.pickSite} className="w-40 [&_select]:h-8 [&_select]:text-[13px]">
          {available.map((s) => (
            <option key={s} value={s}>
              {t.enums.site[s]}
            </option>
          ))}
        </Select>
      }
      table={{ columns: [t.common.date, t.enums.site[site]], rows: [...data].reverse().map((r) => [fmt.date(r.date), `${fmt.number(r.v, 1)} ${fmt.lengthUnit}`]) }}
    >
      <TimeSeriesChart
        ariaLabel={t.enums.site[site]}
        data={data}
        series={[{ kind: "line", key: "v", label: t.enums.site[site], color: "--series-1", dots: true }]}
        formatValue={(v) => `${fmt.number(v, 1)} ${fmt.lengthUnit}`}
        formatAxis={(v) => fmt.number(v, 0)}
        formatTick={(d) => fmt.date(d, "dayMonth")}
        formatTooltipDate={(d) => fmt.date(d, "medium")}
        height={240}
      />
    </ChartCard>
  );
}

export { COL as MEASUREMENT_COLUMNS };
