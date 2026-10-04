import Link from "next/link";
import { addDays, startOfWeek, type ISODate } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const ANALYTICS_RANGES = [30, 90, 180, 365] as const;
const LABEL: Record<number, string> = { 30: "30D", 90: "3M", 180: "6M", 365: "1Y" };

export function parseRange(sp: Record<string, string | string[] | undefined>, fallback = 90): number {
  const n = Number(sp.range);
  return (ANALYTICS_RANGES as readonly number[]).includes(n) ? n : fallback;
}

export function rangeStart(today: ISODate, days: number) {
  return addDays(today, -(days - 1));
}

/** Week starts covering [start, today]. */
export function weekStarts(start: ISODate, today: ISODate, weekStartsOn: number) {
  const out: ISODate[] = [];
  for (let d = startOfWeek(start, weekStartsOn); d <= today; d = addDays(d, 7)) out.push(d);
  return out;
}

export function RangeLinks({ base, value, label }: { base: string; value: number; label: string }) {
  return (
    <nav aria-label={label} className="mb-4 inline-flex gap-0.5 rounded-xl bg-surface-2 p-1">
      {ANALYTICS_RANGES.map((r) => (
        <Link
          key={r}
          href={`${base}?range=${r}`}
          scroll={false}
          aria-current={r === value ? "true" : undefined}
          className={cn(
            "inline-flex h-7 items-center rounded-lg px-3 text-xs font-semibold transition",
            r === value ? "bg-surface text-fg shadow-sm dark:bg-surface-3" : "text-fg-3 hover:text-fg",
          )}
        >
          {LABEL[r]}
        </Link>
      ))}
    </nav>
  );
}
