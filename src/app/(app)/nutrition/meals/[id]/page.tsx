import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { MealEditor } from "@/components/nutrition/composite-editors";
import { getT, getUserContext } from "@/server/context";
import { getPickerData, getPickerFoodsByIds, getSavedMeal } from "@/server/queries/nutrition";

const UUID = /^[0-9a-f-]{36}$/i;

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).nutrition.meals.edit };
}

export default async function MealPage({ params }: PageProps<"/nutrition/meals/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const ctx = await getUserContext();
  const [meal, data] = await Promise.all([getSavedMeal(ctx.userId, id), getPickerData(ctx.userId)]);
  if (!meal) notFound();
  const known = new Set(data.foods.map((f) => f.id));
  const extra = await getPickerFoodsByIds(ctx.userId, meal.items.map((i) => i.foodId).filter((x): x is string => !!x && !known.has(x)));
  return (
    <div className="space-y-4">
      <Link href="/nutrition/meals" className="-ml-1.5 inline-flex items-center gap-0.5 text-sm font-medium text-fg-3 hover:text-fg">
        <ChevronLeft className="size-5" aria-hidden />
        {ctx.t.nutrition.meals.title}
      </Link>
      <MealEditor
        data={data}
        extraFoods={extra}
        initial={{
          id: meal.meal.id,
          name: meal.meal.name,
          mealSlot: meal.meal.mealSlot,
          isFavorite: meal.meal.isFavorite,
          items: meal.items.map((i) => ({ foodId: i.foodId, recipeId: i.recipeId, quantity: i.quantity, unit: i.unit })),
        }}
      />
    </div>
  );
}
