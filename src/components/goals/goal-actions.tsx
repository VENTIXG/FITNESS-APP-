"use client";

import * as React from "react";
import { Archive, CheckCircle2, MoreHorizontal, Pencil, Plus } from "lucide-react";
import { useT } from "@/components/providers/i18n-provider";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useRun } from "@/lib/client/run-action";
import { applyCalorieSuggestion, setGoalStatus } from "@/server/actions/goals";
import { GoalForm } from "./goal-form";

type GoalInitial = React.ComponentProps<typeof GoalForm>["initial"];

export function NewGoalButton({ currentKg, ...props }: { currentKg: number | null } & ButtonProps) {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button {...props} onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        {t.goals.newGoal}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent title={t.goals.newGoal}>
          <GoalForm currentKg={currentKg} onDone={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}

export function GoalMenu({ goal, currentKg }: { goal: NonNullable<GoalInitial>; currentKg: number | null }) {
  const t = useT();
  const { run } = useRun();
  const [editing, setEditing] = React.useState(false);
  return (
    <>
      <Menu>
        <MenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={t.common.actions}>
            <MoreHorizontal />
          </Button>
        </MenuTrigger>
        <MenuContent>
          <MenuItem icon={<Pencil />} onSelect={() => setEditing(true)}>
            {t.goals.editGoal}
          </MenuItem>
          <MenuItem icon={<CheckCircle2 />} onSelect={() => run(() => setGoalStatus({ id: goal.id, status: "completed" }), { success: t.goals.saved })}>
            {t.goals.markComplete}
          </MenuItem>
          <MenuItem icon={<Archive />} onSelect={() => run(() => setGoalStatus({ id: goal.id, status: "archived" }), { success: t.goals.saved })}>
            {t.goals.archive}
          </MenuItem>
        </MenuContent>
      </Menu>
      <Sheet open={editing} onOpenChange={setEditing}>
        <SheetContent title={t.goals.editGoal}>
          <GoalForm initial={goal} currentKg={currentKg} onDone={() => setEditing(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}

export function ApplySuggestionButton({ calories }: { calories: number }) {
  const t = useT();
  const { run, pending } = useRun();
  return (
    <Button variant="secondary" size="sm" loading={pending} onClick={() => run(() => applyCalorieSuggestion({ calories }), { success: t.goals.suggestionApplied })}>
      {t.goals.useSuggestion}
    </Button>
  );
}
