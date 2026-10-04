import "server-only";
import { and, eq } from "drizzle-orm";
import { goalProgress, scheduleStatus } from "@/lib/calc/goal";
import { dailyScore, weeklyScore } from "@/lib/calc/score";
import { addDays, startOfWeek } from "@/lib/dates";
import { resolveDashboardOrder } from "@/lib/preferences";
import type { UserContext } from "@/server/context";
import { db } from "@/server/db";
import { cardioSessions } from "@/server/db/schema";
import { getAnalysis } from "./analysis";
import { getHabitStatuses } from "./habits";
import { getActiveWorkout, getPlannedDay, getWorkoutAggregates } from "./training";

export async function getDashboardData(ctx: UserContext) {
  const analysis = await getAnalysis(ctx);
  const { days, energy, goal, forecast } = analysis;
  const today = days.find((d) => d.date === ctx.today)!;
  const weekStart = startOfWeek(ctx.today, ctx.weekStartsOn);

  const [habits, planned, activeWorkout, todaysWorkouts, todaysCardio] = await Promise.all([
    getHabitStatuses(ctx, days.slice(-56)),
    getPlannedDay(ctx.userId, ctx.today),
    getActiveWorkout(ctx.userId),
    getWorkoutAggregates(ctx.userId, ctx.today, ctx.today, ctx.prefs.training.includeWarmupsInVolume),
    db
      .select()
      .from(cardioSessions)
      .where(and(eq(cardioSessions.userId, ctx.userId), eq(cardioSessions.date, ctx.today))),
  ]);

  const stats = energy.stats;
  const goalInfo = goal
    ? (() => {
        const current = stats.current ?? goal.startWeightKg;
        return {
          goal,
          progress: goalProgress(goal, current),
          status: scheduleStatus(goal, ctx.today, stats.current),
          eta: forecast?.goalEta ?? null,
          current,
        };
      })()
    : null;

  const score = dailyScore(today, ctx.prefs.scoring.weights);
  const weekDays = days.filter((d) => d.date >= weekStart && d.date <= ctx.today);
  const weekScore = weeklyScore(weekDays.map((d) => dailyScore(d, ctx.prefs.scoring.weights).score));
  const last7 = days.filter((d) => d.date > addDays(ctx.today, -7));
  const weekCardioMinutes = weekDays.reduce((a, d) => a + d.cardioMinutes, 0);
  const weightSeries30 = analysis.weights.filter((w) => w.date > addDays(ctx.today, -30));

  return {
    today,
    stats,
    goalInfo,
    score,
    weekScore,
    habits: habits.filter((h) => h.scheduledToday),
    planned,
    activeWorkout,
    todaysWorkouts,
    todaysCardio,
    weekCardioMinutes,
    last7,
    weightSeries30,
    insights: analysis.insights.slice(0, 3),
    order: resolveDashboardOrder(ctx.prefs.dashboard),
    hidden: ctx.prefs.dashboard.hidden,
    scoreEnabled: ctx.prefs.scoring.enabled,
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
