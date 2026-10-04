import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { SIDEBAR_ITEMS } from "@/components/shell/nav-items";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { getT, getUserContext } from "@/server/context";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).more.title };
}

const GROUPS = { track: ["cardio", "habits", "calendar", "goals"], insights: ["analytics", "reports", "coach"], app: ["settings"] } as const;

export default async function MorePage() {
  const { t } = await getUserContext();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t.more.title} />
      <div className="space-y-5">
        {(Object.keys(GROUPS) as (keyof typeof GROUPS)[]).map((g) => (
          <section key={g}>
            <h2 className="mb-2 px-1 text-xs font-semibold tracking-wide text-fg-3 uppercase">{t.more.sections[g]}</h2>
            <Card className="p-0">
              <ul className="divide-y divide-border">
                {GROUPS[g].map((key) => {
                  const item = SIDEBAR_ITEMS.find((i) => i.key === key)!;
                  const Icon = item.icon;
                  return (
                    <li key={key}>
                      <Link href={item.href} className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-2">
                        <Icon className="size-5 text-fg-2" aria-hidden />
                        <span className="flex-1 text-sm font-medium">{t.nav[key]}</span>
                        <ChevronRight className="size-4 text-fg-3" aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </section>
        ))}
      </div>
    </div>
  );
}
