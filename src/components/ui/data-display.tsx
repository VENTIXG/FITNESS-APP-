import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Meter: a single ratio against a limit. The track is a lighter step of the fill
 * (per the dataviz spec), and overflow beyond the target switches to the warning
 * colour with an explicit marker — never colour alone.
 */
export function Meter({
  value,
  max,
  color = "var(--accent)",
  className,
  height = 8,
  showOverflow = true,
  label,
}: {
  value: number;
  max: number;
  color?: string;
  className?: string;
  height?: number;
  showOverflow?: boolean;
  label?: string;
}) {
  const ratio = max > 0 ? value / max : 0;
  const fill = Math.min(1, Math.max(0, ratio));
  const over = showOverflow && ratio > 1;
  return (
    <div
      className={cn("relative w-full overflow-hidden rounded-full", className)}
      style={{ height, background: `color-mix(in oklab, ${color} 16%, var(--chart-track))` }}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      aria-label={label}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-out"
        style={{ width: `${fill * 100}%`, background: over ? "var(--warn)" : color }}
      />
      {over && <div className="absolute inset-y-0 right-0 w-0.5 bg-surface" aria-hidden />}
    </div>
  );
}

/** Circular progress (score, goal %). */
export function ProgressRing({
  value,
  size = 64,
  stroke = 6,
  color = "var(--accent)",
  trackColor,
  children,
  className,
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
  children?: React.ReactNode;
  className?: string;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.min(1, Math.max(0, value));
  return (
    <div className={cn("relative inline-flex shrink-0 items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" role="img" aria-label={label}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          style={{ stroke: trackColor ?? `color-mix(in oklab, ${color} 16%, var(--chart-track))` }}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ stroke: color, transition: "stroke-dashoffset 600ms cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
      </svg>
      {children && <div className="absolute inset-0 flex items-center justify-center">{children}</div>}
    </div>
  );
}

export type DeltaSentiment = "good" | "bad" | "neutral";

/** Signed change with an arrow icon; colour carries sentiment, the arrow + sign carry direction. */
export function Delta({
  value,
  formatted,
  sentiment = "neutral",
  className,
  suffix,
}: {
  value: number;
  formatted: React.ReactNode;
  sentiment?: DeltaSentiment;
  className?: string;
  suffix?: React.ReactNode;
}) {
  const Icon = Math.abs(value) < 1e-9 ? ArrowRight : value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[13px] font-medium",
        sentiment === "good" && "text-good-text",
        sentiment === "bad" && "text-critical-text",
        sentiment === "neutral" && "text-fg-2",
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {formatted}
      {suffix && <span className="ml-1 font-normal text-fg-3">{suffix}</span>}
    </span>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "accent" | "good" | "warn" | "critical" | "outline";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-xs font-medium [&_svg]:size-3.5",
        tone === "neutral" && "bg-surface-2 text-fg-2",
        tone === "accent" && "bg-accent-soft text-fg",
        tone === "good" && "bg-good/12 text-good-text",
        tone === "warn" && "bg-warn/15 text-warn-text",
        tone === "critical" && "bg-critical/12 text-critical-text",
        tone === "outline" && "border border-border text-fg-2",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-surface-2", className)} aria-hidden />;
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
  compact,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  body?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center text-center", compact ? "px-4 py-6" : "px-6 py-12", className)}>
      {icon && (
        <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-surface-2 text-fg-3 [&_svg]:size-6">{icon}</div>
      )}
      <h3 className="text-[15px] font-semibold text-fg">{title}</h3>
      {body && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-fg-3">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Small labelled value used in stat grids. */
export function Stat({
  label,
  value,
  unit,
  sub,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  unit?: React.ReactNode;
  sub?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="truncate text-xs font-medium text-fg-3">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="truncate text-lg font-semibold tracking-tight text-fg">{value}</span>
        {unit && <span className="text-xs text-fg-3">{unit}</span>}
      </div>
      {sub && <div className="mt-0.5 truncate text-xs">{sub}</div>}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-border", className)} role="separator" />;
}

/** Colored dot used as a legend key / series identity mark. */
export function Dot({ color, className }: { color: string; className?: string }) {
  return <span className={cn("inline-block size-2 shrink-0 rounded-full", className)} style={{ background: color }} aria-hidden />;
}
