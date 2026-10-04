import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { RecipeEditor } from "@/components/nutrition/composite-editors";
import { getT, getUserContext } from "@/server/context";
import { getPickerData, getPickerFoodsByIds, getRecipe } from "@/server/queries/nutrition";

const UUID = /^[0-9a-f-]{36}$/i;

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).nutrition.recipes.edit };
}

export default async function RecipePage({ params }: PageProps<"/nutrition/recipes/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const ctx = await getUserContext();
  const [r, data] = await Promise.all([getRecipe(ctx.userId, id), getPickerData(ctx.userId)]);
  if (!r) notFound();
  const known = new Set(data.foods.map((f) => f.id));
  const extra = await getPickerFoodsByIds(ctx.userId, r.items.map((i) => i.foodId).filter((x) => !known.has(x)));
  return (
    <div className="space-y-4">
      <Link href="/nutrition/recipes" className="-ml-1.5 inline-flex items-center gap-0.5 text-sm font-medium text-fg-3 hover:text-fg">
        <ChevronLeft className="size-5" aria-hidden />
        {ctx.t.nutrition.recipes.title}
      </Link>
      <RecipeEditor
        data={data}
        extraFoods={extra}
        initial={{
          id: r.recipe.id,
          name: r.recipe.name,
          servings: r.recipe.servings,
          totalWeightG: r.recipe.totalWeightG,
          instructions: r.recipe.instructions,
          isFavorite: r.recipe.isFavorite,
          items: r.items.map((i) => ({ foodId: i.foodId, quantity: i.quantity, unit: i.unit })),
        }}
      />
    </div>
  );
}
