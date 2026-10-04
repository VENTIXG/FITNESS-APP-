import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { FoodDetailActions, SourceBadge } from "@/components/nutrition/food-library";
import { NutrientGrid } from "@/components/nutrition/shared";
import { Card, CardHeader } from "@/components/ui/card";
import { format } from "@/lib/i18n";
import { getUserContext } from "@/server/context";
import { getFoodDetail } from "@/server/queries/nutrition";

const UUID = /^[0-9a-f-]{36}$/i;

export async function generateMetadata({ params }: PageProps<"/nutrition/foods/[id]">): Promise<Metadata> {
  const { id } = await params;
  const ctx = await getUserContext();
  const d = UUID.test(id) ? await getFoodDetail(ctx.userId, id) : null;
  return { title: d ? (ctx.locale === "el" && d.food.nameEl) || d.food.name : ctx.t.nutrition.foods.title };
}

export default async function FoodDetailPage({ params }: PageProps<"/nutrition/foods/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const ctx = await getUserContext();
  const { t, fmt, locale } = ctx;
  const tn = t.nutrition;
  const d = await getFoodDetail(ctx.userId, id);
  if (!d) notFound();
  const f = d.food;
  const name = (locale === "el" && f.nameEl) || f.name;
  const per100 = { calories: f.calories, proteinG: f.proteinG, carbsG: f.carbsG, fatG: f.fatG, fiberG: f.fiberG, sugarG: f.sugarG, sodiumMg: f.sodiumMg };
  const editable = f.userId === ctx.userId;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/nutrition/foods" className="-ml-1.5 inline-flex items-center gap-0.5 text-sm font-medium text-fg-3 hover:text-fg">
        <ChevronLeft className="size-5" aria-hidden />
        {tn.foods.title}
      </Link>
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{name}</h2>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-fg-3">
          {f.brand && <span>{f.brand}</span>}
          <SourceBadge source={f.source} />
          {f.barcode && <span className="tabular">{f.barcode}</span>}
          {f.archivedAt && <span>· {tn.foods.archivedBadge}</span>}
        </div>
        {f.source === "builtin" && <p className="mt-2 text-[13px] text-fg-3">{tn.builtinHint}</p>}
      </div>
      <FoodDetailActions
        favorite={d.favorite}
        editable={editable}
        food={{ id: f.id, name: f.name, brand: f.brand, barcode: f.barcode, baseUnit: f.baseUnit, ...per100, servings: f.servings, defaultServingId: f.defaultServingId, source: f.source === "openfoodfacts" ? "openfoodfacts" : "custom", externalId: f.externalId }}
      />
      <Card>
        <CardHeader title={format(tn.per100, { unit: f.baseUnit }, locale)} />
        <NutrientGrid n={per100} />
      </Card>
      {f.servings.length > 0 && (
        <Card>
          <CardHeader title={tn.foods.servingsTitle} />
          <ul className="divide-y divide-border">
            {f.servings.map((s) => {
              const k = s.amount / 100;
              return (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span>
                    {(locale === "el" && s.labelEl) || s.label}
                    <span className="ml-1.5 text-fg-3 tabular">
                      {fmt.number(s.amount, 0)} {f.baseUnit}
                    </span>
                    {s.id === f.defaultServingId && <span className="ml-2 text-xs text-fg-3">· {tn.foods.defaultServing}</span>}
                  </span>
                  <span className="font-semibold tabular">{fmt.kcal(f.calories * k)}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      {d.uses > 0 && (
        <p className="text-[13px] text-fg-3">
          {format(t.common.entries, { count: d.uses }, locale)}
          {d.lastUsed && ` · ${fmt.date(d.lastUsed, "medium")}`}
        </p>
      )}
    </div>
  );
}
