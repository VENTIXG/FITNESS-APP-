"use client";

import { Trash2 } from "lucide-react";
import { useT } from "@/components/providers/i18n-provider";
import { useRun } from "@/lib/client/run-action";
import type { ActionResult } from "@/server/actions/_lib";
import { Button } from "./button";
import { useConfirm } from "./confirm-dialog";

/** Icon button that confirms, then calls a server action with `{ id }`. */
export function DeleteButton({
  id,
  action,
  description,
  title,
  successMessage,
}: {
  id: string;
  action: (input: { id: string }) => Promise<ActionResult<unknown>>;
  description?: string;
  title?: string;
  successMessage?: string;
}) {
  const t = useT();
  const { run, pending } = useRun();
  const { confirm, dialog } = useConfirm();
  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t.common.delete}
        loading={pending}
        onClick={async () => {
          if (await confirm({ title: title ?? t.common.delete, description, destructive: true, confirmLabel: t.common.delete })) {
            await run(() => action({ id }), { success: successMessage ?? t.common.deleted });
          }
        }}
      >
        {!pending && <Trash2 />}
      </Button>
      {dialog}
    </>
  );
}
