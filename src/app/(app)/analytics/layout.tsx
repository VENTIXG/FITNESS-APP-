import { PageHeader } from "@/components/ui/page";
import { SectionTabs } from "@/components/ui/section-tabs";
import { getUserContext } from "@/server/context";

export default async function AnalyticsLayout({ children }: LayoutProps<"/analytics">) {
  const { t } = await getUserContext();
  const tabs = t.analytics.tabs;
  return (
    <>
      <PageHeader title={t.analytics.title} />
      <SectionTabs
        tabs={[
          { href: "/analytics", label: tabs.weight },
          { href: "/analytics/body", label: tabs.body },
          { href: "/analytics/nutrition", label: tabs.nutrition },
          { href: "/analytics/training", label: tabs.training },
          { href: "/analytics/cardio", label: tabs.cardio },
          { href: "/analytics/lifestyle", label: tabs.lifestyle },
        ]}
      />
      {children}
    </>
  );
}
