import type { Metadata } from "next";
import { HeartPulse, Plus } from "lucide-react";
import { CardioSessionList, CardioWeeksChart, StepDayList, StepsChart, StepsTodayCard } from "@/components/cardio/cardio-views";
import { QuickAddButton } from "@/components/dashboard/islands";
import { Card, CardHeader } from "@/components/ui/card";
import { Meter, Stat } from "@/components/ui/data-display";
import { PageHeader } from "@/components/ui/page";
import { addDays, startOfWeek } from "@/lib/dates";
import { format } from "@/lib/i18n";
import { mean } from "@/lib/utils";
import { getT, getUserContext } from "@/server/context";
import { getCardioSessions, getStepDays } from "@/server/queries/cardio";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).cardio.title };
}

export default async function CardioPage() {
  const ctx = await getUserContext();
  const { t, fmt, locale } = ctx;
  const tc = t.cardio;
  const weekStart = startOfWeek(ctx.today, ctx.weekStartsOn);
  const firstWeek = addDays(weekStart, -7 * 11);
  const [sessions, stepDays] = await Promise.all([getCardioSessions(ctx.userId, addDays(ctx.today, -365), ctx.today), getStepDays(ctx.userId, addDays(ctx.today, -365), ctx.today)]);
  const goalMin = ctx.prefs.goals.cardioMinutesPerWeek;
  const thisWeek = sessions.filter((s) => s.date >= weekStart);
  const weekMinutes = thisWeek.reduce((a, s) => a + s.durationSeconds / 60, 0);
  const weekDistance = thisWeek.reduce((a, s) => a + (s.distanceM ?? 0), 0);
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const date = addDays(firstWeek, i * 7);
    const end = addDays(date, 6);
    return { date, minutes: Math.round(sessions.filter((s) => s.date >= date && s.date <= end).reduce((a, s) => a + s.durationSeconds / 60, 0)) };
  });
  const todaySteps = stepDays.find((d) => d.date === ctx.today) ?? null;
  const last7 = stepDays.filter((d) => d.date < ctx.today && d.date >= addDays(ctx.today, -7));
  const avg7 = last7.length ? mean(last7.map((d) => d.steps)) : null;

  return (
    <>
      <PageHeader
        title={tc.title}
        actions={
          <QuickAddButton kind="cardio" variant="primary">
            <Plus aria-hidden />
            {tc.log}
          </QuickAddButton>
        }
      />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader title={tc.thisWeek} icon={<HeartPulse />} />
              <div className="text-[34px] leading-none font-semibold tracking-tight tabular">
                {fmt.int(weekMinutes)}
                <span className="ml-1 text-base font-normal text-fg-3">{t.common.minutesShort}</span>
              </div>
              {goalMin > 0 && (
                <>
                  <p className="mt-1 text-[13px] text-fg-3">{format(tc.minutesGoal, { minutes: fmt.int(weekMinutes), goal: fmt.int(goalMin) }, locale)}</p>
                  <Meter className="mt-3" value={weekMinutes} max={goalMin} color="var(--series-1)" showOverflow={false} label={tc.thisWeek} />
                </>
              )}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Stat label={tc.sessions} value={fmt.int(thisWeek.length)} />
                <Stat label={tc.totalDistance} value={weekDistance ? fmt.distance(weekDistance) : "—"} />
              </div>
            </Card>
            <StepsTodayCard today={todaySteps} avg7={avg7} goal={ctx.prefs.goals.stepGoal} />
          </div>
          <StepsChart days={stepDays} goal={ctx.prefs.goals.stepGoal} />
          <CardioWeeksChart weeks={weeks} goal={goalMin} />
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader title={tc.recent} />
            <CardioSessionList
              sessions={sessions.map((s) => ({
                id: s.id,
                date: s.date,
                activity: s.activity,
                durationSeconds: s.durationSeconds,
                distanceM: s.distanceM,
                avgHeartRate: s.avgHeartRate,
                maxHeartRate: s.maxHeartRate,
                calories: s.calories,
                inclinePct: s.inclinePct,
                speedKmh: s.speedKmh,
                notes: s.notes,
                source: s.source,
              }))}
            />
          </Card>
          <Card>
            <CardHeader title={t.steps.title} subtitle={t.steps.manualHint} />
            <StepDayList days={stepDays} />
          </Card>
        </div>
      </div>
    </>
  );
}
