"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Flame, ListChecks, MoreHorizontal, Pause, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { HabitCheck } from "@/components/dashboard/islands";
import { useLocale, useT } from "@/components/providers/i18n-provider";
import { useFmt, useToday } from "@/components/providers/prefs-provider";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { ChipToggle, Segmented, Select } from "@/components/ui/controls";
import { EmptyState } from "@/components/ui/data-display";
import { Field, Input } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useRun } from "@/lib/client/run-action";
import { AUTO_HABIT_METRICS, type AutoHabitMetric, type HabitSchedule } from "@/lib/domain";
import { format } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { createHabit, deleteHabit, reorderHabits, updateHabit } from "@/server/actions/habits";
import type { HabitStatus } from "@/server/queries/habits";

const WEEK = [1, 2, 3, 4, 5, 6, 0];

export function useHabitLabel() {
  const t = useT();
  return (h: Pick<HabitStatus, "type" | "autoMetric" | "name">) =>
    h.type === "auto" && h.autoMetric ? h.name || t.enums.autoHabit[h.autoMetric as AutoHabitMetric] : h.name;
}

export function HabitsList({ habits }: { habits: HabitStatus[] }) {
  const t = useT();
  const th = t.habits;
  const locale = useLocale();
  const fmt = useFmt();
  const today = useToday();
  const label = useHabitLabel();
  const { run } = useRun();
  const { confirm, dialog } = useConfirm();
  const [editing, setEditing] = React.useState<HabitStatus | "new" | null>(null);
  const active = habits.filter((h) => h.isActive);
  const paused = habits.filter((h) => !h.isActive);
  const doneToday = active.filter((h) => h.scheduledToday && h.doneToday).length;
  const scheduled = active.filter((h) => h.scheduledToday && h.doneToday != null).length;

  const move = async (id: string, dir: -1 | 1) => {
    const ids = habits.map((h) => h.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await run(() => reorderHabits({ ids }));
  };

  const row = (h: HabitStatus, idx: number) => {
    const name = label(h);
    const last30 = h.history.slice(-30);
    return (
      <li key={h.id} className={cn("py-3", !h.isActive && "opacity-60")}>
        <div className="flex items-center gap-3">
          {h.isActive && h.scheduledToday ? (
            <HabitCheck habitId={h.id} date={today} done={h.doneToday} manual={h.type === "manual"} label={name} />
          ) : (
            <span className="size-6 shrink-0 rounded-full border border-dashed border-border-strong" aria-hidden />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium">{name}</span>
            </div>
            <div className="truncate text-xs text-fg-3">
              {!h.isActive && `${t.supplements.inactive} · `}
              {h.type === "auto" && `${th.autoBadge} · `}
              {h.schedule === "daily" ? th.daily : h.daysOfWeek.map((d) => fmt.weekdayShort(d)).join(", ")}
              {h.isActive && !h.scheduledToday && ` · ${th.notScheduled}`}
            </div>
          </div>
          {h.streak > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-fg-2 tabular" title={th.currentStreak}>
              <Flame className="size-3.5 text-accent" aria-hidden />
              {h.streak}
            </span>
          )}
          <span className="w-10 text-right text-xs text-fg-3 tabular">{h.completionRate != null ? fmt.pct(h.completionRate) : "—"}</span>
          <Menu>
            <MenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`${t.common.actions}: ${name}`}>
                <MoreHorizontal />
              </Button>
            </MenuTrigger>
            <MenuContent>
              <MenuItem icon={<Pencil />} onSelect={() => setEditing(h)}>
                {t.common.edit}
              </MenuItem>
              <MenuItem
                icon={h.isActive ? <Pause /> : <Play />}
                onSelect={() =>
                  run(() => updateHabit({ id: h.id, name: h.name, type: h.type, autoMetric: (h.autoMetric as AutoHabitMetric) ?? null, schedule: h.schedule, daysOfWeek: h.daysOfWeek, icon: h.icon, isActive: !h.isActive }), {
                    success: t.common.saved,
                  })
                }
              >
                {h.isActive ? t.supplements.inactive : t.supplements.active}
              </MenuItem>
              <MenuItem icon={<ArrowUp />} disabled={idx === 0} onSelect={() => move(h.id, -1)}>
                {t.common.moveUp}
              </MenuItem>
              <MenuItem icon={<ArrowDown />} disabled={idx === habits.length - 1} onSelect={() => move(h.id, 1)}>
                {t.common.moveDown}
              </MenuItem>
              <MenuSeparator />
              <MenuItem
                icon={<Trash2 />}
                destructive
                onSelect={async () => {
                  if (await confirm({ title: t.common.delete, description: th.deleteConfirm, destructive: true, confirmLabel: t.common.delete }))
                    await run(() => deleteHabit({ id: h.id }), { success: t.common.deleted });
                }}
              >
                {t.common.delete}
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>
        <div className="mt-2 flex gap-[3px] pl-9" role="img" aria-label={`${th.last30}: ${h.completionRate != null ? fmt.pct(h.completionRate) : "—"}`}>
          {last30.map((d) => (
            <span
              key={d.date}
              title={fmt.date(d.date, "medium")}
              className={cn(
                "h-3 flex-1 rounded-[3px]",
                !d.scheduled || d.done == null ? "bg-surface-2 opacity-50" : d.done ? "bg-good" : "bg-surface-3",
              )}
            />
          ))}
        </div>
      </li>
    );
  };

  return (
    <Card>
      <CardHeader
        title={th.title}
        icon={<ListChecks />}
        subtitle={scheduled ? format(th.completedToday, { done: doneToday, total: scheduled }, locale) : undefined}
        action={
          <Button variant="secondary" size="sm" onClick={() => setEditing("new")}>
            <Plus aria-hidden />
            {th.add}
          </Button>
        }
      />
      {habits.length ? (
        <ul className="divide-y divide-border">{[...active, ...paused].map((h) => row(h, habits.indexOf(h)))}</ul>
      ) : (
        <EmptyState icon={<ListChecks />} title={th.emptyTitle} body={th.emptyBody} compact />
      )}
      <Sheet open={editing != null} onOpenChange={(o) => !o && setEditing(null)}>
        {editing != null && (
          <SheetContent title={editing === "new" ? th.add : th.edit}>
            <HabitForm initial={editing === "new" ? null : editing} onDone={() => setEditing(null)} />
          </SheetContent>
        )}
      </Sheet>
      {dialog}
    </Card>
  );
}

function HabitForm({ initial, onDone }: { initial: HabitStatus | null; onDone: () => void }) {
  const t = useT();
  const th = t.habits;
  const fmt = useFmt();
  const { run, pending } = useRun();
  const [type, setType] = React.useState<"manual" | "auto">(initial?.type ?? "manual");
  const [metric, setMetric] = React.useState<AutoHabitMetric>((initial?.autoMetric as AutoHabitMetric) ?? "steps_target");
  const [name, setName] = React.useState(initial?.name ?? "");
  const [schedule, setSchedule] = React.useState<HabitSchedule>(initial?.schedule ?? "daily");
  const [days, setDays] = React.useState<number[]>(initial?.daysOfWeek ?? []);
  const finalName = name.trim() || (type === "auto" ? t.enums.autoHabit[metric] : "");
  const valid = !!finalName && (schedule === "daily" || days.length > 0);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!valid) return;
        const values = { name: finalName, type, autoMetric: type === "auto" ? metric : null, schedule, daysOfWeek: schedule === "daily" ? [] : days, icon: initial?.icon ?? null };
        const res = initial ? await run(() => updateHabit({ ...values, id: initial.id, isActive: initial.isActive }), { success: th.saved }) : await run(() => createHabit(values), { success: th.saved });
        if (res.ok) onDone();
      }}
    >
      <Field label={th.type}>
        <Segmented
          block
          value={type}
          onChange={setType}
          ariaLabel={th.type}
          options={[
            { value: "manual", label: th.typeManual },
            { value: "auto", label: th.typeAuto },
          ]}
        />
      </Field>
      {type === "auto" && (
        <Field label={th.metric} htmlFor="habit-metric">
          <Select id="habit-metric" value={metric} onChange={(e) => setMetric(e.target.value as AutoHabitMetric)}>
            {AUTO_HABIT_METRICS.map((m) => (
              <option key={m} value={m}>
                {t.enums.autoHabit[m]}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label={th.name} htmlFor="habit-name" optional={type === "auto" ? t.common.optional : undefined}>
        <Input id="habit-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder={type === "auto" ? t.enums.autoHabit[metric] : undefined} required={type === "manual"} />
      </Field>
      <Field label={th.schedule}>
        <Segmented
          block
          value={schedule}
          onChange={setSchedule}
          ariaLabel={th.schedule}
          options={[
            { value: "daily", label: th.daily },
            { value: "specific_days", label: th.specificDays },
          ]}
        />
      </Field>
      {schedule === "specific_days" && (
        <div className="flex flex-wrap gap-1.5">
          {WEEK.map((w) => (
            <ChipToggle key={w} selected={days.includes(w)} onClick={() => setDays((d) => (d.includes(w) ? d.filter((x) => x !== w) : [...d, w]))} className="min-w-12">
              {fmt.weekdayShort(w)}
            </ChipToggle>
          ))}
        </div>
      )}
      <Button type="submit" variant="primary" block loading={pending} disabled={!valid}>
        {t.common.save}
      </Button>
    </form>
  );
}
