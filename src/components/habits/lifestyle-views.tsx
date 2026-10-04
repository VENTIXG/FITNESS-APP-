"use client";

import * as React from "react";
import { Check, MoreHorizontal, Pause, Pencil, Pill, Play, Plus, Trash2, X } from "lucide-react";
import { SleepForm } from "@/components/forms/lifestyle-forms";
import { useT } from "@/components/providers/i18n-provider";
import { useFmt, useToday } from "@/components/providers/prefs-provider";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { ChipToggle, NumberInput, Segmented, Select, formatForInput, parseDecimal } from "@/components/ui/controls";
import { Badge, EmptyState } from "@/components/ui/data-display";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useRun } from "@/lib/client/run-action";
import { SUPPLEMENT_TIMINGS, type DataSource, type SupplementSchedule, type SupplementTiming } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { createSupplement, deleteSupplement, takeAllSupplements, toggleSupplement, updateSupplement } from "@/server/actions/habits";
import { deleteSleep, deleteWater } from "@/server/actions/lifestyle";

export function WaterEntryList({ entries, timezone }: { entries: { id: string; amountMl: number; loggedAt: Date | string }[]; timezone: string }) {
  const t = useT();
  const fmt = useFmt();
  const { run } = useRun();
  if (!entries.length) return <p className="text-sm text-fg-3">{t.water.emptyBody}</p>;
  return (
    <ul className="divide-y divide-border">
      {entries.map((e) => (
        <li key={e.id} className="flex items-center justify-between gap-3 py-2 text-sm">
          <span className="text-fg-3 tabular">{fmt.time(e.loggedAt, timezone)}</span>
          <span className="flex-1 font-medium tabular">{fmt.volume(e.amountMl)}</span>
          <Button variant="ghost" size="icon-sm" aria-label={t.common.delete} onClick={() => run(() => deleteWater({ id: e.id }), { success: t.common.deleted })}>
            <X />
          </Button>
        </li>
      ))}
    </ul>
  );
}

type SleepRow = { id: string; date: string; bedTime: string | null; wakeTime: string | null; durationMinutes: number; quality: number | null; note: string | null; source: string };

export function SleepList({ entries, goal }: { entries: SleepRow[]; goal: number }) {
  const t = useT();
  const fmt = useFmt();
  const { run } = useRun();
  const { confirm, dialog } = useConfirm();
  const [editing, setEditing] = React.useState<SleepRow | "new" | null>(null);
  const labels = t.sleep.qualityLabels as Record<string, string>;
  return (
    <Card>
      <CardHeader
        title={t.sleep.title}
        action={
          <Button variant="secondary" size="sm" onClick={() => setEditing("new")}>
            <Plus aria-hidden />
            {t.sleep.log}
          </Button>
        }
      />
      {entries.length ? (
        <ul className="divide-y divide-border">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{fmt.date(e.date, "weekdayShort")}</div>
                <div className="truncate text-xs text-fg-3 tabular">
                  {e.bedTime?.slice(0, 5)} → {e.wakeTime?.slice(0, 5)}
                  {e.quality != null && ` · ${labels[String(e.quality)]}`}
                  {e.source !== "manual" && ` · ${t.enums.source[e.source as DataSource]}`}
                </div>
              </div>
              <span className={cn("text-sm font-semibold tabular", goal && e.durationMinutes >= goal - 15 && "text-good-text")}>{fmt.sleep(e.durationMinutes)}</span>
              <Menu>
                <MenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label={t.common.actions}>
                    <MoreHorizontal />
                  </Button>
                </MenuTrigger>
                <MenuContent>
                  <MenuItem icon={<Pencil />} onSelect={() => setEditing(e)}>
                    {t.common.edit}
                  </MenuItem>
                  <MenuItem
                    icon={<Trash2 />}
                    destructive
                    onSelect={async () => {
                      if (await confirm({ title: t.common.delete, description: fmt.date(e.date, "medium"), destructive: true, confirmLabel: t.common.delete }))
                        await run(() => deleteSleep({ id: e.id }), { success: t.common.deleted });
                    }}
                  >
                    {t.common.delete}
                  </MenuItem>
                </MenuContent>
              </Menu>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title={t.sleep.emptyTitle} body={t.sleep.emptyBody} compact />
      )}
      <Sheet open={editing != null} onOpenChange={(o) => !o && setEditing(null)}>
        {editing != null && (
          <SheetContent title={t.sleep.log} description={t.sleep.wakeDateHint}>
            <SleepForm initial={editing === "new" ? undefined : editing} onDone={() => setEditing(null)} />
          </SheetContent>
        )}
      </Sheet>
      {dialog}
    </Card>
  );
}

type Supp = {
  id: string;
  name: string;
  dose: number | null;
  doseUnit: string | null;
  schedule: SupplementSchedule;
  daysOfWeek: number[];
  timing: SupplementTiming | null;
  notes: string | null;
  isActive: boolean;
  taken: boolean;
  dueToday: boolean;
  adherence: number | null;
};

export function SupplementsView({ items }: { items: Supp[] }) {
  const t = useT();
  const ts = t.supplements;
  const fmt = useFmt();
  const today = useToday();
  const { run } = useRun();
  const { confirm, dialog } = useConfirm();
  const [editing, setEditing] = React.useState<Supp | "new" | null>(null);
  const [optimistic, setOptimistic] = React.useState<Record<string, boolean>>({});
  const taken = (s: Supp) => optimistic[s.id] ?? s.taken;
  const due = items.filter((s) => s.isActive && (s.dueToday || s.schedule === "as_needed" || s.taken));
  const remaining = due.filter((s) => s.dueToday && !taken(s));
  const doseText = (s: Supp) => [s.dose != null ? `${fmt.number(s.dose, 2)} ${s.doseUnit ?? ""}`.trim() : null, s.timing ? t.enums.supplementTiming[s.timing] : null].filter(Boolean).join(" · ");

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader
          title={ts.today}
          icon={<Pill />}
          action={
            remaining.length > 1 ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  setOptimistic((o) => ({ ...o, ...Object.fromEntries(remaining.map((s) => [s.id, true])) }));
                  await run(() => takeAllSupplements({ ids: remaining.map((s) => s.id), date: today }));
                }}
              >
                <Check aria-hidden />
                {t.common.all}
              </Button>
            ) : undefined
          }
        />
        {due.length ? (
          <ul className="space-y-1">
            {due.map((s) => {
              const on = taken(s);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={async () => {
                      setOptimistic((o) => ({ ...o, [s.id]: !on }));
                      const res = await run(() => toggleSupplement({ supplementId: s.id, date: today, taken: !on }));
                      if (!res.ok) setOptimistic((o) => ({ ...o, [s.id]: on }));
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-surface-2"
                  >
                    <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full border transition", on ? "border-good bg-good text-white" : "border-border-strong")} aria-hidden>
                      {on && <Check className="size-3.5" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate text-sm font-medium", on && "text-fg-3")}>{s.name}</span>
                      {doseText(s) && <span className="block truncate text-xs text-fg-3">{doseText(s)}</span>}
                    </span>
                    {s.schedule === "as_needed" && <Badge tone="outline">{t.enums.supplementSchedule.as_needed}</Badge>}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon={<Pill />} title={ts.emptyTitle} body={ts.emptyBody} compact />
        )}
        <p className="mt-4 border-t border-border pt-3 text-xs text-fg-3">{ts.disclaimer}</p>
      </Card>

      <Card>
        <CardHeader
          title={t.common.all}
          action={
            <Button variant="secondary" size="sm" onClick={() => setEditing("new")}>
              <Plus aria-hidden />
              {ts.add}
            </Button>
          }
        />
        {items.length ? (
          <ul className="divide-y divide-border">
            {items.map((s) => (
              <li key={s.id} className={cn("flex items-center gap-3 py-2.5", !s.isActive && "opacity-60")}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{s.name}</span>
                    {!s.isActive && <Badge tone="outline">{ts.inactive}</Badge>}
                  </div>
                  <div className="truncate text-xs text-fg-3">
                    {s.schedule === "specific_days" ? s.daysOfWeek.map((d) => fmt.weekdayShort(d)).join(", ") : t.enums.supplementSchedule[s.schedule]}
                    {doseText(s) && ` · ${doseText(s)}`}
                  </div>
                </div>
                {s.adherence != null && <span className="text-xs text-fg-3 tabular">{fmt.pct(s.adherence)}</span>}
                <Menu>
                  <MenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={t.common.actions}>
                      <MoreHorizontal />
                    </Button>
                  </MenuTrigger>
                  <MenuContent>
                    <MenuItem icon={<Pencil />} onSelect={() => setEditing(s)}>
                      {t.common.edit}
                    </MenuItem>
                    <MenuItem
                      icon={s.isActive ? <Pause /> : <Play />}
                      onSelect={() =>
                        run(() => updateSupplement({ id: s.id, name: s.name, dose: s.dose, doseUnit: s.doseUnit, schedule: s.schedule, daysOfWeek: s.daysOfWeek, timing: s.timing, notes: s.notes, isActive: !s.isActive }), {
                          success: t.common.saved,
                        })
                      }
                    >
                      {s.isActive ? ts.inactive : ts.active}
                    </MenuItem>
                    <MenuSeparator />
                    <MenuItem
                      icon={<Trash2 />}
                      destructive
                      onSelect={async () => {
                        if (await confirm({ title: t.common.delete, description: ts.deleteConfirm, destructive: true, confirmLabel: t.common.delete }))
                          await run(() => deleteSupplement({ id: s.id }), { success: t.common.deleted });
                      }}
                    >
                      {t.common.delete}
                    </MenuItem>
                  </MenuContent>
                </Menu>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-fg-3">{ts.emptyBody}</p>
        )}
      </Card>
      <Sheet open={editing != null} onOpenChange={(o) => !o && setEditing(null)}>
        {editing != null && (
          <SheetContent title={editing === "new" ? ts.add : ts.edit} description={ts.disclaimer}>
            <SupplementForm initial={editing === "new" ? null : editing} onDone={() => setEditing(null)} />
          </SheetContent>
        )}
      </Sheet>
      {dialog}
    </div>
  );
}

function SupplementForm({ initial, onDone }: { initial: Supp | null; onDone: () => void }) {
  const t = useT();
  const ts = t.supplements;
  const fmt = useFmt();
  const { run, pending } = useRun();
  const [name, setName] = React.useState(initial?.name ?? "");
  const [dose, setDose] = React.useState(initial?.dose != null ? formatForInput(initial.dose, 2) : "");
  const [unit, setUnit] = React.useState(initial?.doseUnit ?? "");
  const [schedule, setSchedule] = React.useState<SupplementSchedule>(initial?.schedule ?? "daily");
  const [days, setDays] = React.useState<number[]>(initial?.daysOfWeek ?? []);
  const [timing, setTiming] = React.useState<SupplementTiming | "">(initial?.timing ?? "");
  const [notes, setNotes] = React.useState(initial?.notes ?? "");
  const valid = !!name.trim() && (schedule !== "specific_days" || days.length > 0);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!valid) return;
        const values = { name: name.trim(), dose: parseDecimal(dose), doseUnit: unit.trim() || null, schedule, daysOfWeek: schedule === "specific_days" ? days : [], timing: timing || null, notes: notes.trim() || null };
        const res = initial ? await run(() => updateSupplement({ ...values, id: initial.id, isActive: initial.isActive }), { success: ts.saved }) : await run(() => createSupplement(values), { success: ts.saved });
        if (res.ok) onDone();
      }}
    >
      <Field label={ts.name} htmlFor="sup-name">
        <Input id="sup-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={ts.dose} htmlFor="sup-dose" optional={t.common.optional}>
          <NumberInput id="sup-dose" value={dose} onValueChange={setDose} />
        </Field>
        <Field label={ts.doseUnit} htmlFor="sup-unit" optional={t.common.optional}>
          <Input id="sup-unit" value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={20} placeholder="g, mg, IU, caps" />
        </Field>
      </div>
      <Field label={ts.schedule}>
        <Segmented block value={schedule} onChange={setSchedule} ariaLabel={ts.schedule} options={(["daily", "specific_days", "as_needed"] as const).map((v) => ({ value: v, label: t.enums.supplementSchedule[v] }))} />
      </Field>
      {schedule === "specific_days" && (
        <div className="flex flex-wrap gap-1.5">
          {[1, 2, 3, 4, 5, 6, 0].map((w) => (
            <ChipToggle key={w} selected={days.includes(w)} onClick={() => setDays((d) => (d.includes(w) ? d.filter((x) => x !== w) : [...d, w]))} className="min-w-12">
              {fmt.weekdayShort(w)}
            </ChipToggle>
          ))}
        </div>
      )}
      <Field label={ts.timing} htmlFor="sup-timing" optional={t.common.optional}>
        <Select id="sup-timing" value={timing} onChange={(e) => setTiming(e.target.value as SupplementTiming | "")}>
          <option value="">—</option>
          {SUPPLEMENT_TIMINGS.map((x) => (
            <option key={x} value={x}>
              {t.enums.supplementTiming[x]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t.common.notes} htmlFor="sup-notes" optional={t.common.optional}>
        <Textarea id="sup-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} />
      </Field>
      <Button type="submit" variant="primary" block loading={pending} disabled={!valid}>
        {t.common.save}
      </Button>
    </form>
  );
}
