import { PageHeader } from "@/components/ui/page";
import { SectionTabs } from "@/components/ui/section-tabs";
import { getUserContext } from "@/server/context";

export default async function NutritionLayout({ children }: LayoutProps<"/nutrition">) {
  const { t } = await getUserContext();
  const s = t.nutrition.sections;
  return (
    <>
      <PageHeader title={t.nutrition.title} />
      <SectionTabs
        tabs={[
          { href: "/nutrition", label: s.diary },
          { href: "/nutrition/foods", label: s.foods },
          { href: "/nutrition/meals", label: s.meals },
          { href: "/nutrition/recipes", label: s.recipes },
          { href: "/nutrition/history", label: s.history },
        ]}
      />
      {children}
    </>
  );
}
