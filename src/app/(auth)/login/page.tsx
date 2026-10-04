import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/auth-forms";
import { DatabaseUnavailable } from "@/components/shell/database-unavailable";
import { isSignupOpen } from "@/server/actions/auth";
import { getT } from "@/server/context";
import { isDatabaseUnavailable } from "@/server/db/errors";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.auth.signIn };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  let signupOpen = false;
  try {
    signupOpen = await isSignupOpen();
  } catch (err) {
    if (isDatabaseUnavailable(err)) return <DatabaseUnavailable />;
    throw err;
  }
  return <LoginForm next={typeof next === "string" ? next : undefined} signupOpen={signupOpen} />;
}
