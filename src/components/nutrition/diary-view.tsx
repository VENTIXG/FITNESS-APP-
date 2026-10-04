"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookmarkPlus, CalendarDays, ChevronLeft, ChevronRight, Copy, Eraser, MoreHorizontal, Plus, Settings2, Zap } from "lucide-react";
import { toast } from "sonner";
import { useLocale, useT } from "@/components/providers/i18n-provider";
import { useFmt, usePrefs, useToday } from "@/components/providers/prefs-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Meter } from "@/components/ui/data-display";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { macroSplit, sumNutrients, type Nutrients } from "@/lib/calc/nutrition";
import { useRun } from "@/lib/client/run-action";
import { addDays, timeInTimeZone, type ISODate } from "@/lib/dates";
import { quantityLabel } from "@/lib/food-units";
import { format } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { addFoodEntry, clearMeal, copyEntries, logSavedMeal } from "@/server/actions/nutrition";
import type { DiaryEntry, PickerData } from "@/server/queries/nutrition";
import { EntryEditorSheet, QuickAddSheet, SaveMealSheet, SlotSelect } from "./entry-sheets";
import { FoodPicker } from "./food-picker";
import { MACRO_COLORS, MacroLine, useSlotName } from "./shared";

type Target = { calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number } | null;

/** Guess the meal slot from the time of day (only for the default slot ids). */
function guessSlot(slotIds: string[], timezone: string) {
  const [h] = timeInTimeZone(timezone).split(":").map(Number);
  const guess = h < 11 ? "breakfast" : h < 16 ? "lunch" : h < 22 ? "dinner" : "snacks";
  return slotIds.includes(guess) ? guess : slotIds[0];
}

export function DiaryView({
  date,
  entries,
  totals,
  target,
  picker,
  prevDayCount,
  openAdd,
}: {
  date: ISODate;
  entries: DiaryEntry[];
  totals: Nutrients;
  target: Target;
  picker: PickerData;
  prevDayCount: number;
  openAdd: boolean;
}) {
  const t = useT();
  const tn = t.nutrition;
  const locale = useLocale();
  const prefs = usePrefs();
  const router = useRouter();
  const pathname = usePathname();
  const slotName = useSlotName();
  const { run } = useRun();
  const { confirm, dialog } = useConfirm();

  const slotIds = React.useMemo(() => {
    const ids = prefs.mealSlots.map((s) => s.id);
    // Entries in slots that were removed from preferences still show up.
    for (const e of entries) if (!ids.includes(e.mealSlot)) ids.push(e.mealSlot);
    return ids;
  }, [prefs.mealSlots, entries]);

  const [addSlot, setAddSlot] = React.useState<string | null>(null);
  // `?add=1` (from the global + button) opens the picker for the likely meal.
  const [seenOpenAdd, setSeenOpenAdd] = React.useState(false);
  if (openAdd !== seenOpenAdd) {
    setSeenOpenAdd(openAdd);
    if (openAdd) setAddSlot(guessSlot(prefs.mealSlots.map((s) => s.id), prefs.timezone));
  }
  const [quickSlot, setQuickSlot] = React.useState<string | null>(null);
  const [saveSlot, setSaveSlot] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<DiaryEntry | null>(null);

  React.useEffect(() => {
    if (openAdd) router.replace(date === prefs.today ? pathname : `${pathname}?date=${date}`, { scroll: false });
  }, [openAdd, prefs.today, router, pathname, date]);

  const copyFrom = async (fromDate: ISODate, slot: string | null) => {
    const res = await run(() => copyEntries({ fromDate, toDate: date, fromSlot: slot, toSlot: slot }));
    if (res.ok) {
      if (res.data.count) toast.success(format(tn.copied, { count: res.data.count }, locale));
      else toast.info(tn.nothingToCopy);
    }
  };

  const copyPreviousDay = async () => {
    if (!prevDayCount) {
      toast.info(tn.nothingToCopy);
      return;
    }
    const fmtD = (d: string) => (d === prefs.today ? t.common.today : d === addDays(prefs.today, -1) ? t.common.yesterday : "");
    const prev = addDays(date, -1);
    if (
      await confirm({
        title: tn.copyDayTitle,
        description: format(tn.copyDayBody, { count: prevDayCount, date: fmtD(prev) || prev, target: fmtD(date) || date }, locale),
        confirmLabel: t.common.copy,
      })
    )
      await copyFrom(prev, null);
  };

  return (
    <div className="space-y-4">
      <DateNav date={date} actions={
        <Menu>
          <MenuTrigger asChild>
            <Button variant="secondary" size="icon" aria-label={t.common.actions}>
              <MoreHorizontal />
            </Button>
          </MenuTrigger>
          <MenuContent>
            <MenuItem icon={<Copy />} onSelect={copyPreviousDay}>
              {tn.copyPreviousDay}
            </MenuItem>
            <MenuItem icon={<Zap />} onSelect={() => setQuickSlot(guessSlot(slotIds, prefs.timezone))}>
              {tn.quickAdd}
            </MenuItem>
            <MenuSeparator />
            <MenuItem icon={<Settings2 />} asChild>
              <Link href="/settings/nutrition">{tn.targets.title}</Link>
            </MenuItem>
          </MenuContent>
        </Menu>
      } />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="lg:order-2 lg:sticky lg:top-6">
          <DaySummary totals={totals} target={target} />
        </div>
        <div className="space-y-3 lg:order-1">
          {slotIds.map((slot) => (
            <MealSection
              key={slot}
              slot={slot}
              name={slotName(slot)}
              entries={entries.filter((e) => e.mealSlot === slot)}
              onAdd={() => setAddSlot(slot)}
              onEdit={setEditing}
              onQuickAdd={() => setQuickSlot(slot)}
              onCopyYesterday={() => copyFrom(addDays(date, -1), slot)}
              onSaveMeal={() => setSaveSlot(slot)}
              onClear={async () => {
                if (await confirm({ title: tn.clearMeal, description: format(tn.clearMealConfirm, { meal: slotName(slot) }, locale), destructive: true, confirmLabel: tn.clearMeal }))
                  await run(() => clearMeal({ date, mealSlot: slot }), { success: t.common.deleted });
              }}
            />
          ))}
          {!entries.length && (
            <p className="px-1 pt-1 text-center text-[13px] text-fg-3">{tn.emptyDayBody}</p>
          )}
        </div>
      </div>

      <Sheet open={addSlot != null} onOpenChange={(o) => !o && setAddSlot(null)}>
        {addSlot != null && (
          <SheetContent title={format(tn.addTo, { meal: slotName(addSlot) }, locale)} size="lg" flush className="sm:h-[80dvh]">
            <FoodPicker
              data={picker}
              submitLabel={t.common.add}
              keepOpenAfterSubmit
              amountExtra={<SlotSelect id="add-slot" value={addSlot} onChange={setAddSlot} label={tn.meal} />}
              onSubmit={async (sel) => {
                const res = await run(() => addFoodEntry({ date, mealSlot: addSlot, foodId: sel.foodId ?? null, recipeId: sel.recipeId ?? null, quantity: sel.quantity, unit: sel.unit }), {
                  success: format(tn.added, { meal: slotName(addSlot) }, locale),
                });
                return res.ok;
              }}
              onLogMeal={async (meal) => {
                const res = await run(() => logSavedMeal({ mealId: meal.id, date, mealSlot: addSlot }), { success: tn.meals.logged });
                return res.ok;
              }}
            />
          </SheetContent>
        )}
      </Sheet>
      <QuickAddSheet open={quickSlot != null} onOpenChange={(o) => !o && setQuickSlot(null)} date={date} slot={quickSlot ?? slotIds[0]} />
      <SaveMealSheet open={saveSlot != null} onOpenChange={(o) => !o && setSaveSlot(null)} date={date} slot={saveSlot ?? slotIds[0]} />
      <EntryEditorSheet entry={editing} onClose={() => setEditing(null)} />
      {dialog}
    </div>
  );
}

function DateNav({ date, actions }: { date: ISODate; actions?: React.ReactNode }) {
  const t = useT();
  const fmt = useFmt();
  const today = useToday();
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const go = (d: ISODate) => startTransition(() => router.push(d === today ? "/nutrition" : `/nutrition?date=${d}`, { scroll: false }));
  const label = date === today ? t.common.today : date === addDays(today, -1) ? t.common.yesterday : fmt.date(date, "weekday");
  const inputRef = React.useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-2">
      <div className={cn("flex min-w-0 flex-1 items-center gap-1 rounded-2xl border border-border bg-surface p-1 transition-opacity", pending && "opacity-60")}>
        <Button variant="ghost" size="icon" onClick={() => go(addDays(date, -1))} aria-label={t.common.previous}>
          <ChevronLeft />
        </Button>
        <label className="relative flex min-w-0 flex-1 cursor-pointer flex-col items-center justify-center rounded-xl py-1 transition hover:bg-surface-2">
          <span className="truncate text-[15px] font-semibold text-fg">{label}</span>
          <span className="flex items-center gap-1 text-xs text-fg-3">
            <CalendarDays className="size-3" aria-hidden />
            {fmt.date(date, "medium")}
          </span>
          <input
            ref={inputRef}
            type="date"
            value={date}
            max={today}
            onChange={(e) => e.target.value && go(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label={t.common.date}
          />
        </label>
        <Button variant="ghost" size="icon" onClick={() => go(addDays(date, 1))} disabled={date >= today} aria-label={t.common.next}>
          <ChevronRight />
        </Button>
      </div>
      {date !== today && (
        <Button variant="secondary" onClick={() => go(today)}>
          {t.common.today}
        </Button>
      )}
      {actions}
    </div>
  );
}

function DaySummary({ totals, target }: { totals: Nutrients; target: Target }) {
  const t = useT();
  const tn = t.nutrition;
  const fmt = useFmt();
  const consumed = totals.calories;
  const remaining = target ? target.calories - consumed : null;
  const split = macroSplit(totals);
  const macros = [
    { k: "p", label: tn.protein, v: totals.proteinG, tgt: target?.proteinG, c: MACRO_COLORS.protein, pct: split.protein },
    { k: "c", label: tn.carbs, v: totals.carbsG, tgt: target?.carbsG, c: MACRO_COLORS.carbs, pct: split.carbs },
    { k: "f", label: tn.fat, v: totals.fatG, tgt: target?.fatG, c: MACRO_COLORS.fat, pct: split.fat },
    { k: "fi", label: tn.fiber, v: totals.fiberG, tgt: target?.fiberG, c: MACRO_COLORS.fiber, pct: null },
  ];
  return (
    <Card>
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-[13px] text-fg-3">{remaining == null ? tn.consumed : remaining >= 0 ? tn.remaining : tn.over}</div>
          <div className="mt-0.5 text-[34px] leading-none font-semibold tracking-tight tabular">
            {fmt.int(remaining == null ? consumed : Math.abs(remaining))}
            <span className="ml-1 text-base font-normal text-fg-3">kcal</span>
          </div>
        </div>
        {target && (
          <div className="text-right text-[13px] tabular">
            <div className="text-fg-3">
              {tn.consumed} <span className="font-semibold text-fg">{fmt.int(consumed)}</span>
            </div>
            <div className="text-fg-3">
              {tn.target} <span className="font-semibold text-fg">{fmt.int(target.calories)}</span>
            </div>
          </div>
        )}
      </div>
      {target ? (
        <Meter className="mt-3" value={consumed} max={target.calories} color={MACRO_COLORS.calories} height={10} label={tn.calories} />
      ) : (
        <p className="mt-3 text-[13px] text-fg-3">
          {t.dashboard.noTargets}{" "}
          <Link href="/settings/nutrition" className="font-medium text-accent hover:underline">
            {t.dashboard.setTargets}
          </Link>
        </p>
      )}
      <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4">
        {macros.map((m) => (
          <li key={m.k}>
            <div className="mb-1.5 flex items-baseline justify-between gap-1 text-[13px]">
              <span className="flex items-center gap-1.5 text-fg-2">
                <span className="size-2 rounded-full" style={{ background: m.c }} aria-hidden />
                {m.label}
              </span>
              {m.pct != null && consumed > 0 && <span className="text-[11px] text-fg-3 tabular">{fmt.pct(m.pct)}</span>}
            </div>
            <div className="mb-1.5 text-sm tabular">
              <span className="font-semibold text-fg">{fmt.int(m.v)}</span>
              <span className="text-fg-3"> / {m.tgt != null ? fmt.int(m.tgt) : "—"} g</span>
            </div>
            <Meter value={m.v} max={m.tgt ?? 0} color={m.c} height={6} label={m.label} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function MealSection({
  slot,
  name,
  entries,
  onAdd,
  onEdit,
  onQuickAdd,
  onCopyYesterday,
  onSaveMeal,
  onClear,
}: {
  slot: string;
  name: string;
  entries: DiaryEntry[];
  onAdd: () => void;
  onEdit: (e: DiaryEntry) => void;
  onQuickAdd: () => void;
  onCopyYesterday: () => void;
  onSaveMeal: () => void;
  onClear: () => void;
}) {
  const t = useT();
  const tn = t.nutrition;
  const locale = useLocale();
  const fmt = useFmt();
  const totals = sumNutrients(entries);
  const canSave = entries.some((e) => e.foodId || e.recipeId);
  return (
    <Card className="p-0" aria-labelledby={`meal-${slot}`}>
      <div className="flex items-center gap-2 px-4 pt-3.5 pb-2 sm:px-5">
        <div className="min-w-0 flex-1">
          <h2 id={`meal-${slot}`} className="text-[15px] font-semibold tracking-tight text-fg">
            {name}
          </h2>
          {entries.length > 0 && <MacroLine n={totals} className="mt-0.5" />}
        </div>
        {entries.length > 0 && (
          <span className="text-sm font-semibold tabular text-fg">
            {fmt.int(totals.calories)}
            <span className="ml-0.5 text-xs font-normal text-fg-3">kcal</span>
          </span>
        )}
        <Menu>
          <MenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`${t.common.actions}: ${name}`}>
              <MoreHorizontal />
            </Button>
          </MenuTrigger>
          <MenuContent>
            <MenuItem icon={<Zap />} onSelect={onQuickAdd}>
              {tn.quickAdd}
            </MenuItem>
            <MenuItem icon={<Copy />} onSelect={onCopyYesterday}>
              {tn.copyYesterday}
            </MenuItem>
            {canSave && (
              <MenuItem icon={<BookmarkPlus />} onSelect={onSaveMeal}>
                {tn.saveAsMeal}
              </MenuItem>
            )}
            {entries.length > 0 && (
              <>
                <MenuSeparator />
                <MenuItem icon={<Eraser />} destructive onSelect={onClear}>
                  {tn.clearMeal}
                </MenuItem>
              </>
            )}
          </MenuContent>
        </Menu>
      </div>
      {entries.length > 0 && (
        <ul className="divide-y divide-border border-t border-border">
          {entries.map((e) => (
            <li key={e.id}>
              <button type="button" onClick={() => onEdit(e)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-surface-2 sm:px-5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-fg">{e.name}</div>
                  <div className="truncate text-xs text-fg-3">
                    {[e.brand, e.foodId || e.recipeId ? quantityLabel(e.quantity, e.unit, e.servings, locale, fmt.number) : null].filter(Boolean).join(" · ")}
                    {!e.foodId && !e.recipeId && <span>{tn.quickAdd}</span>}
                  </div>
                </div>
                <span className="shrink-0 text-sm tabular text-fg-2">{fmt.int(e.calories)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className={cn("px-2 pb-2", entries.length ? "pt-1" : "pt-0")}>
        <button
          type="button"
          onClick={onAdd}
          className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2.5 text-sm font-medium text-accent transition hover:bg-accent-soft sm:px-3"
        >
          <Plus className="size-4" aria-hidden />
          {tn.addFood}
        </button>
      </div>
    </Card>
  );
}
