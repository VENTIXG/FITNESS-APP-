import "server-only";
import { and, count, eq, gt, inArray, lt } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/server/db";
import { loginAttempts } from "@/server/db/schema";

const WINDOW_MS = 15 * 60_000;
/** Failed attempts allowed per identifier inside the window. */
const LIMITS = { email: 8, ip: 30 } as const;

export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip") || "unknown";
}

export function identifiersFor(email: string, ip: string) {
  return { email: `email:${email.toLowerCase()}`, ip: `ip:${ip}` };
}

/** True when either the account or the client IP has too many recent failures. */
export async function isRateLimited(ids: { email: string; ip: string }): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS);
  const rows = await db
    .select({ identifier: loginAttempts.identifier, n: count() })
    .from(loginAttempts)
    .where(and(inArray(loginAttempts.identifier, [ids.email, ids.ip]), eq(loginAttempts.succeeded, false), gt(loginAttempts.attemptedAt, since)))
    .groupBy(loginAttempts.identifier);
  for (const r of rows) {
    if (r.identifier === ids.email && r.n >= LIMITS.email) return true;
    if (r.identifier === ids.ip && r.n >= LIMITS.ip) return true;
  }
  return false;
}

export async function recordAttempt(ids: { email: string; ip: string }, succeeded: boolean) {
  await db.insert(loginAttempts).values([
    { identifier: ids.email, succeeded },
    { identifier: ids.ip, succeeded },
  ]);
  if (Math.random() < 0.05) {
    await db.delete(loginAttempts).where(lt(loginAttempts.attemptedAt, new Date(Date.now() - 2 * 86_400_000)));
  }
}
