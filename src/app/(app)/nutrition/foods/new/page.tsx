import type { Metadata } from "next";
import { NewFoodForm } from "@/components/nutrition/food-library";
import { SectionTitle } from "@/components/ui/page";
import { getT, getUserContext } from "@/server/context";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).nutrition.foods.new };
}

export default async function NewFoodPage({ searchParams }: PageProps<"/nutrition/foods/new">) {
  const { t } = await getUserContext();
  const sp = await searchParams;
  const name = typeof sp.name === "string" ? sp.name.slice(0, 160) : "";
  const barcode = typeof sp.barcode === "string" && /^\d{6,14}$/.test(sp.barcode) ? sp.barcode : null;
  return (
    <div className="mx-auto max-w-2xl">
      <SectionTitle>{t.nutrition.foods.new}</SectionTitle>
      <NewFoodForm initial={{ name, barcode }} />
    </div>
  );
}
