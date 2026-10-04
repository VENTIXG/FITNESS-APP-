import "server-only";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { evaluateAutoHabit, isScheduledOn, type DaySummary } from "@/lib/calc/day";
import { addDays, dateOfInstant, type ISODate } from "@/lib/dates";
import type { UserContext } from "@/server/context";
import { db } from "@/server/db";
import { habitLogs, habits, supplementLogs, supplements } from "@/server/db/schema";

export type HabitStatus = {
  id: string;
  name: string;
  type: "manual" | "auto";
  autoMetric: string | null;
  icon: string | null;
  schedule: "daily" | "specific_days";
  daysOfWeek: number[];
  sortOrder: number;
  isActive: boolean;
  scheduledToday: boolean;
  /** null = not applicable today (e.g. no supplements due) */
  doneToday: boolean | null;
  streak: number;
  /** Completion over the window: done / scheduled-and-applicable */
  completionRate: number | null;
  history: { date: ISODate; done: boolean | null; scheduled: boolean }[];
};

export async function getHabitStatuses(ctx: UserContext, days: readonly DaySummary[], includeInactive = false): Promise<HabitStatus[]> {
  const start = days[0]?.date ?? ctx.today;
  const [list, logs] = await Promise.all([
    db.select().from(habits).where(eq(habits.userId, ctx.userId)).orderBy(asc(habits.sortOrder), asc(habits.createdAt)),
    db
      .select({ habitId: habitLogs.habitId, date: habitLogs.date })
      .from(habitLogs)
      .where(and(eq(habitLogs.userId, ctx.userId), gte(habitLogs.date, start), lte(habitLogs.date, ctx.today))),
  ]);
  const manualDone = new Set(logs.map((l) => `${l.habitId}|${l.date}`));
  const dayMap = new Map(days.map((d) => [d.date, d]));

  return list
    .filter((h) => includeInactive || h.isActive)
    .map((h) => {
      const since = dateOfInstant(h.createdAt, ctx.timezone);
      const history = days.map((d) => {
        const scheduled = isScheduledOn(h.schedule, h.daysOfWeek, d.date) && d.date >= since;
        let done: boolean | null;
        if (h.type === "auto" && h.autoMetric) done = evaluateAutoHabit(h.autoMetric, d);
        else done = manualDone.has(`${h.id}|${d.date}`);
        return { date: d.date, done, scheduled };
      });
      // Streak: consecutive scheduled & applicable days completed, back from today
      // (an unfinished today doesn't break it).
      let streak = 0;
      for (let i = history.length - 1; i >= 0; i--) {
        const e = history[i];
        if (!e.scheduled || e.done == null) continue;
        if (e.done) streak++;
        else if (e.date === ctx.today) continue;
        else break;
      }
      const applicable = history.filter((e) => e.scheduled && e.done != null && e.date < ctx.today);
      const today = dayMap.get(ctx.today);
      const todayEntry = history.find((e) => e.date === ctx.today);
      return {
        id: h.id,
        name: h.name,
        type: h.type,
        autoMetric: h.autoMetric,
        icon: h.icon,
        schedule: h.schedule,
        daysOfWeek: h.daysOfWeek,
        sortOrder: h.sortOrder,
        isActive: h.isActive,
        scheduledToday: !!todayEntry?.scheduled || (!!today && isScheduledOn(h.schedule, h.daysOfWeek, ctx.today)),
        doneToday: todayEntry?.done ?? null,
        streak,
        completionRate: applicable.length ? applicable.filter((e) => e.done).length / applicable.length : null,
        history,
      };
    });
}

export async function getSupplementsForDate(ctx: UserContext, date: ISODate) {
  const [list, logs] = await Promise.all([
    db.select().from(supplements).where(eq(supplements.userId, ctx.userId)).orderBy(asc(supplements.sortOrder), asc(supplements.createdAt)),
    db
      .select({ supplementId: supplementLogs.supplementId })
      .from(supplementLogs)
      .where(and(eq(supplementLogs.userId, ctx.userId), eq(supplementLogs.date, date))),
  ]);
  const taken = new Set(logs.map((l) => l.supplementId));
  const wd = new Date(`${date}T00:00:00Z`).getUTCDay();
  return list.map((s) => ({
    ...s,
    taken: taken.has(s.id),
    dueToday: s.isActive && (s.schedule === "daily" || (s.schedule === "specific_days" && s.daysOfWeek.includes(wd))),
  }));
}

export function streakWindowStart(today: ISODate) {
  return addDays(today, -89);
}
