import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { getOnboardingContext, getT } from "@/server/context";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).onboarding.title };
}

export default async function OnboardingPage() {
  const ctx = await getOnboardingContext();
  if (ctx.profile.onboardingCompletedAt) redirect("/");
  return (
    <div className="relative min-h-dvh px-4 pt-[calc(env(safe-area-inset-top)+24px)] pb-16">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[380px]"
        style={{ background: "radial-gradient(55% 60% at 50% 0%, var(--accent-soft), transparent 70%)" }}
        aria-hidden
      />
      <div className="relative mx-auto max-w-xl">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <OnboardingWizard
          initial={{
            name: ctx.profile.displayName,
            locale: ctx.locale,
            unitSystem: ctx.profile.unitSystem,
            timezone: ctx.timezone,
            today: ctx.today,
          }}
        />
      </div>
    </div>
  );
}
