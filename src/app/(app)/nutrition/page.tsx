import type { Metadata } from "next";
import { DiaryView } from "@/components/nutrition/diary-view";
import { addDays, type ISODate } from "@/lib/dates";
import { getT, getUserContext } from "@/server/context";
import { countEntries, getDiary, getPickerData } from "@/server/queries/nutrition";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).nutrition.diary };
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export default async function NutritionPage({ searchParams }: PageProps<"/nutrition">) {
  const ctx = await getUserContext();
  const sp = await searchParams;
  const raw = typeof sp.date === "string" && ISO.test(sp.date) ? (sp.date as ISODate) : ctx.today;
  const date = raw > ctx.today ? ctx.today : raw;
  const [diary, picker, prevDayCount] = await Promise.all([getDiary(ctx.userId, date), getPickerData(ctx.userId), countEntries(ctx.userId, addDays(date, -1))]);
  const target = diary.target
    ? { calories: diary.target.calories, proteinG: diary.target.proteinG, carbsG: diary.target.carbsG, fatG: diary.target.fatG, fiberG: diary.target.fiberG }
    : null;
  return (
    <DiaryView
      key={date}
      date={date}
      entries={diary.entries}
      totals={diary.totals}
      target={target}
      picker={picker}
      prevDayCount={prevDayCount}
      openAdd={sp.add === "1"}
    />
  );
}
