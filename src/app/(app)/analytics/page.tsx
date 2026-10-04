import type { Metadata } from "next";
import { SimpleChartCard } from "@/components/analytics/simple-chart";
import { RangeLinks, parseRange, rangeStart, weekStarts } from "@/components/analytics/range";
import { WeightChartCard } from "@/components/progress/weight-chart-card";
import { Card, CardHeader } from "@/components/ui/card";
import { Stat } from "@/components/ui/data-display";
import { adaptiveTdeeHistory } from "@/lib/calc/tdee";
import { addDays, addMonths, startOfMonth } from "@/lib/dates";
import { format } from "@/lib/i18n";
import { toDisplayWeight } from "@/lib/units";
import { mean } from "@/lib/utils";
import { getT, getUserContext } from "@/server/context";
import { getAnalysis } from "@/server/queries/analysis";
import { getNutritionHistory } from "@/server/queries/nutrition";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).analytics.title };
}

export default async function WeightAnalyticsPage({ searchParams }: PageProps<"/analytics">) {
  const ctx = await getUserContext();
  const { t, fmt, locale } = ctx;
  const ta = t.analytics;
  const range = parseRange(await searchParams, 180);
  const start = rangeStart(ctx.today, range);
  const { weights, energy, goal, forecast } = await getAnalysis(ctx);
  const intake = await getNutritionHistory(ctx.userId, addDays(start, -35), addDays(ctx.today, -1));
  const units = fmt.units;
  const disp = (kg: number) => Math.round(toDisplayWeight(kg, units) * 100) / 100;

  // Weekly averages and changes.
  const weeks = weekStarts(start, ctx.today, ctx.weekStartsOn).map((w) => {
    const vals = weights.filter((x) => x.date >= w && x.date <= addDays(w, 6)).map((x) => x.weightKg);
    return { date: w, avg: vals.length ? mean(vals) : null };
  });
  const weekRows = weeks.map((w, i) => {
    const prev = weeks[i - 1]?.avg;
    return { date: w.date, avg: w.avg != null ? disp(w.avg) : null, change: w.avg != null && prev != null ? disp(w.avg) - disp(prev) : null };
  });

  // Monthly averages.
  const months: { month: string; avg: number | null; n: number }[] = [];
  for (let m = startOfMonth(start); m <= ctx.today; m = addMonths(m, 1)) {
    const vals = weights.filter((x) => x.date.startsWith(m.slice(0, 7))).map((x) => x.weightKg);
    months.push({ month: m, avg: vals.length ? mean(vals) : null, n: vals.length });
  }

  // Expenditure over time (data-driven) vs weekly average intake.
  const tdee = adaptiveTdeeHistory({
    intake: intake.map((d) => ({ date: d.date, calories: d.calories })),
    weights: weights.map((w) => ({ date: w.date, value: w.weightKg })),
    from: start,
    to: addDays(ctx.today, -1),
    stepDays: 7,
  });
  const tdeeRows = tdee.map((p) => {
    const win = intake.filter((d) => d.date > addDays(p.date, -7) && d.date <= p.date);
    return { date: p.date, tdee: Math.round(p.tdee), low: Math.round(p.low), high: Math.round(p.high), intake: win.length >= 4 ? Math.round(mean(win.map((d) => d.calories))!) : null };
  });

  return (
    <div className="space-y-4">
      <RangeLinks base="/analytics" value={range} label={ta.range} />
      <WeightChartCard entries={weights} goalKg={goal?.targetWeightKg} forecast={forecast?.points.slice(0, 9)} defaultRange={range >= 365 ? "1y" : range >= 180 ? "6m" : range >= 90 ? "3m" : "30d"} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SimpleChartCard title={ta.weeklyAverage} kind="weight" zero={false} weekly rows={weekRows} series={[{ kind: "line", key: "avg", label: ta.weeklyAverage, color: "--series-1", dots: true, connectNulls: true }]} axisDecimals={1} />
        <SimpleChartCard title={ta.weeklyChangeChart} kind="weightDelta" zero={false} weekly rows={weekRows} series={[{ kind: "bar", key: "change", label: ta.weeklyChangeChart, color: "--series-1" }]} axisDecimals={1} refLines={[]} />
      </div>
      <SimpleChartCard
        title={ta.tdeeTrend}
        subtitle={format(t.goals.tdeeExplain, { days: 28 }, locale)}
        kind="kcal"
        zero={false}
        rows={tdeeRows}
        series={[
          { kind: "band", lowKey: "low", highKey: "high", label: t.goals.confidence, color: "--series-3" },
          { kind: "line", key: "tdee", label: t.goals.adaptiveTdee, color: "--series-3" },
          { kind: "line", key: "intake", label: ta.avgCalories, color: "--series-1", dashed: true, connectNulls: true },
        ]}
        refLines={energy.formula ? [{ y: Math.round(energy.formula.tdee), label: t.goals.formulaTdee, color: "--fg-3" }] : []}
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t.goals.energy} />
          <div className="grid grid-cols-2 gap-4">
            <Stat label={t.goals.formulaTdee} value={energy.formula ? fmt.int(energy.formula.tdee) : "—"} unit="kcal" />
            <Stat
              label={t.goals.adaptiveTdee}
              value={energy.adaptive ? fmt.int(energy.adaptive.tdee) : "—"}
              unit="kcal"
              sub={
                <span className="text-fg-3">
                  {energy.adaptive ? `${t.goals.confidence}: ${t.goals.confidenceLevel[energy.adaptive.confidence]} · ${fmt.int(energy.adaptive.low)}–${fmt.int(energy.adaptive.high)}` : t.goals.tdeeNeedsData}
                </span>
              }
            />
          </div>
        </Card>
        <Card className="p-0">
          <div className="px-4 pt-4 sm:px-5">
            <CardHeader title={ta.monthlyChange} />
          </div>
          <table className="w-full text-sm">
            <tbody>
              {[...months].reverse().map((m, i, arr) => {
                const prev = arr[i + 1]?.avg;
                const change = m.avg != null && prev != null ? m.avg - prev : null;
                return (
                  <tr key={m.month} className="border-t border-border">
                    <td className="py-2.5 pl-4 sm:pl-5">{fmt.date(m.month, "monthYear")}</td>
                    <td className="py-2.5 text-right tabular">{m.avg != null ? fmt.weight(m.avg) : "—"}</td>
                    <td className="py-2.5 pr-4 text-right text-fg-3 tabular sm:pr-5">{change != null ? fmt.weight(change, { signed: true }) : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
