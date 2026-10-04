import * as React from "react";
import { cn } from "@/lib/utils";

export const inputClass = cn(
  "h-11 w-full min-w-0 rounded-xl border border-border bg-surface-2/70 px-3.5 text-[15px] text-fg",
  "placeholder:text-fg-3 outline-none transition-[border-color,box-shadow,background-color] duration-150",
  "hover:border-border-strong focus:border-accent/70 focus:bg-surface focus:ring-4 focus:ring-accent/15",
  "disabled:cursor-not-allowed disabled:opacity-50",
  "aria-[invalid=true]:border-critical aria-[invalid=true]:focus:ring-critical/15",
);

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input data-slot="input" className={cn(inputClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn(inputClass, "h-auto min-h-24 resize-y py-3 leading-relaxed", className)} {...props} />;
}

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label data-slot="label" className={cn("text-[13px] font-medium text-fg-2", className)} {...props} />;
}

type FieldProps = {
  label?: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
  optional?: string;
  trailing?: React.ReactNode;
};

/** Label + control + hint/error, with consistent spacing. */
export function Field({ label, htmlFor, hint, error, className, children, optional, trailing }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {(label || trailing) && (
        <div className="flex items-center justify-between gap-2">
          {label && (
            <Label htmlFor={htmlFor}>
              {label}
              {optional && <span className="ml-1.5 font-normal text-fg-3">· {optional}</span>}
            </Label>
          )}
          {trailing}
        </div>
      )}
      {children}
      {error ? (
        <p className="text-[13px] text-critical-text" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[13px] text-fg-3">{hint}</p>
      ) : null}
    </div>
  );
}

/** Input with a fixed suffix (unit) inside the field. */
export function InputWithSuffix({ suffix, className, ...props }: React.ComponentProps<"input"> & { suffix: React.ReactNode }) {
  return (
    <div className={cn("relative", className)}>
      <Input {...props} className="pr-14" />
      <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm text-fg-3">{suffix}</span>
    </div>
  );
}
