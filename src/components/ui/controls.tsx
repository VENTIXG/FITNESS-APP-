"use client";

import { Check, ChevronDown, Minus, Plus } from "lucide-react";
import { Checkbox as CheckboxPrimitive, Switch as SwitchPrimitive } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";
import { inputClass } from "./input";

export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "relative inline-flex h-[26px] w-[44px] shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors",
        "bg-surface-3 data-[state=checked]:bg-accent",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-[22px] translate-x-[1px] rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ease-out data-[state=checked]:translate-x-[19px]" />
    </SwitchPrimitive.Root>
  );
}

/** A row with a label/description and a switch — the standard settings toggle. */
export function SwitchRow({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  id,
}: {
  label: React.ReactNode;
  description?: React.ReactNode;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  id?: string;
}) {
  const autoId = React.useId();
  const switchId = id ?? autoId;
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <label htmlFor={switchId} className="min-w-0 cursor-pointer">
        <span className="block text-sm font-medium text-fg">{label}</span>
        {description && <span className="mt-0.5 block text-[13px] text-fg-3">{description}</span>}
      </label>
      <Switch id={switchId} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}

export function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "peer flex size-5 shrink-0 items-center justify-center rounded-md border border-border-strong bg-surface transition-colors",
        "data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=checked]:text-accent-fg",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        <Check className="size-3.5" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

type SegmentedOption<T extends string> = { value: T; label: React.ReactNode; icon?: React.ReactNode };

/** iOS-style segmented control (radio group semantics). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = "md",
  ariaLabel,
  block,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly SegmentedOption<T>[];
  className?: string;
  size?: "sm" | "md";
  ariaLabel?: string;
  block?: boolean;
}) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = (idx + (e.key === "ArrowRight" ? 1 : -1) + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("inline-flex items-center gap-0.5 rounded-xl bg-surface-2 p-1", block && "flex w-full", className)}
    >
      {options.map((o, idx) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[idx] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onKeyDown={(e) => onKeyDown(e, idx)}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition-all duration-150",
              "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring [&_svg]:size-4",
              size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-[13px]",
              block && "flex-1",
              active ? "bg-surface text-fg shadow-sm dark:bg-surface-3" : "text-fg-3 hover:text-fg",
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Native select (best mobile UX) with consistent styling. */
export function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className={cn("relative", className)}>
      <select className={cn(inputClass, "cursor-pointer appearance-none pr-10")} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-3" aria-hidden />
    </div>
  );
}

/** Parses user-typed decimals in either locale style ("84,5" or "84.5"). */
export function parseDecimal(raw: string): number | null {
  const s = raw.trim().replace(/\s/g, "");
  if (!s) return null;
  // If both separators exist, the last one is the decimal separator.
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let normalized = s;
  if (lastComma > -1 && lastDot > -1) {
    normalized = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma > -1) {
    normalized = s.replace(",", ".");
  }
  if (!/^-?\d*\.?\d*$/.test(normalized) || normalized === "-" || normalized === ".") return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** Formats a number for an editable field (no grouping, locale decimal separator). */
export function formatForInput(value: number | null | undefined, decimals: number, decimalSep = "."): string {
  if (value == null || !Number.isFinite(value)) return "";
  const rounded = Math.round(value * 10 ** decimals) / 10 ** decimals;
  return String(rounded).replace(".", decimalSep);
}

type NumberInputProps = Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> & {
  value: string;
  onValueChange: (raw: string) => void;
  /** Integer-only keyboard. */
  integer?: boolean;
  suffix?: React.ReactNode;
  step?: number;
  min?: number;
  max?: number;
  /** Show −/+ stepper buttons. */
  stepper?: boolean;
  inputClassName?: string;
};

/**
 * Text input with a numeric keyboard (inputMode) that accepts both decimal
 * separators. Keeps the raw string so users can type freely; parse with parseDecimal.
 */
export function NumberInput({
  value,
  onValueChange,
  integer,
  suffix,
  step = 1,
  min,
  max,
  stepper,
  className,
  inputClassName,
  ...props
}: NumberInputProps) {
  const bump = (dir: 1 | -1) => {
    const current = parseDecimal(value) ?? 0;
    let next = Math.round((current + dir * step) * 1000) / 1000;
    if (min != null) next = Math.max(min, next);
    if (max != null) next = Math.min(max, next);
    onValueChange(String(next));
  };
  const input = (
    <div className={cn("relative min-w-0 flex-1", !stepper && className)}>
      <input
        type="text"
        inputMode={integer ? "numeric" : "decimal"}
        autoComplete="off"
        enterKeyHint="done"
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "" || /^-?[\d.,\s]*$/.test(v)) onValueChange(v);
        }}
        className={cn(inputClass, "tabular", suffix && "pr-12", stepper && "text-center", inputClassName)}
        {...props}
      />
      {suffix && (
        <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm text-fg-3">{suffix}</span>
      )}
    </div>
  );
  if (!stepper) return input;
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <button
        type="button"
        onClick={() => bump(-1)}
        className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-2 text-fg-2 transition hover:bg-surface-3 active:scale-95"
        aria-label="−"
      >
        <Minus className="size-4" />
      </button>
      {input}
      <button
        type="button"
        onClick={() => bump(1)}
        className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-2 text-fg-2 transition hover:bg-surface-3 active:scale-95"
        aria-label="+"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}

/** Pill toggle chips for multi-select (tags, weekdays). */
export function ChipToggle({
  selected,
  onClick,
  children,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-all",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        selected ? "border-accent bg-accent-soft text-fg" : "border-border bg-surface-2 text-fg-2 hover:border-border-strong",
        className,
      )}
    >
      {children}
    </button>
  );
}
