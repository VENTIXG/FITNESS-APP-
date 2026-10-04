import type { Metadata } from "next";
import { MealEditor } from "@/components/nutrition/composite-editors";
import { SectionTitle } from "@/components/ui/page";
import { getT, getUserContext } from "@/server/context";
import { getPickerData } from "@/server/queries/nutrition";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).nutrition.meals.new };
}

export default async function NewMealPage() {
  const ctx = await getUserContext();
  const data = await getPickerData(ctx.userId);
  return (
    <>
      <SectionTitle>{ctx.t.nutrition.meals.new}</SectionTitle>
      <MealEditor data={data} extraFoods={[]} />
    </>
  );
}
