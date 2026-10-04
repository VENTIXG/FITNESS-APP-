"use client";

import * as React from "react";
import { Check, Dumbbell, Plus, Search } from "lucide-react";
import { useLocale, useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { ChipToggle, Segmented, Select } from "@/components/ui/controls";
import { Badge } from "@/components/ui/data-display";
import { Field, Input, Textarea } from "@/components/ui/input";
import { useRun } from "@/lib/client/run-action";
import { EQUIPMENT, EXERCISE_CATEGORIES, MUSCLE_GROUPS, TRACKING_TYPES, type Equipment, type ExerciseCategory, type MuscleGroup, type TrackingType } from "@/lib/domain";
import { format } from "@/lib/i18n";
import { cn, normalizeSearch } from "@/lib/utils";
import { createExercise, updateExercise } from "@/server/actions/training";
import type { ExerciseInfo } from "@/server/queries/training";

export function exerciseName(e: { name: string; nameEl?: string | null }, locale: string) {
  return (locale === "el" && e.nameEl) || e.name;
}

export type ExerciseFormValues = {
  id?: string;
  name: string;
  muscleGroup: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment;
  category: ExerciseCategory;
  trackingType: TrackingType;
  instructions: string | null;
};

export function ExerciseForm({ initial, onSaved }: { initial?: Partial<ExerciseFormValues>; onSaved?: (id: string) => void }) {
  const t = useT();
  const te = t.training.exercise;
  const { run, pending } = useRun();
  const [name, setName] = React.useState(initial?.name ?? "");
  const [muscle, setMuscle] = React.useState<MuscleGroup>(initial?.muscleGroup ?? "chest");
  const [secondary, setSecondary] = React.useState<MuscleGroup[]>(initial?.secondaryMuscles ?? []);
  const [equipment, setEquipment] = React.useState<Equipment>(initial?.equipment ?? "barbell");
  const [category, setCategory] = React.useState<ExerciseCategory>(initial?.category ?? "compound");
  const [tracking, setTracking] = React.useState<TrackingType>(initial?.trackingType ?? "weight_reps");
  const [instructions, setInstructions] = React.useState(initial?.instructions ?? "");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const values = { name: name.trim(), muscleGroup: muscle, secondaryMuscles: secondary.filter((m) => m !== muscle), equipment, category, trackingType: tracking, instructions: instructions.trim() || null };
    const res = initial?.id ? await run(() => updateExercise({ ...values, id: initial.id! }), { success: te.saved }) : await run(() => createExercise(values), { success: te.saved });
    if (res.ok) onSaved?.(initial?.id ?? (res.data as { id: string }).id);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label={te.name} htmlFor="ex-name">
        <Input id="ex-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required autoFocus={!initial?.id} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={te.muscle} htmlFor="ex-muscle">
          <Select id="ex-muscle" value={muscle} onChange={(e) => setMuscle(e.target.value as MuscleGroup)}>
            {MUSCLE_GROUPS.map((m) => (
              <option key={m} value={m}>
                {t.enums.muscle[m]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={te.equipment} htmlFor="ex-equipment">
          <Select id="ex-equipment" value={equipment} onChange={(e) => setEquipment(e.target.value as Equipment)}>
            {EQUIPMENT.map((m) => (
              <option key={m} value={m}>
                {t.enums.equipment[m]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label={te.secondary}>
        <div className="flex flex-wrap gap-1.5">
          {MUSCLE_GROUPS.filter((m) => m !== muscle).map((m) => (
            <ChipToggle key={m} selected={secondary.includes(m)} onClick={() => setSecondary((s) => (s.includes(m) ? s.filter((x) => x !== m) : [...s, m]))}>
              {t.enums.muscle[m]}
            </ChipToggle>
          ))}
        </div>
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={te.category}>
          <Segmented block value={category} onChange={setCategory} options={EXERCISE_CATEGORIES.map((c) => ({ value: c, label: t.enums.category[c] }))} ariaLabel={te.category} />
        </Field>
        <Field label={te.tracking} htmlFor="ex-tracking">
          <Select id="ex-tracking" value={tracking} onChange={(e) => setTracking(e.target.value as TrackingType)}>
            {TRACKING_TYPES.map((m) => (
              <option key={m} value={m}>
                {t.enums.tracking[m]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label={te.instructions} htmlFor="ex-instr" optional={t.common.optional}>
        <Textarea id="ex-instr" value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={3} maxLength={4000} />
      </Field>
      <Button type="submit" variant="primary" block loading={pending} disabled={!name.trim()}>
        {t.common.save}
      </Button>
    </form>
  );
}

/** Multi-select exercise chooser with search and muscle filter. */
export function ExercisePicker({
  library,
  recentIds,
  onConfirm,
  single,
}: {
  library: ExerciseInfo[];
  recentIds: string[];
  onConfirm: (ids: string[]) => void | Promise<void>;
  single?: boolean;
}) {
  const t = useT();
  const te = t.training.exercise;
  const locale = useLocale();
  const [query, setQuery] = React.useState("");
  const [muscle, setMuscle] = React.useState<MuscleGroup | null>(null);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [creating, setCreating] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const list = React.useMemo(() => {
    const q = normalizeSearch(query);
    const tokens = q ? q.split(/\s+/) : [];
    const recentRank = new Map(recentIds.map((id, i) => [id, i]));
    return library
      .filter((e) => !muscle || e.muscleGroup === muscle || e.secondaryMuscles.includes(muscle))
      .filter((e) => {
        if (!tokens.length) return true;
        const text = normalizeSearch(`${e.name} ${e.nameEl ?? ""} ${t.enums.muscle[e.muscleGroup]} ${t.enums.equipment[e.equipment]}`);
        return tokens.every((tok) => text.includes(tok));
      })
      .sort((a, b) => {
        const ra = recentRank.get(a.id) ?? 999;
        const rb = recentRank.get(b.id) ?? 999;
        if (!tokens.length && ra !== rb) return ra - rb;
        return exerciseName(a, locale).localeCompare(exerciseName(b, locale), locale);
      });
  }, [library, query, muscle, recentIds, locale, t]);

  const confirm = async (ids: string[]) => {
    setBusy(true);
    try {
      await onConfirm(ids);
    } finally {
      setBusy(false);
    }
  };

  if (creating) {
    return (
      <div className="px-5 pb-5">
        <button type="button" onClick={() => setCreating(false)} className="mb-4 text-sm font-medium text-fg-3 hover:text-fg">
          ← {t.common.back}
        </button>
        <ExerciseForm initial={{ name: query }} onSaved={(id) => confirm([id])} />
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="sticky top-0 z-10 space-y-3 bg-surface px-5 pb-3">
        <label className="relative block">
          <span className="sr-only">{te.searchPlaceholder}</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-3" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={te.searchPlaceholder}
            autoFocus
            className="h-11 w-full rounded-xl border border-border bg-surface-2 pl-10 pr-3 text-[15px] outline-none transition placeholder:text-fg-3 focus:border-accent focus:ring-3 focus:ring-accent/20"
          />
        </label>
        <div className="no-scrollbar -mx-5 flex gap-1.5 overflow-x-auto px-5">
          <ChipToggle selected={!muscle} onClick={() => setMuscle(null)} className="h-8 shrink-0">
            {t.common.all}
          </ChipToggle>
          {MUSCLE_GROUPS.map((m) => (
            <ChipToggle key={m} selected={muscle === m} onClick={() => setMuscle(muscle === m ? null : m)} className="h-8 shrink-0">
              {t.enums.muscle[m]}
            </ChipToggle>
          ))}
        </div>
      </div>
      <ul className="flex-1 divide-y divide-border px-5">
        {list.map((e) => {
          const isSel = selected.includes(e.id);
          return (
            <li key={e.id}>
              <button
                type="button"
                aria-pressed={isSel}
                disabled={busy}
                onClick={() => (single ? confirm([e.id]) : setSelected((s) => (isSel ? s.filter((x) => x !== e.id) : [...s, e.id])))}
                className="flex w-full items-center gap-3 py-3 text-left"
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-xl transition",
                    isSel ? "bg-accent text-accent-fg" : "bg-surface-2 text-fg-3",
                  )}
                  aria-hidden
                >
                  {isSel ? <Check className="size-4" /> : <Dumbbell className="size-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[15px] font-medium text-fg">{exerciseName(e, locale)}</span>
                    {e.userId && <Badge tone="outline">{te.custom}</Badge>}
                  </span>
                  <span className="block truncate text-[13px] text-fg-3">
                    {t.enums.muscle[e.muscleGroup]} · {t.enums.equipment[e.equipment]}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {!list.length && <p className="px-5 py-10 text-center text-sm text-fg-3">{te.noResults}</p>}
      <div className="px-5 pt-3 pb-1">
        <Button type="button" variant="outline" block onClick={() => setCreating(true)}>
          <Plus aria-hidden />
          {te.new}
        </Button>
      </div>
      {!single && selected.length > 0 && (
        <div className="sticky bottom-0 bg-surface px-5 pt-3 pb-4">
          <Button type="button" variant="accent" size="lg" block loading={busy} onClick={() => confirm(selected)}>
            {format(te.addSelected, { count: selected.length }, locale)}
          </Button>
        </div>
      )}
    </div>
  );
}
