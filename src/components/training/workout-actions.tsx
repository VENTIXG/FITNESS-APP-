"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ListChecks, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useT } from "@/components/providers/i18n-provider";
import { useToday } from "@/components/providers/prefs-provider";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { ChipToggle, NumberInput, parseDecimal } from "@/components/ui/controls";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useRun } from "@/lib/client/run-action";
import { deleteWorkout, updateWorkoutMeta } from "@/server/actions/training";

type Meta = { id: string; name: string; date: string; durationSeconds: number | null; notes: string | null; sessionRpe: number | null };

export function WorkoutActions({ workout }: { workout: Meta }) {
  const t = useT();
  const tw = t.training.workout;
  const router = useRouter();
  const { run } = useRun();
  const { confirm, dialog } = useConfirm();
  const [editing, setEditing] = React.useState(false);
  return (
    <>
      <Menu>
        <MenuTrigger asChild>
          <Button variant="secondary" size="icon" aria-label={t.common.actions}>
            <MoreHorizontal />
          </Button>
        </MenuTrigger>
        <MenuContent>
          <MenuItem icon={<ListChecks />} asChild>
            <Link href={`/training/workout/${workout.id}?edit=1`}>{tw.edit}</Link>
          </MenuItem>
          <MenuItem icon={<Pencil />} onSelect={() => setEditing(true)}>
            {t.common.details}
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            icon={<Trash2 />}
            destructive
            onSelect={async () => {
              if (!(await confirm({ title: t.common.delete, description: tw.deleteConfirm, destructive: true, confirmLabel: t.common.delete }))) return;
              const res = await run(() => deleteWorkout({ workoutId: workout.id }), { success: tw.deleted });
              if (res.ok) router.replace("/training/history");
            }}
          >
            {t.common.delete}
          </MenuItem>
        </MenuContent>
      </Menu>
      <Sheet open={editing} onOpenChange={setEditing}>
        {editing && (
          <SheetContent title={tw.edit}>
            <MetaForm workout={workout} onDone={() => setEditing(false)} />
          </SheetContent>
        )}
      </Sheet>
      {dialog}
    </>
  );
}

function MetaForm({ workout, onDone }: { workout: Meta; onDone: () => void }) {
  const t = useT();
  const tw = t.training.workout;
  const today = useToday();
  const { run, pending } = useRun();
  const [name, setName] = React.useState(workout.name);
  const [date, setDate] = React.useState(workout.date);
  const [minutes, setMinutes] = React.useState(workout.durationSeconds != null ? String(Math.round(workout.durationSeconds / 60)) : "");
  const [notes, setNotes] = React.useState(workout.notes ?? "");
  const [rpe, setRpe] = React.useState<number | null>(workout.sessionRpe);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const m = parseDecimal(minutes);
        const res = await run(
          () =>
            updateWorkoutMeta({
              workoutId: workout.id,
              name: name.trim() || workout.name,
              date,
              durationSeconds: m != null ? Math.round(Math.min(720, Math.max(0, m)) * 60) : null,
              notes: notes.trim() || null,
              sessionRpe: rpe,
            }),
          { success: t.common.saved },
        );
        if (res.ok) onDone();
      }}
    >
      <Field label={tw.name} htmlFor="wm-name">
        <Input id="wm-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={tw.date} htmlFor="wm-date">
          <Input id="wm-date" type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </Field>
        <Field label={t.training.duration} htmlFor="wm-dur">
          <NumberInput id="wm-dur" integer value={minutes} onValueChange={setMinutes} suffix={t.common.minutesShort} />
        </Field>
      </div>
      <Field label={tw.sessionRpe}>
        <div className="flex flex-wrap gap-1.5">
          {[5, 6, 7, 8, 9, 10].map((v) => (
            <ChipToggle key={v} selected={rpe === v} onClick={() => setRpe(rpe === v ? null : v)} className="min-w-11">
              {v}
            </ChipToggle>
          ))}
        </div>
      </Field>
      <Field label={tw.notes} htmlFor="wm-notes">
        <Textarea id="wm-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={4000} />
      </Field>
      <Button type="submit" variant="primary" block loading={pending}>
        {t.common.save}
      </Button>
    </form>
  );
}
