"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, CheckCircle2, GripVertical, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { StartWorkoutButton } from "@/components/dashboard/islands";
import { useLocale, useT } from "@/components/providers/i18n-provider";
import { useFmt } from "@/components/providers/prefs-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { ChipToggle, NumberInput, Segmented, parseDecimal } from "@/components/ui/controls";
import { Badge } from "@/components/ui/data-display";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useRun } from "@/lib/client/run-action";
import { format } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { saveProgram, setActiveProgram } from "@/server/actions/training";
import type { ExerciseInfo } from "@/server/queries/training";
import { ExercisePicker, exerciseName } from "./exercise-picker";

type PExercise = { id: string; exerciseId: string; targetSets: string; repMin: string; repMax: string; targetRir: string; restSeconds: string; notes: string };
type PDay = { id: string; name: string; weekdays: number[]; notes: string; exercises: PExercise[] };
type PState = { name: string; description: string; scheduleType: "rotation" | "weekly"; daysPerWeek: string; days: PDay[] };

export type ProgramInitial = {
  id: string;
  name: string;
  description: string | null;
  scheduleType: "rotation" | "weekly";
  daysPerWeek: number | null;
  isActive: boolean;
  days: {
    id: string;
    name: string;
    weekdays: number[];
    notes: string | null;
    exercises: { id: string; exerciseId: string; targetSets: number; repMin: number | null; repMax: number | null; targetRir: number | null; restSeconds: number | null; notes: string | null }[];
  }[];
};

const str = (v: number | null | undefined) => (v == null ? "" : String(v));
const uid = () => crypto.randomUUID();

export function ProgramEditor({ initial, library, recentIds }: { initial: ProgramInitial; library: ExerciseInfo[]; recentIds: string[] }) {
  const t = useT();
  const tp = t.training.program;
  const locale = useLocale();
  const fmt = useFmt();
  const router = useRouter();
  const { run, pending } = useRun();
  const { confirm, dialog } = useConfirm();
  const exById = React.useMemo(() => new Map(library.map((e) => [e.id, e])), [library]);
  const [state, setState] = React.useState<PState>(() => ({
    name: initial.name,
    description: initial.description ?? "",
    scheduleType: initial.scheduleType,
    daysPerWeek: str(initial.daysPerWeek),
    days: initial.days.map((d) => ({
      id: d.id,
      name: d.name,
      weekdays: d.weekdays,
      notes: d.notes ?? "",
      exercises: d.exercises.map((e) => ({
        id: e.id,
        exerciseId: e.exerciseId,
        targetSets: String(e.targetSets),
        repMin: str(e.repMin),
        repMax: str(e.repMax),
        targetRir: str(e.targetRir),
        restSeconds: str(e.restSeconds),
        notes: e.notes ?? "",
      })),
    })),
  }));
  const [dirty, setDirty] = React.useState(false);
  const [pickerDay, setPickerDay] = React.useState<string | null>(null);
  const drag = React.useRef<{ dayId: string; index: number } | null>(null);

  React.useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const edit = (fn: (s: PState) => PState) => {
    setState(fn);
    setDirty(true);
  };
  const editDay = (dayId: string, fn: (d: PDay) => PDay) => edit((s) => ({ ...s, days: s.days.map((d) => (d.id === dayId ? fn(d) : d)) }));
  const moveIn = <T,>(list: T[], from: number, to: number) => {
    if (to < 0 || to >= list.length || from === to) return list;
    const next = [...list];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  };

  const save = async () => {
    const n = (v: string, int = true) => {
      const x = parseDecimal(v);
      return x == null ? null : int ? Math.round(x) : x;
    };
    const res = await run(
      () =>
        saveProgram({
          id: initial.id,
          name: state.name.trim() || initial.name,
          description: state.description.trim() || null,
          scheduleType: state.scheduleType,
          daysPerWeek: state.scheduleType === "rotation" ? n(state.daysPerWeek) : null,
          days: state.days.map((d, i) => ({
            id: d.id,
            name: d.name.trim() || format(tp.dayDefault, { n: i + 1 }, locale),
            weekdays: state.scheduleType === "weekly" ? d.weekdays : [],
            notes: d.notes.trim() || null,
            exercises: d.exercises.map((e) => {
              const repMin = n(e.repMin);
              const repMax = n(e.repMax);
              return {
                id: e.id,
                exerciseId: e.exerciseId,
                targetSets: Math.max(1, Math.min(20, n(e.targetSets) ?? 3)),
                repMin: repMin != null ? Math.max(1, Math.min(100, repMin)) : null,
                repMax: repMax != null ? Math.max(repMin ?? 1, Math.min(100, repMax)) : null,
                targetRir: n(e.targetRir, false),
                restSeconds: n(e.restSeconds) != null ? Math.max(0, Math.min(900, n(e.restSeconds)!)) : null,
                notes: e.notes.trim() || null,
              };
            }),
          })),
        }),
      { success: tp.saved },
    );
    if (res.ok) {
      setDirty(false);
      router.refresh();
    }
  };

  return (
    <div className="space-y-4 pb-24">
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {initial.isActive ? (
            <Badge tone="accent">
              <CheckCircle2 className="size-3" aria-hidden />
              {tp.active}
            </Badge>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => run(() => setActiveProgram({ id: initial.id }), { success: tp.activated })}>
              <CheckCircle2 aria-hidden />
              {tp.setActive}
            </Button>
          )}
        </div>
        <Field label={tp.name} htmlFor="pg-name">
          <Input id="pg-name" value={state.name} maxLength={120} onChange={(e) => edit((s) => ({ ...s, name: e.target.value }))} />
        </Field>
        <Field label={tp.description} htmlFor="pg-desc" optional={t.common.optional}>
          <Textarea id="pg-desc" rows={2} maxLength={2000} value={state.description} onChange={(e) => edit((s) => ({ ...s, description: e.target.value }))} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Field label={tp.schedule}>
            <Segmented
              block
              value={state.scheduleType}
              onChange={(v) => edit((s) => ({ ...s, scheduleType: v }))}
              options={[
                { value: "rotation", label: t.enums.scheduleType.rotation },
                { value: "weekly", label: t.enums.scheduleType.weekly },
              ]}
              ariaLabel={tp.schedule}
            />
          </Field>
          {state.scheduleType === "rotation" && (
            <Field label={tp.daysPerWeek} htmlFor="pg-dpw">
              <NumberInput id="pg-dpw" integer value={state.daysPerWeek} onValueChange={(v) => edit((s) => ({ ...s, daysPerWeek: v }))} className="w-28" />
            </Field>
          )}
        </div>
      </Card>

      <h2 className="px-1 pt-2 text-[15px] font-semibold">{tp.days}</h2>
      {state.days.map((day, di) => (
        <Card key={day.id} className="p-0">
          <div className="flex items-center gap-2 px-4 pt-4 sm:px-5">
            <Input
              aria-label={tp.dayName}
              value={day.name}
              maxLength={80}
              onChange={(e) => editDay(day.id, (d) => ({ ...d, name: e.target.value }))}
              className="h-10 flex-1 font-semibold"
            />
            <StartWorkoutButton programDayId={day.id} variant="secondary" size="sm" disabled={dirty}>
              {tp.startThisDay}
            </StartWorkoutButton>
            <Menu>
              <MenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`${t.common.actions}: ${day.name}`}>
                  <MoreHorizontal />
                </Button>
              </MenuTrigger>
              <MenuContent>
                <MenuItem icon={<ArrowUp />} disabled={di === 0} onSelect={() => edit((s) => ({ ...s, days: moveIn(s.days, di, di - 1) }))}>
                  {t.common.moveUp}
                </MenuItem>
                <MenuItem icon={<ArrowDown />} disabled={di === state.days.length - 1} onSelect={() => edit((s) => ({ ...s, days: moveIn(s.days, di, di + 1) }))}>
                  {t.common.moveDown}
                </MenuItem>
                <MenuSeparator />
                <MenuItem
                  icon={<Trash2 />}
                  destructive
                  onSelect={async () => {
                    if (await confirm({ title: t.common.delete, description: tp.deleteDayConfirm, destructive: true, confirmLabel: t.common.delete }))
                      edit((s) => ({ ...s, days: s.days.filter((d) => d.id !== day.id) }));
                  }}
                >
                  {t.common.delete}
                </MenuItem>
              </MenuContent>
            </Menu>
          </div>
          {state.scheduleType === "weekly" && (
            <div className="flex flex-wrap gap-1.5 px-4 pt-3 sm:px-5" role="group" aria-label={tp.weekdays}>
              {[1, 2, 3, 4, 5, 6, 0].map((w) => (
                <ChipToggle
                  key={w}
                  selected={day.weekdays.includes(w)}
                  onClick={() => editDay(day.id, (d) => ({ ...d, weekdays: d.weekdays.includes(w) ? d.weekdays.filter((x) => x !== w) : [...d.weekdays, w].sort() }))}
                  className="h-8 min-w-12"
                >
                  {fmt.weekdayShort(w)}
                </ChipToggle>
              ))}
            </div>
          )}
          <div className="mt-3 hidden grid-cols-[1.5rem_minmax(0,1fr)_3.5rem_6rem_3.5rem_4rem_2rem] gap-2 border-t border-border px-4 pt-2 text-[11px] font-medium tracking-wide text-fg-3 uppercase sm:grid sm:px-5">
            <span />
            <span>{t.training.exercise.title}</span>
            <span className="text-center">{tp.targetSets}</span>
            <span className="text-center">{tp.repRange}</span>
            <span className="text-center">{tp.targetRir}</span>
            <span className="text-center">{tp.rest} (s)</span>
            <span />
          </div>
          {day.exercises.length > 0 && (
            <div className="mt-3 grid grid-cols-4 gap-2 border-t border-border pt-2 pr-14 pl-12 text-center text-[10px] font-medium tracking-wide text-fg-3 uppercase sm:hidden">
              <span>{tp.targetSets}</span>
              <span>{tp.repRange}</span>
              <span>{tp.targetRir}</span>
              <span>{tp.rest} (s)</span>
            </div>
          )}
          {day.exercises.length === 0 && <p className="px-4 py-4 text-sm text-fg-3 sm:px-5">{tp.dayEmpty}</p>}
          <ul className="divide-y divide-border sm:divide-y-0">
            {day.exercises.map((e, ei) => {
              const info = exById.get(e.exerciseId);
              const setField = (k: keyof PExercise, v: string) => editDay(day.id, (d) => ({ ...d, exercises: d.exercises.map((x) => (x.id === e.id ? { ...x, [k]: v } : x)) }));
              return (
                <li
                  key={e.id}
                  draggable
                  onDragStart={() => (drag.current = { dayId: day.id, index: ei })}
                  onDragOver={(ev) => {
                    if (drag.current?.dayId === day.id) ev.preventDefault();
                  }}
                  onDrop={() => {
                    const from = drag.current;
                    drag.current = null;
                    if (from && from.dayId === day.id) editDay(day.id, (d) => ({ ...d, exercises: moveIn(d.exercises, from.index, ei) }));
                  }}
                  className="grid grid-cols-[1.5rem_minmax(0,1fr)_2rem] items-center gap-x-2 gap-y-2 px-4 py-3 sm:grid-cols-[1.5rem_minmax(0,1fr)_3.5rem_6rem_3.5rem_4rem_2rem] sm:py-1.5 sm:px-5"
                >
                  <span className="cursor-grab text-fg-3 active:cursor-grabbing" title={tp.dragHint} aria-hidden>
                    <GripVertical className="size-4" />
                  </span>
                  <span className="truncate text-sm font-medium">{info ? exerciseName(info, locale) : "—"}</span>
                  <div className="col-span-3 col-start-1 row-start-2 grid grid-cols-4 gap-2 pl-8 sm:col-span-4 sm:col-start-3 sm:row-start-1 sm:grid-cols-[3.5rem_6rem_3.5rem_4rem] sm:pl-0">
                    <ProgInput label={tp.targetSets} value={e.targetSets} onChange={(v) => setField("targetSets", v)} />
                    <div className="flex items-center gap-0.5">
                      <ProgInput label={`${tp.repRange} min`} value={e.repMin} onChange={(v) => setField("repMin", v)} />
                      <span className="text-fg-3">–</span>
                      <ProgInput label={`${tp.repRange} max`} value={e.repMax} onChange={(v) => setField("repMax", v)} />
                    </div>
                    <ProgInput label={tp.targetRir} value={e.targetRir} onChange={(v) => setField("targetRir", v)} />
                    <ProgInput label={`${tp.rest} (s)`} value={e.restSeconds} onChange={(v) => setField("restSeconds", v)} />
                  </div>
                  <Menu>
                    <MenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={t.common.actions} className="col-start-3 row-start-1 sm:col-start-7">
                        <MoreHorizontal />
                      </Button>
                    </MenuTrigger>
                    <MenuContent>
                      <MenuItem icon={<ArrowUp />} disabled={ei === 0} onSelect={() => editDay(day.id, (d) => ({ ...d, exercises: moveIn(d.exercises, ei, ei - 1) }))}>
                        {t.common.moveUp}
                      </MenuItem>
                      <MenuItem
                        icon={<ArrowDown />}
                        disabled={ei === day.exercises.length - 1}
                        onSelect={() => editDay(day.id, (d) => ({ ...d, exercises: moveIn(d.exercises, ei, ei + 1) }))}
                      >
                        {t.common.moveDown}
                      </MenuItem>
                      <MenuSeparator />
                      <MenuItem icon={<Trash2 />} destructive onSelect={() => editDay(day.id, (d) => ({ ...d, exercises: d.exercises.filter((x) => x.id !== e.id) }))}>
                        {t.common.remove}
                      </MenuItem>
                    </MenuContent>
                  </Menu>
                </li>
              );
            })}
          </ul>
          <div className="px-2 pt-1 pb-2">
            <Button variant="ghost" size="sm" className="text-accent" onClick={() => setPickerDay(day.id)}>
              <Plus aria-hidden />
              {tp.addExercise}
            </Button>
          </div>
        </Card>
      ))}
      <Button
        variant="secondary"
        block
        onClick={() => edit((s) => ({ ...s, days: [...s.days, { id: uid(), name: format(tp.dayDefault, { n: s.days.length + 1 }, locale), weekdays: [], notes: "", exercises: [] }] }))}
      >
        <Plus aria-hidden />
        {tp.addDay}
      </Button>

      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+72px)] z-30 px-4 lg:bottom-6 lg:left-[248px]">
        <div className={cn("mx-auto flex max-w-xl items-center justify-between gap-3 rounded-2xl border border-border bg-surface/95 p-2 pl-4 shadow-pop backdrop-blur transition", !dirty && "opacity-0 pointer-events-none translate-y-2")}>
          <span className="text-sm text-fg-2">{t.common.unsavedChanges}</span>
          <Button variant="accent" loading={pending} onClick={save}>
            {t.common.save}
          </Button>
        </div>
      </div>

      <Sheet open={pickerDay != null} onOpenChange={(o) => !o && setPickerDay(null)}>
        {pickerDay && (
          <SheetContent title={tp.addExercise} size="lg" flush className="sm:h-[80dvh]">
            <ExercisePicker
              library={library}
              recentIds={recentIds}
              onConfirm={(ids) => {
                editDay(pickerDay, (d) => ({
                  ...d,
                  exercises: [...d.exercises, ...ids.map((exerciseId) => ({ id: uid(), exerciseId, targetSets: "3", repMin: "8", repMax: "12", targetRir: "", restSeconds: "", notes: "" }))],
                }));
                setPickerDay(null);
              }}
            />
          </SheetContent>
        )}
      </Sheet>
      {dialog}
      <span className="sr-only">{format(t.common.days, { count: state.days.length }, locale)}</span>
    </div>
  );
}

function ProgInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={label}
      title={label}
      value={value}
      onChange={(e) => /^[\d.,]*$/.test(e.target.value) && onChange(e.target.value)}
      className="h-9 w-full min-w-0 rounded-lg border border-border bg-surface-2 px-1 text-center text-sm tabular outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
    />
  );
}
