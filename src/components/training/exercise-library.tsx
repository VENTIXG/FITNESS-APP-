"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Dumbbell, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useLocale, useT } from "@/components/providers/i18n-provider";
import { useFmt } from "@/components/providers/prefs-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { ChipToggle, NumberInput, Select, formatForInput, parseDecimal } from "@/components/ui/controls";
import { Badge, EmptyState } from "@/components/ui/data-display";
import { Field, Textarea } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useRun } from "@/lib/client/run-action";
import { EQUIPMENT, MUSCLE_GROUPS, type Equipment, type MuscleGroup } from "@/lib/domain";
import { format } from "@/lib/i18n";
import { fromDisplayWeight, toDisplayWeight } from "@/lib/units";
import { normalizeSearch } from "@/lib/utils";
import { deleteExercise, saveExerciseSettings } from "@/server/actions/training";
import type { ExerciseInfo } from "@/server/queries/training";
import { ExerciseForm, exerciseName, type ExerciseFormValues } from "./exercise-picker";

export function ExerciseLibrary({ library, usage }: { library: ExerciseInfo[]; usage: Record<string, { sessions: number; last: string }> }) {
  const t = useT();
  const te = t.training.exercise;
  const locale = useLocale();
  const fmt = useFmt();
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [muscle, setMuscle] = React.useState<MuscleGroup | null>(null);
  const [equipment, setEquipment] = React.useState<Equipment | "">("");
  const [creating, setCreating] = React.useState(false);
  const [limit, setLimit] = React.useState(60);

  const list = React.useMemo(() => {
    const tokens = normalizeSearch(query).split(/\s+/).filter(Boolean);
    return library
      .filter((e) => (!muscle || e.muscleGroup === muscle) && (!equipment || e.equipment === equipment))
      .filter((e) => {
        if (!tokens.length) return true;
        const text = normalizeSearch(`${e.name} ${e.nameEl ?? ""}`);
        return tokens.every((tok) => text.includes(tok));
      })
      .sort((a, b) => (usage[b.id]?.sessions ?? 0) - (usage[a.id]?.sessions ?? 0) || exerciseName(a, locale).localeCompare(exerciseName(b, locale), locale));
  }, [library, query, muscle, equipment, usage, locale]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">{te.searchPlaceholder}</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-3" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={te.searchPlaceholder}
            className="h-11 w-full rounded-xl border border-border bg-surface pl-10 pr-3 text-[15px] outline-none transition placeholder:text-fg-3 focus:border-accent focus:ring-3 focus:ring-accent/20"
          />
        </label>
        <Select aria-label={te.filterEquipment} value={equipment} onChange={(e) => setEquipment(e.target.value as Equipment | "")} className="sm:w-48">
          <option value="">{te.filterEquipment}: {t.common.all}</option>
          {EQUIPMENT.map((q) => (
            <option key={q} value={q}>
              {t.enums.equipment[q]}
            </option>
          ))}
        </Select>
        <Button variant="primary" onClick={() => setCreating(true)}>
          <Plus aria-hidden />
          {te.new}
        </Button>
      </div>
      <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        <ChipToggle selected={!muscle} onClick={() => setMuscle(null)} className="h-8 shrink-0">
          {t.common.all}
        </ChipToggle>
        {MUSCLE_GROUPS.map((m) => (
          <ChipToggle key={m} selected={muscle === m} onClick={() => setMuscle(muscle === m ? null : m)} className="h-8 shrink-0">
            {t.enums.muscle[m]}
          </ChipToggle>
        ))}
      </div>
      <Card className="p-0">
        {list.length ? (
          <ul className="divide-y divide-border">
            {list.slice(0, limit).map((e) => {
              const u = usage[e.id];
              return (
                <li key={e.id}>
                  <Link href={`/training/exercises/${e.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2 sm:px-5">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-fg-3" aria-hidden>
                      <Dumbbell className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium">{exerciseName(e, locale)}</span>
                        {e.userId && <Badge tone="outline">{te.custom}</Badge>}
                      </div>
                      <div className="truncate text-xs text-fg-3">
                        {t.enums.muscle[e.muscleGroup]} · {t.enums.equipment[e.equipment]}
                      </div>
                    </div>
                    {u && (
                      <div className="shrink-0 text-right text-xs text-fg-3">
                        <div className="tabular">{format(t.common.sessions, { count: u.sessions }, locale)}</div>
                        <div>{fmt.date(u.last, "dayMonth")}</div>
                      </div>
                    )}
                    <ChevronRight className="size-4 shrink-0 text-fg-3" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon={<Dumbbell />} title={te.noResults} />
        )}
        {list.length > limit && (
          <div className="border-t border-border p-2">
            <Button variant="ghost" block onClick={() => setLimit((l) => l + 60)}>
              {t.common.more} ({fmt.int(list.length - limit)})
            </Button>
          </div>
        )}
      </Card>
      <Sheet open={creating} onOpenChange={setCreating}>
        {creating && (
          <SheetContent title={te.new}>
            <ExerciseForm initial={{ name: query }} onSaved={(id) => router.push(`/training/exercises/${id}`)} />
          </SheetContent>
        )}
      </Sheet>
    </div>
  );
}

export function CustomExerciseActions({ exercise }: { exercise: ExerciseFormValues & { id: string } }) {
  const t = useT();
  const te = t.training.exercise;
  const router = useRouter();
  const { run } = useRun();
  const { confirm, dialog } = useConfirm();
  const [editing, setEditing] = React.useState(false);
  return (
    <div className="flex gap-2">
      <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
        <Pencil aria-hidden />
        {t.common.edit}
      </Button>
      <Button
        variant="destructive-ghost"
        size="sm"
        onClick={async () => {
          if (!(await confirm({ title: t.common.delete, description: te.deleteConfirm, destructive: true, confirmLabel: t.common.delete }))) return;
          const res = await run(() => deleteExercise({ id: exercise.id }));
          if (res.ok) {
            toast.success(res.data.archived ? te.archived : te.deleted);
            router.push("/training/exercises");
          }
        }}
      >
        <Trash2 aria-hidden />
        {t.common.delete}
      </Button>
      <Sheet open={editing} onOpenChange={setEditing}>
        {editing && (
          <SheetContent title={te.edit}>
            <ExerciseForm initial={exercise} onSaved={() => setEditing(false)} />
          </SheetContent>
        )}
      </Sheet>
      {dialog}
    </div>
  );
}

export function ExerciseSettingsForm({
  exerciseId,
  initial,
  defaults,
}: {
  exerciseId: string;
  initial: { notes: string | null; repMin: number | null; repMax: number | null; incrementKg: number | null; restSeconds: number | null } | null;
  defaults: { repMin: number; repMax: number; incrementKg: number; restSeconds: number };
}) {
  const t = useT();
  const te = t.training.exercise;
  const fmt = useFmt();
  const { run, pending } = useRun();
  const [repMin, setRepMin] = React.useState(initial?.repMin != null ? String(initial.repMin) : "");
  const [repMax, setRepMax] = React.useState(initial?.repMax != null ? String(initial.repMax) : "");
  const [inc, setInc] = React.useState(initial?.incrementKg != null ? formatForInput(toDisplayWeight(initial.incrementKg, fmt.units), 2) : "");
  const [rest, setRest] = React.useState(initial?.restSeconds != null ? String(initial.restSeconds) : "");
  const [notes, setNotes] = React.useState(initial?.notes ?? "");
  const int = (v: string) => {
    const n = parseDecimal(v);
    return n == null ? null : Math.round(n);
  };
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const incV = parseDecimal(inc);
        await run(
          () =>
            saveExerciseSettings({
              exerciseId,
              repMin: int(repMin),
              repMax: int(repMax),
              incrementKg: incV != null && incV > 0 ? fromDisplayWeight(incV, fmt.units) : null,
              restSeconds: int(rest),
              notes: notes.trim() || null,
            }),
          { success: te.settingsSaved },
        );
      }}
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label={`${te.repRange} (min)`} htmlFor="es-min">
          <NumberInput id="es-min" integer value={repMin} onValueChange={setRepMin} placeholder={String(defaults.repMin)} />
        </Field>
        <Field label={`${te.repRange} (max)`} htmlFor="es-max">
          <NumberInput id="es-max" integer value={repMax} onValueChange={setRepMax} placeholder={String(defaults.repMax)} />
        </Field>
        <Field label={te.increment} htmlFor="es-inc">
          <NumberInput id="es-inc" value={inc} onValueChange={setInc} suffix={fmt.weightUnit} placeholder={formatForInput(toDisplayWeight(defaults.incrementKg, fmt.units), 2)} />
        </Field>
        <Field label={te.restSeconds} htmlFor="es-rest">
          <NumberInput id="es-rest" integer value={rest} onValueChange={setRest} suffix="s" placeholder={String(defaults.restSeconds)} />
        </Field>
      </div>
      <Field label={te.notes} htmlFor="es-notes" optional={t.common.optional}>
        <Textarea id="es-notes" rows={2} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <Button type="submit" variant="secondary" loading={pending}>
        {t.common.save}
      </Button>
    </form>
  );
}
