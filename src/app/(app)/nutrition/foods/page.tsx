import type { Metadata } from "next";
import { FoodLibrary } from "@/components/nutrition/food-library";
import { getT, getUserContext } from "@/server/context";
import { getPickerData } from "@/server/queries/nutrition";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).nutrition.foods.title };
}

export default async function FoodsPage() {
  const ctx = await getUserContext();
  const { foods } = await getPickerData(ctx.userId);
  return <FoodLibrary foods={foods} />;
}
