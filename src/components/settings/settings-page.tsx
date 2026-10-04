import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getUserContext } from "@/server/context";

/** Common frame for a settings sub-page: back link + title + description. */
export async function SettingsFrame({ section, children }: { section: keyof Awaited<ReturnType<typeof getUserContext>>["t"]["settings"]["sections"]; children: React.ReactNode }) {
  const { t } = await getUserContext();
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/settings" className="-ml-1.5 inline-flex items-center gap-0.5 text-sm font-medium text-fg-3 hover:text-fg">
        <ChevronLeft className="size-5" aria-hidden />
        {t.settings.title}
      </Link>
      <h1 className="mt-2 text-[28px] leading-tight font-semibold tracking-tight">{t.settings.sections[section]}</h1>
      <p className="mt-1 mb-5 text-sm text-fg-3">{t.settings.descriptions[section]}</p>
      <div className="space-y-4">{children}</div>
    </div>
  );
}
