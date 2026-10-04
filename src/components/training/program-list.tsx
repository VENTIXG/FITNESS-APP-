"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronRight, LayoutTemplate, MoreHorizontal, Pencil, Power, Trash2 } from "lucide-react";
import { useLocale, useT } from "@/components/providers/i18n-provider";
import { useFmt } from "@/components/providers/prefs-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Badge, EmptyState } from "@/components/ui/data-display";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { useRun } from "@/lib/client/run-action";
import { format } from "@/lib/i18n";
import { createProgramFromTemplate, deleteProgram, setActiveProgram } from "@/server/actions/training";

type ProgramRow = { id: string; name: string; description: string | null; scheduleType: "rotation" | "weekly"; isActive: boolean; days: number; lastUsed: string | null };
const TEMPLATES = ["ppl", "upperLower", "fullBody", "blank"] as const;

export function ProgramList({ programs }: { programs: ProgramRow[] }) {
  const t = useT();
  const tp = t.training.program;
  const locale = useLocale();
  const fmt = useFmt();
  const router = useRouter();
  const { run } = useRun();
  const { confirm, dialog } = useConfirm();
  const [busy, setBusy] = React.useState<string | null>(null);

  const fromTemplate = async (template: (typeof TEMPLATES)[number]) => {
    setBusy(template);
    const res = await run(() => createProgramFromTemplate({ template }), { success: tp.saved });
    setBusy(null);
    if (res.ok) router.push(`/training/programs/${res.data.id}`);
  };

  return (
    <div className="space-y-5">
      {programs.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {programs.map((p) => (
            <Card key={p.id} className={p.isActive ? "border-accent/60" : undefined}>
              <div className="flex items-start gap-2">
                <Link href={`/training/programs/${p.id}`} className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-semibold">{p.name}</h3>
                    {p.isActive && (
                      <Badge tone="accent">
                        <CheckCircle2 className="size-3" aria-hidden />
                        {tp.active}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-[13px] text-fg-3">
                    {format(t.common.days, { count: p.days }, locale)} · {t.enums.scheduleType[p.scheduleType]}
                  </p>
                  {p.lastUsed && <p className="mt-0.5 text-xs text-fg-3">{t.training.exercise.lastPerformed}: {fmt.date(p.lastUsed, "dayMonth")}</p>}
                </Link>
                <Menu>
                  <MenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={`${t.common.actions}: ${p.name}`}>
                      <MoreHorizontal />
                    </Button>
                  </MenuTrigger>
                  <MenuContent>
                    <MenuItem icon={<Pencil />} asChild>
                      <Link href={`/training/programs/${p.id}`}>{t.common.edit}</Link>
                    </MenuItem>
                    {p.isActive ? (
                      <MenuItem icon={<Power />} onSelect={() => run(() => setActiveProgram({ id: null }), { success: t.common.saved })}>
                        {tp.deactivate}
                      </MenuItem>
                    ) : (
                      <MenuItem icon={<CheckCircle2 />} onSelect={() => run(() => setActiveProgram({ id: p.id }), { success: tp.activated })}>
                        {tp.setActive}
                      </MenuItem>
                    )}
                    <MenuSeparator />
                    <MenuItem
                      icon={<Trash2 />}
                      destructive
                      onSelect={async () => {
                        if (await confirm({ title: t.common.delete, description: tp.deleteConfirm, destructive: true, confirmLabel: t.common.delete }))
                          await run(() => deleteProgram({ id: p.id }), { success: t.common.deleted });
                      }}
                    >
                      {t.common.delete}
                    </MenuItem>
                  </MenuContent>
                </Menu>
              </div>
              <Link href={`/training/programs/${p.id}`} className="mt-3 inline-flex items-center gap-0.5 text-[13px] font-medium text-accent hover:underline">
                {tp.edit}
                <ChevronRight className="size-3.5" aria-hidden />
              </Link>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState icon={<LayoutTemplate />} title={tp.emptyTitle} body={tp.emptyBody} />
        </Card>
      )}
      <section>
        <h2 className="mb-3 text-[15px] font-semibold">{tp.templates}</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {TEMPLATES.map((k) => (
            <Button key={k} variant="secondary" size="lg" className="justify-start" loading={busy === k} disabled={!!busy} onClick={() => fromTemplate(k)}>
              <LayoutTemplate aria-hidden />
              {tp.template[k]}
            </Button>
          ))}
        </div>
      </section>
      {dialog}
    </div>
  );
}
