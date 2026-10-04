"use client";

import * as React from "react";
import { TriangleAlert } from "lucide-react";
import { useF, useT } from "@/components/providers/i18n-provider";
import { useFmt, usePrefs, useToday } from "@/components/providers/prefs-provider";
import { Button } from "@/components/ui/button";
import { formatForInput, NumberInput, parseDecimal } from "@/components/ui/controls";
import { Field, Input } from "@/components/ui/input";
import { assessRate, dailyEnergyBalanceForRate, requiredWeeklyRate } from "@/lib/calc/goal";
import { useRun } from "@/lib/client/run-action";
import { fromDisplayWeight, toDisplayWeight } from "@/lib/units";
import { createGoal, updateGoal } from "@/server/actions/goals";

type GoalInitial = {
  id: string;
  startDate: string;
  startWeightKg: number;
  targetWeightKg: number;
  targetBodyFatPct: number | null;
  targetDate: string | null;
};

export function GoalForm({ initial, currentKg, onDone }: { initial?: GoalInitial; currentKg: number | null; onDone?: () => void }) {
  const t = useT();
  const f = useF();
  const fmt = useFmt();
  const prefs = usePrefs();
  const today = useToday();
  const { run, pending } = useRun();
  const sep = fmt.locale === "el" ? "," : ".";
  const toStr = (kg: number | null | undefined) => formatForInput(kg != null ? toDisplayWeight(kg, prefs.unitSystem) : null, 1, sep);
  const [startDate, setStartDate] = React.useState(initial?.startDate ?? today);
  const [start, setStart] = React.useState(toStr(initial?.startWeightKg ?? currentKg));
  const [target, setTarget] = React.useState(toStr(initial?.targetWeightKg));
  const [bf, setBf] = React.useState(initial?.targetBodyFatPct != null ? formatForInput(initial.targetBodyFatPct, 1, sep) : "");
  const [date, setDate] = React.useState(initial?.targetDate ?? "");

  const kg = (s: string) => (parseDecimal(s) != null ? fromDisplayWeight(parseDecimal(s)!, prefs.unitSystem) : null);
  const startKg = kg(start);
  const targetKg = kg(target);
  const from = currentKg ?? startKg;
  const required = from && targetKg && date ? requiredWeeklyRate(from, targetKg, today, date) : null;
  const safety = required != null && from ? assessRate(required, from) : null;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!startKg || !targetKg) return;
        const payload = { startDate, startWeightKg: startKg, targetWeightKg: targetKg, targetBodyFatPct: parseDecimal(bf), targetDate: date || null, notes: null };
        const res = initial ? await run(() => updateGoal({ id: initial.id, ...payload }), { success: t.goals.saved }) : await run(() => createGoal(payload), { success: t.goals.saved });
        if (res.ok) onDone?.();
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label={t.goals.startWeight}>
          <NumberInput value={start} onValueChange={setStart} suffix={fmt.weightUnit} aria-label={t.goals.startWeight} />
        </Field>
        <Field label={t.goals.startDate} htmlFor="g-start">
          <Input id="g-start" type="date" value={startDate} max={today} onChange={(e) => e.target.value && setStartDate(e.target.value)} />
        </Field>
        <Field label={t.goals.targetWeight}>
          <NumberInput value={target} onValueChange={setTarget} suffix={fmt.weightUnit} aria-label={t.goals.targetWeight} autoFocus />
        </Field>
        <Field label={t.goals.targetDate} htmlFor="g-date" optional={t.common.optional}>
          <Input id="g-date" type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label={t.goals.targetBodyFat} optional={t.common.optional}>
          <NumberInput value={bf} onValueChange={setBf} suffix="%" aria-label={t.goals.targetBodyFat} />
        </Field>
      </div>
      {required != null && (
        <div className="grid grid-cols-2 gap-3 rounded-2xl bg-surface-2 p-4 text-sm">
          <div>
            <div className="text-xs text-fg-3">{t.goals.requiredRate}</div>
            <div className="font-semibold">{f(t.weight.ratePerWeek, { value: fmt.weight(required, { signed: true, decimals: 2 }) })}</div>
          </div>
          <div>
            <div className="text-xs text-fg-3">{required < 0 ? t.goals.requiredDeficit : t.goals.requiredSurplus}</div>
            <div className="font-semibold">≈ {fmt.kcal(Math.abs(dailyEnergyBalanceForRate(required)))}</div>
          </div>
        </div>
      )}
      {safety && safety.level !== "ok" && (
        <div className="flex gap-3 rounded-2xl border border-warn/30 bg-warn/10 p-4 text-sm leading-relaxed text-fg-2">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn-text" aria-hidden />
          <p>
            {f(safety.level === "very_aggressive" ? t.goals.veryAggressiveWarning : t.goals.aggressiveWarning, {
              rate: fmt.weight(Math.abs(required!), { decimals: 2 }),
              pct: fmt.pct(safety.pctPerWeek / 100, 1),
            })}
          </p>
        </div>
      )}
      <Button type="submit" variant="primary" size="lg" block loading={pending} disabled={!startKg || !targetKg}>
        {t.common.save}
      </Button>
    </form>
  );
}
