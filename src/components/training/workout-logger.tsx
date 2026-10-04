"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronLeft, Cloud, CloudOff, Dumbbell, Loader2, Plus, Trash2 } from "lucide-react";
import { useMounted } from "@/components/charts/chart-utils";
import { useLocale, useT } from "@/components/providers/i18n-provider";
import { useFmt, usePrefs } from "@/components/providers/prefs-provider";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { ChipToggle, parseDecimal } from "@/components/ui/controls";
import { Skeleton } from "@/components/ui/data-display";
import { Field, Textarea } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { setVolume } from "@/lib/calc/training";
import { useRun } from "@/lib/client/run-action";
import type { TrackingType } from "@/lib/domain";
import { format } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { deleteWorkout, finishWorkout, loadExerciseContexts, syncWorkout } from "@/server/actions/training";
import type { ExerciseContext, ExerciseInfo } from "@/server/queries/training";
import { ExerciseCard } from "./exercise-card";
import { ExercisePicker } from "./exercise-picker";
import { clearLocal, emptySet, fromServer, inputToKg, loadLocal, saveLocal, toSnapshot, uid, type LExercise, type LoggerState, type LSet, type ServerWorkout } from "./logger-state";
import { RestTimerBar, useRestTimer } from "./rest-timer";

export type LoggerProps = {
  workout: ServerWorkout & { status: "in_progress" | "completed"; startedAt: string; updatedAtMs: number; sessionRpe: number | null };
  contexts: Record<string, ExerciseContext>;
  library: ExerciseInfo[];
  recentIds: string[];
};

/** The logger keeps device-local state, so it renders only on the client. */
export function WorkoutLoggerGate(props: LoggerProps) {
  const mounted = useMounted();
  if (!mounted)
    return (
      <div className="space-y-3">
        <Skeleton className="h-14" />
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>
    );
  return <WorkoutLogger {...props} />;
}

type SyncStatus = "saved" | "saving" | "offline" | "error";

function WorkoutLogger({ workout, contexts: initialContexts, library, recentIds }: LoggerProps) {
  const t = useT();
  const tw = t.training.workout;
  const locale = useLocale();
  const fmt = useFmt();
  const prefs = usePrefs();
  const router = useRouter();
  const { run } = useRun();
  const { confirm, dialog } = useConfirm();
  const timer = useRestTimer();
  const units = fmt.units;
  const metric = prefs.training.effortMetric;
  const editing = workout.status === "completed";

  const [state, setState] = React.useState<LoggerState>(() => {
    const server = fromServer(workout, units, metric, workout.updatedAtMs);
    const local = loadLocal(workout.id);
    // Unsynced local edits newer than the server copy win (e.g. after going offline).
    return local && local.rev > local.savedRev && local.updatedAt >= workout.updatedAtMs ? local : server;
  });
  const [contexts, setContexts] = React.useState(initialContexts);
  const [status, setStatus] = React.useState<SyncStatus>("saved");
  const [picker, setPicker] = React.useState<{ mode: "add" } | { mode: "replace"; exerciseId: string } | null>(null);
  const [finishing, setFinishing] = React.useState(false);

  const tracking = React.useCallback((exerciseId: string): TrackingType => contexts[exerciseId]?.exercise.trackingType ?? "weight_reps", [contexts]);

  const update = React.useCallback((fn: (s: LoggerState) => LoggerState) => {
    setState((s) => ({ ...fn(s), rev: s.rev + 1, updatedAt: Date.now() }));
  }, []);
  const updateExercise = (id: string, fn: (e: LExercise) => LExercise) => update((s) => ({ ...s, exercises: s.exercises.map((e) => (e.id === id ? fn(e) : e)) }));

  // Persist every change on the device.
  React.useEffect(() => {
    saveLocal(state);
  }, [state]);

  // Debounced autosave of in-progress workouts.
  const syncing = React.useRef(false);
  const [retryTick, setRetryTick] = React.useState(0);
  React.useEffect(() => {
    if (editing || state.rev <= state.savedRev) return;
    const id = window.setTimeout(async () => {
      if (syncing.current) return;
      if (!navigator.onLine) {
        setStatus("offline");
        return;
      }
      syncing.current = true;
      setStatus("saving");
      const rev = state.rev;
      const res = await run(() => syncWorkout(toSnapshot(state, units, metric, tracking)), { silent: true });
      syncing.current = false;
      if (res.ok) {
        setState((s) => ({ ...s, savedRev: Math.max(s.savedRev, rev) }));
        setStatus("saved");
      } else {
        setStatus(res.error === "network" ? "offline" : "error");
        window.setTimeout(() => setRetryTick((n) => n + 1), 8000);
      }
    }, 1200);
    return () => window.clearTimeout(id);
  }, [state, editing, units, metric, tracking, run, retryTick]);

  React.useEffect(() => {
    const onOnline = () => setRetryTick((n) => n + 1);
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  // Elapsed time (in-progress only).
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (editing) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [editing]);
  const elapsed = Math.max(0, Math.floor((now - Date.parse(workout.startedAt)) / 1000));

  const addExercises = async (ids: string[]) => {
    const missing = ids.filter((id) => !contexts[id]);
    if (missing.length) {
      const res = await run(() => loadExerciseContexts({ exerciseIds: missing, workoutId: workout.id }));
      if (!res.ok) return;
      setContexts((c) => ({ ...c, ...res.data }));
      return res.data;
    }
    return {};
  };

  const newExercise = (exerciseId: string, ctx: ExerciseContext | undefined): LExercise => {
    const lastSets = ctx?.sessions[0]?.sets ?? [];
    const warmups = lastSets.filter((s) => s.setType === "warmup").length;
    const working = Math.max(1, Math.min(8, lastSets.length - warmups || 3));
    return {
      id: uid(),
      exerciseId,
      notes: "",
      repMin: null,
      repMax: null,
      restSeconds: null,
      sets: [...Array.from({ length: warmups }, () => emptySet("warmup")), ...Array.from({ length: working }, () => emptySet())],
    };
  };

  const onPicked = async (ids: string[]) => {
    const fetched = (await addExercises(ids)) ?? {};
    const ctxOf = (id: string) => contexts[id] ?? fetched[id];
    if (picker?.mode === "replace") {
      const [id] = ids;
      update((s) => ({
        ...s,
        exercises: s.exercises.map((e) => (e.id === picker.exerciseId ? { ...newExercise(id, ctxOf(id)), id: e.id, sets: e.sets.map((x) => ({ ...x, completed: false, completedAt: null })) } : e)),
      }));
    } else {
      update((s) => ({ ...s, exercises: [...s.exercises, ...ids.map((id) => newExercise(id, ctxOf(id)))] }));
    }
    setPicker(null);
  };

  const onSetCompleted = (set: LSet, ex: LExercise) => {
    if (editing || !prefs.training.autoStartRest) return;
    const ctx = contexts[ex.exerciseId];
    const rest = ex.restSeconds ?? ctx?.settings?.restSeconds ?? prefs.training.defaultRestSeconds;
    timer.start(set.setType === "warmup" ? Math.min(60, rest) : rest);
  };

  const allSets = state.exercises.flatMap((e) => e.sets.map((s) => ({ s, e })));
  const completed = allSets.filter((x) => x.s.completed);
  const incomplete = allSets.length - completed.length;
  const volume = completed.reduce((acc, { s }) => (s.setType === "warmup" && !prefs.training.includeWarmupsInVolume ? acc : acc + setVolume({ weightKg: inputToKg(s.weight, units), reps: parseDecimal(s.reps) })), 0);

  const discard = async () => {
    if (!(await confirm({ title: tw.discard, description: tw.discardConfirm, destructive: true, confirmLabel: tw.discard }))) return;
    const res = await run(() => deleteWorkout({ workoutId: workout.id }));
    if (res.ok) {
      clearLocal(workout.id);
      timer.stop();
      router.replace("/training");
    }
  };

  return (
    <div className="pb-28">
      {/* Sticky header */}
      <div className="sticky top-0 z-30 -mx-4 mb-4 border-b border-border bg-bg/90 px-4 py-2.5 backdrop-blur pt-safe sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" aria-label={t.common.back}>
            <Link href={editing ? `/training/workout/${workout.id}` : "/training"}>
              <ChevronLeft />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <input
              aria-label={tw.name}
              value={state.name}
              maxLength={120}
              onChange={(e) => {
                const v = e.target.value;
                update((s) => ({ ...s, name: v }));
              }}
              className="w-full truncate bg-transparent text-[17px] font-semibold tracking-tight outline-none focus:underline"
            />
            <div className="flex items-center gap-2 text-xs text-fg-3">
              {editing ? <span>{tw.editing}</span> : <span className="tabular">{fmt.clock(elapsed)}</span>}
              {!editing && <SyncBadge status={status} />}
            </div>
          </div>
          <Button variant="accent" onClick={() => setFinishing(true)} disabled={!state.exercises.length}>
            {editing ? tw.saveChanges : tw.finish}
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-3">
        {state.exercises.length === 0 && (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-border-strong px-6 py-12 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-surface-2 text-fg-3">
              <Dumbbell className="size-5" aria-hidden />
            </div>
            <p className="text-sm text-fg-2">{tw.noExercises}</p>
          </div>
        )}
        {state.exercises.map((ex, i) => (
          <ExerciseCard
            key={ex.id}
            ex={ex}
            ctx={contexts[ex.exerciseId]}
            index={i}
            count={state.exercises.length}
            metric={metric}
            onChange={(fn) => updateExercise(ex.id, fn)}
            onSetCompleted={onSetCompleted}
            onMove={(dir) =>
              update((s) => {
                const list = [...s.exercises];
                const j = i + dir;
                if (j < 0 || j >= list.length) return s;
                [list[i], list[j]] = [list[j], list[i]];
                return { ...s, exercises: list };
              })
            }
            onRemove={async () => {
              const hasDone = ex.sets.some((s) => s.completed);
              if (hasDone && !(await confirm({ title: tw.removeExercise, destructive: true, confirmLabel: t.common.remove }))) return;
              update((s) => ({ ...s, exercises: s.exercises.filter((e) => e.id !== ex.id) }));
            }}
            onReplace={() => setPicker({ mode: "replace", exerciseId: ex.id })}
          />
        ))}

        <Button variant="secondary" size="lg" block onClick={() => setPicker({ mode: "add" })}>
          <Plus aria-hidden />
          {tw.addExercise}
        </Button>

        <Field label={tw.notes} htmlFor="workout-notes" className="pt-3">
          <Textarea
            id="workout-notes"
            rows={3}
            maxLength={4000}
            value={state.notes}
            onChange={(e) => {
              const v = e.target.value;
              update((s) => ({ ...s, notes: v }));
            }}
          />
        </Field>

        {!editing && (
          <Button variant="destructive-ghost" block onClick={discard}>
            <Trash2 aria-hidden />
            {tw.discard}
          </Button>
        )}
      </div>

      <Sheet open={picker != null} onOpenChange={(o) => !o && setPicker(null)}>
        {picker && (
          <SheetContent title={picker.mode === "replace" ? tw.replaceExercise : tw.addExercise} size="lg" flush className="sm:h-[80dvh]">
            <ExercisePicker library={library} recentIds={recentIds} single={picker.mode === "replace"} onConfirm={onPicked} />
          </SheetContent>
        )}
      </Sheet>

      <FinishSheet
        open={finishing}
        onOpenChange={setFinishing}
        editing={editing}
        completedSets={completed.length}
        incomplete={incomplete}
        volume={volume}
        elapsed={elapsed}
        initialRpe={workout.sessionRpe}
        onFinish={async (sessionRpe) => {
          const res = await run(() => finishWorkout({ ...toSnapshot(state, units, metric, tracking), sessionRpe }), { success: tw.finished });
          if (!res.ok) return;
          clearLocal(workout.id);
          timer.stop();
          router.replace(`/training/workout/${workout.id}${editing ? "" : "?done=1"}`);
          router.refresh();
        }}
      />

      <RestTimerBar timer={timer} />
      {dialog}
      <span className="sr-only" aria-live="polite">
        {format(tw.exerciseCount, { count: state.exercises.length }, locale)}
      </span>
    </div>
  );
}

function SyncBadge({ status }: { status: SyncStatus }) {
  const t = useT();
  const tw = t.training.workout;
  const map = {
    saved: { icon: <Cloud className="size-3" />, label: tw.syncSaved, cls: "" },
    saving: { icon: <Loader2 className="size-3 animate-spin" />, label: tw.syncSaving, cls: "" },
    offline: { icon: <CloudOff className="size-3" />, label: tw.syncOffline, cls: "text-warn-text" },
    error: { icon: <AlertTriangle className="size-3" />, label: tw.syncError, cls: "text-critical-text" },
  }[status];
  return (
    <span className={cn("inline-flex items-center gap-1", map.cls)} role="status">
      {map.icon}
      {map.label}
    </span>
  );
}

function FinishSheet({
  open,
  onOpenChange,
  editing,
  completedSets,
  incomplete,
  volume,
  elapsed,
  initialRpe,
  onFinish,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: boolean;
  completedSets: number;
  incomplete: number;
  volume: number;
  elapsed: number;
  initialRpe: number | null;
  onFinish: (rpe: number | null) => Promise<void>;
}) {
  const t = useT();
  const tw = t.training.workout;
  const locale = useLocale();
  const fmt = useFmt();
  const [rpe, setRpe] = React.useState<number | null>(initialRpe);
  const [busy, setBusy] = React.useState(false);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {open && (
        <SheetContent title={editing ? tw.saveChanges : tw.finishTitle} size="sm">
          <div className="space-y-5">
            <dl className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: t.training.sets, value: fmt.int(completedSets) },
                { label: t.training.volume, value: fmt.load(volume) },
                { label: t.training.duration, value: editing ? "—" : fmt.duration(elapsed) },
              ].map((x) => (
                <div key={x.label} className="rounded-xl bg-surface-2 px-2 py-3">
                  <dt className="text-[11px] text-fg-3">{x.label}</dt>
                  <dd className="mt-0.5 text-[15px] font-semibold tabular">{x.value}</dd>
                </div>
              ))}
            </dl>
            {incomplete > 0 && (
              <p className="flex items-start gap-2 rounded-xl bg-warn/10 px-3 py-2.5 text-[13px] text-warn-text">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                {format(tw.finishWithIncomplete, { count: incomplete }, locale)}
              </p>
            )}
            <Field label={tw.sessionRpe}>
              <div className="flex flex-wrap gap-1.5">
                {[5, 6, 7, 8, 9, 10].map((v) => (
                  <ChipToggle key={v} selected={rpe === v} onClick={() => setRpe(rpe === v ? null : v)} className="min-w-11">
                    {v}
                  </ChipToggle>
                ))}
              </div>
            </Field>
            <Button
              variant="accent"
              size="lg"
              block
              loading={busy}
              disabled={completedSets === 0}
              onClick={async () => {
                setBusy(true);
                try {
                  await onFinish(rpe);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {editing ? tw.saveChanges : tw.finish}
            </Button>
          </div>
        </SheetContent>
      )}
    </Sheet>
  );
}
