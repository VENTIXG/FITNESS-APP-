import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus, Star, UtensilsCrossed } from "lucide-react";
import { MacroLine } from "@/components/nutrition/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/data-display";
import { SectionTitle } from "@/components/ui/page";
import { format } from "@/lib/i18n";
import { getT, getUserContext } from "@/server/context";
import { getPickerData } from "@/server/queries/nutrition";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).nutrition.meals.title };
}

export default async function MealsPage() {
  const ctx = await getUserContext();
  const { t, fmt, locale } = ctx;
  const tm = t.nutrition.meals;
  const { meals } = await getPickerData(ctx.userId);
  return (
    <div className="space-y-4">
      <SectionTitle
        action={
          <Button asChild variant="primary" size="sm">
            <Link href="/nutrition/meals/new">
              <Plus aria-hidden />
              {tm.new}
            </Link>
          </Button>
        }
      >
        {tm.title}
      </SectionTitle>
      {meals.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {meals.map((m) => (
            <Link key={m.id} href={`/nutrition/meals/${m.id}`} className="group">
              <Card className="h-full transition group-hover:border-border-strong">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="truncate font-semibold">{m.name}</h3>
                      {m.favorite && <Star className="size-3.5 shrink-0 fill-current text-[var(--series-4)]" aria-label={t.nutrition.favorite} />}
                    </div>
                    <p className="mt-1 line-clamp-2 text-[13px] text-fg-3">{m.items.map((i) => (locale === "el" && i.nameEl) || i.name).join(", ")}</p>
                  </div>
                  <ChevronRight className="mt-0.5 size-4 shrink-0 text-fg-3" aria-hidden />
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <MacroLine n={m.totals} />
                  <span className="text-sm font-semibold tabular">{fmt.kcal(m.totals.calories)}</span>
                </div>
                {m.useCount > 0 && <p className="mt-2 text-xs text-fg-3">{format(tm.usedTimes, { count: m.useCount }, locale)}</p>}
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={<UtensilsCrossed />}
            title={tm.empty}
            body={t.nutrition.mealsEmpty}
            action={
              <Button asChild variant="primary">
                <Link href="/nutrition/meals/new">{tm.new}</Link>
              </Button>
            }
          />
        </Card>
      )}
    </div>
  );
}
