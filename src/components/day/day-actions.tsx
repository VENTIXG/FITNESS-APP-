"use client";

import * as React from "react";
import { Footprints, Moon, NotebookPen, Pencil, Scale } from "lucide-react";
import { SleepForm, NoteForm, StepsForm } from "@/components/forms/lifestyle-forms";
import { WeightForm } from "@/components/forms/weight-form";
import { useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";

type Kind = "weight" | "steps" | "sleep" | "note";

/** Log or edit entries for a specific (possibly past) date. */
export function DayLogButton({
  kind,
  date,
  label,
  variant = "secondary",
  initial,
}: {
  kind: Kind;
  date: string;
  label: string;
  variant?: "secondary" | "ghost";
  initial?: {
    weight?: { id: string; date: string; weightKg: number; note: string | null } | null;
    manualSteps?: number | null;
    sleep?: { date: string; bedTime: string | null; wakeTime: string | null; quality: number | null; note: string | null } | null;
    note?: { content: string; tags: string[]; energy: number | null } | null;
  };
}) {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  const icon = { weight: <Scale />, steps: <Footprints />, sleep: <Moon />, note: <NotebookPen /> }[kind];
  const title = { weight: t.weight.log, steps: t.steps.set, sleep: t.sleep.log, note: t.notes.title }[kind];
  const done = () => setOpen(false);
  return (
    <>
      <Button variant={variant} size="sm" onClick={() => setOpen(true)}>
        {initial && Object.values(initial).some(Boolean) ? <Pencil aria-hidden /> : icon}
        {label}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        {open && (
          <SheetContent title={title} description={kind === "steps" ? t.steps.manualHint : undefined}>
            {kind === "weight" && <WeightForm defaultDate={date} initial={initial?.weight ?? undefined} onDone={done} />}
            {kind === "steps" && <StepsForm date={date} currentManual={initial?.manualSteps ?? null} onDone={done} />}
            {kind === "sleep" && <SleepForm initial={initial?.sleep ?? { date, bedTime: null, wakeTime: null, quality: null, note: null }} onDone={done} />}
            {kind === "note" && <NoteForm date={date} initial={initial?.note ?? null} onDone={done} />}
          </SheetContent>
        )}
      </Sheet>
    </>
  );
}
