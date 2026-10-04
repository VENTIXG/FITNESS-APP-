import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "@/components/auth/auth-forms";
import { DatabaseUnavailable } from "@/components/shell/database-unavailable";
import { Button } from "@/components/ui/button";
import { isSignupOpen } from "@/server/actions/auth";
import { getT } from "@/server/context";
import { isDatabaseUnavailable } from "@/server/db/errors";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.auth.signUp };
}

export default async function SignupPage() {
  const t = await getT();
  let open = false;
  try {
    open = await isSignupOpen();
  } catch (err) {
    if (isDatabaseUnavailable(err)) return <DatabaseUnavailable />;
    throw err;
  }
  if (!open) {
    return (
      <div className="rounded-3xl border border-border bg-surface p-7 text-center shadow-pop">
        <h1 className="text-lg font-semibold">{t.auth.signupClosed}</h1>
        <Button asChild variant="primary" className="mt-5">
          <Link href="/login">{t.auth.signIn}</Link>
        </Button>
      </div>
    );
  }
  return <SignupForm />;
}
