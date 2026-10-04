import Link from "next/link";
import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      data-slot="card"
      className={cn("rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-5", className)}
      {...props}
    />
  );
}

type CardHeaderProps = {
  title: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  href?: string;
  subtitle?: React.ReactNode;
  className?: string;
};

/** Compact card title row: icon + label on the left, optional action/link on the right. */
export function CardHeader({ title, icon, action, href, subtitle, className }: CardHeaderProps) {
  const titleEl = (
    <div className="flex min-w-0 items-center gap-2">
      {icon && <span className="flex size-6 shrink-0 items-center justify-center text-fg-3 [&_svg]:size-[18px]">{icon}</span>}
      <div className="min-w-0">
        <h2 className="truncate text-sm font-medium text-fg-2">{title}</h2>
        {subtitle && <p className="truncate text-xs text-fg-3">{subtitle}</p>}
      </div>
    </div>
  );
  return (
    <div className={cn("mb-3 flex items-center justify-between gap-3", className)}>
      {href ? (
        <Link href={href} className="group -m-1 flex min-w-0 items-center gap-1 rounded-lg p-1 hover:text-fg">
          {titleEl}
          <ChevronRight className="size-4 shrink-0 text-fg-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      ) : (
        titleEl
      )}
      {action && <div className="flex shrink-0 items-center gap-1">{action}</div>}
    </div>
  );
}

export function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mt-4 flex items-center gap-2 border-t border-border pt-3", className)} {...props} />;
}

/** Large metric value with unit — proportional figures (no tabular nums) per the dataviz spec. */
export function Metric({
  value,
  unit,
  className,
  size = "lg",
}: {
  value: React.ReactNode;
  unit?: React.ReactNode;
  className?: string;
  size?: "md" | "lg" | "xl";
}) {
  return (
    <div className={cn("flex items-baseline gap-1.5", className)}>
      <span
        className={cn(
          "font-semibold tracking-tight text-fg",
          size === "md" && "text-xl",
          size === "lg" && "text-[28px] leading-none",
          size === "xl" && "text-[40px] leading-none sm:text-5xl",
        )}
      >
        {value}
      </span>
      {unit && <span className="text-sm font-medium text-fg-3">{unit}</span>}
    </div>
  );
}
