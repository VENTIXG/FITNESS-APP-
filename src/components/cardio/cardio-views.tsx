"use client";

import * as React from "react";
import { Footprints, HeartPulse, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { ChartCard, RANGE_DAYS, RangeTabs, type RangeKey } from "@/components/charts/chart-card";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { QuickAddButton } from "@/components/dashboard/islands";
import { CardioForm, type CardioInitial } from "@/components/forms/body-forms";
import { StepsForm } from "@/components/forms/lifestyle-forms";
import { useLocale, useT } from "@/components/providers/i18n-provider";
import { useFmt, usePrefs, useToday } from "@/components/providers/prefs-provider";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Badge, EmptyState } from "@/components/ui/data-display";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useRun } from "@/lib/client/run-action";
import { addDays } from "@/lib/dates";
import type { DataSource } from "@/lib/domain";
import { format } from "@/lib/i18n";
import { paceSeconds } from "@/lib/units";
import { deleteCardio } from "@/server/actions/cardio";
import { deleteSteps } from "@/server/actions/lifestyle";

export type CardioRow = CardioInitial & { source: string };
export type StepDay = { date: string; steps: number; manual: { id: string; steps: number } | null; imported: { id: string; steps: number; source: string } | null };

export function StepsChart({ days, goal }: { days: StepDay[]; goal: number }) {
  const t = useT();
  const fmt = useFmt();
  const today = useToday();
  const [range, setRange] = React.useState<RangeKey>("30d");
  const n = RANGE_DAYS[range] ?? 365;
  const map = new Map(days.map((d) => [d.date, d.steps]));
  const rows = Array.from({ length: n }, (_, i) => {
    const date = addDays(today, -(n - 1 - i));
    return { date, steps: map.get(date) ?? null };
  });
  return (
    <ChartCard
      title={t.steps.title}
      table={{ columns: [t.common.date, t.steps.title], rows: [...rows].reverse().filter((r) => r.steps != null).map((r) => [fmt.date(r.date, "medium"), fmt.int(r.steps!)]) }}
    >
      <div className="mb-3">
        <RangeTabs value={range} onChange={setRange} options={["7d", "30d", "3m", "6m", "1y"]} />
      </div>
      <TimeSeriesChart
        ariaLabel={t.steps.title}
        data={rows}
        yDomain="zero"
        series={[{ kind: "bar", key: "steps", label: t.steps.title, color: "--series-2" }]}
        refLines={goal ? [{ y: goal, label: t.steps.goal, color: "--fg-2" }] : []}
        formatValue={(v) => fmt.int(v)}
        formatAxis={(v) => (v >= 1000 ? `${fmt.number(v / 1000, 0)}k` : fmt.int(v))}
        formatTick={(d) => fmt.date(d, n > 120 ? "monthShort" : "dayMonth")}
        formatTooltipDate={(d) => fmt.date(d, "weekdayShort")}
      />
    </ChartCard>
  );
}

export function CardioWeeksChart({ weeks, goal }: { weeks: { date: string; minutes: number }[]; goal: number }) {
  const t = useT();
  const fmt = useFmt();
  return (
    <ChartCard
      title={`${t.cardio.totalMinutes} · ${t.common.perWeek}`}
      table={{ columns: [t.common.date, t.cardio.totalMinutes], rows: [...weeks].reverse().map((w) => [fmt.date(w.date, "medium"), fmt.int(w.minutes)]) }}
    >
      <TimeSeriesChart
        ariaLabel={t.cardio.totalMinutes}
        data={weeks}
        height={200}
        yDomain="zero"
        series={[{ kind: "bar", key: "minutes", label: t.cardio.totalMinutes, color: "--series-1" }]}
        refLines={goal ? [{ y: goal, label: t.steps.goal, color: "--fg-2" }] : []}
        formatValue={(v) => `${fmt.int(v)} ${t.common.minutesShort}`}
        formatAxis={(v) => fmt.int(v)}
        formatTick={(d) => fmt.date(d, "dayMonth")}
        formatTooltipDate={(d) => `${fmt.date(d, "dayMonth")} – ${fmt.date(addDays(d, 6), "dayMonth")}`}
      />
    </ChartCard>
  );
}

export function CardioSessionList({ sessions }: { sessions: CardioRow[] }) {
  const t = useT();
  const tc = t.cardio;
  const fmt = useFmt();
  const { run } = useRun();
  const { confirm, dialog } = useConfirm();
  const [editing, setEditing] = React.useState<CardioRow | null>(null);
  const [limit, setLimit] = React.useState(15);
  if (!sessions.length)
    return (
      <EmptyState
        icon={<HeartPulse />}
        title={tc.emptyTitle}
        body={tc.emptyBody}
        action={
          <QuickAddButton kind="cardio" variant="primary">
            <Plus aria-hidden />
            {tc.log}
          </QuickAddButton>
        }
      />
    );
  return (
    <>
      <ul className="divide-y divide-border">
        {sessions.slice(0, limit).map((s) => {
          const pace = s.distanceM ? paceSeconds(s.durationSeconds, s.distanceM, fmt.units) : null;
          return (
            <li key={s.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{t.enums.cardio[s.activity]}</span>
                  {s.source !== "manual" && <Badge tone="outline">{t.enums.source[s.source as DataSource]}</Badge>}
                </div>
                <div className="truncate text-xs text-fg-3 tabular">
                  {[
                    fmt.date(s.date, "weekdayShort"),
                    s.distanceM ? fmt.distance(s.distanceM) : null,
                    pace ? fmt.pace(pace) : null,
                    s.avgHeartRate ? `${s.avgHeartRate} ${tc.bpm}` : null,
                    s.calories ? fmt.kcal(s.calories) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              <span className="text-sm font-semibold tabular">{fmt.duration(s.durationSeconds)}</span>
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
                    icon={<Trash2 />}
                    destructive
                    onSelect={async () => {
                      if (await confirm({ title: t.common.delete, description: `${t.enums.cardio[s.activity]} · ${fmt.date(s.date, "medium")}`, destructive: true, confirmLabel: t.common.delete }))
                        await run(() => deleteCardio({ id: s.id }), { success: t.common.deleted });
                    }}
                  >
                    {t.common.delete}
                  </MenuItem>
                </MenuContent>
              </Menu>
            </li>
          );
        })}
      </ul>
      {sessions.length > limit && (
        <Button variant="ghost" block size="sm" onClick={() => setLimit((l) => l + 15)}>
          {t.common.more}
        </Button>
      )}
      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && (
          <SheetContent title={tc.editTitle}>
            <CardioForm initial={editing} onDone={() => setEditing(null)} />
          </SheetContent>
        )}
      </Sheet>
      {dialog}
    </>
  );
}

export function StepDayList({ days }: { days: StepDay[] }) {
  const t = useT();
  const locale = useLocale();
  const fmt = useFmt();
  const prefs = usePrefs();
  const { run } = useRun();
  const { confirm, dialog } = useConfirm();
  const [editing, setEditing] = React.useState<StepDay | null>(null);
  const [limit, setLimit] = React.useState(14);
  if (!days.length) return <EmptyState icon={<Footprints />} title={t.steps.emptyTitle} body={t.steps.emptyBody} compact />;
  return (
    <>
      <ul className="divide-y divide-border">
        {days.slice(0, limit).map((d) => (
          <li key={d.date} className="flex items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{fmt.date(d.date, "weekdayShort")}</div>
              <div className="text-xs text-fg-3 tabular">
                {d.imported && format(t.steps.importedFrom, { source: t.enums.source[d.imported.source as DataSource] }, locale) + `: ${fmt.int(d.imported.steps)}`}
                {d.imported && d.manual && " · "}
                {d.manual && `${t.steps.manualEntry}: ${fmt.int(d.manual.steps)}`}
              </div>
            </div>
            <span className={`text-sm font-semibold tabular ${d.steps >= prefs.stepGoal ? "text-good-text" : ""}`}>{fmt.int(d.steps)}</span>
            <Menu>
              <MenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={t.common.actions}>
                  <MoreHorizontal />
                </Button>
              </MenuTrigger>
              <MenuContent>
                <MenuItem icon={<Pencil />} onSelect={() => setEditing(d)}>
                  {t.steps.set}
                </MenuItem>
                {d.manual && (
                  <MenuItem
                    icon={<Trash2 />}
                    destructive
                    onSelect={async () => {
                      if (await confirm({ title: t.common.delete, description: `${t.steps.manualEntry} · ${fmt.date(d.date, "medium")}`, destructive: true, confirmLabel: t.common.delete }))
                        await run(() => deleteSteps({ id: d.manual!.id }), { success: t.common.deleted });
                    }}
                  >
                    {t.common.delete}
                  </MenuItem>
                )}
              </MenuContent>
            </Menu>
          </li>
        ))}
      </ul>
      {days.length > limit && (
        <Button variant="ghost" block size="sm" onClick={() => setLimit((l) => l + 14)}>
          {t.common.more}
        </Button>
      )}
      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && (
          <SheetContent title={`${t.steps.title} · ${fmt.date(editing.date, "medium")}`} description={t.steps.manualHint}>
            <StepsForm currentManual={editing.manual?.steps ?? null} date={editing.date} onDone={() => setEditing(null)} />
          </SheetContent>
        )}
      </Sheet>
      {dialog}
    </>
  );
}

export function StepsTodayCard({ today, avg7, goal }: { today: StepDay | null; avg7: number | null; goal: number }) {
  const t = useT();
  const fmt = useFmt();
  const [open, setOpen] = React.useState(false);
  const steps = today?.steps ?? 0;
  return (
    <Card>
      <CardHeader
        title={t.steps.title}
        icon={<Footprints />}
        action={
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
            <Plus aria-hidden />
            {t.steps.add}
          </Button>
        }
      />
      <div className="text-[34px] leading-none font-semibold tracking-tight tabular">{fmt.int(steps)}</div>
      <div className="mt-1 text-[13px] text-fg-3">
        {t.steps.goal} {fmt.int(goal)}
        {avg7 != null && ` · ${t.steps.avg7} ${fmt.int(avg7)}`}
      </div>
      {today?.imported && today.manual && <p className="mt-2 text-xs text-fg-3">{t.steps.usingImported}</p>}
      <Sheet open={open} onOpenChange={setOpen}>
        {open && (
          <SheetContent title={t.steps.add} description={t.steps.manualHint}>
            <StepsForm currentManual={today?.manual?.steps ?? null} onDone={() => setOpen(false)} />
          </SheetContent>
        )}
      </Sheet>
    </Card>
  );
}
