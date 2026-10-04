import { APP_NAME } from "@/lib/config";
import { cn } from "@/lib/utils";

/** Brand mark: three ascending bars (progress) in a rounded tile. */
export function LogoMark({ className, size = 32 }: { className?: string; size?: number }) {
  const bar = { fill: "var(--accent-fg)" } as const;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={cn("shrink-0", className)} aria-hidden>
      <rect width="32" height="32" rx="9" style={{ fill: "var(--accent)" }} />
      <rect x="7.5" y="17" width="4.5" height="8" rx="1.6" style={{ ...bar, opacity: 0.55 }} />
      <rect x="13.75" y="12" width="4.5" height="13" rx="1.6" style={{ ...bar, opacity: 0.8 }} />
      <rect x="20" y="7" width="4.5" height="18" rx="1.6" style={bar} />
    </svg>
  );
}

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      {!compact && <span className="text-[17px] font-semibold tracking-[0.08em] text-fg">{APP_NAME}</span>}
    </span>
  );
}
