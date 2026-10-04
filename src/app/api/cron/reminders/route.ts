import { timingSafeEqual } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { REMINDER_KINDS, type ReminderKind } from "@/lib/domain";
import { timeInTimeZone } from "@/lib/dates";
import { format } from "@/lib/i18n";
import { getContextForUser } from "@/server/context";
import { db } from "@/server/db";
import { notificationDeliveries, pushSubscriptions, userPreferences } from "@/server/db/schema";
import { isPushConfigured, sendPushToUser } from "@/server/push";
import { getDaySummaries } from "@/server/queries/days";
import { getPlannedDay } from "@/server/queries/training";

export const dynamic = "force-dynamic";

/** Minutes after the reminder time during which it may still fire (covers hourly/15-min cron schedules). */
const WINDOW_MIN = 60;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(got);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

async function handle(req: Request) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: "CRON_SECRET not set" }, { status: 503 });
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isPushConfigured()) return NextResponse.json({ sent: 0, reason: "push_not_configured" });

  // Users with reminders enabled and at least one push device.
  const candidates = await db
    .selectDistinct({ userId: userPreferences.userId })
    .from(userPreferences)
    .innerJoin(pushSubscriptions, eq(pushSubscriptions.userId, userPreferences.userId))
    .where(sql`(${userPreferences.notifications} ->> 'enabled')::boolean is true`);

  let sent = 0;
  for (const { userId } of candidates) {
    const ctx = await getContextForUser(userId);
    if (!ctx || !ctx.prefs.notifications.enabled) continue;
    const nowMin = minutes(timeInTimeZone(ctx.timezone));
    const due = REMINDER_KINDS.filter((k) => {
      const r = ctx.prefs.notifications.reminders[k];
      const diff = nowMin - minutes(r.time);
      return r.enabled && diff >= 0 && diff < WINDOW_MIN;
    });
    if (!due.length) continue;
    const [day] = await getDaySummaries(ctx, ctx.today, ctx.today);
    const planned = due.includes("workout") ? await getPlannedDay(ctx.userId, ctx.today) : null;
    const needed: Record<ReminderKind, boolean> = {
      weight: day.weightKg == null,
      nutrition: day.nutrition.entries === 0,
      workout: !!planned?.day && day.workoutsCompleted === 0,
      water: day.waterGoalMl > 0 && day.waterMl < day.waterGoalMl,
      steps: day.stepGoal > 0 && (day.steps ?? 0) < day.stepGoal,
      supplements: day.supplementsDue > day.supplementsTaken,
      sleep: true,
    };
    for (const kind of due) {
      if (!needed[kind]) continue;
      // Claim the (user, kind, date) slot first so concurrent runs never double-send.
      const claimed = await db.insert(notificationDeliveries).values({ userId, kind, date: ctx.today }).onConflictDoNothing().returning({ id: notificationDeliveries.id });
      if (!claimed.length) continue;
      const body = format(ctx.t.notifications.reminderBody[kind], { remaining: ctx.fmt.int(Math.max(0, day.stepGoal - (day.steps ?? 0))) }, ctx.locale);
      const url = { weight: "/progress", nutrition: "/nutrition", workout: "/training", water: "/habits/water", steps: "/cardio", supplements: "/habits/supplements", sleep: "/habits/sleep" }[kind];
      const n = await sendPushToUser(userId, { title: ctx.t.enums.reminder[kind], body, url, tag: `reminder-${kind}` });
      if (!n) await db.delete(notificationDeliveries).where(and(eq(notificationDeliveries.userId, userId), eq(notificationDeliveries.kind, kind), eq(notificationDeliveries.date, ctx.today)));
      sent += n;
    }
  }
  return NextResponse.json({ sent, users: candidates.length });
}

export const GET = handle;
export const POST = handle;
