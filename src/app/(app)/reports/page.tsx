import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge, EmptyState } from "@/components/ui/data-display";
import { PageHeader } from "@/components/ui/page";
import { format } from "@/lib/i18n";
import { getT, getUserContext } from "@/server/context";
import { getWeeklyReports } from "@/server/queries/reports";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).reports.title };
}

export default async function ReportsPage() {
  const ctx = await getUserContext();
  const { t, fmt, locale } = ctx;
  const tr = t.reports;
  const reports = (await getWeeklyReports(ctx, 16)).filter((r) => r.foodDays || r.weighIns || r.workouts || r.inProgress);
  return (
    <>
      <PageHeader title={tr.title} />
      {reports.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {reports.map((r) => (
            <Link key={r.weekStart} href={`/reports/${r.weekStart}`} className="group">
              <Card className="h-full transition group-hover:border-border-strong">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold">{format(tr.week, { week: r.week.week }, locale)}</h2>
                      {r.inProgress && <Badge tone="accent">{tr.inProgress}</Badge>}
                    </div>
                    <p className="text-[13px] text-fg-3">
                      {fmt.date(r.weekStart, "dayMonth")} – {fmt.date(r.weekEnd, "dayMonth")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.score != null && (
                      <span className="text-right">
                        <span className="block text-xl leading-none font-semibold tabular">{r.score}</span>
                        <span className="text-[10px] text-fg-3 uppercase">{tr.score}</span>
                      </span>
                    )}
                    <ChevronRight className="size-4 text-fg-3" aria-hidden />
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="text-fg-3">{tr.avgWeight}</dt>
                    <dd className="mt-0.5 font-semibold tabular">
                      {r.avgWeight != null ? fmt.weight(r.avgWeight) : tr.noData}
                      {r.weightChange != null && <span className="ml-1 font-normal text-fg-3">{fmt.weight(r.weightChange, { signed: true, unit: false })}</span>}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-fg-3">{tr.avgCalories}</dt>
                    <dd className="mt-0.5 font-semibold tabular">{r.avgCalories != null ? fmt.kcal(r.avgCalories) : tr.noData}</dd>
                  </div>
                  <div>
                    <dt className="text-fg-3">{tr.workouts}</dt>
                    <dd className="mt-0.5 font-semibold tabular">
                      {r.workouts}
                      {r.plannedWorkouts ? `/${r.plannedWorkouts}` : ""}
                    </dd>
                  </div>
                </dl>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState icon={<FileText />} title={tr.emptyTitle} body={tr.emptyBody} />
        </Card>
      )}
    </>
  );
}
