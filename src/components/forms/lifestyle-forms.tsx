"use client";

import * as React from "react";
import { GlassWater, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/components/providers/i18n-provider";
import { useFmt, usePrefs, useToday } from "@/components/providers/prefs-provider";
import { Button } from "@/components/ui/button";
import { ChipToggle, NumberInput, parseDecimal, Segmented } from "@/components/ui/controls";
import { Meter } from "@/components/ui/data-display";
import { Field, Input, Textarea } from "@/components/ui/input";
import { useRun } from "@/lib/client/run-action";
import { addDays, minutesBetweenClockTimes } from "@/lib/dates";
import { NOTE_TAGS, type NoteTag } from "@/lib/domain";
import { fromDisplayVolume } from "@/lib/units";
import { cn } from "@/lib/utils";
import { addWater, logSleep, saveNote, setSteps, undoLastWater } from "@/server/actions/lifestyle";

// ── Water ─────────────────────────────────────────────────────────────────

export function WaterQuickAdd({ totalMl, date, onAdded, compact }: { totalMl: number; date?: string; onAdded?: () => void; compact?: boolean }) {
  const t = useT();
  const fmt = useFmt();
  const prefs = usePrefs();
  const today = useToday();
  const day = date ?? today;
  const { run } = useRun();
  const [optimistic, setOptimistic] = React.useState(totalMl);
  const [custom, setCustom] = React.useState("");
  const [syncedTotal, setSyncedTotal] = React.useState(totalMl);
  if (totalMl !== syncedTotal) {
    setSyncedTotal(totalMl);
    setOptimistic(totalMl);
  }

  async function add(ml: number) {
    setOptimistic((v) => v + ml);
    const res = await run(() => addWater({ date: day, amountMl: Math.round(ml) }));
    if (!res.ok) {
      setOptimistic((v) => v - ml);
      return;
    }
    toast.success(`${t.water.saved} · +${fmt.volume(ml)}`, {
      action: {
        label: t.common.undo,
        onClick: () => {
          setOptimistic((v) => v - ml);
          void run(() => undoLastWater({ date: day }));
        },
      },
    });
    onAdded?.();
  }

  const presets = prefs.unitSystem === "imperial" ? [fromDisplayVolume(8, "imperial"), fromDisplayVolume(16, "imperial")] : [250, 500];
  return (
    <div className="flex flex-col gap-3">
      {!compact && (
        <div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-semibold tracking-tight">{fmt.volume(optimistic)}</span>
            <span className="text-sm text-fg-3">
              {t.water.goal}: {fmt.volume(prefs.waterGoalMl)}
            </span>
          </div>
          <Meter value={optimistic} max={prefs.waterGoalMl} color="var(--series-3)" className="mt-2" label={t.water.title} />
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        {presets.map((ml) => (
          <Button key={ml} variant="secondary" size="lg" onClick={() => add(ml)}>
            <GlassWater aria-hidden />+{fmt.volume(ml)}
          </Button>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const v = parseDecimal(custom);
          if (v && v > 0) {
            void add(fromDisplayVolume(v, prefs.unitSystem));
            setCustom("");
          }
        }}
      >
        <NumberInput value={custom} onValueChange={setCustom} integer suffix={fmt.volumeUnit} placeholder={t.water.custom} aria-label={t.water.customAmount} className="flex-1" />
        <Button type="submit" variant="outline" disabled={!parseDecimal(custom)}>
          {t.common.add}
        </Button>
      </form>
    </div>
  );
}

export function WaterUndoButton({ date }: { date: string }) {
  const t = useT();
  const { run, pending } = useRun();
  return (
    <Button variant="ghost" size="sm" loading={pending} onClick={() => run(() => undoLastWater({ date }))}>
      <Undo2 aria-hidden />
      {t.common.undo}
    </Button>
  );
}

// ── Steps ─────────────────────────────────────────────────────────────────

export function StepsForm({ currentManual, onDone, date }: { currentManual?: number | null; onDone?: () => void; date?: string }) {
  const t = useT();
  const today = useToday();
  const { run, pending } = useRun();
  const [mode, setMode] = React.useState<"set" | "add">("set");
  const [value, setValue] = React.useState(currentManual ? String(currentManual) : "");
  const [day, setDay] = React.useState(date ?? today);
  const steps = parseDecimal(value);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (steps == null) return;
        const res = await run(() => setSteps({ date: day, steps: Math.round(steps), mode }), { success: t.steps.saved });
        if (res.ok) onDone?.();
      }}
    >
      <Segmented
        block
        value={mode}
        onChange={setMode}
        options={[
          { value: "set", label: t.steps.set },
          { value: "add", label: t.steps.add },
        ]}
      />
      <Field label={t.steps.title} htmlFor="steps-value" hint={t.steps.manualHint}>
        <NumberInput id="steps-value" value={value} onValueChange={setValue} integer inputClassName="h-14 text-2xl font-semibold" autoFocus />
      </Field>
      <Field label={t.common.date} htmlFor="steps-date">
        <Input id="steps-date" type="date" value={day} max={addDays(today, 1)} onChange={(e) => e.target.value && setDay(e.target.value)} />
      </Field>
      <Button type="submit" variant="primary" size="lg" block loading={pending} disabled={steps == null}>
        {t.common.save}
      </Button>
    </form>
  );
}

// ── Sleep ─────────────────────────────────────────────────────────────────

export function SleepForm({
  onDone,
  initial,
}: {
  onDone?: () => void;
  initial?: { date: string; bedTime: string | null; wakeTime: string | null; quality: number | null; note: string | null };
}) {
  const t = useT();
  const fmt = useFmt();
  const today = useToday();
  const { run, pending } = useRun();
  const [date, setDate] = React.useState(initial?.date ?? today);
  const [bed, setBed] = React.useState(initial?.bedTime?.slice(0, 5) ?? "23:00");
  const [wake, setWake] = React.useState(initial?.wakeTime?.slice(0, 5) ?? "07:00");
  const [quality, setQuality] = React.useState<number | null>(initial?.quality ?? null);
  const [note, setNote] = React.useState(initial?.note ?? "");
  const minutes = bed && wake ? minutesBetweenClockTimes(bed, wake) : null;
  const labels = t.sleep.qualityLabels as Record<string, string>;
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await run(
          () => logSleep({ date, bedTime: bed, wakeTime: wake, durationMinutes: minutes, quality, note }),
          { success: t.sleep.saved },
        );
        if (res.ok) onDone?.();
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label={t.sleep.bedTime} htmlFor="bed">
          <Input id="bed" type="time" value={bed} onChange={(e) => setBed(e.target.value)} required />
        </Field>
        <Field label={t.sleep.wakeTime} htmlFor="wake">
          <Input id="wake" type="time" value={wake} onChange={(e) => setWake(e.target.value)} required />
        </Field>
      </div>
      {minutes != null && (
        <div className="rounded-xl bg-surface-2 px-4 py-3 text-sm">
          <span className="text-fg-3">{t.sleep.total}: </span>
          <span className="font-semibold">{fmt.sleep(minutes)}</span>
        </div>
      )}
      <Field label={t.sleep.quality}>
        <div className="grid grid-cols-5 gap-1.5">
          {[1, 2, 3, 4, 5].map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setQuality(quality === q ? null : q)}
              aria-pressed={quality === q}
              className={cn(
                "flex h-12 flex-col items-center justify-center rounded-xl border text-sm font-semibold transition",
                quality === q ? "border-accent bg-accent-soft text-fg" : "border-border bg-surface-2 text-fg-2 hover:border-border-strong",
              )}
              title={labels[String(q)]}
            >
              {q}
            </button>
          ))}
        </div>
        {quality && <p className="text-[13px] text-fg-3">{labels[String(quality)]}</p>}
      </Field>
      <Field label={t.common.date} htmlFor="sleep-date" hint={t.sleep.wakeDateHint}>
        <Input id="sleep-date" type="date" value={date} max={addDays(today, 1)} onChange={(e) => e.target.value && setDate(e.target.value)} />
      </Field>
      <Field label={t.common.note} htmlFor="sleep-note" optional={t.common.optional}>
        <Input id="sleep-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      </Field>
      <Button type="submit" variant="primary" size="lg" block loading={pending}>
        {t.common.save}
      </Button>
    </form>
  );
}

// ── Daily note ────────────────────────────────────────────────────────────

export function NoteForm({
  onDone,
  initial,
  date,
}: {
  onDone?: () => void;
  initial?: { content: string; tags: string[]; energy: number | null } | null;
  date?: string;
}) {
  const t = useT();
  const today = useToday();
  const { run, pending } = useRun();
  const [day, setDay] = React.useState(date ?? today);
  const [content, setContent] = React.useState(initial?.content ?? "");
  const [tags, setTags] = React.useState<NoteTag[]>((initial?.tags ?? []).filter((x): x is NoteTag => (NOTE_TAGS as readonly string[]).includes(x)));
  const [energy, setEnergy] = React.useState<number | null>(initial?.energy ?? null);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await run(() => saveNote({ date: day, content, tags, energy }), { success: t.notes.saved });
        if (res.ok) onDone?.();
      }}
    >
      <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder={t.notes.placeholder} maxLength={4000} rows={4} aria-label={t.notes.title} autoFocus />
      <Field label={t.notes.tags}>
        <div className="flex flex-wrap gap-2">
          {NOTE_TAGS.map((tag) => (
            <ChipToggle key={tag} selected={tags.includes(tag)} onClick={() => setTags((cur) => (cur.includes(tag) ? cur.filter((x) => x !== tag) : [...cur, tag]))}>
              {t.enums.noteTag[tag]}
            </ChipToggle>
          ))}
        </div>
      </Field>
      <Field label={t.notes.energy}>
        <div className="grid grid-cols-5 gap-1.5">
          {[1, 2, 3, 4, 5].map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setEnergy(energy === q ? null : q)}
              aria-pressed={energy === q}
              className={cn(
                "h-11 rounded-xl border text-sm font-semibold transition",
                energy === q ? "border-accent bg-accent-soft text-fg" : "border-border bg-surface-2 text-fg-2 hover:border-border-strong",
              )}
            >
              {q}
            </button>
          ))}
        </div>
      </Field>
      {!date && (
        <Field label={t.common.date} htmlFor="note-date">
          <Input id="note-date" type="date" value={day} max={addDays(today, 1)} onChange={(e) => e.target.value && setDay(e.target.value)} />
        </Field>
      )}
      <Button type="submit" variant="primary" size="lg" block loading={pending}>
        {t.common.save}
      </Button>
    </form>
  );
}
