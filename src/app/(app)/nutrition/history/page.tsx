import type { Metadata } from "next";
import { NutritionHistory } from "@/components/nutrition/history";
import { addDays } from "@/lib/dates";
import { getT, getUserContext } from "@/server/context";
import { getNutritionHistory } from "@/server/queries/nutrition";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).nutrition.history.title };
}

export default async function NutritionHistoryPage() {
  const ctx = await getUserContext();
  const rows = await getNutritionHistory(ctx.userId, addDays(ctx.today, -364), ctx.today);
  return (
    <NutritionHistory
      days={rows.map((r) => ({
        date: r.date,
        calories: r.calories,
        proteinG: r.proteinG,
        carbsG: r.carbsG,
        fatG: r.fatG,
        fiberG: r.fiberG,
        entries: r.entries,
        target: r.target ? { calories: r.target.calories, proteinG: r.target.proteinG } : null,
      }))}
    />
  );
}
