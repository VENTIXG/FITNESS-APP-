import type { Metadata } from "next";
import { RecipeEditor } from "@/components/nutrition/composite-editors";
import { SectionTitle } from "@/components/ui/page";
import { getT, getUserContext } from "@/server/context";
import { getPickerData } from "@/server/queries/nutrition";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).nutrition.recipes.new };
}

export default async function NewRecipePage() {
  const ctx = await getUserContext();
  const data = await getPickerData(ctx.userId);
  return (
    <>
      <SectionTitle>{ctx.t.nutrition.recipes.new}</SectionTitle>
      <RecipeEditor data={data} extraFoods={[]} />
    </>
  );
}
