import type { Metadata } from "next";
import { Flame } from "lucide-react";
import { HabitsList } from "@/components/habits/habits-view";
import { Card, CardHeader } from "@/components/ui/card";
import { proteinHit } from "@/lib/calc/nutrition";
import { stepsHit } from "@/lib/calc/day";
import { dailyStreak, weeklyStreak, type Streak } from "@/lib/calc/streaks";
import { addDays, startOfWeek } from "@/lib/dates";
import { format } from "@/lib/i18n";
import { getT, getUserContext } from "@/server/context";
import { getDaySummaries } from "@/server/queries/days";
import { getHabitStatuses } from "@/server/queries/habits";
import { getTrainingPlan } from "@/server/queries/training";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).habits.title };
}

export default async function HabitsPage() {
  const ctx = await getUserContext();
  const { t, locale } = ctx;
  const th = t.habits;
  const earliest = addDays(ctx.today, -179);
  const [days, plan] = await Promise.all([getDaySummaries(ctx, earliest, ctx.today), getTrainingPlan(ctx.userId, ctx.prefs.training)]);
  const habits = await getHabitStatuses(ctx, days.slice(-90), true);

  const set = (pred: (d: (typeof days)[number]) => boolean) => new Set(days.filter(pred).map((d) => d.date));
  const weekCounts = new Map<string, number>();
  for (const d of days) {
    const w = startOfWeek(d.date, ctx.weekStartsOn);
    weekCounts.set(w, (weekCounts.get(w) ?? 0) + d.workoutsCompleted);
  }
  const streaks: { label: string; hint?: string; s: Streak; unit: "day" | "week" }[] = [
    { label: th.loggingStreak, s: dailyStreak(set((d) => d.nutrition.entries > 0), ctx.today, earliest), unit: "day" },
    { label: th.stepsStreak, s: dailyStreak(set((d) => stepsHit(d.steps, d.stepGoal)), ctx.today, earliest), unit: "day" },
    { label: th.proteinStreak, s: dailyStreak(set((d) => d.nutrition.entries > 0 && !!d.nutrition.target && proteinHit(d.nutrition.totals.proteinG, d.nutrition.target.proteinG)), ctx.today, earliest), unit: "day" },
    { label: th.workoutStreak, hint: th.workoutStreakHint, s: weeklyStreak(weekCounts, plan.plannedPerWeek, ctx.today, ctx.weekStartsOn, earliest), unit: "week" },
  ];
  const count = (n: number, unit: "day" | "week") => format(unit === "day" ? th.daysStreak : th.weeksStreak, { count: n }, locale);

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <HabitsList habits={habits} />
      </div>
      <Card>
        <CardHeader title={th.streaksTitle} icon={<Flame />} />
        <ul className="divide-y divide-border">
          {streaks.map((x) => (
            <li key={x.label} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">{x.label}</div>
                {x.hint && <div className="text-xs text-fg-3">{x.hint}</div>}
              </div>
              <div className="text-right tabular">
                <div className="text-sm font-semibold">{count(x.s.current, x.unit)}</div>
                <div className="text-xs text-fg-3">
                  {th.bestStreak}: {count(x.s.best, x.unit)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
