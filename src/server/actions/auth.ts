"use server";

import { count, eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { LOCALE_COOKIE } from "@/lib/config";
import { isValidTimeZone } from "@/lib/dates";
import { LOCALES } from "@/lib/domain";
import { getDummyHash, hashPassword, verifyPassword } from "@/server/auth/crypto";
import { clientIp, identifiersFor, isRateLimited, recordAttempt } from "@/server/auth/rate-limit";
import { createSession, destroyCurrentSession, destroyOtherSessions, getSessionUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { profiles, userPreferences, users } from "@/server/db/schema";
import { ActionError, createAction } from "./_lib";

export type AuthFormState = {
  error?: "invalidCredentials" | "tooManyAttempts" | "signupClosed" | "emailTaken" | "passwordTooShort" | "passwordsDontMatch" | "invalidEmail" | "generic";
  email?: string;
} | null;

/** Only allow same-site relative redirects after sign-in. */
function safeNext(next: unknown): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}

export async function isSignupOpen(): Promise<boolean> {
  if (process.env.ALLOW_SIGNUP === "true") return true;
  const [{ n }] = await db.select({ n: count() }).from(users).where(eq(users.isDemoAccount, false));
  return n === 0;
}

const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  password: z.string().min(1).max(500),
});

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = signInSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  const emailRaw = String(formData.get("email") ?? "");
  if (!parsed.success) return { error: "invalidCredentials", email: emailRaw };
  const { email, password } = parsed.data;

  const ids = identifiersFor(email, await clientIp());
  if (await isRateLimited(ids)) return { error: "tooManyAttempts", email };

  const user = (await db.select().from(users).where(eq(sql`lower(${users.email})`, email)).limit(1))[0];
  // Verify against a dummy hash when the account doesn't exist so timing doesn't reveal it.
  const valid = user ? await verifyPassword(password, user.passwordHash) : (await verifyPassword(password, await getDummyHash()), false);
  await recordAttempt(ids, valid);
  if (!user || !valid) return { error: "invalidCredentials", email };

  await createSession(user.id);
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  redirect(safeNext(formData.get("next")));
}

const signUpSchema = z
  .object({
    name: z.string().trim().max(80).optional(),
    email: z.string().trim().toLowerCase().email().max(320),
    password: z.string().min(10).max(500),
    confirm: z.string(),
    timezone: z.string().max(80).optional(),
    locale: z.enum(LOCALES).optional(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "mismatch" });

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = Object.fromEntries(formData.entries());
  const email = String(raw.email ?? "");
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue.path[0] === "email") return { error: "invalidEmail", email };
    if (issue.path[0] === "password") return { error: "passwordTooShort", email };
    if (issue.path[0] === "confirm") return { error: "passwordsDontMatch", email };
    return { error: "generic", email };
  }
  const data = parsed.data;
  const timezone = data.timezone && isValidTimeZone(data.timezone) ? data.timezone : "UTC";
  const locale = data.locale ?? "en";
  const passwordHash = await hashPassword(data.password);

  let userId: string;
  try {
    userId = await db.transaction(async (tx) => {
      // Serialise sign-ups so two simultaneous requests can't both claim the owner slot.
      await tx.execute(sql`select pg_advisory_xact_lock(724001)`);
      if (process.env.ALLOW_SIGNUP !== "true") {
        const [{ n }] = await tx.select({ n: count() }).from(users).where(eq(users.isDemoAccount, false));
        if (n > 0) throw new ActionError("signupClosed");
      }
      const [user] = await tx.insert(users).values({ email: data.email, passwordHash }).returning({ id: users.id });
      await tx.insert(profiles).values({ userId: user.id, displayName: data.name || null, timezone, locale });
      await tx.insert(userPreferences).values({ userId: user.id });
      return user.id;
    });
  } catch (err) {
    if (err instanceof ActionError && err.code === "signupClosed") return { error: "signupClosed", email };
    const code = (err as { code?: string; cause?: { code?: string } }).code ?? (err as { cause?: { code?: string } }).cause?.code;
    if (code === "23505") return { error: "emailTaken", email };
    console.error("[signUp]", err);
    return { error: "generic", email };
  }

  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  await createSession(userId);
  redirect("/onboarding");
}

export async function signOut() {
  await destroyCurrentSession();
  redirect("/login");
}

export const changePassword = createAction(
  z.object({ current: z.string().min(1), next: z.string().min(10).max(500) }),
  async (input, ctx) => {
    const user = (await db.select().from(users).where(eq(users.id, ctx.userId)).limit(1))[0];
    if (!user || !(await verifyPassword(input.current, user.passwordHash))) throw new ActionError("wrongPassword");
    await db.update(users).set({ passwordHash: await hashPassword(input.next) }).where(eq(users.id, ctx.userId));
    const session = await getSessionUser();
    if (session) await destroyOtherSessions(ctx.userId, session.sessionId);
    return null;
  },
  { revalidate: false },
);

export const signOutEverywhere = createAction(
  z.object({}),
  async (_input, ctx) => {
    const session = await getSessionUser();
    if (session) await destroyOtherSessions(ctx.userId, session.sessionId);
    return null;
  },
  { revalidate: false },
);

/** Remembers the language choice on signed-out pages. */
export async function setGuestLocale(locale: string) {
  if (!(LOCALES as readonly string[]).includes(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
}
