import "server-only";
import { redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "./session";

export { getSessionUser, type SessionUser };

/** Current user or a redirect to sign-in. Use in pages/layouts. */
export async function requireUser(): Promise<SessionUser & { profile: NonNullable<SessionUser["profile"]> }> {
  const user = await getSessionUser();
  if (!user || !user.profile) redirect("/login");
  return user as SessionUser & { profile: NonNullable<SessionUser["profile"]> };
}

/** Like requireUser, but also sends users who haven't finished onboarding to /onboarding. */
export async function requireOnboardedUser() {
  const user = await requireUser();
  if (!user.profile.onboardingCompletedAt) redirect("/onboarding");
  return user;
}
