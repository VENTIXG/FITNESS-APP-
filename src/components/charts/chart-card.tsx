"use client";

import * as React from "react";
import { ChartColumnBig, Table2 } from "lucide-react";
import { useT } from "@/components/providers/i18n-provider";
import { cn } from "@/lib/utils";

/**
 * Card wrapper with a chart/table toggle — every chart has a table twin so values
 * never depend on hover (accessibility requirement).
 */
export function ChartCard({
  title,
  subtitle,
  action,
  table,
  children,
  className,
  footer,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  table?: { columns: string[]; rows: (string | number)[][] };
  children: React.ReactNode;
  className?: string;
  footer?: React.ReactNode;
}) {
  const t = useT();
  const [view, setView] = React.useState<"chart" | "table">("chart");
  return (
    <section className={cn("rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-5", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight text-fg">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[13px] text-fg-3">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {action}
          {table && (
            <div className="flex rounded-lg bg-surface-2 p-0.5" role="group" aria-label={`${t.common.chart} / ${t.common.table}`}>
              <button
                type="button"
                onClick={() => setView("chart")}
                aria-pressed={view === "chart"}
                aria-label={t.common.chart}
                className={cn("flex size-7 items-center justify-center rounded-md transition", view === "chart" ? "bg-surface text-fg shadow-sm dark:bg-surface-3" : "text-fg-3")}
              >
                <ChartColumnBig className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setView("table")}
                aria-pressed={view === "table"}
                aria-label={t.common.table}
                className={cn("flex size-7 items-center justify-center rounded-md transition", view === "table" ? "bg-surface text-fg shadow-sm dark:bg-surface-3" : "text-fg-3")}
              >
                <Table2 className="size-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
      {view === "chart" || !table ? (
        children
      ) : (
        <div className="max-h-80 overflow-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface-2 text-left text-xs text-fg-3">
              <tr>
                {table.columns.map((c) => (
                  <th key={c} scope="col" className="px-3 py-2 font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {table.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((cell, j) => (
                    <td key={j} className={cn("px-3 py-2 tabular", j === 0 ? "text-fg-2" : "text-fg")}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {footer && <div className="mt-4">{footer}</div>}
    </section>
  );
}

export const RANGES = ["7d", "30d", "3m", "6m", "1y", "all"] as const;
export type RangeKey = (typeof RANGES)[number];
export const RANGE_DAYS: Record<RangeKey, number | null> = { "7d": 7, "30d": 30, "3m": 91, "6m": 182, "1y": 365, all: null };
export const RANGE_LABEL: Record<RangeKey, string> = { "7d": "7D", "30d": "30D", "3m": "3M", "6m": "6M", "1y": "1Y", all: "ALL" };

export function RangeTabs({ value, onChange, options = RANGES }: { value: RangeKey; onChange: (r: RangeKey) => void; options?: readonly RangeKey[] }) {
  return (
    <div className="inline-flex rounded-xl bg-surface-2 p-1" role="radiogroup">
      {options.map((r) => (
        <button
          key={r}
          type="button"
          role="radio"
          aria-checked={value === r}
          onClick={() => onChange(r)}
          className={cn(
            "h-7 rounded-lg px-2.5 text-xs font-semibold tracking-wide transition",
            value === r ? "bg-surface text-fg shadow-sm dark:bg-surface-3" : "text-fg-3 hover:text-fg",
          )}
        >
          {RANGE_LABEL[r]}
        </button>
      ))}
    </div>
  );
}
