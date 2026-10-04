import { and, eq, isNull, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { CARDIO_ACTIVITIES, HEALTH_METRICS } from "@/lib/domain";
import { minutesBetweenClockTimes } from "@/lib/dates";
import { isoDate } from "@/lib/validation";
import { sha256 } from "@/server/auth/crypto";
import { getContextForUser } from "@/server/context";
import { db } from "@/server/db";
import { apiTokens, cardioSessions, healthMetrics, sleepEntries, stepEntries, weightEntries } from "@/server/db/schema";

export const dynamic = "force-dynamic";

const MAX_BYTES = 512 * 1024;
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/);

const payloadSchema = z.object({
  source: z.enum(["apple_health", "health_connect", "api", "import"]).default("api"),
  weights: z.array(z.object({ date: isoDate, weightKg: z.number().min(20).max(400) })).max(500).default([]),
  steps: z.array(z.object({ date: isoDate, steps: z.number().int().min(0).max(200000) })).max(500).default([]),
  sleep: z
    .array(
      z
        .object({ date: isoDate, bedTime: clock.optional(), wakeTime: clock.optional(), durationMinutes: z.number().int().min(0).max(1440).optional() })
        .refine((s) => s.durationMinutes != null || (s.bedTime && s.wakeTime), "duration_or_times"),
    )
    .max(500)
    .default([]),
  cardio: z
    .array(
      z.object({
        date: isoDate,
        activity: z.enum(CARDIO_ACTIVITIES),
        durationSeconds: z.number().int().min(1).max(86400),
        distanceM: z.number().min(0).max(1_000_000).optional(),
        avgHeartRate: z.number().int().min(20).max(250).optional(),
        maxHeartRate: z.number().int().min(20).max(250).optional(),
        calories: z.number().int().min(0).max(20000).optional(),
        externalId: z.string().min(1).max(120),
      }),
    )
    .max(500)
    .default([]),
  metrics: z.array(z.object({ date: isoDate, metric: z.enum(HEALTH_METRICS), value: z.number().min(0).max(100000) })).max(1000).default([]),
});

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "WWW-Authenticate": "Bearer" } });
}

/**
 * Token-authenticated import endpoint for phone automations (iOS Shortcuts,
 * Health Connect bridges, scripts). Imported rows carry their source and never
 * overwrite manual entries.
 */
export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token || !token.startsWith("forge_")) return unauthorized();
  const row = (
    await db
      .select({ id: apiTokens.id, userId: apiTokens.userId, scopes: apiTokens.scopes })
      .from(apiTokens)
      .where(and(eq(apiTokens.tokenHash, sha256(token)), isNull(apiTokens.revokedAt)))
      .limit(1)
  )[0];
  if (!row || !row.scopes.includes("ingest")) return unauthorized();

  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_BYTES) return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  let json: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_BYTES) return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
    json = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "validation", issues: parsed.error.issues.slice(0, 20).map((i) => ({ path: i.path.join("."), message: i.message })) }, { status: 422 });
  const p = parsed.data;
  const ctx = await getContextForUser(row.userId);
  if (!ctx) return unauthorized();
  const userId = row.userId;
  const tooNew = (d: string) => d > ctx.today;
  const result = { inserted: 0, updated: 0, skipped: 0 };

  await db.transaction(async (tx) => {
    for (const w of p.weights) {
      if (tooNew(w.date)) {
        result.skipped++;
        continue;
      }
      const existing = (await tx.select().from(weightEntries).where(and(eq(weightEntries.userId, userId), eq(weightEntries.date, w.date))).limit(1))[0];
      if (!existing) {
        await tx.insert(weightEntries).values({ userId, date: w.date, weightKg: w.weightKg, source: p.source });
        result.inserted++;
      } else if (existing.source === p.source) {
        await tx.update(weightEntries).set({ weightKg: w.weightKg }).where(eq(weightEntries.id, existing.id));
        result.updated++;
      } else result.skipped++; // never overwrite a manual (or other-source) weigh-in
    }
    for (const s of p.steps) {
      if (tooNew(s.date)) {
        result.skipped++;
        continue;
      }
      const r = await tx
        .insert(stepEntries)
        .values({ userId, date: s.date, steps: s.steps, source: p.source })
        .onConflictDoUpdate({ target: [stepEntries.userId, stepEntries.date, stepEntries.source], set: { steps: s.steps, updatedAt: sql`now()` } })
        .returning({ created: sql<boolean>`xmax = 0` });
      if (r[0]?.created) result.inserted++;
      else result.updated++;
    }
    for (const s of p.sleep) {
      if (tooNew(s.date)) {
        result.skipped++;
        continue;
      }
      const duration = s.durationMinutes ?? minutesBetweenClockTimes(s.bedTime!.slice(0, 5), s.wakeTime!.slice(0, 5));
      const values = { bedTime: s.bedTime ?? null, wakeTime: s.wakeTime ?? null, durationMinutes: duration };
      const r = await tx
        .insert(sleepEntries)
        .values({ userId, date: s.date, source: p.source, ...values })
        .onConflictDoUpdate({ target: [sleepEntries.userId, sleepEntries.date, sleepEntries.source], set: { ...values, updatedAt: sql`now()` } })
        .returning({ created: sql<boolean>`xmax = 0` });
      if (r[0]?.created) result.inserted++;
      else result.updated++;
    }
    for (const c of p.cardio) {
      if (tooNew(c.date)) {
        result.skipped++;
        continue;
      }
      const r = await tx
        .insert(cardioSessions)
        .values({ userId, date: c.date, activity: c.activity, durationSeconds: c.durationSeconds, distanceM: c.distanceM ?? null, avgHeartRate: c.avgHeartRate ?? null, maxHeartRate: c.maxHeartRate ?? null, calories: c.calories ?? null, source: p.source, externalId: c.externalId })
        .onConflictDoNothing()
        .returning({ id: cardioSessions.id });
      if (r.length) result.inserted++;
      else result.skipped++;
    }
    for (const m of p.metrics) {
      if (tooNew(m.date)) {
        result.skipped++;
        continue;
      }
      const r = await tx
        .insert(healthMetrics)
        .values({ userId, date: m.date, metric: m.metric, value: m.value, source: p.source })
        .onConflictDoUpdate({ target: [healthMetrics.userId, healthMetrics.date, healthMetrics.metric, healthMetrics.source], set: { value: m.value, updatedAt: sql`now()` } })
        .returning({ created: sql<boolean>`xmax = 0` });
      if (r[0]?.created) result.inserted++;
      else result.updated++;
    }
    await tx.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, row.id));
  });

  return NextResponse.json({ ok: true, ...result });
}
