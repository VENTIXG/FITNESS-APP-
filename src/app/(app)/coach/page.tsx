import type { Metadata } from "next";
import { Flame, ShieldCheck, Sparkles } from "lucide-react";
import { AiSummary } from "@/components/coach/ai-summary";
import { InsightRow } from "@/components/dashboard/cards";
import { Card, CardHeader } from "@/components/ui/card";
import { Stat } from "@/components/ui/data-display";
import { PageHeader } from "@/components/ui/page";
import { startOfWeek } from "@/lib/dates";
import { groupBy } from "@/lib/utils";
import { isAiCoachConfigured } from "@/server/actions/coach";
import { getT, getUserContext } from "@/server/context";
import { getAnalysis } from "@/server/queries/analysis";
import { getWeeklyReport } from "@/server/queries/reports";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).coach.title };
}

export default async function CoachPage() {
  const ctx = await getUserContext();
  const { t, fmt } = ctx;
  const tc = t.coach;
  const [analysis, week, configured] = await Promise.all([getAnalysis(ctx), getWeeklyReport(ctx, startOfWeek(ctx.today, ctx.weekStartsOn)), isAiCoachConfigured()]);
  const groups = [...groupBy([...analysis.insights].sort((a, b) => b.priority - a.priority), (i) => i.category).entries()];
  const e = analysis.energy;
  return (
    <>
      <PageHeader title={tc.title} subtitle={tc.subtitle} />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title={tc.insights} icon={<Sparkles />} />
            {groups.length ? (
              <div className="space-y-5">
                {groups.map(([cat, list]) => (
                  <section key={cat}>
                    <h3 className="mb-2.5 text-xs font-semibold tracking-wide text-fg-3 uppercase">{tc.categories[cat]}</h3>
                    <ul className="space-y-3.5">
                      {list.map((i) => (
                        <InsightRow key={i.id} insight={i} ctx={ctx} />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            ) : (
              <p className="text-sm text-fg-3">{tc.noInsights}</p>
            )}
          </Card>
          <Card>
            <CardHeader title={tc.aiSummary} icon={<Sparkles />} />
            <AiSummary configured={configured} />
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader title={tc.thisWeek} />
            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              <Stat label={t.reports.avgWeight} value={week.avgWeight != null ? fmt.weight(week.avgWeight, { unit: false }) : "—"} unit={week.avgWeight != null ? fmt.weightUnit : undefined} />
              <Stat label={t.reports.avgCalories} value={week.avgCalories != null ? fmt.int(week.avgCalories) : "—"} unit={week.avgCalories != null ? "kcal" : undefined} />
              <Stat label={t.reports.workouts} value={`${week.workouts}${week.plannedWorkouts ? ` / ${week.plannedWorkouts}` : ""}`} />
              <Stat label={t.reports.avgSteps} value={week.avgSteps != null ? fmt.int(week.avgSteps) : "—"} />
            </div>
          </Card>
          <Card>
            <CardHeader title={tc.expenditure} icon={<Flame />} />
            <div className="grid grid-cols-2 gap-4">
              <Stat label={t.goals.formulaTdee} value={e.formula ? fmt.int(e.formula.tdee) : "—"} unit="kcal" />
              <Stat
                label={t.goals.adaptiveTdee}
                value={e.adaptive ? fmt.int(e.adaptive.tdee) : "—"}
                unit="kcal"
                sub={<span className="text-fg-3">{e.adaptive ? `${t.goals.confidence}: ${t.goals.confidenceLevel[e.adaptive.confidence]}` : t.goals.tdeeNeedsData}</span>}
              />
            </div>
          </Card>
          <p className="flex gap-2 px-1 text-xs leading-relaxed text-fg-3">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
            {tc.disclaimer}
          </p>
        </div>
      </div>
    </>
  );
}
