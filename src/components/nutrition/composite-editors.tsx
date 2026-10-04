"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useLocale, useT } from "@/components/providers/i18n-provider";
import { useFmt, usePrefs, useToday } from "@/components/providers/prefs-provider";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { NumberInput, Select, SwitchRow, formatForInput, parseDecimal } from "@/components/ui/controls";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { multiplyNutrients, sumNutrients, type Nutrients } from "@/lib/calc/nutrition";
import { useRun } from "@/lib/client/run-action";
import { toBaseAmount, unitOptions } from "@/lib/food-units";
import { format } from "@/lib/i18n";
import {
  addFoodEntry,
  createRecipe,
  createSavedMeal,
  deleteRecipe,
  deleteSavedMeal,
  logSavedMeal,
  updateRecipe,
  updateSavedMeal,
} from "@/server/actions/nutrition";
import type { PickerData, PickerFood } from "@/server/queries/nutrition";
import { SlotSelect } from "./entry-sheets";
import { FoodPicker, type PickerTab } from "./food-picker";
import { NutrientGrid, foodName, foodPreview, recipePreview, useSlotName, type PickerRecipe } from "./shared";

type Item = { key: string; foodId: string | null; recipeId: string | null; quantity: string; unit: string };
let seq = 0;
const nextKey = () => `i${++seq}`;

function useLookups(data: PickerData, extraFoods: PickerFood[]) {
  return React.useMemo(() => {
    const foods = new Map<string, PickerFood>();
    for (const f of extraFoods) foods.set(f.id, f);
    for (const f of data.foods) foods.set(f.id, f);
    const recipes = new Map<string, PickerRecipe>(data.recipes.map((r) => [r.id, r]));
    return { foods, recipes };
  }, [data, extraFoods]);
}

function itemNutrients(item: Item, l: ReturnType<typeof useLookups>): Nutrients | null {
  const q = parseDecimal(item.quantity) ?? 0;
  if (item.foodId) {
    const f = l.foods.get(item.foodId);
    return f ? foodPreview(f, q, item.unit) : null;
  }
  const r = item.recipeId ? l.recipes.get(item.recipeId) : null;
  return r ? recipePreview(r, q, item.unit) : null;
}

function ItemsEditor({
  items,
  setItems,
  data,
  lookups,
  allowRecipes,
  title,
  addLabel,
}: {
  items: Item[];
  setItems: React.Dispatch<React.SetStateAction<Item[]>>;
  data: PickerData;
  lookups: ReturnType<typeof useLookups>;
  allowRecipes: boolean;
  title: string;
  addLabel: string;
}) {
  const t = useT();
  const locale = useLocale();
  const fmt = useFmt();
  const [picking, setPicking] = React.useState(false);
  const tabs: PickerTab[] = allowRecipes ? ["recent", "favorites", "mine", "recipes", "all"] : ["recent", "favorites", "mine", "all"];
  const pickerData = React.useMemo(() => (allowRecipes ? data : { ...data, recipes: [], recent: data.recent.filter((r) => r.foodId) }), [data, allowRecipes]);
  const update = (key: string, patch: Partial<Item>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const move = (idx: number, dir: -1 | 1) =>
    setItems((list) => {
      const next = [...list];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return list;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });

  return (
    <Card>
      <CardHeader
        title={title}
        action={
          <Button type="button" variant="secondary" size="sm" onClick={() => setPicking(true)}>
            <Plus aria-hidden />
            {addLabel}
          </Button>
        }
      />
      {items.length === 0 ? (
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-border-strong px-4 py-8 text-sm text-fg-3 transition hover:border-accent hover:text-fg"
        >
          <Plus className="size-5" aria-hidden />
          {addLabel}
        </button>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item, idx) => {
            const food = item.foodId ? lookups.foods.get(item.foodId) : null;
            const recipe = item.recipeId ? lookups.recipes.get(item.recipeId) : null;
            const name = food ? foodName(food, locale) : (recipe?.name ?? "—");
            const n = itemNutrients(item, lookups);
            const options = food
              ? unitOptions(food, locale)
              : [{ id: "serving", label: t.nutrition.servingSize, amount: 1 }, ...(recipe && recipe.totalWeightG > 0 ? [{ id: "g", label: "g", amount: 1 }] : [])];
            return (
              <li key={item.key} className="py-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{name}</div>
                    <div className="text-xs text-fg-3 tabular">{n ? fmt.kcal(n.calories) : t.common.invalidNumber}</div>
                  </div>
                  <div className="flex shrink-0 items-center">
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={t.common.moveUp} disabled={idx === 0} onClick={() => move(idx, -1)}>
                      <ArrowUp />
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={t.common.moveDown} disabled={idx === items.length - 1} onClick={() => move(idx, 1)}>
                      <ArrowDown />
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={`${t.common.remove}: ${name}`} onClick={() => setItems((l) => l.filter((i) => i.key !== item.key))}>
                      <Trash2 />
                    </Button>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                  <NumberInput aria-label={t.nutrition.amount} value={item.quantity} onValueChange={(v) => update(item.key, { quantity: v })} />
                  <Select aria-label={t.common.unit} value={item.unit} onChange={(e) => update(item.key, { unit: e.target.value })} className="min-w-28">
                    {options.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Sheet open={picking} onOpenChange={setPicking}>
        {picking && (
          <SheetContent title={addLabel} size="lg" flush className="sm:h-[80dvh]">
            <FoodPicker
              data={pickerData}
              tabs={tabs}
              submitLabel={t.common.add}
              onSubmit={async (sel) => {
                setItems((l) => [...l, { key: nextKey(), foodId: sel.foodId ?? null, recipeId: sel.recipeId ?? null, quantity: formatForInput(sel.quantity, 2), unit: sel.unit }]);
                setPicking(false);
                return true;
              }}
            />
          </SheetContent>
        )}
      </Sheet>
    </Card>
  );
}

function cleanItems(items: Item[], lookups: ReturnType<typeof useLookups>) {
  const out = [];
  for (const i of items) {
    const quantity = parseDecimal(i.quantity);
    if (quantity == null || quantity <= 0) return null;
    if (i.foodId) {
      const f = lookups.foods.get(i.foodId);
      if (!f || toBaseAmount(f, quantity, i.unit) == null) return null;
    }
    out.push({ foodId: i.foodId, recipeId: i.recipeId, quantity, unit: i.unit });
  }
  return out;
}

/** Log N servings of a meal / recipe into a meal slot today. */
function LogRow({ onLog, servings }: { onLog: (slot: string, servings: number) => Promise<void>; servings?: boolean }) {
  const t = useT();
  const prefs = usePrefs();
  const [slot, setSlot] = React.useState(prefs.mealSlots[0]?.id ?? "breakfast");
  const [qty, setQty] = React.useState("1");
  const [busy, setBusy] = React.useState(false);
  return (
    <Card>
      <CardHeader title={t.nutrition.meals.logTo} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-40 flex-1">
          <SlotSelect id="log-slot" value={slot} onChange={setSlot} label={t.nutrition.meal} />
        </div>
        {servings && (
          <Field label={t.nutrition.recipes.servings} htmlFor="log-qty" className="w-28">
            <NumberInput id="log-qty" value={qty} onValueChange={setQty} />
          </Field>
        )}
        <Button
          type="button"
          variant="accent"
          loading={busy}
          onClick={async () => {
            const q = parseDecimal(qty) ?? 1;
            setBusy(true);
            try {
              await onLog(slot, q);
            } finally {
              setBusy(false);
            }
          }}
        >
          {t.common.add}
        </Button>
      </div>
    </Card>
  );
}

// ── Saved meals ─────────────────────────────────────────────────────────────

type MealInitial = { id: string; name: string; mealSlot: string | null; isFavorite: boolean; items: { foodId: string | null; recipeId: string | null; quantity: number; unit: string }[] };

export function MealEditor({ data, extraFoods, initial }: { data: PickerData; extraFoods: PickerFood[]; initial?: MealInitial }) {
  const t = useT();
  const tm = t.nutrition.meals;
  const prefs = usePrefs();
  const today = useToday();
  const router = useRouter();
  const slotName = useSlotName();
  const { run, pending } = useRun();
  const { confirm, dialog } = useConfirm();
  const lookups = useLookups(data, extraFoods);
  const [name, setName] = React.useState(initial?.name ?? "");
  const [slot, setSlot] = React.useState<string>(initial?.mealSlot ?? "");
  const [favorite, setFavorite] = React.useState(initial?.isFavorite ?? false);
  const [items, setItems] = React.useState<Item[]>(
    () => initial?.items.map((i) => ({ key: nextKey(), foodId: i.foodId, recipeId: i.recipeId, quantity: formatForInput(i.quantity, 2), unit: i.unit })) ?? [],
  );
  const totals = sumNutrients(items.map((i) => itemNutrients(i, lookups)).filter((n): n is Nutrients => !!n));
  const clean = cleanItems(items, lookups);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !clean?.length) return;
    const payload = { name: name.trim(), mealSlot: slot || null, isFavorite: favorite, items: clean };
    const res = initial ? await run(() => updateSavedMeal({ ...payload, id: initial.id }), { success: t.common.saved }) : await run(() => createSavedMeal(payload), { success: t.nutrition.mealSaved });
    if (res.ok && !initial) router.push(`/nutrition/meals/${res.data.id}`);
  };

  return (
    <form onSubmit={save} className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4">
        <Card className="space-y-4">
          <Field label={t.nutrition.mealName} htmlFor="meal-name">
            <Input id="meal-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
          </Field>
          <Field label={tm.defaultSlot} htmlFor="meal-slot">
            <Select id="meal-slot" value={slot} onChange={(e) => setSlot(e.target.value)}>
              <option value="">{tm.anySlot}</option>
              {prefs.mealSlots.map((s) => (
                <option key={s.id} value={s.id}>
                  {slotName(s.id)}
                </option>
              ))}
            </Select>
          </Field>
          <SwitchRow label={t.nutrition.favorite} checked={favorite} onCheckedChange={setFavorite} />
        </Card>
        <ItemsEditor items={items} setItems={setItems} data={data} lookups={lookups} allowRecipes title={tm.items} addLabel={tm.addItem} />
      </div>
      <div className="space-y-4 lg:sticky lg:top-6">
        <Card>
          <CardHeader title={t.common.total} />
          <NutrientGrid n={totals} className="sm:grid-cols-3" />
          <Button type="submit" variant="primary" block className="mt-4" loading={pending} disabled={!name.trim() || !clean?.length}>
            {t.common.save}
          </Button>
          {initial && (
            <Button
              type="button"
              variant="destructive-ghost"
              block
              className="mt-2"
              onClick={async () => {
                if (!(await confirm({ title: t.common.delete, description: tm.deleteConfirm, destructive: true, confirmLabel: t.common.delete }))) return;
                const res = await run(() => deleteSavedMeal({ id: initial.id }), { success: t.common.deleted });
                if (res.ok) router.push("/nutrition/meals");
              }}
            >
              <Trash2 aria-hidden />
              {t.common.delete}
            </Button>
          )}
        </Card>
        {initial && (
          <LogRow
            onLog={async (mealSlot) => {
              await run(() => logSavedMeal({ mealId: initial.id, date: today, mealSlot }), { success: tm.logged });
            }}
          />
        )}
      </div>
      {dialog}
    </form>
  );
}

// ── Recipes ─────────────────────────────────────────────────────────────────

type RecipeInitial = {
  id: string;
  name: string;
  servings: number;
  totalWeightG: number | null;
  instructions: string | null;
  isFavorite: boolean;
  items: { foodId: string; quantity: number; unit: string }[];
};

export function RecipeEditor({ data, extraFoods, initial }: { data: PickerData; extraFoods: PickerFood[]; initial?: RecipeInitial }) {
  const t = useT();
  const tr = t.nutrition.recipes;
  const locale = useLocale();
  const fmt = useFmt();
  const today = useToday();
  const router = useRouter();
  const slotName = useSlotName();
  const { run, pending } = useRun();
  const { confirm, dialog } = useConfirm();
  const lookups = useLookups(data, extraFoods);
  const [name, setName] = React.useState(initial?.name ?? "");
  const [servings, setServings] = React.useState(formatForInput(initial?.servings ?? 4, 1));
  const [weight, setWeight] = React.useState(initial?.totalWeightG ? formatForInput(initial.totalWeightG, 0) : "");
  const [instructions, setInstructions] = React.useState(initial?.instructions ?? "");
  const [favorite, setFavorite] = React.useState(initial?.isFavorite ?? false);
  const [items, setItems] = React.useState<Item[]>(
    () => initial?.items.map((i) => ({ key: nextKey(), foodId: i.foodId, recipeId: null, quantity: formatForInput(i.quantity, 2), unit: i.unit })) ?? [],
  );
  const total = sumNutrients(items.map((i) => itemNutrients(i, lookups)).filter((n): n is Nutrients => !!n));
  const s = parseDecimal(servings) ?? 0;
  const w = parseDecimal(weight);
  const rawWeight = items.reduce((acc, i) => {
    const f = i.foodId ? lookups.foods.get(i.foodId) : null;
    const base = f ? toBaseAmount(f, parseDecimal(i.quantity) ?? 0, i.unit) : null;
    return acc + (base ?? 0);
  }, 0);
  const clean = cleanItems(items, lookups);
  const valid = !!name.trim() && s > 0 && !!clean?.length;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    const payload = {
      name: name.trim(),
      servings: s,
      totalWeightG: w && w > 0 ? w : null,
      instructions: instructions.trim() || null,
      isFavorite: favorite,
      ingredients: clean!.map((i) => ({ foodId: i.foodId!, quantity: i.quantity, unit: i.unit })),
    };
    const res = initial ? await run(() => updateRecipe({ ...payload, id: initial.id }), { success: tr.saved }) : await run(() => createRecipe(payload), { success: tr.saved });
    if (res.ok && !initial) router.push(`/nutrition/recipes/${res.data.id}`);
  };

  const totalWeight = w && w > 0 ? w : rawWeight;
  return (
    <form onSubmit={save} className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4">
        <Card className="space-y-4">
          <Field label={t.common.name} htmlFor="recipe-name">
            <Input id="recipe-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={tr.servings} htmlFor="recipe-servings">
              <NumberInput id="recipe-servings" value={servings} onValueChange={setServings} stepper step={1} min={1} max={100} />
            </Field>
            <Field label={tr.cookedWeight} htmlFor="recipe-weight" hint={tr.cookedWeightHint}>
              <NumberInput id="recipe-weight" value={weight} onValueChange={setWeight} suffix="g" integer placeholder={rawWeight ? formatForInput(rawWeight, 0) : undefined} />
            </Field>
          </div>
          <SwitchRow label={t.nutrition.favorite} checked={favorite} onCheckedChange={setFavorite} />
        </Card>
        <ItemsEditor items={items} setItems={setItems} data={data} lookups={lookups} allowRecipes={false} title={tr.ingredients} addLabel={tr.addIngredient} />
        <Card>
          <Field label={tr.instructions} htmlFor="recipe-instructions" optional={t.common.optional}>
            <Textarea id="recipe-instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={6} maxLength={8000} />
          </Field>
        </Card>
      </div>
      <div className="space-y-4 lg:sticky lg:top-6">
        <Card>
          {items.length ? (
            <div className="space-y-4">
              <div>
                <div className="mb-2 text-[13px] font-medium text-fg-3">{tr.perServing}</div>
                <NutrientGrid n={multiplyNutrients(total, s > 0 ? 1 / s : 0)} className="sm:grid-cols-3" />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-fg-3">{tr.total}</span>
                <span className="font-semibold tabular">{fmt.kcal(total.calories)}
                  {totalWeight > 0 && ` · ${fmt.int(totalWeight)} g`}</span>
              </div>
              {totalWeight > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-fg-3">{tr.per100g}</span>
                  <span className="font-semibold tabular">{fmt.kcal((total.calories / totalWeight) * 100)}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-fg-3">{tr.noIngredients}</p>
          )}
          <Button type="submit" variant="primary" block className="mt-4" loading={pending} disabled={!valid}>
            {t.common.save}
          </Button>
          {initial && (
            <Button
              type="button"
              variant="destructive-ghost"
              block
              className="mt-2"
              onClick={async () => {
                if (!(await confirm({ title: t.common.delete, description: tr.deleteConfirm, destructive: true, confirmLabel: t.common.delete }))) return;
                const res = await run(() => deleteRecipe({ id: initial.id }), { success: t.common.deleted });
                if (res.ok) router.push("/nutrition/recipes");
              }}
            >
              <Trash2 aria-hidden />
              {t.common.delete}
            </Button>
          )}
        </Card>
        {initial && (
          <LogRow
            servings
            onLog={async (mealSlot, qty) => {
              await run(() => addFoodEntry({ date: today, mealSlot, recipeId: initial.id, foodId: null, quantity: qty, unit: "serving" }), {
                success: format(t.nutrition.added, { meal: slotName(mealSlot) }, locale),
              });
            }}
          />
        )}
      </div>
      {dialog}
    </form>
  );
}
