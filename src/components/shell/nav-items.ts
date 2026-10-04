import {
  CalendarDays,
  ChartColumnBig,
  ChartSpline,
  Dumbbell,
  Ellipsis,
  FileText,
  HeartPulse,
  House,
  ListChecks,
  Settings,
  Sparkles,
  Target,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import type { Dictionary } from "@/lib/i18n";

export type NavKey = keyof Dictionary["nav"];

export type NavItem = { key: NavKey; href: string; icon: LucideIcon };

export const SIDEBAR_ITEMS: NavItem[] = [
  { key: "dashboard", href: "/", icon: House },
  { key: "nutrition", href: "/nutrition", icon: UtensilsCrossed },
  { key: "training", href: "/training", icon: Dumbbell },
  { key: "cardio", href: "/cardio", icon: HeartPulse },
  { key: "progress", href: "/progress", icon: ChartSpline },
  { key: "calendar", href: "/calendar", icon: CalendarDays },
  { key: "analytics", href: "/analytics", icon: ChartColumnBig },
  { key: "reports", href: "/reports", icon: FileText },
  { key: "goals", href: "/goals", icon: Target },
  { key: "habits", href: "/habits", icon: ListChecks },
  { key: "coach", href: "/coach", icon: Sparkles },
  { key: "settings", href: "/settings", icon: Settings },
];

export const BOTTOM_TABS: NavItem[] = [
  { key: "home", href: "/", icon: House },
  { key: "food", href: "/nutrition", icon: UtensilsCrossed },
  { key: "workout", href: "/training", icon: Dumbbell },
  { key: "progress", href: "/progress", icon: ChartSpline },
  { key: "more", href: "/more", icon: Ellipsis },
];

/** Whether `href` is the active section for `pathname`. */
export function isActive(href: string, pathname: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Bottom-tab "More" is active for every section that has no tab of its own. */
export function activeBottomTab(pathname: string): string {
  const direct = BOTTOM_TABS.find((t) => t.href !== "/more" && isActive(t.href, pathname));
  return direct?.href ?? "/more";
}
