import type { Metadata } from "next";
import { and, eq, gte } from "drizzle-orm";
import { SupplementsView } from "@/components/habits/lifestyle-views";
import { addDays, eachDay, weekday } from "@/lib/dates";
import { getT, getUserContext } from "@/server/context";
import { db } from "@/server/db";
import { supplementLogs } from "@/server/db/schema";
import { getSupplementsForDate } from "@/server/queries/habits";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).supplements.title };
}

export default async function SupplementsPage() {
  const ctx = await getUserContext();
  const start = addDays(ctx.today, -29);
  const [items, logs] = await Promise.all([
    getSupplementsForDate(ctx, ctx.today),
    db.select({ supplementId: supplementLogs.supplementId, date: supplementLogs.date }).from(supplementLogs).where(and(eq(supplementLogs.userId, ctx.userId), gte(supplementLogs.date, start))),
  ]);
  const taken = new Set(logs.map((l) => `${l.supplementId}|${l.date}`));
  const days = eachDay(start, addDays(ctx.today, -1));
  return (
    <SupplementsView
      items={items.map((s) => {
        const created = s.createdAt.toISOString().slice(0, 10);
        const due = s.schedule === "as_needed" ? [] : days.filter((d) => d >= created && (s.schedule === "daily" || s.daysOfWeek.includes(weekday(d))));
        return {
          id: s.id,
          name: s.name,
          dose: s.dose,
          doseUnit: s.doseUnit,
          schedule: s.schedule,
          daysOfWeek: s.daysOfWeek,
          timing: s.timing,
          notes: s.notes,
          isActive: s.isActive,
          taken: s.taken,
          dueToday: s.dueToday,
          adherence: due.length ? due.filter((d) => taken.has(`${s.id}|${d}`)).length / due.length : null,
        };
      })}
    />
  );
}
