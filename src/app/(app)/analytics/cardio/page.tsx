import type { Metadata } from "next";
import { SimpleChartCard } from "@/components/analytics/simple-chart";
import { RangeLinks, parseRange, rangeStart, weekStarts } from "@/components/analytics/range";
import { Card, CardHeader } from "@/components/ui/card";
import { Meter } from "@/components/ui/data-display";
import { addDays, eachDay } from "@/lib/dates";
import { toDisplayDistance } from "@/lib/units";
import { getT, getUserContext } from "@/server/context";
import { getCardioSessions, getStepDays } from "@/server/queries/cardio";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).analytics.tabs.cardio };
}

export default async function CardioAnalyticsPage({ searchParams }: PageProps<"/analytics/cardio">) {
  const ctx = await getUserContext();
  const { t, fmt } = ctx;
  const ta = t.analytics;
  const range = parseRange(await searchParams, 90);
  const start = rangeStart(ctx.today, range);
  const [sessions, steps] = await Promise.all([getCardioSessions(ctx.userId, start, ctx.today), getStepDays(ctx.userId, start, ctx.today)]);
  const weeks = weekStarts(start, ctx.today, ctx.weekStartsOn).map((w) => {
    const list = sessions.filter((s) => s.date >= w && s.date <= addDays(w, 6));
    return {
      date: w,
      sessions: list.length,
      minutes: Math.round(list.reduce((a, s) => a + s.durationSeconds / 60, 0)),
      distance: Math.round(toDisplayDistance(list.reduce((a, s) => a + (s.distanceM ?? 0), 0), fmt.units) * 10) / 10,
    };
  });
  const hr = [...sessions].reverse().filter((s) => s.avgHeartRate).map((s) => ({ date: s.date, hr: s.avgHeartRate }));
  const stepMap = new Map(steps.map((s) => [s.date, s.steps]));
  const stepRows = eachDay(start, ctx.today).map((date) => ({ date, steps: stepMap.get(date) ?? null }));
  const byActivity = new Map<string, number>();
  for (const s of sessions) byActivity.set(s.activity, (byActivity.get(s.activity) ?? 0) + s.durationSeconds / 60);
  const activities = [...byActivity.entries()].sort((a, b) => b[1] - a[1]);
  const maxMin = Math.max(1, ...activities.map(([, m]) => m));
  const goal = ctx.prefs.goals.cardioMinutesPerWeek;

  return (
    <div className="space-y-4">
      <RangeLinks base="/analytics/cardio" value={range} label={ta.range} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SimpleChartCard
          title={ta.cardioMinutes}
          kind="minutes"
          weekly
          height={180}
          rows={weeks}
          series={[{ kind: "bar", key: "minutes", label: ta.cardioMinutes, color: "--series-1" }]}
          refLines={goal ? [{ y: goal, label: t.common.goal, color: "--fg-2" }] : []}
        />
        <SimpleChartCard title={ta.cardioSessions} kind="int" weekly height={180} rows={weeks} series={[{ kind: "bar", key: "sessions", label: ta.cardioSessions, color: "--series-2" }]} />
        <SimpleChartCard title={ta.cardioDistance} kind="distance" weekly height={180} rows={weeks} series={[{ kind: "bar", key: "distance", label: ta.cardioDistance, color: "--series-3" }]} />
      </div>
      <SimpleChartCard
        title={ta.stepsChart}
        kind="int"
        rows={stepRows}
        series={[{ kind: "bar", key: "steps", label: t.steps.title, color: "--series-2" }]}
        refLines={ctx.prefs.goals.stepGoal ? [{ y: ctx.prefs.goals.stepGoal, label: t.steps.goal, color: "--fg-2" }] : []}
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SimpleChartCard title={ta.avgHeartRate} kind="bpm" zero={false} rows={hr} series={[{ kind: "line", key: "hr", label: ta.avgHeartRate, color: "--series-8", dots: true }]} />
        <Card>
          <CardHeader title={`${ta.cardioMinutes} · ${t.cardio.activity}`} />
          {activities.length ? (
            <ul className="space-y-2.5">
              {activities.map(([a, m]) => (
                <li key={a}>
                  <div className="mb-1 flex justify-between text-[13px]">
                    <span className="text-fg-2">{t.enums.cardio[a as keyof typeof t.enums.cardio]}</span>
                    <span className="font-semibold tabular">
                      {fmt.int(m)} {t.common.minutesShort}
                    </span>
                  </div>
                  <Meter value={m} max={maxMin} height={6} color="var(--series-1)" showOverflow={false} label={a} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-fg-3">{ta.noDataRange}</p>
          )}
        </Card>
      </div>
    </div>
  );
}
