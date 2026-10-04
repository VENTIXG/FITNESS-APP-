import type { Metadata } from "next";
import { Moon } from "lucide-react";
import { SimpleChartCard } from "@/components/analytics/simple-chart";
import { SleepList } from "@/components/habits/lifestyle-views";
import { Card, CardHeader } from "@/components/ui/card";
import { Stat } from "@/components/ui/data-display";
import { addDays, eachDay } from "@/lib/dates";
import { mean } from "@/lib/utils";
import { getT, getUserContext } from "@/server/context";
import { getSleepEntries } from "@/server/queries/days";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).sleep.title };
}

export default async function SleepPage() {
  const ctx = await getUserContext();
  const { t, fmt } = ctx;
  const entries = await getSleepEntries(ctx.userId, addDays(ctx.today, -89), ctx.today);
  // One value per night: manual entries win over imported ones.
  const byDate = new Map<string, (typeof entries)[number]>();
  for (const e of entries) {
    const cur = byDate.get(e.date);
    if (!cur || (cur.source !== "manual" && e.source === "manual")) byDate.set(e.date, e);
  }
  const nights = [...byDate.values()];
  const last = nights[0];
  const week = nights.filter((n) => n.date > addDays(ctx.today, -7));
  const prevWeek = nights.filter((n) => n.date <= addDays(ctx.today, -7) && n.date > addDays(ctx.today, -14));
  const avg = (list: typeof nights) => (list.length ? mean(list.map((n) => n.durationMinutes)) : null);
  const quality = week.filter((n) => n.quality != null);
  const goal = ctx.prefs.goals.sleepGoalMinutes;
  const rows = eachDay(addDays(ctx.today, -29), ctx.today).map((date) => ({ date, sleep: byDate.get(date)?.durationMinutes ?? null }));
  const labels = t.sleep.qualityLabels as Record<string, string>;
  const wk = avg(week);
  const pw = avg(prevWeek);
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <CardHeader title={t.sleep.lastNight} icon={<Moon />} />
          <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
            <Stat label={t.sleep.lastNight} value={last ? fmt.sleep(last.durationMinutes) : "—"} sub={last?.quality != null ? <span className="text-fg-3">{labels[String(last.quality)]}</span> : undefined} />
            <Stat label={t.sleep.weekAvg} value={wk != null ? fmt.sleep(wk) : "—"} sub={wk != null && pw != null ? <span className="text-fg-3">{t.common.lastWeek}: {fmt.sleep(pw)}</span> : undefined} />
            <Stat label={t.sleep.quality} value={quality.length ? fmt.number(mean(quality.map((n) => n.quality!))!, 1) + " / 5" : "—"} />
            <Stat label={t.sleep.goal} value={goal ? fmt.sleep(goal) : "—"} />
          </div>
        </Card>
        <SimpleChartCard
          title={t.analytics.sleepChart}
          kind="sleep"
          rows={rows}
          series={[{ kind: "bar", key: "sleep", label: t.sleep.total, color: "--series-7" }]}
          refLines={goal ? [{ y: goal, label: t.sleep.goal, color: "--fg-2" }] : []}
          height={240}
        />
      </div>
      <SleepList
        goal={goal}
        entries={nights.slice(0, 30).map((n) => ({ id: n.id, date: n.date, bedTime: n.bedTime, wakeTime: n.wakeTime, durationMinutes: n.durationMinutes, quality: n.quality, note: n.note, source: n.source }))}
      />
    </div>
  );
}
