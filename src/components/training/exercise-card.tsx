"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Check, Lightbulb, MoreHorizontal, NotebookPen, Pin, Plus, Repeat, SlidersHorizontal, Trash2, Trophy, X } from "lucide-react";
import { useLocale, useT } from "@/components/providers/i18n-provider";
import { useFmt, usePrefs } from "@/components/providers/prefs-provider";
import { Button } from "@/components/ui/button";
import { NumberInput, parseDecimal } from "@/components/ui/controls";
import { Field, Textarea } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { defaultIncrementKg, suggestProgression, type ProgressionSuggestion } from "@/lib/calc/progression";
import { livePrsForSet } from "@/lib/calc/training";
import { SET_TYPES, type SetType } from "@/lib/domain";
import { format } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { ExerciseContext } from "@/server/queries/training";
import { exerciseName } from "./exercise-picker";
import { durationToInput, emptySet, inputToKg, parseDuration, weightToInput, distanceToInput, type EffortMetric, type LExercise, type LSet } from "./logger-state";

type Props = {
  ex: LExercise;
  ctx: ExerciseContext | undefined;
  index: number;
  count: number;
  metric: EffortMetric;
  onChange: (fn: (ex: LExercise) => LExercise) => void;
  onSetCompleted: (set: LSet, ex: LExercise) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onReplace: () => void;
};

export function useExerciseConfig(ex: LExercise, ctx: ExerciseContext | undefined) {
  const prefs = usePrefs();
  const repMin = ex.repMin ?? ctx?.settings?.repMin ?? prefs.training.defaultRepMin;
  const repMax = Math.max(repMin, ex.repMax ?? ctx?.settings?.repMax ?? prefs.training.defaultRepMax);
  const rest = ex.restSeconds ?? ctx?.settings?.restSeconds ?? prefs.training.defaultRestSeconds;
  const increment = ctx?.settings?.incrementKg ?? (ctx ? defaultIncrementKg(ctx.exercise, prefs.training) : prefs.training.incrementUpperKg);
  return { repMin, repMax, rest, increment };
}

export function ExerciseCard({ ex, ctx, index, count, metric, onChange, onSetCompleted, onMove, onRemove, onReplace }: Props) {
  const t = useT();
  const tw = t.training.workout;
  const locale = useLocale();
  const fmt = useFmt();
  const prefs = usePrefs();
  const units = fmt.units;
  const tracking = ctx?.exercise.trackingType ?? "weight_reps";
  const cfg = useExerciseConfig(ex, ctx);
  const [showNotes, setShowNotes] = React.useState(!!ex.notes);
  const [showConfig, setShowConfig] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);

  const last = ctx?.sessions[0] ?? null;
  const lastWorking = last?.sets.filter((s) => s.setType !== "warmup") ?? [];
  const lastWarmups = last?.sets.filter((s) => s.setType === "warmup") ?? [];
  const workingCount = ex.sets.filter((s) => s.setType !== "warmup").length;

  const suggestion: ProgressionSuggestion | null =
    tracking === "weight_reps" || tracking === "bodyweight_reps"
      ? suggestProgression({
          last: last ? { date: last.date, sets: lastWorking } : null,
          previous: ctx?.sessions[1] ? { date: ctx.sessions[1].date, sets: ctx.sessions[1].sets.filter((s) => s.setType !== "warmup") } : null,
          config: { repMin: cfg.repMin, repMax: cfg.repMax, incrementKg: cfg.increment, roundingKg: prefs.training.roundingKg },
          targetSets: Math.max(1, workingCount),
          tracking,
        })
      : null;

  /** Previous-session set aligned with this row (warm-ups to warm-ups, working to working). */
  const previousFor = (set: LSet) => {
    const pool = set.setType === "warmup" ? ex.sets.filter((s) => s.setType === "warmup") : ex.sets.filter((s) => s.setType !== "warmup");
    const i = pool.findIndex((s) => s.id === set.id);
    return (set.setType === "warmup" ? lastWarmups : lastWorking)[i] ?? null;
  };
  /** Placeholder target: suggestion first (working sets), else last time. */
  const targetFor = (set: LSet) => {
    const prev = previousFor(set);
    if (set.setType !== "warmup" && suggestion && suggestion.kind !== "first_time" && !dismissed) {
      const i = ex.sets.filter((s) => s.setType !== "warmup").findIndex((s) => s.id === set.id);
      const sg = suggestion.sets[Math.min(i, suggestion.sets.length - 1)];
      if (sg) return { weightKg: sg.weightKg, reps: sg.reps, durationSeconds: prev?.durationSeconds ?? null, distanceM: prev?.distanceM ?? null };
    }
    return prev ? { weightKg: prev.weightKg, reps: prev.reps, durationSeconds: prev.durationSeconds, distanceM: prev.distanceM } : null;
  };

  const updateSet = (id: string, patch: Partial<LSet>) => onChange((e) => ({ ...e, sets: e.sets.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));

  const toggleComplete = (set: LSet) => {
    if (set.completed) {
      updateSet(set.id, { completed: false, completedAt: null });
      return;
    }
    // Empty fields take the target values ("use previous" in one tap).
    const target = targetFor(set);
    const filled: Partial<LSet> = { completed: true, completedAt: new Date().toISOString() };
    if (!set.weight && target?.weightKg != null) filled.weight = weightToInput(target.weightKg, units);
    if (!set.reps && target?.reps != null) filled.reps = String(target.reps);
    if (!set.duration && target?.durationSeconds != null) filled.duration = durationToInput(target.durationSeconds);
    if (!set.distance && target?.distanceM != null) filled.distance = distanceToInput(target.distanceM, units);
    const next = { ...set, ...filled };
    const reps = parseDecimal(next.reps);
    const hasData = tracking === "duration" ? parseDuration(next.duration) != null : tracking === "distance" ? parseDecimal(next.distance) != null : reps != null && reps > 0;
    if (!hasData) return;
    updateSet(set.id, filled);
    onSetCompleted(next, ex);
  };

  const applySuggestion = () => {
    if (!suggestion) return;
    onChange((e) => {
      let i = 0;
      return {
        ...e,
        sets: e.sets.map((s) => {
          if (s.setType === "warmup" || s.completed) return s;
          const sg = suggestion.sets[Math.min(i++, suggestion.sets.length - 1)];
          return sg ? { ...s, weight: sg.weightKg != null ? weightToInput(sg.weightKg, units) : s.weight, reps: String(sg.reps) } : s;
        }),
      };
    });
    setDismissed(true);
  };

  const addSet = () =>
    onChange((e) => {
      const lastSet = e.sets[e.sets.length - 1];
      const s = emptySet(lastSet?.setType === "warmup" ? "normal" : (lastSet?.setType ?? "normal"));
      if (lastSet) Object.assign(s, { weight: lastSet.weight, reps: lastSet.reps, duration: lastSet.duration, distance: lastSet.distance });
      return { ...e, sets: [...e.sets, s] };
    });

  const name = ctx ? exerciseName(ctx.exercise, locale) : "…";
  const loadLabel = tracking === "bodyweight_reps" ? `+${fmt.weightUnit}` : fmt.weightUnit;
  const effortLabel = metric === "rpe" ? t.training.rpe : t.training.rir;
  const showWeight = tracking === "weight_reps" || tracking === "bodyweight_reps";
  const showReps = showWeight;
  const showDuration = tracking === "duration" || tracking === "distance";
  const showDistance = tracking === "distance";
  const cols = cn(
    "grid items-center gap-1.5 sm:gap-2",
    showWeight ? "grid-cols-[1.75rem_minmax(0,1fr)_4rem_3.25rem_2.75rem_2.75rem] sm:grid-cols-[2.5rem_minmax(0,1fr)_6rem_5rem_4rem_3rem]" : showDistance ? "grid-cols-[2rem_minmax(0,1fr)_5rem_5rem_2.75rem]" : "grid-cols-[2rem_minmax(0,1fr)_6rem_2.75rem]",
  );

  let setNo = 0;
  return (
    <section className="rounded-2xl border border-border bg-surface shadow-card" aria-label={name}>
      <header className="flex items-start gap-2 px-4 pt-3.5 pb-2 sm:px-5">
        <div className="min-w-0 flex-1">
          {ctx ? (
            <Link href={`/training/exercises/${ex.exerciseId}`} className="block truncate text-[16px] font-semibold tracking-tight text-accent hover:underline">
              {name}
            </Link>
          ) : (
            <span className="text-[16px] font-semibold">{name}</span>
          )}
          <div className="mt-0.5 text-xs text-fg-3">
            {ctx && t.enums.muscle[ctx.exercise.muscleGroup]}
            {showReps && ` · ${format(t.training.suggestion.range, { min: cfg.repMin, max: cfg.repMax }, locale)}`}
            {` · ${t.training.rest.title} ${fmt.clock(cfg.rest)}`}
          </div>
        </div>
        <Menu>
          <MenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`${t.common.actions}: ${name}`}>
              <MoreHorizontal />
            </Button>
          </MenuTrigger>
          <MenuContent>
            <MenuItem icon={<NotebookPen />} onSelect={() => setShowNotes((v) => !v)}>
              {tw.exerciseNotes}
            </MenuItem>
            <MenuItem icon={<SlidersHorizontal />} onSelect={() => setShowConfig((v) => !v)}>
              {t.training.exercise.repRange} · {t.training.rest.title}
            </MenuItem>
            <MenuItem icon={<Repeat />} onSelect={onReplace}>
              {tw.replaceExercise}
            </MenuItem>
            <MenuSeparator />
            <MenuItem icon={<ArrowUp />} disabled={index === 0} onSelect={() => onMove(-1)}>
              {t.common.moveUp}
            </MenuItem>
            <MenuItem icon={<ArrowDown />} disabled={index === count - 1} onSelect={() => onMove(1)}>
              {t.common.moveDown}
            </MenuItem>
            <MenuSeparator />
            <MenuItem icon={<Trash2 />} destructive onSelect={onRemove}>
              {tw.removeExercise}
            </MenuItem>
          </MenuContent>
        </Menu>
      </header>

      {showNotes && (
        <div className="px-4 pb-2 sm:px-5">
          <Textarea
            aria-label={tw.exerciseNotes}
            placeholder={ctx?.settings?.notes ?? tw.exerciseNotes}
            value={ex.notes}
            rows={2}
            maxLength={1000}
            onChange={(e) => onChange((x) => ({ ...x, notes: e.target.value }))}
          />
        </div>
      )}
      {!showNotes && ctx?.settings?.notes && (
        <p className="flex items-center gap-1.5 px-4 pb-2 text-xs text-fg-3 sm:px-5">
          <Pin className="size-3 shrink-0" aria-hidden />
          {ctx.settings.notes}
        </p>
      )}

      {showConfig && <ConfigRow cfg={cfg} showReps={showReps} onChange={onChange} />}

      {suggestion && !dismissed && suggestion.kind !== "first_time" && (
        <SuggestionBanner suggestion={suggestion} lastDate={last?.date ?? null} onApply={applySuggestion} onDismiss={() => setDismissed(true)} />
      )}
      {suggestion?.kind === "first_time" && !last && (
        <p className="mx-4 mb-2 rounded-xl bg-surface-2 px-3 py-2 text-[13px] text-fg-2 sm:mx-5">{format(t.training.suggestion.first_time, { repMin: cfg.repMin, repMax: cfg.repMax }, locale)}</p>
      )}

      <div className="px-2 pb-2 sm:px-3">
        <div className={cn(cols, "px-1 pb-1 text-[11px] font-medium tracking-wide text-fg-3 uppercase")}>
          <span className="text-center">{tw.set}</span>
          <span>{tw.previous}</span>
          {showWeight && <span className="text-center">{loadLabel}</span>}
          {showReps && <span className="text-center">{t.training.reps}</span>}
          {showDistance && <span className="text-center">{fmt.distanceUnit}</span>}
          {showDuration && <span className="text-center">{t.training.duration}</span>}
          {showReps && <span className="text-center">{effortLabel}</span>}
          <span className="sr-only">{t.common.done}</span>
        </div>
        <ul className="space-y-1">
          {ex.sets.map((s) => {
            if (s.setType !== "warmup") setNo++;
            const prev = previousFor(s);
            const target = targetFor(s);
            const prs =
              s.completed && ctx?.records && showReps
                ? livePrsForSet(ctx.records, inputToKg(s.weight, units), parseDecimal(s.reps), tracking).filter((p) => s.setType !== "warmup" && p !== "rep_at_weight")
                : [];
            const prevText = prev
              ? tracking === "duration"
                ? fmt.clock(prev.durationSeconds ?? 0)
                : tracking === "distance"
                  ? `${fmt.distance(prev.distanceM ?? 0)}`
                  : `${prev.weightKg ? fmt.load(prev.weightKg, false) : tracking === "bodyweight_reps" ? "BW" : "0"}×${prev.reps ?? 0}`
              : "—";
            return (
              <li key={s.id}>
                <div className={cn(cols, "rounded-xl px-1 py-1 transition-colors", s.completed && "bg-good/10")}>
                  <SetTypeButton
                    set={s}
                    number={setNo}
                    onType={(type) => updateSet(s.id, { setType: type })}
                    onRemove={() => onChange((e) => ({ ...e, sets: e.sets.filter((x) => x.id !== s.id) }))}
                  />
                  <button
                    type="button"
                    className="truncate text-left text-[13px] text-fg-3 tabular hover:text-fg disabled:hover:text-fg-3"
                    disabled={!prev || s.completed}
                    title={tw.copyPrevious}
                    onClick={() =>
                      prev &&
                      updateSet(s.id, {
                        weight: weightToInput(prev.weightKg, units),
                        reps: prev.reps != null ? String(prev.reps) : "",
                        duration: durationToInput(prev.durationSeconds),
                        distance: distanceToInput(prev.distanceM, units),
                      })
                    }
                  >
                    {prevText}
                  </button>
                  {showWeight && (
                    <CellInput
                      label={`${tw.set} ${setNo} ${loadLabel}`}
                      value={s.weight}
                      placeholder={target?.weightKg != null ? weightToInput(target.weightKg, units) : ""}
                      onChange={(v) => updateSet(s.id, { weight: v })}
                      completed={s.completed}
                    />
                  )}
                  {showReps && (
                    <CellInput
                      label={`${tw.set} ${setNo} ${t.training.reps}`}
                      value={s.reps}
                      integer
                      placeholder={target?.reps != null ? String(target.reps) : ""}
                      onChange={(v) => updateSet(s.id, { reps: v })}
                      completed={s.completed}
                    />
                  )}
                  {showDistance && (
                    <CellInput
                      label={`${tw.set} ${setNo} ${fmt.distanceUnit}`}
                      value={s.distance}
                      placeholder={target?.distanceM != null ? distanceToInput(target.distanceM, units) : ""}
                      onChange={(v) => updateSet(s.id, { distance: v })}
                      completed={s.completed}
                    />
                  )}
                  {showDuration && (
                    <CellInput
                      label={`${tw.set} ${setNo} ${t.training.duration}`}
                      value={s.duration}
                      text
                      placeholder={target?.durationSeconds != null ? durationToInput(target.durationSeconds) : "0:00"}
                      onChange={(v) => updateSet(s.id, { duration: v })}
                      completed={s.completed}
                    />
                  )}
                  {showReps && (
                    <CellInput label={`${tw.set} ${setNo} ${effortLabel}`} value={s.effort} placeholder="–" onChange={(v) => updateSet(s.id, { effort: v })} completed={s.completed} />
                  )}
                  <button
                    type="button"
                    onClick={() => toggleComplete(s)}
                    aria-pressed={s.completed}
                    aria-label={`${tw.set} ${setNo}: ${t.common.done}`}
                    className={cn(
                      "mx-auto flex size-10 items-center justify-center rounded-xl border-2 transition active:scale-90",
                      s.completed ? "border-good bg-good text-white" : "border-border-strong text-fg-3 hover:border-good hover:text-good-text",
                    )}
                  >
                    <Check className="size-5" strokeWidth={3} />
                  </button>
                </div>
                {prs.length > 0 && (
                  <div className="flex flex-wrap gap-1 px-1 pt-1 pb-0.5 animate-pop-in">
                    {prs.map((p) => (
                      <span key={p} className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--series-4)_22%,transparent)] px-2 py-0.5 text-[11px] font-semibold text-fg">
                        <Trophy className="size-3 text-[var(--series-4)]" aria-hidden />
                        {t.enums.prType[p]}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <Button type="button" variant="ghost" size="sm" block className="mt-1 text-fg-2" onClick={addSet}>
          <Plus aria-hidden />
          {tw.addSet}
        </Button>
      </div>
    </section>
  );
}

function CellInput({
  value,
  onChange,
  placeholder,
  label,
  integer,
  text,
  completed,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
  integer?: boolean;
  text?: boolean;
  completed: boolean;
}) {
  return (
    <input
      type="text"
      inputMode={text ? "text" : integer ? "numeric" : "decimal"}
      autoComplete="off"
      enterKeyHint="next"
      aria-label={label}
      value={value}
      placeholder={placeholder}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        const v = e.target.value;
        if (text ? /^[\d:]*$/.test(v) : /^[\d.,]*$/.test(v)) onChange(v);
      }}
      className={cn(
        "h-10 w-full min-w-0 rounded-lg border bg-surface-2 px-1 text-center text-[15px] font-semibold tabular text-fg outline-none transition placeholder:font-normal placeholder:text-fg-3/70",
        "focus:border-accent focus:bg-surface focus:ring-2 focus:ring-accent/25",
        completed ? "border-transparent bg-transparent" : "border-transparent",
      )}
    />
  );
}

function SetTypeButton({ set, number, onType, onRemove }: { set: LSet; number: number; onType: (t: SetType) => void; onRemove: () => void }) {
  const t = useT();
  const short = t.enums.setTypeShort[set.setType];
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label={`${t.training.workout.setType}: ${t.enums.setType[set.setType]}`}
          className={cn(
            "mx-auto flex size-8 items-center justify-center rounded-lg text-[13px] font-semibold tabular transition hover:bg-surface-3",
            set.setType === "warmup" && "text-[var(--series-4)]",
            set.setType === "drop" && "text-[var(--series-3)]",
            set.setType === "failure" && "text-critical-text",
            set.setType === "normal" && "text-fg-2",
          )}
        >
          {short || number}
        </button>
      </MenuTrigger>
      <MenuContent align="start">
        <MenuLabel>{t.training.workout.setType}</MenuLabel>
        {SET_TYPES.map((type) => (
          <MenuItem key={type} onSelect={() => onType(type)} icon={type === set.setType ? <Check /> : <span className="size-4" />}>
            {t.enums.setType[type]}
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuItem destructive icon={<X />} onSelect={onRemove}>
          {t.training.workout.removeSet}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

function SuggestionBanner({ suggestion, lastDate, onApply, onDismiss }: { suggestion: ProgressionSuggestion; lastDate: string | null; onApply: () => void; onDismiss: () => void }) {
  const t = useT();
  const ts = t.training.suggestion;
  const locale = useLocale();
  const fmt = useFmt();
  const first = suggestion.sets[0];
  const w = first?.weightKg != null ? fmt.load(first.weightKg) : "";
  const text =
    suggestion.kind === "increase_load"
      ? first?.weightKg != null && suggestion.lastWeightKg == null
        ? format(ts.bodyweightLoad, { weight: w }, locale)
        : format(ts.increase_load, { repMax: suggestion.repMax, weight: w, repMin: suggestion.repMin }, locale)
      : suggestion.kind === "increase_reps"
        ? format(ts.increase_reps, { weight: suggestion.lastWeightKg ? fmt.load(suggestion.lastWeightKg) : "BW", reps: suggestion.sets.map((s) => s.reps).join(" / ") }, locale)
        : suggestion.kind === "repeat"
          ? format(ts.repeat, { weight: w }, locale)
          : format(ts.reset, { repMin: suggestion.repMin, weight: w }, locale);
  return (
    <div className="mx-4 mb-2 flex items-start gap-2.5 rounded-xl border border-border bg-surface-2 px-3 py-2.5 sm:mx-5">
      <Lightbulb className="mt-0.5 size-4 shrink-0 text-[var(--series-4)]" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-snug text-fg">{text}</p>
        {lastDate && <p className="mt-0.5 text-[11px] text-fg-3">{format(ts.basedOn, { date: fmt.date(lastDate, "medium") }, locale)}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button type="button" size="xs" variant="secondary" onClick={onApply}>
          {ts.apply}
        </Button>
        <Button type="button" size="icon-sm" variant="ghost" aria-label={ts.dismiss} onClick={onDismiss}>
          <X />
        </Button>
      </div>
    </div>
  );
}

function ConfigRow({
  cfg,
  showReps,
  onChange,
}: {
  cfg: { repMin: number; repMax: number; rest: number };
  showReps: boolean;
  onChange: (fn: (ex: LExercise) => LExercise) => void;
}) {
  const t = useT();
  const [min, setMin] = React.useState(String(cfg.repMin));
  const [max, setMax] = React.useState(String(cfg.repMax));
  const [rest, setRest] = React.useState(String(cfg.rest));
  const commit = () => {
    const a = parseDecimal(min);
    const b = parseDecimal(max);
    const r = parseDecimal(rest);
    onChange((e) => ({
      ...e,
      repMin: a != null ? Math.max(1, Math.min(100, Math.round(a))) : e.repMin,
      repMax: b != null ? Math.max(1, Math.min(100, Math.round(Math.max(b, a ?? 1)))) : e.repMax,
      restSeconds: r != null ? Math.max(0, Math.min(900, Math.round(r))) : e.restSeconds,
    }));
  };
  return (
    <div className="mx-4 mb-2 grid grid-cols-3 gap-2 rounded-xl bg-surface-2 p-3 sm:mx-5">
      {showReps && (
        <>
          <Field label={`${t.training.reps} min`}>
            <NumberInput integer value={min} onValueChange={setMin} onBlur={commit} />
          </Field>
          <Field label={`${t.training.reps} max`}>
            <NumberInput integer value={max} onValueChange={setMax} onBlur={commit} />
          </Field>
        </>
      )}
      <Field label={t.training.exercise.restSeconds}>
        <NumberInput integer value={rest} onValueChange={setRest} onBlur={commit} />
      </Field>
    </div>
  );
}
