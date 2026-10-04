"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Pencil, Plus, Search, Star, Trash2, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { useLocale, useT } from "@/components/providers/i18n-provider";
import { useFmt } from "@/components/providers/prefs-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Segmented } from "@/components/ui/controls";
import { Badge, EmptyState } from "@/components/ui/data-display";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useRun } from "@/lib/client/run-action";
import { cn, normalizeSearch } from "@/lib/utils";
import { deleteFood, toggleFavoriteFood } from "@/server/actions/nutrition";
import type { PickerFood } from "@/server/queries/nutrition";
import { FoodForm, type FoodFormValues } from "./food-form";
import { MacroLine, foodName } from "./shared";

type Filter = "all" | "mine" | "favorites" | "builtin";
const PAGE = 60;

export function FoodLibrary({ foods }: { foods: PickerFood[] }) {
  const t = useT();
  const tn = t.nutrition;
  const locale = useLocale();
  const fmt = useFmt();
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("all");
  const [limit, setLimit] = React.useState(PAGE);

  const list = React.useMemo(() => {
    const q = normalizeSearch(query);
    const tokens = q ? q.split(/\s+/) : [];
    return foods
      .filter((f) => (filter === "mine" ? f.mine : filter === "favorites" ? f.favorite : filter === "builtin" ? f.source === "builtin" : true))
      .filter((f) => {
        if (!tokens.length) return true;
        const text = normalizeSearch(`${f.name} ${f.nameEl ?? ""} ${f.brand ?? ""} ${f.barcode ?? ""}`);
        return tokens.every((tok) => text.includes(tok));
      })
      .sort((a, b) => foodName(a, locale).localeCompare(foodName(b, locale), locale));
  }, [foods, query, filter, locale]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">{tn.searchFoods}</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-3" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(PAGE);
            }}
            placeholder={tn.searchFoods}
            className="h-11 w-full rounded-xl border border-border bg-surface pl-10 pr-3 text-[15px] outline-none transition placeholder:text-fg-3 focus:border-accent focus:ring-3 focus:ring-accent/20"
          />
        </label>
        <Button asChild variant="primary">
          <Link href="/nutrition/foods/new">
            <Plus aria-hidden />
            {tn.foods.new}
          </Link>
        </Button>
      </div>
      <Segmented
        ariaLabel={tn.foods.library}
        value={filter}
        onChange={(v) => {
          setFilter(v);
          setLimit(PAGE);
        }}
        className="no-scrollbar max-w-full overflow-x-auto"
        options={[
          { value: "all", label: t.common.all },
          { value: "mine", label: tn.tabs.mine },
          { value: "favorites", label: tn.tabs.favorites },
          { value: "builtin", label: tn.builtin },
        ]}
      />
      <Card className="p-0">
        {list.length ? (
          <ul className="divide-y divide-border">
            {list.slice(0, limit).map((f) => (
              <li key={f.id}>
                <Link href={`/nutrition/foods/${f.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-fg">{foodName(f, locale)}</span>
                      {f.favorite && <Star className="size-3.5 shrink-0 fill-current text-[var(--series-4)]" aria-label={tn.favorite} />}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      {f.brand && <span className="truncate text-xs text-fg-3">{f.brand}</span>}
                      <MacroLine n={f.per100} />
                    </div>
                  </div>
                  <span className="shrink-0 text-right text-sm font-semibold tabular text-fg-2">
                    {fmt.int(f.per100.calories)}
                    <span className="block text-[11px] font-normal text-fg-3">kcal / 100 {f.baseUnit}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-fg-3" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<UtensilsCrossed />} title={tn.noFoodsFound} body={filter === "mine" ? tn.mineEmpty : filter === "favorites" ? tn.favoritesEmpty : undefined} />
        )}
        {list.length > limit && (
          <div className="border-t border-border p-2">
            <Button variant="ghost" block onClick={() => setLimit((l) => l + PAGE)}>
              {t.common.more} ({fmt.int(list.length - limit)})
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

export function NewFoodForm({ initial }: { initial?: Partial<FoodFormValues> }) {
  const router = useRouter();
  return (
    <Card>
      <FoodForm initial={initial} onSaved={(id) => router.push(`/nutrition/foods/${id}`)} />
    </Card>
  );
}

export function FoodDetailActions({ food, favorite, editable }: { food: FoodFormValues & { id: string }; favorite: boolean; editable: boolean }) {
  const t = useT();
  const tn = t.nutrition;
  const router = useRouter();
  const { run } = useRun();
  const { confirm, dialog } = useConfirm();
  const [fav, setFav] = React.useState(favorite);
  const [editing, setEditing] = React.useState(false);
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="secondary"
        aria-pressed={fav}
        onClick={async () => {
          const next = !fav;
          setFav(next);
          const res = await run(() => toggleFavoriteFood({ foodId: food.id, favorite: next }), { success: next ? tn.favorited : tn.unfavorited });
          if (!res.ok) setFav(!next);
        }}
      >
        <Star className={cn(fav && "fill-current text-[var(--series-4)]")} aria-hidden />
        {fav ? tn.unfavorite : tn.favorite}
      </Button>
      {editable && (
        <>
          <Button variant="secondary" onClick={() => setEditing(true)}>
            <Pencil aria-hidden />
            {t.common.edit}
          </Button>
          <Button
            variant="destructive-ghost"
            onClick={async () => {
              if (!(await confirm({ title: t.common.delete, description: tn.foods.deleteConfirm, destructive: true, confirmLabel: t.common.delete }))) return;
              const res = await run(() => deleteFood({ id: food.id }));
              if (res.ok) {
                toast.success(res.data.archived ? tn.foods.archived : tn.foods.deleted);
                router.push("/nutrition/foods");
              }
            }}
          >
            <Trash2 aria-hidden />
            {t.common.delete}
          </Button>
          <Sheet open={editing} onOpenChange={setEditing}>
            {editing && (
              <SheetContent title={tn.foods.edit} size="lg">
                <FoodForm initial={food} onSaved={() => setEditing(false)} />
              </SheetContent>
            )}
          </Sheet>
        </>
      )}
      {dialog}
    </div>
  );
}

export function SourceBadge({ source }: { source: PickerFood["source"] }) {
  const t = useT();
  const tn = t.nutrition;
  return <Badge tone="outline">{source === "builtin" ? tn.builtin : source === "openfoodfacts" ? tn.fromOff : tn.custom}</Badge>;
}
