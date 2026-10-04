import "server-only";
import { and, eq, gt, lt, ne, sql } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { SESSION_COOKIE } from "@/lib/config";
import { db } from "@/server/db";
import { profiles, sessions, users, type Profile } from "@/server/db/schema";
import { generateToken, sha256 } from "./crypto";

const DAY_MS = 86_400_000;

export function sessionMaxAgeDays() {
  const v = Number(process.env.SESSION_MAX_AGE_DAYS ?? 30);
  return Number.isFinite(v) && v > 0 ? v : 30;
}

/** Cookies are `Secure` unless the deployment is explicitly served over plain HTTP (e.g. a LAN box). */
export function shouldUseSecureCookies() {
  const appUrl = process.env.APP_URL;
  if (appUrl) return appUrl.startsWith("https://");
  return process.env.NODE_ENV === "production";
}

export function sessionCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: shouldUseSecureCookies(),
    sameSite: "lax" as const,
    path: "/",
    expires,
  };
}

export async function createSession(userId: string) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + sessionMaxAgeDays() * DAY_MS);
  const userAgent = (await headers()).get("user-agent")?.slice(0, 300) ?? null;
  await db.insert(sessions).values({ id: sha256(token), userId, expiresAt, userAgent });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
  // Opportunistic cleanup of expired sessions.
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

export type SessionUser = {
  id: string;
  email: string;
  isDemoAccount: boolean;
  sessionId: string;
  profile: Profile | null;
};

/** Resolves the current session (once per request). Extends it when it's more than a day old. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const id = sha256(token);
  const rows = await db
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      lastSeenAt: sessions.lastSeenAt,
      userId: users.id,
      email: users.email,
      isDemoAccount: users.isDemoAccount,
      profile: profiles,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  if (Date.now() - row.lastSeenAt.getTime() > DAY_MS) {
    // Sliding expiry. The cookie itself is refreshed by the proxy on navigation.
    await db
      .update(sessions)
      .set({ lastSeenAt: new Date(), expiresAt: new Date(Date.now() + sessionMaxAgeDays() * DAY_MS) })
      .where(eq(sessions.id, id));
  }

  return { id: row.userId, email: row.email, isDemoAccount: row.isDemoAccount, sessionId: row.sessionId, profile: row.profile };
});

export async function destroyCurrentSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, sha256(token)));
  store.delete(SESSION_COOKIE);
}

export async function destroyOtherSessions(userId: string, keepSessionId: string) {
  await db.delete(sessions).where(and(eq(sessions.userId, userId), ne(sessions.id, keepSessionId)));
}

export async function listSessions(userId: string) {
  return db
    .select({ id: sessions.id, userAgent: sessions.userAgent, createdAt: sessions.createdAt, lastSeenAt: sessions.lastSeenAt })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, sql`now()`)))
    .orderBy(sql`${sessions.lastSeenAt} desc`);
}
