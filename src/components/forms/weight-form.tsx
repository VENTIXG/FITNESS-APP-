"use client";

import * as React from "react";
import { toast } from "sonner";
import { useF, useT } from "@/components/providers/i18n-provider";
import { useFmt, usePrefs, useToday } from "@/components/providers/prefs-provider";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatForInput, NumberInput, parseDecimal } from "@/components/ui/controls";
import { Field, Input } from "@/components/ui/input";
import { useRun } from "@/lib/client/run-action";
import { addDays } from "@/lib/dates";
import { fromDisplayWeight, toDisplayWeight } from "@/lib/units";
import { logWeight, updateWeight } from "@/server/actions/body";

type Props = {
  onDone?: () => void;
  /** Prefill (kg) — usually the most recent weigh-in. */
  lastWeightKg?: number | null;
  initial?: { id: string; date: string; weightKg: number; note: string | null };
  defaultDate?: string;
};

export function WeightForm({ onDone, lastWeightKg, initial, defaultDate }: Props) {
  const t = useT();
  const f = useF();
  const fmt = useFmt();
  const prefs = usePrefs();
  const today = useToday();
  const { run, pending } = useRun();
  const decimalSep = fmt.locale === "el" ? "," : ".";
  const startKg = initial?.weightKg ?? lastWeightKg ?? null;
  const [value, setValue] = React.useState(formatForInput(startKg != null ? toDisplayWeight(startKg, prefs.unitSystem) : null, 1, decimalSep));
  const [date, setDate] = React.useState(initial?.date ?? defaultDate ?? today);
  const [note, setNote] = React.useState(initial?.note ?? "");
  const [confirmReplace, setConfirmReplace] = React.useState<number | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    // Select the prefilled value so typing replaces it immediately.
    const id = window.setTimeout(() => inputRef.current?.select(), 50);
    return () => window.clearTimeout(id);
  }, []);

  const parsed = parseDecimal(value);
  const kg = parsed != null ? fromDisplayWeight(parsed, prefs.unitSystem) : null;
  const invalid = kg != null && (kg < 20 || kg > 400);

  async function submit(replace = false) {
    if (kg == null || invalid) return;
    if (initial) {
      const res = await run(() => updateWeight({ id: initial.id, date, weightKg: kg, note }), { success: t.weight.saved });
      if (res.ok) onDone?.();
      return;
    }
    const res = await run(() => logWeight({ date, weightKg: kg, note, replace }));
    if (!res.ok) return;
    if (res.data.status === "exists") {
      setConfirmReplace(res.data.existingKg);
      return;
    }
    toast.success(t.weight.saved);
    onDone?.();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-4"
    >
      <Field label={t.weight.weight} htmlFor="weight-value" error={invalid ? (kg! < 20 ? t.common.tooLow : t.common.tooHigh) : undefined}>
        <NumberInput
          ref={inputRef}
          id="weight-value"
          value={value}
          onValueChange={setValue}
          suffix={fmt.weightUnit}
          stepper
          step={0.1}
          min={0}
          inputClassName="h-14 text-2xl font-semibold"
          aria-invalid={invalid || undefined}
          autoFocus
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t.common.date} htmlFor="weight-date">
          <Input id="weight-date" type="date" value={date} max={addDays(today, 1)} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </Field>
        <Field label={t.common.note} htmlFor="weight-note" optional={t.common.optional}>
          <Input id="weight-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        </Field>
      </div>
      <Button type="submit" variant="primary" size="lg" block loading={pending} disabled={kg == null || invalid}>
        {t.common.save}
      </Button>
      <ConfirmDialog
        open={confirmReplace != null}
        onOpenChange={(o) => !o && setConfirmReplace(null)}
        title={t.weight.duplicateTitle}
        description={f(t.weight.duplicateBody, {
          value: confirmReplace != null ? fmt.weight(confirmReplace) : "",
          date: fmt.date(date, "dayMonth"),
        })}
        confirmLabel={t.weight.replace}
        onConfirm={() => submit(true)}
      />
    </form>
  );
}
