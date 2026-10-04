"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, SlidersHorizontal } from "lucide-react";
import { useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useRun } from "@/lib/client/run-action";
import type { DashboardCard } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { saveDashboardLayout } from "@/server/actions/settings";

export function DashboardGrid({
  order: initialOrder,
  hidden: initialHidden,
  cards,
}: {
  order: DashboardCard[];
  hidden: DashboardCard[];
  cards: Partial<Record<DashboardCard, React.ReactNode>>;
}) {
  const t = useT();
  const { run } = useRun();
  const [order, setOrder] = React.useState(initialOrder);
  const [hidden, setHidden] = React.useState(initialHidden);
  const [open, setOpen] = React.useState(false);

  const persist = (nextOrder: DashboardCard[], nextHidden: DashboardCard[]) => {
    setOrder(nextOrder);
    setHidden(nextHidden);
    void run(() => saveDashboardLayout({ order: nextOrder, hidden: nextHidden }), { silent: false });
  };
  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[idx], next[j]] = [next[j], next[idx]];
    persist(next, hidden);
  };
  const toggle = (card: DashboardCard) => persist(order, hidden.includes(card) ? hidden.filter((c) => c !== card) : [...hidden, card]);

  const visible = order.filter((c) => !hidden.includes(c) && cards[c] != null);

  return (
    <>
      <div className="grid grid-flow-row-dense gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((card, i) => (
          <div key={card} className={cn("animate-fade-up [&>section]:h-full", (card === "weekly" || card === "insights") && "sm:col-span-2", card === "insights" && "xl:col-span-1")} style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
            {cards[card]}
          </div>
        ))}
      </div>
      <div className="mt-6 flex justify-center">
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          <SlidersHorizontal aria-hidden />
          {t.dashboard.editLayout}
        </Button>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent title={t.dashboard.customizeTitle} description={t.dashboard.customizeHint}>
          <ul className="divide-y divide-border">
            {order.map((card, idx) => {
              const isHidden = hidden.includes(card);
              return (
                <li key={card} className="flex items-center gap-2 py-2.5">
                  <span className={cn("flex-1 text-sm font-medium", isHidden && "text-fg-3 line-through")}>{t.enums.dashboardCard[card]}</span>
                  <Button variant="ghost" size="icon-sm" onClick={() => move(idx, -1)} disabled={idx === 0} aria-label={t.common.moveUp}>
                    <ArrowUp />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => move(idx, 1)} disabled={idx === order.length - 1} aria-label={t.common.moveDown}>
                    <ArrowDown />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => toggle(card)} aria-label={isHidden ? t.common.show : t.common.hide} aria-pressed={!isHidden}>
                    {isHidden ? <EyeOff /> : <Eye />}
                  </Button>
                </li>
              );
            })}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
}
