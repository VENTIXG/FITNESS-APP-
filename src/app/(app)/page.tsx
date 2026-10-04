import type { Metadata } from "next";
import { Search } from "lucide-react";
import {
  CaloriesCard,
  CardioCard,
  GoalCard,
  HabitsCard,
  InsightsCard,
  MacrosCard,
  ScoreCard,
  StepsCard,
  WaterCard,
  WeeklyCard,
  WeightCard,
  WorkoutCard,
} from "@/components/dashboard/cards";
import { DashboardGrid } from "@/components/dashboard/dashboard-grid";
import { SearchButton } from "@/components/shell/search-button";
import { PageHeader } from "@/components/ui/page";
import { timeInTimeZone } from "@/lib/dates";
import type { DashboardCard } from "@/lib/domain";
import { getT, getUserContext } from "@/server/context";
import { getDashboardData } from "@/server/queries/dashboard";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).nav.dashboard };
}

export default async function DashboardPage() {
  const ctx = await getUserContext();
  const d = await getDashboardData(ctx);
  const { t, fmt } = ctx;
  const hour = Number(timeInTimeZone(ctx.timezone).slice(0, 2));
  const greeting = hour < 12 ? t.dashboard.greetingMorning : hour < 18 ? t.dashboard.greetingAfternoon : t.dashboard.greetingEvening;
  const name = ctx.profile.displayName;

  const p = { d, ctx };
  const cards: Partial<Record<DashboardCard, React.ReactNode>> = {
    score: d.scoreEnabled ? <ScoreCard {...p} /> : null,
    weight: <WeightCard {...p} />,
    goal: <GoalCard {...p} />,
    calories: <CaloriesCard {...p} />,
    macros: <MacrosCard {...p} />,
    workout: <WorkoutCard {...p} />,
    steps: <StepsCard {...p} />,
    cardio: <CardioCard {...p} />,
    water: <WaterCard {...p} />,
    habits: <HabitsCard {...p} />,
    weekly: <WeeklyCard {...p} />,
    insights: <InsightsCard {...p} />,
  };

  return (
    <>
      <PageHeader
        eyebrow={fmt.date(ctx.today, "weekday")}
        title={name ? `${greeting}, ${name}` : greeting}
        actions={
          <SearchButton>
            <Search aria-hidden />
          </SearchButton>
        }
      />
      <DashboardGrid order={d.order} hidden={d.hidden} cards={cards} />
    </>
  );
}
