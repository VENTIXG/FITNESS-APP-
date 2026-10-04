import { SectionTabs } from "@/components/ui/section-tabs";
import { PageHeader } from "@/components/ui/page";
import { getUserContext } from "@/server/context";

export default async function ProgressLayout({ children }: LayoutProps<"/progress">) {
  const { t } = await getUserContext();
  return (
    <>
      <PageHeader title={t.nav.progress} />
      <SectionTabs
        tabs={[
          { href: "/progress", label: t.body.tabs.weight },
          { href: "/progress/body", label: t.body.tabs.body },
          { href: "/progress/measurements", label: t.body.tabs.measurements },
          { href: "/progress/photos", label: t.body.tabs.photos },
        ]}
      />
      {children}
    </>
  );
}
