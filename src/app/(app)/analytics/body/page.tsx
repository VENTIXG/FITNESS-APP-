import type { Metadata } from "next";
import Link from "next/link";
import { Ruler } from "lucide-react";
import { BodyFatChart, MassCharts, MeasurementChart } from "@/components/progress/body-charts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/data-display";
import { getT, getUserContext } from "@/server/context";
import { getBodyComposition, getMeasurements } from "@/server/queries/body";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).analytics.tabs.body };
}

export default async function BodyAnalyticsPage() {
  const ctx = await getUserContext();
  const { t } = ctx;
  const [rows, measurements] = await Promise.all([getBodyComposition(ctx.userId), getMeasurements(ctx.userId)]);
  if (!rows.length && !measurements.length) {
    return (
      <Card>
        <EmptyState
          icon={<Ruler />}
          title={t.body.emptyCompositionTitle}
          body={t.body.emptyCompositionBody}
          action={
            <Button asChild variant="secondary">
              <Link href="/progress/body">{t.body.tabs.body}</Link>
            </Button>
          }
        />
      </Card>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {rows.length > 0 && <BodyFatChart rows={rows} />}
      {rows.length > 0 && <MassCharts rows={rows} />}
      {measurements.length > 0 && (
        <div className="lg:col-span-2">
          <MeasurementChart rows={measurements as unknown as Record<string, unknown>[]} />
        </div>
      )}
    </div>
  );
}
