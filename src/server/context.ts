import "server-only";
import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { LOCALE_COOKIE } from "@/lib/config";
import { todayInTimeZone, type ISODate } from "@/lib/dates";
import { LOCALES, type Locale } from "@/lib/domain";
import { createFormatter, type Formatter } from "@/lib/format";
import { getDictionary, type Dictionary } from "@/lib/i18n";
import {
  parseDashboardPrefs,
  parseGoalsPrefs,
  parseNotificationPrefs,
  parseNutritionPrefs,
  parseScoringPrefs,
  parseTrainingPrefs,
  type DashboardPrefs,
  type GoalsPrefs,
  type NotificationPrefs,
  type NutritionPrefs,
  type ScoringPrefs,
  type TrainingPrefs,
} from "@/lib/preferences";
import { getSessionUser, requireOnboardedUser, requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { profiles, userPreferences, users, type Profile } from "@/server/db/schema";

export type Prefs = {
  goals: GoalsPrefs;
  training: TrainingPrefs;
  nutrition: NutritionPrefs;
  dashboard: DashboardPrefs;
  scoring: ScoringPrefs;
  notifications: NotificationPrefs;
};

export const loadPrefs = cache(async (userId: string): Promise<Prefs> => {
  const row = (await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1))[0];
  return {
    goals: parseGoalsPrefs(row?.goals),
    training: parseTrainingPrefs(row?.training),
    nutrition: parseNutritionPrefs(row?.nutrition),
    dashboard: parseDashboardPrefs(row?.dashboard),
    scoring: parseScoringPrefs(row?.scoring),
    notifications: parseNotificationPrefs(row?.notifications),
  };
});

export type UserContext = {
  userId: string;
  email: string;
  isDemoAccount: boolean;
  profile: Profile;
  prefs: Prefs;
  locale: Locale;
  timezone: string;
  today: ISODate;
  weekStartsOn: number;
  t: Dictionary;
  fmt: Formatter;
};

async function buildContext(user: Awaited<ReturnType<typeof requireUser>>): Promise<UserContext> {
  const prefs = await loadPrefs(user.id);
  const locale = user.profile.locale;
  return {
    userId: user.id,
    email: user.email,
    isDemoAccount: user.isDemoAccount,
    profile: user.profile,
    prefs,
    locale,
    timezone: user.profile.timezone,
    today: todayInTimeZone(user.profile.timezone),
    weekStartsOn: user.profile.weekStartsOn,
    t: getDictionary(locale),
    fmt: createFormatter(locale, user.profile.unitSystem),
  };
}

/** Context for app pages (requires sign-in and completed onboarding). */
export const getUserContext = cache(async (): Promise<UserContext> => buildContext(await requireOnboardedUser()));

/** Context for onboarding (signed in, onboarding may be incomplete). */
export const getOnboardingContext = cache(async (): Promise<UserContext> => buildContext(await requireUser()));

/** Locale for any page, including signed-out ones. */
export const getLocale = cache(async (): Promise<Locale> => {
  try {
    const user = await getSessionUser();
    if (user?.profile?.locale) return user.profile.locale;
  } catch {
    // Database unavailable — fall through to cookie / header detection.
  }
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (fromCookie && (LOCALES as readonly string[]).includes(fromCookie)) return fromCookie as Locale;
  const accept = (await headers()).get("accept-language")?.toLowerCase() ?? "";
  return accept.startsWith("el") ? "el" : "en";
});

export async function getT() {
  return getDictionary(await getLocale());
}

/**
 * Context for background jobs and token-authenticated APIs (no session).
 * Only use after the caller has been authorised for `userId`.
 */
export async function getContextForUser(userId: string): Promise<UserContext | null> {
  const row = (
    await db
      .select({ id: users.id, email: users.email, isDemoAccount: users.isDemoAccount, profile: profiles })
      .from(users)
      .innerJoin(profiles, eq(profiles.userId, users.id))
      .where(eq(users.id, userId))
      .limit(1)
  )[0];
  if (!row) return null;
  return buildContext({ id: row.id, email: row.email, isDemoAccount: row.isDemoAccount, profile: row.profile } as Awaited<ReturnType<typeof requireUser>>);
}
