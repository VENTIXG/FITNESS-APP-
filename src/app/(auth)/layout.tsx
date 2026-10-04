import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { GuestLocaleSwitch } from "@/components/auth/guest-locale-switch";
import { getSessionUser } from "@/server/auth";
import { getT } from "@/server/context";

export default async function AuthLayout({ children }: LayoutProps<"/">) {
  let signedIn = false;
  try {
    signedIn = !!(await getSessionUser());
  } catch {
    // Database unavailable — the page shows the setup message.
  }
  if (signedIn) redirect("/");
  const t = await getT();

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-10">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-60 dark:opacity-100"
        style={{ background: "radial-gradient(60% 60% at 50% 0%, var(--accent-soft), transparent 70%)" }}
        aria-hidden
      />
      <div className="relative w-full max-w-[400px]">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        {children}
        <p className="mx-auto mt-6 max-w-[340px] text-center text-xs leading-relaxed text-fg-3">{t.auth.privacyNote}</p>
        <div className="mt-6 flex justify-center">
          <GuestLocaleSwitch />
        </div>
      </div>
    </div>
  );
}
