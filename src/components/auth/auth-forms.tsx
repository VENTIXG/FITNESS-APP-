"use client";

import Link from "next/link";
import { useActionState, useSyncExternalStore } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useLocale, useT } from "@/components/providers/i18n-provider";
import { noopSubscribe } from "@/lib/utils";
import { signIn, signUp, type AuthFormState } from "@/server/actions/auth";

function authErrorMessage(t: ReturnType<typeof useT>, code: NonNullable<AuthFormState>["error"]) {
  if (!code) return undefined;
  return code === "generic" ? t.errors.generic : t.auth[code];
}

function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-critical/25 bg-critical/8 px-3.5 py-3 text-sm text-critical-text">
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}

export function LoginForm({ next, signupOpen }: { next?: string; signupOpen: boolean }) {
  const t = useT();
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signIn, null);
  return (
    <div className="rounded-3xl border border-border bg-surface p-6 shadow-pop sm:p-7">
      <h1 className="text-[22px] font-semibold tracking-tight">{t.auth.signInTitle}</h1>
      <p className="mt-1 text-sm text-fg-3">{t.auth.signInSubtitle}</p>
      <form action={action} className="mt-6 flex flex-col gap-4">
        <input type="hidden" name="next" value={next ?? "/"} />
        <FormError message={authErrorMessage(t, state?.error)} />
        <Field label={t.auth.email} htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="username" required defaultValue={state?.email} autoFocus inputMode="email" />
        </Field>
        <Field label={t.auth.password} htmlFor="password">
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </Field>
        <Button type="submit" variant="primary" size="lg" block loading={pending} className="mt-1">
          {pending ? t.auth.signingIn : t.auth.signIn}
        </Button>
      </form>
      {signupOpen && (
        <p className="mt-5 text-center text-sm text-fg-3">
          {t.auth.noAccount}{" "}
          <Link href="/signup" className="font-medium text-fg underline-offset-4 hover:underline">
            {t.auth.createAccount}
          </Link>
        </p>
      )}
    </div>
  );
}

export function SignupForm() {
  const t = useT();
  const locale = useLocale();
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signUp, null);
  const timezone = useSyncExternalStore(
    noopSubscribe,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    () => "UTC",
  );
  return (
    <div className="rounded-3xl border border-border bg-surface p-6 shadow-pop sm:p-7">
      <h1 className="text-[22px] font-semibold tracking-tight">{t.auth.signUpTitle}</h1>
      <p className="mt-1 text-sm text-fg-3">{t.auth.signUpSubtitle}</p>
      <form action={action} className="mt-6 flex flex-col gap-4">
        <input type="hidden" name="timezone" value={timezone} />
        <input type="hidden" name="locale" value={locale} />
        <FormError message={authErrorMessage(t, state?.error)} />
        <Field label={t.auth.name} htmlFor="name" optional={t.common.optional}>
          <Input id="name" name="name" autoComplete="given-name" maxLength={80} />
        </Field>
        <Field label={t.auth.email} htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="username" required defaultValue={state?.email} inputMode="email" />
        </Field>
        <Field label={t.auth.password} htmlFor="password" hint={t.auth.passwordTooShort}>
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
        </Field>
        <Field label={t.auth.confirmPassword} htmlFor="confirm">
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required />
        </Field>
        <Button type="submit" variant="primary" size="lg" block loading={pending} className="mt-1">
          {pending ? t.auth.signingUp : t.auth.signUp}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-fg-3">
        {t.auth.haveAccount}{" "}
        <Link href="/login" className="font-medium text-fg underline-offset-4 hover:underline">
          {t.auth.signIn}
        </Link>
      </p>
    </div>
  );
}
