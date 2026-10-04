import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

/** Page title row. On phones the title is large (iOS style); actions sit on the right. */
export function PageHeader({
  title,
  subtitle,
  actions,
  back,
  backLabel,
  className,
  eyebrow,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  back?: string;
  backLabel?: string;
  className?: string;
  eyebrow?: React.ReactNode;
}) {
  return (
    <header className={cn("mb-5 flex flex-col gap-3 sm:mb-7", className)}>
      {back && (
        <Link
          href={back}
          className="-ml-1.5 inline-flex w-fit items-center gap-0.5 rounded-lg py-1 pr-2 pl-0.5 text-sm font-medium text-fg-3 transition hover:text-fg"
        >
          <ChevronLeft className="size-5" aria-hidden />
          {backLabel}
        </Link>
      )}
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <div className="mb-1 text-[13px] font-medium text-fg-3">{eyebrow}</div>}
          <h1 className="truncate text-[28px] leading-tight font-semibold tracking-tight text-fg sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-fg-3">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/** Section heading inside a page. */
export function SectionTitle({ children, action, className }: { children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-3 flex items-center justify-between gap-3", className)}>
      <h2 className="text-[15px] font-semibold tracking-tight text-fg">{children}</h2>
      {action}
    </div>
  );
}

/** Route-based tab bar (each tab is a link). */
export function LinkTabs({
  tabs,
  active,
  className,
}: {
  tabs: readonly { href: string; label: React.ReactNode; key: string }[];
  active: string;
  className?: string;
}) {
  return (
    <nav className={cn("no-scrollbar -mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0", className)}>
      <div className="inline-flex min-w-full gap-1 rounded-xl bg-surface-2 p-1 sm:min-w-0">
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "inline-flex h-8 flex-1 items-center justify-center whitespace-nowrap rounded-lg px-3 text-[13px] font-medium transition-all sm:flex-none",
                isActive ? "bg-surface text-fg shadow-sm dark:bg-surface-3" : "text-fg-3 hover:text-fg",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** List container with hairline separators (mobile-friendly alternative to tables). */
export function List({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul className={cn("divide-y divide-border", className)} {...props} />;
}
