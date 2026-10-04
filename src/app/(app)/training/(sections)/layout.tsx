import { PageHeader } from "@/components/ui/page";
import { SectionTabs } from "@/components/ui/section-tabs";
import { getUserContext } from "@/server/context";

export default async function TrainingLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getUserContext();
  const s = t.training.sections;
  return (
    <>
      <PageHeader title={t.training.title} />
      <SectionTabs
        tabs={[
          { href: "/training", label: s.overview },
          { href: "/training/history", label: s.history },
          { href: "/training/exercises", label: s.exercises },
          { href: "/training/programs", label: s.programs },
          { href: "/training/records", label: s.records },
        ]}
      />
      {children}
    </>
  );
}
