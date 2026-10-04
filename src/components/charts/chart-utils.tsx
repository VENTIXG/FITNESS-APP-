"use client";

import { useTheme } from "next-themes";
import * as React from "react";
import { cn, noopSubscribe } from "@/lib/utils";

/** Resolves CSS custom properties to concrete colours (re-read when the theme changes). */
export function useCssColors<K extends string>(vars: Record<K, string>): Record<K, string> {
  const { resolvedTheme } = useTheme();
  const key = JSON.stringify(vars);
  const [colors, setColors] = React.useState<Record<K, string>>(() => {
    const out = {} as Record<K, string>;
    for (const k of Object.keys(vars) as K[]) out[k] = "#888";
    return out;
  });
  React.useEffect(() => {
    const style = getComputedStyle(document.documentElement);
    const parsed = JSON.parse(key) as Record<K, string>;
    const out = {} as Record<K, string>;
    for (const k of Object.keys(parsed) as K[]) {
      const v = parsed[k];
      out[k] = v.startsWith("--") ? style.getPropertyValue(v).trim() || "#888" : v;
    }
    // Colours live in CSS custom properties, so they can only be read after mount.
    setColors(out); // eslint-disable-line react-hooks/set-state-in-effect
  }, [key, resolvedTheme]);
  return colors;
}

export const CHROME = {
  grid: "--chart-grid",
  axis: "--chart-axis",
  muted: "--chart-muted",
  text: "--fg-3",
  surface: "--surface",
  fg: "--fg",
} as const;

export function useMounted() {
  return React.useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/** Fixed-height frame that includes the axis band (no nested scroll) and avoids SSR size warnings. */
export function ChartFrame({ height, children, className }: { height: number; children: React.ReactNode; className?: string }) {
  const mounted = useMounted();
  return (
    <div className={cn("w-full", className)} style={{ height }}>
      {mounted ? children : <div className="h-full w-full animate-pulse rounded-xl bg-surface-2/50" aria-hidden />}
    </div>
  );
}

export type TooltipRow = { label: string; value: string; color?: string; dashed?: boolean };

/** Tooltip body: values lead (strong), labels follow; short line keys, not boxes. */
export function TooltipCard({ title, rows }: { title: string; rows: TooltipRow[] }) {
  if (!rows.length) return null;
  return (
    <div className="min-w-36 rounded-xl border border-border bg-surface/95 px-3 py-2.5 text-xs shadow-pop backdrop-blur">
      <div className="mb-1.5 font-medium text-fg-3">{title}</div>
      <div className="flex flex-col gap-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-2">
            {r.color && (
              <span
                className="h-0.5 w-3 shrink-0 rounded-full"
                style={r.dashed ? { backgroundImage: `linear-gradient(90deg, ${r.color} 60%, transparent 0)`, backgroundSize: "4px 2px" } : { background: r.color }}
                aria-hidden
              />
            )}
            <span className="font-semibold text-fg tabular">{r.value}</span>
            <span className="text-fg-3">{r.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const axisTick = (color: string) => ({ fill: color, fontSize: 11, fontFamily: "inherit" });

/** "Nice" y-axis domain with padding, so lines don't hug the frame. */
export function paddedDomain(values: readonly number[], pad = 0.08, minSpan = 1): [number, number] | ["auto", "auto"] {
  const finite = values.filter((v) => Number.isFinite(v));
  if (!finite.length) return ["auto", "auto"];
  let lo = Math.min(...finite);
  let hi = Math.max(...finite);
  if (hi - lo < minSpan) {
    const mid = (hi + lo) / 2;
    lo = mid - minSpan / 2;
    hi = mid + minSpan / 2;
  }
  const span = hi - lo;
  return [Math.floor((lo - span * pad) * 10) / 10, Math.ceil((hi + span * pad) * 10) / 10];
}

export function Legend({ items, className }: { items: { label: string; color: string; kind?: "line" | "dot" | "bar" | "dashed" }[]; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-fg-2", className)}>
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          {it.kind === "dot" ? (
            <span className="size-2 rounded-full" style={{ background: it.color }} />
          ) : it.kind === "bar" ? (
            <span className="size-2.5 rounded-[3px]" style={{ background: it.color }} />
          ) : it.kind === "dashed" ? (
            <span className="h-0.5 w-3.5" style={{ backgroundImage: `linear-gradient(90deg, ${it.color} 60%, transparent 0)`, backgroundSize: "5px 2px" }} />
          ) : (
            <span className="h-0.5 w-3.5 rounded-full" style={{ background: it.color }} />
          )}
          {it.label}
        </span>
      ))}
    </div>
  );
}
