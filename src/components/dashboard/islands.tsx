"use client";

import * as React from "react";
import { Check, Play } from "lucide-react";
import { useT } from "@/components/providers/i18n-provider";
import { useQuickAdd } from "@/components/shell/app-shell";
import type { QuickAddKind } from "@/components/shell/quick-add";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useRun } from "@/lib/client/run-action";
import { cn } from "@/lib/utils";
import { toggleHabit } from "@/server/actions/habits";
import { startWorkout } from "@/server/actions/training";

export function QuickAddButton({ kind, children, ...props }: { kind: QuickAddKind } & ButtonProps) {
  const qa = useQuickAdd();
  return (
    <Button {...props} onClick={() => qa?.openForm(kind)}>
      {children}
    </Button>
  );
}

export function StartWorkoutButton({ programDayId, children, ...props }: { programDayId: string | null } & ButtonProps) {
  const [pending, startTransition] = React.useTransition();
  return (
    <Button
      {...props}
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          await startWorkout({ programDayId });
        })
      }
    >
      {!pending && <Play aria-hidden className="fill-current" />}
      {children}
    </Button>
  );
}

export function HabitCheck({
  habitId,
  date,
  done,
  manual,
  label,
}: {
  habitId: string;
  date: string;
  done: boolean | null;
  manual: boolean;
  label: string;
}) {
  const t = useT();
  const { run } = useRun();
  const [optimistic, setOptimistic] = React.useState(done);
  React.useEffect(() => setOptimistic(done), [done]);
  const checked = !!optimistic;
  const content = (
    <span
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors",
        checked ? "border-good bg-good text-white" : "border-border-strong bg-transparent",
        optimistic == null && "border-dashed opacity-60",
      )}
      aria-hidden
    >
      {checked && <Check className="size-3.5" strokeWidth={3} />}
    </span>
  );
  if (!manual) {
    return (
      <span className="flex items-center" role="img" aria-label={`${label}: ${checked ? t.common.done : "—"}`}>
        {content}
      </span>
    );
  }
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      className="-m-1.5 rounded-full p-1.5 focus-visible:outline-2 focus-visible:outline-ring"
      onClick={async () => {
        const next = !checked;
        setOptimistic(next);
        const res = await run(() => toggleHabit({ habitId, date, done: next }));
        if (!res.ok) setOptimistic(!next);
      }}
    >
      {content}
    </button>
  );
}
