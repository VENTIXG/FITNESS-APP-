"use client";

import * as React from "react";
import { Copy, Trash2 } from "lucide-react";
import { useLocale, useT } from "@/components/providers/i18n-provider";
import { useFmt, usePrefs, useToday } from "@/components/providers/prefs-provider";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { NumberInput, Select, formatForInput, parseDecimal } from "@/components/ui/controls";
import { Field, Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { multiplyNutrients, scaleNutrients, type Nutrients } from "@/lib/calc/nutrition";
import { useRun } from "@/lib/client/run-action";
import { toBaseAmount, unitOptions } from "@/lib/food-units";
import { format } from "@/lib/i18n";
import { deleteFoodEntry, duplicateFoodEntry, quickAddEntry, saveMealFromDiary, updateFoodEntry } from "@/server/actions/nutrition";
import type { DiaryEntry } from "@/server/queries/nutrition";
import { NutrientGrid, useSlotName } from "./shared";

export function SlotSelect({ id, value, onChange, label }: { id: string; value: string; onChange: (v: string) => void; label?: string }) {
  const t = useT();
  const prefs = usePrefs();
  const slotName = useSlotName();
  const slots = prefs.mealSlots.some((s) => s.id === value) ? prefs.mealSlots : [...prefs.mealSlots, { id: value, name: null }];
  return (
    <Field label={label ?? t.nutrition.moveTo} htmlFor={id}>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {slots.map((s) => (
          <option key={s.id} value={s.id}>
            {slotName(s.id)}
          </option>
        ))}
      </Select>
    </Field>
  );
}

const nutrientsOf = (e: DiaryEntry): Nutrients => ({
  calories: e.calories,
  proteinG: e.proteinG,
  carbsG: e.carbsG,
  fatG: e.fatG,
  fiberG: e.fiberG,
  sugarG: e.sugarG,
  sodiumMg: e.sodiumMg,
});

export function EntryEditorSheet({ entry, onClose }: { entry: DiaryEntry | null; onClose: () => void }) {
  const t = useT();
  return (
    <Sheet open={!!entry} onOpenChange={(o) => !o && onClose()}>
      {entry && (
        <SheetContent title={t.nutrition.editEntry} description={entry.name}>
          <EntryEditor key={entry.id} entry={entry} onDone={onClose} />
        </SheetContent>
      )}
    </Sheet>
  );
}

function EntryEditor({ entry, onDone }: { entry: DiaryEntry; onDone: () => void }) {
  const t = useT();
  const tn = t.nutrition;
  const locale = useLocale();
  const today = useToday();
  const fmt = useFmt();
  const { run, pending } = useRun();
  const { confirm, dialog } = useConfirm();
  const [qty, setQty] = React.useState(formatForInput(entry.quantity, 2));
  const [unit, setUnit] = React.useState(entry.unit);
  const [slot, setSlot] = React.useState(entry.mealSlot);
  const [date, setDate] = React.useState(entry.date);

  // Per-100 values are recovered from the snapshot. Units can only change for entries still linked to a food with known unit data.
  const food = entry.foodId && entry.baseUnit ? { baseUnit: entry.baseUnit, servings: entry.servings } : null;
  const per100 = food && entry.baseAmount ? scaleNutrients(nutrientsOf(entry), (100 * 100) / entry.baseAmount) : null;
  const q = parseDecimal(qty) ?? 0;
  let preview: Nutrients | null = null;
  if (food && per100) {
    const base = toBaseAmount(food, q, unit);
    preview = base != null ? scaleNutrients(per100, base) : null;
  } else if (q > 0) {
    preview = multiplyNutrients(nutrientsOf(entry), q / entry.quantity);
  }
  const serving = entry.servings.find((s) => s.id === unit);
  const unitLabel = unit === "serving" ? tn.servingSize : serving ? (locale === "el" && serving.labelEl) || serving.label : unit;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!preview) return;
    const res = await run(() => updateFoodEntry({ id: entry.id, quantity: q, unit, mealSlot: slot, date }), { success: tn.entryUpdated });
    if (res.ok) onDone();
  };

  return (
    <form onSubmit={save} className="space-y-5">
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <Field label={tn.amount} htmlFor="entry-qty">
          <NumberInput id="entry-qty" value={qty} onValueChange={setQty} />
        </Field>
        <Field label={t.common.unit} htmlFor="entry-unit">
          {food ? (
            <Select id="entry-unit" value={unit} onChange={(e) => setUnit(e.target.value)} className="min-w-32">
              {unitOptions(food, locale).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </Select>
          ) : (
            <div className="flex h-11 min-w-24 items-center rounded-xl border border-border bg-surface-2 px-3.5 text-sm text-fg-2">{unitLabel}</div>
          )}
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SlotSelect id="entry-slot" value={slot} onChange={setSlot} />
        <Field label={t.common.date} htmlFor="entry-date">
          <Input id="entry-date" type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </Field>
      </div>
      {preview ? <NutrientGrid n={preview} /> : <p className="text-sm text-fg-3">{t.common.invalidNumber}</p>}
      <Button type="submit" variant="primary" block size="lg" loading={pending} disabled={!preview}>
        {t.common.save}
      </Button>
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={async () => {
            const res = await run(() => duplicateFoodEntry({ id: entry.id }), { success: t.common.copied });
            if (res.ok) onDone();
          }}
        >
          <Copy aria-hidden />
          {t.common.duplicate}
        </Button>
        <Button
          type="button"
          variant="destructive-ghost"
          onClick={async () => {
            if (!(await confirm({ title: t.common.delete, description: `${entry.name} · ${fmt.kcal(entry.calories)}`, destructive: true, confirmLabel: t.common.delete }))) return;
            const res = await run(() => deleteFoodEntry({ id: entry.id }), { success: tn.entryDeleted });
            if (res.ok) onDone();
          }}
        >
          <Trash2 aria-hidden />
          {t.common.delete}
        </Button>
      </div>
      {dialog}
    </form>
  );
}

export function QuickAddSheet({ open, onOpenChange, date, slot }: { open: boolean; onOpenChange: (o: boolean) => void; date: string; slot: string }) {
  const t = useT();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {open && (
        <SheetContent title={t.nutrition.quickAddTitle}>
          <QuickAddForm date={date} initialSlot={slot} onDone={() => onOpenChange(false)} />
        </SheetContent>
      )}
    </Sheet>
  );
}

function QuickAddForm({ date, initialSlot, onDone }: { date: string; initialSlot: string; onDone: () => void }) {
  const t = useT();
  const tn = t.nutrition;
  const locale = useLocale();
  const slotName = useSlotName();
  const { run, pending } = useRun();
  const [name, setName] = React.useState("");
  const [kcal, setKcal] = React.useState("");
  const [p, setP] = React.useState("");
  const [c, setC] = React.useState("");
  const [f, setF] = React.useState("");
  const [fi, setFi] = React.useState("");
  const [slot, setSlot] = React.useState(initialSlot);
  const k = parseDecimal(kcal);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (k == null || k < 0) return;
    const res = await run(
      () =>
        quickAddEntry({
          date,
          mealSlot: slot,
          name: name.trim() || undefined,
          calories: k,
          proteinG: parseDecimal(p) ?? 0,
          carbsG: parseDecimal(c) ?? 0,
          fatG: parseDecimal(f) ?? 0,
          fiberG: parseDecimal(fi) ?? 0,
        }),
      { success: format(tn.added, { meal: slotName(slot) }, locale) },
    );
    if (res.ok) onDone();
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label={t.common.name} htmlFor="qa-name" optional={t.common.optional}>
        <Input id="qa-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder={tn.quickAddName} />
      </Field>
      <Field label={tn.calories} htmlFor="qa-kcal">
        <NumberInput id="qa-kcal" value={kcal} onValueChange={setKcal} suffix="kcal" integer required autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label={tn.protein} htmlFor="qa-p">
          <NumberInput id="qa-p" value={p} onValueChange={setP} suffix="g" />
        </Field>
        <Field label={tn.carbs} htmlFor="qa-c">
          <NumberInput id="qa-c" value={c} onValueChange={setC} suffix="g" />
        </Field>
        <Field label={tn.fat} htmlFor="qa-f">
          <NumberInput id="qa-f" value={f} onValueChange={setF} suffix="g" />
        </Field>
        <Field label={tn.fiber} htmlFor="qa-fi">
          <NumberInput id="qa-fi" value={fi} onValueChange={setFi} suffix="g" />
        </Field>
      </div>
      <SlotSelect id="qa-slot" value={slot} onChange={setSlot} label={tn.meal} />
      <Button type="submit" variant="primary" block size="lg" loading={pending} disabled={k == null}>
        {t.common.add}
      </Button>
    </form>
  );
}

export function SaveMealSheet({ open, onOpenChange, date, slot }: { open: boolean; onOpenChange: (o: boolean) => void; date: string; slot: string }) {
  const t = useT();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {open && (
        <SheetContent title={t.nutrition.saveMealTitle} size="sm">
          <SaveMealForm date={date} slot={slot} onDone={() => onOpenChange(false)} />
        </SheetContent>
      )}
    </Sheet>
  );
}

function SaveMealForm({ date, slot, onDone }: { date: string; slot: string; onDone: () => void }) {
  const t = useT();
  const slotName = useSlotName();
  const { run, pending } = useRun();
  const [name, setName] = React.useState(() => slotName(slot));
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        const res = await run(() => saveMealFromDiary({ name: name.trim(), date, mealSlot: slot }), { success: t.nutrition.mealSaved });
        if (res.ok) onDone();
      }}
    >
      <Field label={t.nutrition.mealName} htmlFor="meal-name">
        <Input id="meal-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required autoFocus />
      </Field>
      <Button type="submit" variant="primary" block loading={pending} disabled={!name.trim()}>
        {t.common.save}
      </Button>
    </form>
  );
}
