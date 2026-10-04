"use client";

import * as React from "react";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { useLocale, useT } from "@/components/providers/i18n-provider";
import { useFmt } from "@/components/providers/prefs-provider";
import { Button } from "@/components/ui/button";
import { NumberInput, Segmented, formatForInput, parseDecimal } from "@/components/ui/controls";
import { Field, Input } from "@/components/ui/input";
import { caloriesFromMacros } from "@/lib/calc/nutrition";
import { useRun } from "@/lib/client/run-action";
import { format } from "@/lib/i18n";
import { createFood, updateFood } from "@/server/actions/nutrition";

export type FoodFormValues = {
  id?: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  baseUnit: "g" | "ml";
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sugarG: number | null;
  sodiumMg: number | null;
  servings: { id: string; label: string; amount: number }[];
  defaultServingId: string | null;
  source?: "custom" | "openfoodfacts";
  externalId?: string | null;
};

type ServingRow = { id: string; label: string; amount: string };

const newId = () => `s${Math.random().toString(36).slice(2, 9)}`;

export function FoodForm({
  initial,
  onSaved,
  submitLabel,
  formId = "food-form",
  hideSubmit,
}: {
  initial?: Partial<FoodFormValues>;
  onSaved?: (id: string) => void;
  submitLabel?: string;
  formId?: string;
  hideSubmit?: boolean;
}) {
  const t = useT();
  const tf = t.nutrition.foods;
  const fmt = useFmt();
  const locale = useLocale();
  const { run, pending } = useRun();
  const num = (v: number | null | undefined, d = 1) => (v == null ? "" : formatForInput(v, d));

  const [name, setName] = React.useState(initial?.name ?? "");
  const [brand, setBrand] = React.useState(initial?.brand ?? "");
  const [barcode, setBarcode] = React.useState(initial?.barcode ?? "");
  const [baseUnit, setBaseUnit] = React.useState<"g" | "ml">(initial?.baseUnit ?? "g");
  const [kcal, setKcal] = React.useState(num(initial?.calories, 0));
  const [protein, setProtein] = React.useState(num(initial?.proteinG));
  const [carbs, setCarbs] = React.useState(num(initial?.carbsG));
  const [fat, setFat] = React.useState(num(initial?.fatG));
  const [fiber, setFiber] = React.useState(num(initial?.fiberG));
  const [sugar, setSugar] = React.useState(num(initial?.sugarG));
  const [sodium, setSodium] = React.useState(num(initial?.sodiumMg, 0));
  const [servings, setServings] = React.useState<ServingRow[]>(
    (initial?.servings ?? []).map((s) => ({ id: s.id, label: s.label, amount: formatForInput(s.amount, 1) })),
  );
  const [defaultServing, setDefaultServing] = React.useState<string | null>(initial?.defaultServingId ?? null);
  const [error, setError] = React.useState<string | null>(null);

  const p = parseDecimal(protein) ?? 0;
  const c = parseDecimal(carbs) ?? 0;
  const f = parseDecimal(fat) ?? 0;
  const k = parseDecimal(kcal);
  const fromMacros = caloriesFromMacros({ proteinG: p, carbsG: c, fatG: f });
  const mismatch = k != null && fromMacros > 0 && Math.abs(fromMacros - k) > Math.max(25, k * 0.2);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || k == null) {
      setError(t.common.required);
      return;
    }
    const cleanServings = servings
      .map((s) => ({ id: s.id, label: s.label.trim(), amount: parseDecimal(s.amount) ?? 0 }))
      .filter((s) => s.label && s.amount > 0);
    const values = {
      name: name.trim(),
      brand: brand.trim() || null,
      barcode: barcode.trim() || null,
      baseUnit,
      calories: k,
      proteinG: p,
      carbsG: c,
      fatG: f,
      fiberG: parseDecimal(fiber) ?? 0,
      sugarG: parseDecimal(sugar),
      sodiumMg: parseDecimal(sodium),
      servings: cleanServings,
      defaultServingId: cleanServings.some((s) => s.id === defaultServing) ? defaultServing : null,
      source: initial?.source ?? "custom",
      externalId: initial?.externalId ?? null,
    };
    const res = initial?.id
      ? await run(() => updateFood({ ...values, id: initial.id! }), { success: tf.saved })
      : await run(() => createFood(values), { success: tf.saved });
    if (res.ok) onSaved?.(initial?.id ?? (res.data as { id: string }).id);
  };

  const unitLabel = baseUnit;
  return (
    <form id={formId} onSubmit={submit} className="space-y-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={tf.name} htmlFor={`${formId}-name`} className="sm:col-span-2">
          <Input id={`${formId}-name`} value={name} onChange={(e) => setName(e.target.value)} required maxLength={160} autoComplete="off" />
        </Field>
        <Field label={tf.brand} htmlFor={`${formId}-brand`} optional={t.common.optional}>
          <Input id={`${formId}-brand`} value={brand} onChange={(e) => setBrand(e.target.value)} maxLength={120} autoComplete="off" />
        </Field>
        <Field label={tf.barcode} htmlFor={`${formId}-barcode`} optional={t.common.optional}>
          <Input id={`${formId}-barcode`} value={barcode} onChange={(e) => setBarcode(e.target.value.replace(/\D/g, ""))} inputMode="numeric" maxLength={14} autoComplete="off" />
        </Field>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">{format(tf.nutrientsPer, { unit: unitLabel }, locale)}</h3>
          <Segmented
            size="sm"
            ariaLabel={tf.baseUnit}
            value={baseUnit}
            onChange={setBaseUnit}
            options={[
              { value: "g", label: tf.per100g },
              { value: "ml", label: tf.per100ml },
            ]}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label={t.nutrition.calories} htmlFor={`${formId}-kcal`}>
            <NumberInput id={`${formId}-kcal`} value={kcal} onValueChange={setKcal} suffix="kcal" integer required />
          </Field>
          <Field label={t.nutrition.protein} htmlFor={`${formId}-p`}>
            <NumberInput id={`${formId}-p`} value={protein} onValueChange={setProtein} suffix="g" />
          </Field>
          <Field label={t.nutrition.carbs} htmlFor={`${formId}-c`}>
            <NumberInput id={`${formId}-c`} value={carbs} onValueChange={setCarbs} suffix="g" />
          </Field>
          <Field label={t.nutrition.fat} htmlFor={`${formId}-f`}>
            <NumberInput id={`${formId}-f`} value={fat} onValueChange={setFat} suffix="g" />
          </Field>
          <Field label={t.nutrition.fiber} htmlFor={`${formId}-fi`}>
            <NumberInput id={`${formId}-fi`} value={fiber} onValueChange={setFiber} suffix="g" />
          </Field>
          <Field label={t.nutrition.sugar} htmlFor={`${formId}-s`} optional={t.common.optional}>
            <NumberInput id={`${formId}-s`} value={sugar} onValueChange={setSugar} suffix="g" />
          </Field>
          <Field label={t.nutrition.sodium} htmlFor={`${formId}-na`} optional={t.common.optional}>
            <NumberInput id={`${formId}-na`} value={sodium} onValueChange={setSodium} suffix="mg" integer />
          </Field>
        </div>
        {mismatch && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-warn/10 px-3 py-2.5 text-[13px] text-warn-text" role="status">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {format(tf.kcalCheck, { kcal: fmt.int(fromMacros) }, locale)}
          </p>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold">{tf.servingsTitle}</h3>
        <p className="mt-0.5 mb-3 text-[13px] text-fg-3">{format(tf.servingsHint, { unit: unitLabel }, locale)}</p>
        <ul className="space-y-2">
          {servings.map((s, i) => (
            <li key={s.id} className="flex items-end gap-2">
              <Field label={i === 0 ? tf.servingLabel : undefined} className="min-w-0 flex-1">
                <Input
                  aria-label={tf.servingLabel}
                  value={s.label}
                  maxLength={60}
                  onChange={(e) => setServings((rows) => rows.map((r) => (r.id === s.id ? { ...r, label: e.target.value } : r)))}
                />
              </Field>
              <Field label={i === 0 ? format(tf.servingAmount, { unit: unitLabel }, locale) : undefined} className="w-28">
                <NumberInput
                  aria-label={format(tf.servingAmount, { unit: unitLabel }, locale)}
                  value={s.amount}
                  suffix={unitLabel}
                  onValueChange={(v) => setServings((rows) => rows.map((r) => (r.id === s.id ? { ...r, amount: v } : r)))}
                />
              </Field>
              <label className="mb-3 flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-fg-3">
                <input
                  type="radio"
                  name={`${formId}-default`}
                  className="accent-[var(--accent)]"
                  checked={defaultServing === s.id}
                  onChange={() => setDefaultServing(s.id)}
                />
                {tf.defaultServing}
              </label>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t.common.remove}
                onClick={() => setServings((rows) => rows.filter((r) => r.id !== s.id))}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
        {servings.length < 10 && (
          <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={() => setServings((rows) => [...rows, { id: newId(), label: "", amount: "" }])}>
            <Plus aria-hidden />
            {tf.addServing}
          </Button>
        )}
      </div>

      {error && (
        <p className="text-sm text-critical-text" role="alert">
          {error}
        </p>
      )}
      {!hideSubmit && (
        <Button type="submit" variant="primary" block loading={pending}>
          {submitLabel ?? t.common.save}
        </Button>
      )}
    </form>
  );
}
