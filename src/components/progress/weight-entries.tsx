"use client";

import * as React from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { WeightForm } from "@/components/forms/weight-form";
import { useT } from "@/components/providers/i18n-provider";
import { useFmt } from "@/components/providers/prefs-provider";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Badge } from "@/components/ui/data-display";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useRun } from "@/lib/client/run-action";
import type { DataSource } from "@/lib/domain";
import { deleteWeight } from "@/server/actions/body";

type Entry = { id: string; date: string; weightKg: number; note: string | null; source: string };

export function WeightEntries({ entries }: { entries: Entry[] }) {
  const t = useT();
  const fmt = useFmt();
  const { run } = useRun();
  const { confirm, dialog } = useConfirm();
  const [editing, setEditing] = React.useState<Entry | null>(null);
  const [limit, setLimit] = React.useState(20);
  const sorted = [...entries].reverse();
  return (
    <>
      <ul className="divide-y divide-border lg:max-h-[640px] lg:overflow-y-auto lg:pr-1">
        {sorted.slice(0, limit).map((e, i) => {
          const prev = sorted[i + 1];
          const diff = prev ? e.weightKg - prev.weightKg : null;
          return (
            <li key={e.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-fg">{fmt.date(e.date, "weekdayShort")}</div>
                {e.note && <div className="truncate text-xs text-fg-3">{e.note}</div>}
              </div>
              {e.source !== "manual" && <Badge tone="outline">{t.enums.source[e.source as DataSource]}</Badge>}
              <div className="text-right">
                <div className="text-sm font-semibold tabular">{fmt.weight(e.weightKg)}</div>
                {diff != null && <div className="text-xs text-fg-3 tabular">{fmt.weight(diff, { signed: true })}</div>}
              </div>
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
                    destructive
                    icon={<Trash2 />}
                    onSelect={async () => {
                      if (await confirm({ title: t.common.delete, description: `${fmt.date(e.date, "medium")} · ${fmt.weight(e.weightKg)}`, destructive: true, confirmLabel: t.common.delete })) {
                        await run(() => deleteWeight({ id: e.id }), { success: t.weight.deleted });
                      }
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
      {sorted.length > limit && (
        <Button variant="ghost" block className="mt-2" onClick={() => setLimit((l) => l + 60)}>
          {t.common.more}
        </Button>
      )}
      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && (
          <SheetContent title={t.weight.editEntry}>
            <WeightForm initial={editing} onDone={() => setEditing(null)} />
          </SheetContent>
        )}
      </Sheet>
      {dialog}
    </>
  );
}
