"use client";

import * as React from "react";
import { Area, Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import { axisTick, ChartFrame, CHROME, Legend, paddedDomain, TooltipCard, useCssColors, type TooltipRow } from "./chart-utils";

export type SeriesSpec =
  | { kind: "line"; key: string; label: string; color: string; dashed?: boolean; dots?: boolean; connectNulls?: boolean }
  | { kind: "dots"; key: string; label: string; color: string }
  | { kind: "bar"; key: string; label: string; color: string; stackId?: string }
  | { kind: "band"; lowKey: string; highKey: string; label: string; color: string };

export type ChartRow = { date: string } & Record<string, number | string | null | undefined>;

type Props = {
  data: readonly ChartRow[];
  series: readonly SeriesSpec[];
  height?: number;
  formatValue: (v: number) => string;
  formatTick: (date: string) => string;
  formatTooltipDate: (date: string) => string;
  formatAxis?: (v: number) => string;
  yDomain?: [number, number] | "zero" | "auto";
  refLines?: readonly { y: number; label: string; color: string }[];
  showLegend?: boolean;
  ariaLabel: string;
};

/**
 * Date-indexed composed chart. Single y-axis only (no dual axes); solid hairline grid;
 * 2px lines; bars ≤ 24px with 4px rounded data-ends; crosshair tooltip listing every series.
 */
export function TimeSeriesChart({
  data,
  series,
  height = 240,
  formatValue,
  formatTick,
  formatTooltipDate,
  formatAxis,
  yDomain = "auto",
  refLines = [],
  showLegend,
  ariaLabel,
}: Props) {
  const colorVars = Object.fromEntries(series.map((s, i) => [`s${i}`, s.color]));
  const colors = useCssColors({ ...CHROME, ...colorVars } as Record<string, string>);
  const refColors = useCssColors(Object.fromEntries(refLines.map((r, i) => [`r${i}`, r.color])) as Record<string, string>);

  const domain = React.useMemo(() => {
    if (yDomain === "zero") return [0, "auto"] as [number, "auto"];
    if (Array.isArray(yDomain)) return yDomain;
    const vals: number[] = [];
    for (const row of data) {
      for (const s of series) {
        const keys = s.kind === "band" ? [s.lowKey, s.highKey] : [s.key];
        for (const k of keys) {
          const v = row[k];
          if (typeof v === "number") vals.push(v);
        }
      }
    }
    for (const r of refLines) vals.push(r.y);
    return paddedDomain(vals);
  }, [data, series, refLines, yDomain]);

  const hasBars = series.some((s) => s.kind === "bar");

  return (
    <div>
      <ChartFrame height={height}>
        <div role="img" aria-label={ariaLabel} className="h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data as ChartRow[]} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="22%">
              <CartesianGrid vertical={false} stroke={colors.grid} strokeWidth={1} />
              <XAxis
                dataKey="date"
                tickFormatter={formatTick}
                tick={axisTick(colors.text)}
                axisLine={{ stroke: colors.axis }}
                tickLine={false}
                minTickGap={28}
                interval="preserveStartEnd"
                padding={hasBars ? undefined : { left: 6, right: 6 }}
              />
              <YAxis
                domain={domain}
                tickFormatter={formatAxis ?? ((v: number) => formatValue(v))}
                tick={axisTick(colors.text)}
                axisLine={false}
                tickLine={false}
                width={48}
                tickCount={5}
                allowDecimals
              />
              <Tooltip
                cursor={hasBars ? { fill: colors.grid, opacity: 0.5 } : { stroke: colors.axis, strokeWidth: 1 }}
                isAnimationActive={false}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0]?.payload as ChartRow | undefined;
                  if (!row) return null;
                  const rows: TooltipRow[] = [];
                  series.forEach((s, i) => {
                    if (s.kind === "band") {
                      const lo = row[s.lowKey];
                      const hi = row[s.highKey];
                      if (typeof lo === "number" && typeof hi === "number") rows.push({ label: s.label, value: `${formatValue(lo)} – ${formatValue(hi)}`, color: colors[`s${i}`] });
                      return;
                    }
                    const v = row[s.key];
                    if (typeof v === "number") rows.push({ label: s.label, value: formatValue(v), color: colors[`s${i}`], dashed: s.kind === "line" && s.dashed });
                  });
                  return <TooltipCard title={formatTooltipDate(String(label))} rows={rows} />;
                }}
              />
              {refLines.map((r, i) => (
                <ReferenceLine key={r.label} y={r.y} stroke={refColors[`r${i}`]} strokeDasharray="5 4" strokeWidth={1.5} ifOverflow="extendDomain" />
              ))}
              {series.map((s, i) => {
                const color = colors[`s${i}`];
                switch (s.kind) {
                  case "band":
                    return (
                      <Area
                        key={i}
                        dataKey={(d: ChartRow) => (typeof d[s.lowKey] === "number" && typeof d[s.highKey] === "number" ? [d[s.lowKey], d[s.highKey]] : null)}
                        stroke="none"
                        fill={color}
                        fillOpacity={0.12}
                        isAnimationActive={false}
                        connectNulls
                        activeDot={false}
                      />
                    );
                  case "bar":
                    return <Bar key={i} dataKey={s.key} fill={color} stackId={s.stackId} maxBarSize={24} radius={s.stackId ? 0 : [4, 4, 0, 0]} isAnimationActive={false} />;
                  case "dots":
                    return <Scatter key={i} dataKey={s.key} fill={color} shape={(p: { cx?: number; cy?: number }) => (p.cx == null || p.cy == null ? <g /> : <circle cx={p.cx} cy={p.cy} r={3} fill={color} />)} isAnimationActive={false} />;
                  case "line":
                    return (
                      <Line
                        key={i}
                        type="monotone"
                        dataKey={s.key}
                        stroke={color}
                        strokeWidth={2}
                        strokeDasharray={s.dashed ? "6 5" : undefined}
                        dot={s.dots ? { r: 3, fill: color, stroke: colors.surface, strokeWidth: 2 } : false}
                        activeDot={{ r: 4.5, fill: color, stroke: colors.surface, strokeWidth: 2 }}
                        connectNulls={s.connectNulls ?? true}
                        isAnimationActive={false}
                      />
                    );
                }
              })}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </ChartFrame>
      {showLegend && (
        <Legend
          className="mt-3"
          items={series.map((s, i) => ({
            label: s.label,
            color: colors[`s${i}`],
            kind: s.kind === "dots" ? "dot" : s.kind === "bar" || s.kind === "band" ? "bar" : s.dashed ? "dashed" : "line",
          }))}
        />
      )}
    </div>
  );
}
