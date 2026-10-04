"use client";

import * as React from "react";
import { useCssColors } from "./chart-utils";

/** Lightweight SVG sparkline (no axes). Accent stroke for the series, end dot with surface ring. */
export function Sparkline({
  values,
  height = 36,
  color = "--series-1",
  className,
  ariaLabel,
}: {
  values: readonly (number | null)[];
  height?: number;
  color?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const c = useCssColors({ line: color, surface: "--surface" });
  const gid = React.useId().replace(/:/g, "");
  const pts = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v != null && Number.isFinite(p.v));
  const width = 120;
  if (pts.length < 2) return <div style={{ height }} className={className} aria-hidden />;
  const min = Math.min(...pts.map((p) => p.v));
  const max = Math.max(...pts.map((p) => p.v));
  const span = max - min || 1;
  const n = values.length - 1 || 1;
  const x = (i: number) => 3 + (i / n) * (width - 6);
  const y = (v: number) => 3 + (1 - (v - min) / span) * (height - 6);
  const d = pts.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const area = `${d} L${x(pts[pts.length - 1].i).toFixed(1)},${height} L${x(pts[0].i).toFixed(1)},${height} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className={className} style={{ height, width: "100%" }} role="img" aria-label={ariaLabel}>
      <defs>
        <linearGradient id={`sg-${gid}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={c.line} stopOpacity={0.18} />
          <stop offset="100%" stopColor={c.line} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sg-${gid})`} />
      <path d={d} fill="none" stroke={c.line} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={x(last.i)} cy={y(last.v)} r={3.2} fill={c.line} stroke={c.surface} strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Tiny column chart for 7-day trends (one hue; optional target line). */
export function MiniBars({
  values,
  target,
  height = 44,
  color = "--series-1",
  labels,
  ariaLabel,
}: {
  values: readonly (number | null)[];
  target?: number | null;
  height?: number;
  color?: string;
  labels?: readonly string[];
  ariaLabel?: string;
}) {
  const c = useCssColors({ bar: color, track: "--chart-track", axis: "--chart-axis" });
  const max = Math.max(target ?? 0, ...values.map((v) => v ?? 0), 1);
  return (
    <div className="w-full" role="img" aria-label={ariaLabel}>
      <div className="relative flex items-end gap-1" style={{ height }}>
        {target != null && target > 0 && (
          <div className="absolute inset-x-0 border-t border-dashed" style={{ bottom: `${(target / max) * 100}%`, borderColor: c.axis }} aria-hidden />
        )}
        {values.map((v, i) => (
          <div key={i} className="flex h-full flex-1 items-end">
            <div
              className="w-full rounded-t-[4px]"
              style={{ height: v ? `${Math.max(4, (v / max) * 100)}%` : "3px", background: v ? c.bar : c.track }}
            />
          </div>
        ))}
      </div>
      {labels && (
        <div className="mt-1 flex gap-1">
          {labels.map((l, i) => (
            <span key={i} className="flex-1 text-center text-[10px] text-fg-3">
              {l}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
