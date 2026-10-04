import type { Metadata } from "next";
import Link from "next/link";
import { ChefHat, ChevronRight, Plus, Star } from "lucide-react";
import { MacroLine } from "@/components/nutrition/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/data-display";
import { SectionTitle } from "@/components/ui/page";
import { format } from "@/lib/i18n";
import { getT, getUserContext } from "@/server/context";
import { getPickerData } from "@/server/queries/nutrition";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).nutrition.recipes.title };
}

export default async function RecipesPage() {
  const ctx = await getUserContext();
  const { t, fmt, locale } = ctx;
  const tr = t.nutrition.recipes;
  const { recipes } = await getPickerData(ctx.userId);
  return (
    <div className="space-y-4">
      <SectionTitle
        action={
          <Button asChild variant="primary" size="sm">
            <Link href="/nutrition/recipes/new">
              <Plus aria-hidden />
              {tr.new}
            </Link>
          </Button>
        }
      >
        {tr.title}
      </SectionTitle>
      {recipes.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {recipes.map((r) => (
            <Link key={r.id} href={`/nutrition/recipes/${r.id}`} className="group">
              <Card className="h-full transition group-hover:border-border-strong">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="truncate font-semibold">{r.name}</h3>
                      {r.favorite && <Star className="size-3.5 shrink-0 fill-current text-[var(--series-4)]" aria-label={t.nutrition.favorite} />}
                    </div>
                    <p className="mt-1 text-[13px] text-fg-3">
                      {format(t.common.servings, { count: r.servings }, locale)} · {format(tr.ingredientCount, { count: r.ingredientCount }, locale)}
                    </p>
                  </div>
                  <ChevronRight className="mt-0.5 size-4 shrink-0 text-fg-3" aria-hidden />
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <MacroLine n={r.perServing} />
                  <span className="text-sm tabular">
                    <span className="font-semibold">{fmt.kcal(r.perServing.calories)}</span>
                    <span className="text-fg-3"> / {t.nutrition.perServing}</span>
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={<ChefHat />}
            title={tr.empty}
            body={t.nutrition.recipesEmpty}
            action={
              <Button asChild variant="primary">
                <Link href="/nutrition/recipes/new">{tr.new}</Link>
              </Button>
            }
          />
        </Card>
      )}
    </div>
  );
}
