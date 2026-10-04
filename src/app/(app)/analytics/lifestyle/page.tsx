import type { Metadata } from "next";
import { SimpleChartCard } from "@/components/analytics/simple-chart";
import { RangeLinks, parseRange, rangeStart } from "@/components/analytics/range";
import { Card, CardHeader } from "@/components/ui/card";
import { Meter } from "@/components/ui/data-display";
import { dailyScore } from "@/lib/calc/score";
import { getT, getUserContext } from "@/server/context";
import { getDaySummaries } from "@/server/queries/days";
import { getHabitStatuses } from "@/server/queries/habits";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).analytics.tabs.lifestyle };
}

export default async function LifestyleAnalyticsPage({ searchParams }: PageProps<"/analytics/lifestyle">) {
  const ctx = await getUserContext();
  const { t, fmt } = ctx;
  const ta = t.analytics;
  const range = parseRange(await searchParams, 30);
  const start = rangeStart(ctx.today, range);
  const days = await getDaySummaries(ctx, start, ctx.today);
  const habits = await getHabitStatuses(ctx, days);
  const rows = days.map((d) => ({
    date: d.date,
    sleep: d.sleepMinutes,
    water: d.waterMl || null,
    score: ctx.prefs.scoring.enabled ? dailyScore(d, ctx.prefs.scoring.weights).score : null,
  }));
  const goals = ctx.prefs.goals;
  return (
    <div className="space-y-4">
      <RangeLinks base="/analytics/lifestyle" value={range} label={ta.range} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SimpleChartCard
          title={ta.sleepChart}
          kind="sleep"
          rows={rows}
          series={[{ kind: "bar", key: "sleep", label: t.sleep.total, color: "--series-7" }]}
          refLines={goals.sleepGoalMinutes ? [{ y: goals.sleepGoalMinutes, label: t.common.goal, color: "--fg-2" }] : []}
        />
        <SimpleChartCard
          title={ta.waterChart}
          kind="ml"
          rows={rows}
          series={[{ kind: "bar", key: "water", label: t.water.title, color: "--series-3" }]}
          refLines={goals.waterGoalMl ? [{ y: goals.waterGoalMl, label: t.common.goal, color: "--fg-2" }] : []}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {ctx.prefs.scoring.enabled && (
          <SimpleChartCard title={ta.dailyScores} kind="score" rows={rows} series={[{ kind: "line", key: "score", label: ta.dailyScores, color: "--series-1", dots: true }]} />
        )}
        <Card>
          <CardHeader title={ta.habitCompletion} href="/habits" />
          {habits.length ? (
            <ul className="space-y-2.5">
              {habits.map((h) => {
                const label = h.type === "auto" && h.autoMetric ? h.name || t.enums.autoHabit[h.autoMetric as keyof typeof t.enums.autoHabit] : h.name;
                return (
                  <li key={h.id}>
                    <div className="mb-1 flex justify-between gap-2 text-[13px]">
                      <span className="truncate text-fg-2">{label}</span>
                      <span className="font-semibold tabular">{h.completionRate != null ? fmt.pct(h.completionRate) : "—"}</span>
                    </div>
                    <Meter value={h.completionRate ?? 0} max={1} height={6} color="var(--series-2)" showOverflow={false} label={label} />
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-fg-3">{t.habits.emptyBody}</p>
          )}
        </Card>
      </div>
    </div>
  );
}
