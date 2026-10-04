"use client";

import { usePathname } from "next/navigation";
import { LinkTabs } from "./page";

/** Route tabs that highlight the deepest matching href. */
export function SectionTabs({ tabs }: { tabs: { href: string; label: string }[] }) {
  const pathname = usePathname();
  const active = [...tabs].sort((a, b) => b.href.length - a.href.length).find((t) => pathname === t.href || pathname.startsWith(`${t.href}/`));
  return <LinkTabs tabs={tabs.map((t) => ({ ...t, key: t.href }))} active={active?.href ?? tabs[0].href} />;
}
