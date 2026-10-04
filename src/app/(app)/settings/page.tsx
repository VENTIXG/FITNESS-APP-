import type { Metadata } from "next";
import Link from "next/link";
import { Bell, ChevronRight, Database, Dumbbell, Footprints, LayoutDashboard, Plug, Shield, SlidersHorizontal, User, Utensils } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { getT, getUserContext } from "@/server/context";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).settings.title };
}

const SETTINGS_SECTIONS = [
  { key: "profile", icon: User },
  { key: "preferences", icon: SlidersHorizontal },
  { key: "nutrition", icon: Utensils },
  { key: "activity", icon: Footprints },
  { key: "training", icon: Dumbbell },
  { key: "dashboard", icon: LayoutDashboard },
  { key: "notifications", icon: Bell },
  { key: "integrations", icon: Plug },
  { key: "data", icon: Database },
  { key: "account", icon: Shield },
] as const;

export default async function SettingsPage() {
  const { t, email } = await getUserContext();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t.settings.title} subtitle={email} />
      <Card className="p-0">
        <ul className="divide-y divide-border">
          {SETTINGS_SECTIONS.map(({ key, icon: Icon }) => (
            <li key={key}>
              <Link href={`/settings/${key}`} className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-surface-2 sm:px-5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-fg-2" aria-hidden>
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{t.settings.sections[key]}</span>
                  <span className="block truncate text-xs text-fg-3">{t.settings.descriptions[key]}</span>
                </span>
                <ChevronRight className="size-4 text-fg-3" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
