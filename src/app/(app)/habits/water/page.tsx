import type { Metadata } from "next";
import { Droplets } from "lucide-react";
import { SimpleChartCard } from "@/components/analytics/simple-chart";
import { WaterQuickAdd, WaterUndoButton } from "@/components/forms/lifestyle-forms";
import { WaterEntryList } from "@/components/habits/lifestyle-views";
import { Card, CardHeader } from "@/components/ui/card";
import { Meter, Stat } from "@/components/ui/data-display";
import { addDays } from "@/lib/dates";
import { mean } from "@/lib/utils";
import { getT, getUserContext } from "@/server/context";
import { getDaySummaries, getWaterEntries } from "@/server/queries/days";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).water.title };
}

export default async function WaterPage() {
  const ctx = await getUserContext();
  const { t, fmt } = ctx;
  const [days, entries] = await Promise.all([getDaySummaries(ctx, addDays(ctx.today, -29), ctx.today), getWaterEntries(ctx.userId, ctx.today)]);
  const today = days.at(-1);
  const goal = ctx.prefs.goals.waterGoalMl;
  const prev7 = days.filter((d) => d.date < ctx.today).slice(-7).filter((d) => d.waterMl > 0);
  const avg7 = prev7.length ? mean(prev7.map((d) => d.waterMl)) : null;
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
      <div className="space-y-4">
        <Card>
          <CardHeader title={t.water.today} icon={<Droplets />} action={<WaterUndoButton date={ctx.today} />} />
          <div className="text-[34px] leading-none font-semibold tracking-tight tabular">{fmt.volume(today?.waterMl ?? 0)}</div>
          {goal > 0 && <Meter className="mt-3" value={today?.waterMl ?? 0} max={goal} color="var(--series-3)" showOverflow={false} label={t.water.title} />}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Stat label={t.water.goal} value={goal ? fmt.volume(goal) : "—"} />
            <Stat label={t.water.avg7} value={avg7 != null ? fmt.volume(avg7) : "—"} />
          </div>
          <div className="mt-4 border-t border-border pt-4">
            <WaterQuickAdd totalMl={today?.waterMl ?? 0} />
          </div>
        </Card>
        <Card>
          <CardHeader title={t.water.entries} />
          <WaterEntryList entries={entries} timezone={ctx.timezone} />
        </Card>
      </div>
      <div className="lg:col-span-2">
        <SimpleChartCard
          title={t.analytics.waterChart}
          kind="ml"
          rows={days.map((d) => ({ date: d.date, water: d.waterMl || null }))}
          series={[{ kind: "bar", key: "water", label: t.water.title, color: "--series-3" }]}
          refLines={goal ? [{ y: goal, label: t.water.goal, color: "--fg-2" }] : []}
          height={260}
        />
      </div>
    </div>
  );
}
