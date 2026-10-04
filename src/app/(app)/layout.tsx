import { unstable_rethrow } from "next/navigation";
import { PrefsProvider, type ClientPrefs } from "@/components/providers/prefs-provider";
import { AppShell } from "@/components/shell/app-shell";
import { DatabaseUnavailable } from "@/components/shell/database-unavailable";
import { getUserContext, type UserContext } from "@/server/context";
import { isDatabaseUnavailable } from "@/server/db/errors";
import { getActiveWorkout } from "@/server/queries/training";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  let ctx: UserContext;
  try {
    ctx = await getUserContext();
  } catch (err) {
    unstable_rethrow(err);
    if (isDatabaseUnavailable(err)) {
      return (
        <div className="flex min-h-dvh items-center justify-center p-4">
          <DatabaseUnavailable />
        </div>
      );
    }
    throw err;
  }

  const activeWorkout = await getActiveWorkout(ctx.userId);
  const prefs: ClientPrefs = {
    displayName: ctx.profile.displayName,
    unitSystem: ctx.profile.unitSystem,
    timezone: ctx.timezone,
    weekStartsOn: ctx.weekStartsOn,
    today: ctx.today,
    training: ctx.prefs.training,
    mealSlots: ctx.prefs.nutrition.mealSlots,
    stepGoal: ctx.prefs.goals.stepGoal,
    waterGoalMl: ctx.prefs.goals.waterGoalMl,
    sleepGoalMinutes: ctx.prefs.goals.sleepGoalMinutes,
    showSugar: ctx.prefs.nutrition.showSugar,
    showSodium: ctx.prefs.nutrition.showSodium,
  };

  return (
    <PrefsProvider prefs={prefs}>
      <AppShell
        user={{ name: ctx.profile.displayName, email: ctx.email }}
        activeWorkout={activeWorkout ? { id: activeWorkout.id, name: activeWorkout.name, startedAt: activeWorkout.startedAt.toISOString() } : null}
      >
        {children}
      </AppShell>
    </PrefsProvider>
  );
}
