import { PageHeader } from "@/components/ui/page";
import { SectionTabs } from "@/components/ui/section-tabs";
import { getUserContext } from "@/server/context";

export default async function HabitsLayout({ children }: LayoutProps<"/habits">) {
  const { t } = await getUserContext();
  const s = t.habits.sections;
  return (
    <>
      <PageHeader title={t.habits.title} />
      <SectionTabs
        tabs={[
          { href: "/habits", label: s.habits },
          { href: "/habits/water", label: s.water },
          { href: "/habits/sleep", label: s.sleep },
          { href: "/habits/supplements", label: s.supplements },
        ]}
      />
      {children}
    </>
  );
}
