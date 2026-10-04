"use client";

import * as React from "react";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, Plus, Search, Star, UtensilsCrossed, X } from "lucide-react";
import { useLocale, useT } from "@/components/providers/i18n-provider";
import { useFmt } from "@/components/providers/prefs-provider";
import { Button } from "@/components/ui/button";
import { NumberInput, Select, formatForInput, parseDecimal } from "@/components/ui/controls";
import { Badge } from "@/components/ui/data-display";
import { Field } from "@/components/ui/input";
import { useRun } from "@/lib/client/run-action";
import { quantityLabel, unitOptions } from "@/lib/food-units";
import { format } from "@/lib/i18n";
import { cn, normalizeSearch } from "@/lib/utils";
import { toggleFavoriteFood } from "@/server/actions/nutrition";
import type { PickerData, PickerFood } from "@/server/queries/nutrition";
import { FoodForm } from "./food-form";
import { MacroLine, NutrientGrid, defaultPortion, foodName, foodPreview, recipePreview, type PickerMeal, type PickerRecipe } from "./shared";

export type PickerTab = "recent" | "favorites" | "mine" | "meals" | "recipes" | "all";
export type PickSelection = { foodId?: string; recipeId?: string; quantity: number; unit: string; label: string };

type Selected = { kind: "food"; food: PickerFood } | { kind: "recipe"; recipe: PickerRecipe };
type Row =
  | { kind: "food"; food: PickerFood; portion: { quantity: number; unit: string } }
  | { kind: "recipe"; recipe: PickerRecipe; portion: { quantity: number; unit: string } }
  | { kind: "meal"; meal: PickerMeal };

const rowKey = (r: Row) => (r.kind === "food" ? `f:${r.food.id}` : r.kind === "recipe" ? `r:${r.recipe.id}` : `m:${r.meal.id}`);

export function FoodPicker({
  data,
  tabs = ["recent", "favorites", "mine", "meals", "recipes", "all"],
  submitLabel,
  onSubmit,
  onLogMeal,
  amountExtra,
  keepOpenAfterSubmit,
  autoFocus = true,
  headerExtra,
}: {
  data: PickerData;
  tabs?: PickerTab[];
  submitLabel: string;
  onSubmit: (sel: PickSelection) => Promise<boolean>;
  onLogMeal?: (meal: PickerMeal) => Promise<boolean>;
  amountExtra?: React.ReactNode;
  keepOpenAfterSubmit?: boolean;
  autoFocus?: boolean;
  /** Extra controls next to the search field; a function receives `openFood(id)`. */
  headerExtra?: React.ReactNode | ((openFood: (id: string) => void) => React.ReactNode);
}) {
  const t = useT();
  const tn = t.nutrition;
  const locale = useLocale();
  const [query, setQuery] = React.useState("");
  const [tab, setTab] = React.useState<PickerTab>(data.recent.length ? tabs[0] : tabs.includes("all") ? "all" : tabs[0]);
  const [selected, setSelected] = React.useState<Selected | null>(null);
  const [creating, setCreating] = React.useState<string | null>(null);
  const [pendingFoodId, setPendingFoodId] = React.useState<string | null>(null);
  const [added, setAdded] = React.useState<Set<string>>(() => new Set());
  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);

  const foodById = React.useMemo(() => new Map(data.foods.map((f) => [f.id, f])), [data.foods]);
  const recipeById = React.useMemo(() => new Map(data.recipes.map((r) => [r.id, r])), [data.recipes]);
  const recentByFood = React.useMemo(() => new Map(data.recent.filter((r) => r.foodId).map((r) => [r.foodId!, r])), [data.recent]);

  // After creating a food, open it as soon as the refreshed data includes it.
  const createdFood = pendingFoodId ? foodById.get(pendingFoodId) : undefined;
  if (createdFood) {
    setPendingFoodId(null);
    setSelected({ kind: "food", food: createdFood });
  }

  const foodRow = React.useCallback((f: PickerFood): Row => ({ kind: "food", food: f, portion: defaultPortion(f, recentByFood.get(f.id)) }), [recentByFood]);
  const recipeRow = (r: PickerRecipe): Row => ({ kind: "recipe", recipe: r, portion: { quantity: 1, unit: "serving" } });

  const index = React.useMemo(
    () => ({
      foods: data.foods.map((f) => ({ f, text: normalizeSearch(`${f.name} ${f.nameEl ?? ""} ${f.brand ?? ""}`), name: normalizeSearch(foodName(f, locale)) })),
      recipes: data.recipes.map((r) => ({ r, text: normalizeSearch(r.name) })),
      meals: data.meals.map((m) => ({ m, text: normalizeSearch(m.name) })),
    }),
    [data, locale],
  );

  const rows: Row[] = React.useMemo(() => {
    const q = normalizeSearch(query);
    if (q) {
      const tokens = q.split(/\s+/);
      const hit = (text: string) => tokens.every((tok) => text.includes(tok));
      const rank = (name: string, f?: PickerFood) =>
        (name.startsWith(q) ? 0 : name.split(/\s+/).some((w) => w.startsWith(tokens[0])) ? 1 : 2) - (f?.favorite ? 0.6 : 0) - (f && recentByFood.has(f.id) ? 0.4 : 0) - (f?.mine ? 0.2 : 0);
      const foods = index.foods
        .filter((x) => hit(x.text))
        .map((x) => ({ x, s: rank(x.name, x.f) }))
        .sort((a, b) => a.s - b.s || a.x.name.localeCompare(b.x.name))
        .slice(0, 50)
        .map(({ x }) => foodRow(x.f));
      const recipes = tabs.includes("recipes") ? index.recipes.filter((x) => hit(x.text)).map((x) => recipeRow(x.r)) : [];
      const meals = onLogMeal && tabs.includes("meals") ? index.meals.filter((x) => hit(x.text)).map((x): Row => ({ kind: "meal", meal: x.m })) : [];
      return [...meals, ...recipes, ...foods];
    }
    switch (tab) {
      case "recent":
        return data.recent
          .map((r): Row | null => {
            if (r.foodId) {
              const f = foodById.get(r.foodId);
              return f ? { kind: "food", food: f, portion: defaultPortion(f, r) } : null;
            }
            const rec = r.recipeId ? recipeById.get(r.recipeId) : null;
            return rec ? { kind: "recipe", recipe: rec, portion: { quantity: r.quantity, unit: r.unit } } : null;
          })
          .filter((r): r is Row => !!r);
      case "favorites":
        return [...data.recipes.filter((r) => r.favorite).map(recipeRow), ...data.foods.filter((f) => f.favorite).map(foodRow)];
      case "mine":
        return data.foods.filter((f) => f.mine).map(foodRow);
      case "meals":
        return data.meals.map((m): Row => ({ kind: "meal", meal: m }));
      case "recipes":
        return data.recipes.map(recipeRow);
      default:
        return [...data.foods].sort((a, b) => foodName(a, locale).localeCompare(foodName(b, locale), locale)).map(foodRow);
    }
  }, [query, tab, index, data, foodById, recipeById, recentByFood, foodRow, onLogMeal, tabs, locale]);

  const markAdded = (key: string) => {
    setAdded((s) => new Set(s).add(key));
    window.setTimeout(() => setAdded((s) => {
      const n = new Set(s);
      n.delete(key);
      return n;
    }), 1600);
  };

  const quick = async (row: Row) => {
    const key = rowKey(row);
    setBusyKey(key);
    try {
      if (row.kind === "meal") {
        if (onLogMeal && (await onLogMeal(row.meal))) markAdded(key);
        return;
      }
      const sel: PickSelection =
        row.kind === "food"
          ? { foodId: row.food.id, quantity: row.portion.quantity, unit: row.portion.unit, label: foodName(row.food, locale) }
          : { recipeId: row.recipe.id, quantity: row.portion.quantity, unit: row.portion.unit, label: row.recipe.name };
      if (await onSubmit(sel)) markAdded(key);
    } finally {
      setBusyKey(null);
    }
  };

  if (creating != null) {
    return (
      <div className="px-5 pb-5">
        <BackRow onBack={() => setCreating(null)} label={tn.createFood} />
        <FoodForm
          formId="picker-food-form"
          initial={{ name: creating }}
          onSaved={(id) => {
            setCreating(null);
            setPendingFoodId(id);
          }}
        />
      </div>
    );
  }

  if (selected) {
    return (
      <AmountView
        selected={selected}
        recent={selected.kind === "food" ? recentByFood.get(selected.food.id) : null}
        submitLabel={submitLabel}
        extra={amountExtra}
        onBack={() => setSelected(null)}
        onSubmit={async (sel) => {
          const ok = await onSubmit(sel);
          if (ok && keepOpenAfterSubmit) {
            markAdded(selected.kind === "food" ? `f:${selected.food.id}` : `r:${selected.recipe.id}`);
            setSelected(null);
          }
          return ok;
        }}
      />
    );
  }

  const emptyText: Record<PickerTab, string> = {
    recent: tn.recentEmpty,
    favorites: tn.favoritesEmpty,
    mine: tn.mineEmpty,
    meals: tn.mealsEmpty,
    recipes: tn.recipesEmpty,
    all: tn.noFoodsFound,
  };

  return (
    <div className="pb-4">
      <div className="sticky top-0 z-10 space-y-3 bg-surface px-5 pb-3">
        <div className="flex gap-2">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">{tn.searchFoods}</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-3" aria-hidden />
            <input
              ref={searchRef}
              type="search"
              value={query}
              autoFocus={autoFocus}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && rows[0] && rows[0].kind !== "meal") {
                  e.preventDefault();
                  const r = rows[0];
                  setSelected(r.kind === "food" ? { kind: "food", food: r.food } : { kind: "recipe", recipe: r.recipe });
                }
              }}
              placeholder={tn.searchFoods}
              className="h-11 w-full rounded-xl border border-border bg-surface-2 pr-10 pl-10 text-[15px] text-fg outline-none transition placeholder:text-fg-3 focus:border-accent focus:ring-3 focus:ring-accent/20"
              autoComplete="off"
              enterKeyHint="search"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  searchRef.current?.focus();
                }}
                className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-fg-3 hover:bg-surface-3 hover:text-fg"
                aria-label={t.common.clear}
              >
                <X className="size-4" />
              </button>
            )}
          </label>
          {typeof headerExtra === "function" ? headerExtra(setPendingFoodId) : headerExtra}
        </div>
        {!query && tabs.length > 1 && (
          <div role="tablist" aria-label={tn.addFood} className="no-scrollbar -mx-5 flex gap-1.5 overflow-x-auto px-5">
            {tabs.map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={cn(
                  "h-8 shrink-0 rounded-full border px-3.5 text-[13px] font-medium transition",
                  tab === k ? "border-transparent bg-fg text-bg" : "border-border bg-surface text-fg-2 hover:border-border-strong",
                )}
              >
                {tn.tabs[k]}
              </button>
            ))}
          </div>
        )}
      </div>

      {rows.length ? (
        <ul className="divide-y divide-border px-5" role={query ? "listbox" : undefined}>
          {rows.map((row) => {
            const key = rowKey(row);
            return (
              <PickerRowItem
                key={key}
                row={row}
                isAdded={added.has(key)}
                busy={busyKey === key}
                onOpen={() => {
                  if (row.kind === "food") setSelected({ kind: "food", food: row.food });
                  else if (row.kind === "recipe") setSelected({ kind: "recipe", recipe: row.recipe });
                }}
                onQuick={() => quick(row)}
                quickLabel={row.kind === "meal" ? tn.logMeal : submitLabel}
              />
            );
          })}
        </ul>
      ) : (
        <div className="flex flex-col items-center px-8 py-12 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-surface-2 text-fg-3">
            <UtensilsCrossed className="size-5" aria-hidden />
          </div>
          <p className="text-sm text-fg-2">{query ? tn.noFoodsFound : emptyText[tab]}</p>
          {!query && tab === "meals" && (
            <Button asChild variant="secondary" size="sm" className="mt-4">
              <Link href="/nutrition/meals/new">{tn.meals.new}</Link>
            </Button>
          )}
          {!query && tab === "recipes" && (
            <Button asChild variant="secondary" size="sm" className="mt-4">
              <Link href="/nutrition/recipes/new">{tn.recipes.new}</Link>
            </Button>
          )}
        </div>
      )}

      {(query || tab === "mine" || tab === "all") && (
        <div className="px-5 pt-3">
          <Button type="button" variant="outline" block onClick={() => setCreating(query.trim())}>
            <Plus aria-hidden />
            {query.trim() ? format(tn.createFoodFromSearch, { query: query.trim() }, locale) : tn.createFood}
          </Button>
        </div>
      )}
    </div>
  );
}

function BackRow({ onBack, label, action }: { onBack: () => void; label: string; action?: React.ReactNode }) {
  const t = useT();
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <button type="button" onClick={onBack} className="-ml-1.5 inline-flex items-center gap-0.5 rounded-lg py-1 pr-2 text-sm font-medium text-fg-3 transition hover:text-fg">
        <ChevronLeft className="size-5" aria-hidden />
        {t.common.back}
      </button>
      <span className="sr-only">{label}</span>
      {action}
    </div>
  );
}

function PickerRowItem({
  row,
  onOpen,
  onQuick,
  isAdded,
  busy,
  quickLabel,
}: {
  row: Row;
  onOpen: () => void;
  onQuick: () => void;
  isAdded: boolean;
  busy: boolean;
  quickLabel: string;
}) {
  const t = useT();
  const locale = useLocale();
  const fmt = useFmt();
  let title: string;
  let sub: React.ReactNode;
  let kcal: number | null = null;
  let badge: React.ReactNode = null;
  if (row.kind === "food") {
    const f = row.food;
    title = foodName(f, locale);
    const n = foodPreview(f, row.portion.quantity, row.portion.unit);
    kcal = n?.calories ?? null;
    sub = [f.brand, quantityLabel(row.portion.quantity, row.portion.unit, f.servings, locale, fmt.number)].filter(Boolean).join(" · ");
    if (f.favorite) badge = <Star className="size-3.5 shrink-0 fill-current text-[var(--series-4)]" aria-label={t.nutrition.favorite} />;
  } else if (row.kind === "recipe") {
    const r = row.recipe;
    title = r.name;
    kcal = recipePreview(r, row.portion.quantity, row.portion.unit)?.calories ?? null;
    sub = row.portion.unit === "serving" ? format(t.common.servings, { count: row.portion.quantity }, locale) : `${fmt.int(row.portion.quantity)} g`;
    badge = <Badge tone="outline">{t.nutrition.recipes.title}</Badge>;
  } else {
    const m = row.meal;
    title = m.name;
    kcal = m.totals.calories;
    sub = m.items.map((i) => foodName(i, locale)).join(", ");
    badge = <Badge tone="outline">{t.nutrition.tabs.meals}</Badge>;
  }
  const clickable = row.kind !== "meal";
  return (
    <li className="flex items-center gap-2 py-1">
      <button
        type="button"
        onClick={clickable ? onOpen : onQuick}
        disabled={!clickable && busy}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl py-2.5 text-left transition hover:opacity-80"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[15px] font-medium text-fg">{title}</span>
            {badge}
          </div>
          <div className="truncate text-[13px] text-fg-3">{sub}</div>
        </div>
        {kcal != null && (
          <span className="shrink-0 text-sm font-semibold tabular text-fg-2">
            {fmt.int(kcal)}
            <span className="ml-0.5 text-xs font-normal text-fg-3">kcal</span>
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={onQuick}
        disabled={busy}
        aria-label={`${quickLabel}: ${title}`}
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full border transition active:scale-90 disabled:opacity-60",
          isAdded ? "border-transparent bg-good text-white" : "border-border bg-surface-2 text-fg hover:border-accent hover:text-accent",
        )}
      >
        {isAdded ? <Check className="size-4" /> : busy ? <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Plus className="size-4" />}
      </button>
    </li>
  );
}

const CHIP_PRESETS: Record<string, number[]> = { g: [50, 100, 150, 200, 250], ml: [100, 200, 250, 330, 500], oz: [1, 2, 4, 8], fl_oz: [4, 8, 12, 16] };

function AmountView({
  selected,
  recent,
  submitLabel,
  extra,
  onBack,
  onSubmit,
}: {
  selected: Selected;
  recent?: { quantity: number; unit: string } | null;
  submitLabel: string;
  extra?: React.ReactNode;
  onBack: () => void;
  onSubmit: (sel: PickSelection) => Promise<boolean>;
}) {
  const t = useT();
  const tn = t.nutrition;
  const locale = useLocale();
  const fmt = useFmt();
  const { run } = useRun();
  const initial = selected.kind === "food" ? defaultPortion(selected.food, recent) : { quantity: 1, unit: "serving" };
  const [qty, setQty] = React.useState(formatForInput(initial.quantity, 2));
  const [unit, setUnit] = React.useState(initial.unit);
  const [busy, setBusy] = React.useState(false);
  const [favorite, setFavorite] = React.useState(selected.kind === "food" ? selected.food.favorite : false);

  const q = parseDecimal(qty) ?? 0;
  const options =
    selected.kind === "food"
      ? unitOptions(selected.food, locale)
      : [{ id: "serving", label: tn.servingSize, amount: 1 }, ...(selected.recipe.totalWeightG > 0 ? [{ id: "g", label: "g", amount: 1 }] : [])];
  const preview = selected.kind === "food" ? foodPreview(selected.food, q, unit) : recipePreview(selected.recipe, q, unit);
  const chips = CHIP_PRESETS[unit] ?? [0.5, 1, 1.5, 2, 3];
  const name = selected.kind === "food" ? foodName(selected.food, locale) : selected.recipe.name;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!preview) return;
    setBusy(true);
    try {
      await onSubmit(
        selected.kind === "food"
          ? { foodId: selected.food.id, quantity: q, unit, label: name }
          : { recipeId: selected.recipe.id, quantity: q, unit, label: name },
      );
    } finally {
      setBusy(false);
    }
  };

  const food = selected.kind === "food" ? selected.food : null;
  return (
    <form onSubmit={submit} className="px-5 pb-5">
      <BackRow
        onBack={onBack}
        label={name}
        action={
          food && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-pressed={favorite}
              aria-label={favorite ? tn.unfavorite : tn.favorite}
              onClick={async () => {
                const next = !favorite;
                setFavorite(next);
                const res = await run(() => toggleFavoriteFood({ foodId: food.id, favorite: next }), { success: next ? tn.favorited : tn.unfavorited });
                if (!res.ok) setFavorite(!next);
              }}
            >
              <Star className={cn(favorite && "fill-current text-[var(--series-4)]")} />
            </Button>
          )
        }
      />
      <h3 className="text-xl font-semibold tracking-tight text-fg">{name}</h3>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-fg-3">
        {food?.brand && <span>{food.brand}</span>}
        {food && (
          <Badge tone="outline">{food.source === "builtin" ? tn.builtin : food.source === "openfoodfacts" ? tn.fromOff : tn.custom}</Badge>
        )}
        {food && (
          <span className="tabular">
            {format(tn.per100, { unit: food.baseUnit }, locale)}: {fmt.int(food.per100.calories)} kcal
          </span>
        )}
        {selected.kind === "recipe" && (
          <span className="tabular">
            {tn.perServing}: {fmt.int(selected.recipe.perServing.calories)} kcal
          </span>
        )}
      </div>
      {food?.source === "builtin" && <p className="mt-1 text-xs text-fg-3">{tn.builtinHint}</p>}

      <div className="mt-5 grid grid-cols-[1fr_auto] gap-3">
        <Field label={tn.amount} htmlFor="amount-qty">
          <NumberInput id="amount-qty" value={qty} onValueChange={setQty} autoFocus />
        </Field>
        <Field label={t.common.unit} htmlFor="amount-unit">
          <Select id="amount-unit" value={unit} onChange={(e) => setUnit(e.target.value)} className="min-w-32">
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
                {o.id !== "g" && o.id !== "ml" && o.id !== "serving" && food ? ` (${fmt.number(o.amount, 0)} ${food.baseUnit})` : ""}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="no-scrollbar mt-2.5 flex gap-1.5 overflow-x-auto">
        {chips.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setQty(formatForInput(c, 2))}
            className={cn(
              "h-8 shrink-0 rounded-full border px-3 text-[13px] font-medium tabular transition",
              q === c ? "border-accent bg-accent-soft text-fg" : "border-border bg-surface-2 text-fg-2 hover:border-border-strong",
            )}
          >
            {fmt.number(c, 1)}
          </button>
        ))}
      </div>

      <div className="mt-5">
        <div className="mb-2 text-[13px] font-medium text-fg-3">{tn.preview}</div>
        {preview ? <NutrientGrid n={preview} /> : <p className="text-sm text-fg-3">{t.common.invalidNumber}</p>}
      </div>

      {extra && <div className="mt-5">{extra}</div>}

      <Button type="submit" variant="primary" size="lg" block className="mt-6" loading={busy} disabled={!preview}>
        {submitLabel}
        {preview && <span className="ml-1 opacity-70 tabular">· {fmt.int(preview.calories)} kcal</span>}
      </Button>
      {preview && (
        <div className="mt-3 flex justify-center">
          <MacroLine n={preview} />
        </div>
      )}
      {selected.kind === "recipe" && (
        <div className="mt-4 text-center">
          <Link href={`/nutrition/recipes/${selected.recipe.id}`} className="inline-flex items-center gap-1 text-[13px] text-fg-3 hover:text-fg">
            {t.common.details}
            <ChevronRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      )}
      {food && (
        <div className="mt-4 text-center">
          <Link href={`/nutrition/foods/${food.id}`} className="inline-flex items-center gap-1 text-[13px] text-fg-3 hover:text-fg">
            {t.common.details}
            <ChevronRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      )}
    </form>
  );
}
