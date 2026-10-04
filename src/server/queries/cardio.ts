import "server-only";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import type { ISODate } from "@/lib/dates";
import { db } from "@/server/db";
import { cardioSessions, stepEntries } from "@/server/db/schema";

export async function getCardioSessions(userId: string, start: ISODate, end: ISODate) {
  return db
    .select()
    .from(cardioSessions)
    .where(and(eq(cardioSessions.userId, userId), gte(cardioSessions.date, start), lte(cardioSessions.date, end)))
    .orderBy(desc(cardioSessions.date), desc(cardioSessions.startedAt), desc(cardioSessions.createdAt));
}

/** Step entries by day with manual and imported values kept separate. Imported values win for totals. */
export async function getStepDays(userId: string, start: ISODate, end: ISODate) {
  const rows = await db
    .select({ id: stepEntries.id, date: stepEntries.date, steps: stepEntries.steps, source: stepEntries.source })
    .from(stepEntries)
    .where(and(eq(stepEntries.userId, userId), gte(stepEntries.date, start), lte(stepEntries.date, end)))
    .orderBy(desc(stepEntries.date));
  const byDate = new Map<string, { date: string; manual: { id: string; steps: number } | null; imported: { id: string; steps: number; source: string } | null }>();
  for (const r of rows) {
    const d = byDate.get(r.date) ?? { date: r.date, manual: null, imported: null };
    if (r.source === "manual") d.manual = { id: r.id, steps: r.steps };
    else if (!d.imported || r.steps > d.imported.steps) d.imported = { id: r.id, steps: r.steps, source: r.source };
    byDate.set(r.date, d);
  }
  return [...byDate.values()].map((d) => ({ ...d, steps: d.imported?.steps ?? d.manual?.steps ?? 0 }));
}
