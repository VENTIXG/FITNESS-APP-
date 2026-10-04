import type { Metadata } from "next";
import { SimpleChartCard } from "@/components/analytics/simple-chart";
import { RangeLinks, parseRange, rangeStart } from "@/components/analytics/range";
import { Card, CardHeader } from "@/components/ui/card";
import { Stat } from "@/components/ui/data-display";
import { averageNutrients, caloriesOnTarget, macroSplit, proteinHit } from "@/lib/calc/nutrition";
import { addDays, eachDay } from "@/lib/dates";
import { getT, getUserContext } from "@/server/context";
import { getNutritionHistory } from "@/server/queries/nutrition";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).analytics.tabs.nutrition };
}

export default async function NutritionAnalyticsPage({ searchParams }: PageProps<"/analytics/nutrition">) {
  const ctx = await getUserContext();
  const { t, fmt } = ctx;
  const ta = t.analytics;
  const range = parseRange(await searchParams, 90);
  const start = rangeStart(ctx.today, range);
  const history = await getNutritionHistory(ctx.userId, addDays(ctx.today, -364), ctx.today);
  const complete = history.filter((d) => d.date < ctx.today);
  const inRange = complete.filter((d) => d.date >= start);

  const periods = [7, 30, 90].map((n) => {
    const days = complete.filter((d) => d.date >= addDays(ctx.today, -n));
    const avg = averageNutrients(days);
    const withTarget = days.filter((d) => d.target);
    return {
      n,
      label: n === 7 ? ta.last7 : n === 30 ? ta.last30 : ta.last90,
      logged: days.length,
      avg,
      calorieAdherence: withTarget.length ? withTarget.filter((d) => caloriesOnTarget(d.calories, d.target!.calories)).length / withTarget.length : null,
      proteinAdherence: withTarget.length ? withTarget.filter((d) => proteinHit(d.proteinG, d.target!.proteinG)).length / withTarget.length : null,
      split: avg ? macroSplit(avg) : null,
    };
  });

  const byDate = new Map(inRange.map((d) => [d.date, d]));
  const rows = eachDay(start, addDays(ctx.today, -1)).map((date) => {
    const d = byDate.get(date);
    return { date, calories: d ? Math.round(d.calories) : null, target: d?.target?.calories ?? null, protein: d ? Math.round(d.proteinG) : null, proteinTarget: d?.target?.proteinG ?? null };
  });

  return (
    <div className="space-y-4">
      <Card className="p-0">
        <div className="px-4 pt-4 sm:px-5">
          <CardHeader title={ta.compare} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-y border-border text-left text-xs text-fg-3">
                <th className="py-2 pl-4 font-medium sm:pl-5" />
                {periods.map((p) => (
                  <th key={p.n} className="py-2 pr-4 text-right font-medium sm:pr-5">
                    {p.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular">
              {(
                [
                  [ta.avgCalories, (p: (typeof periods)[number]) => (p.avg ? fmt.kcal(p.avg.calories) : "—")],
                  [ta.avgProtein, (p: (typeof periods)[number]) => (p.avg ? `${fmt.int(p.avg.proteinG)} g` : "—")],
                  [ta.avgCarbs, (p: (typeof periods)[number]) => (p.avg ? `${fmt.int(p.avg.carbsG)} g` : "—")],
                  [ta.avgFat, (p: (typeof periods)[number]) => (p.avg ? `${fmt.int(p.avg.fatG)} g` : "—")],
                  [ta.avgFiber, (p: (typeof periods)[number]) => (p.avg ? `${fmt.int(p.avg.fiberG)} g` : "—")],
                  [ta.loggedDays, (p: (typeof periods)[number]) => `${p.logged}/${p.n}`],
                  [ta.calorieAdherence, (p: (typeof periods)[number]) => (p.calorieAdherence != null ? fmt.pct(p.calorieAdherence) : "—")],
                  [ta.proteinAdherence, (p: (typeof periods)[number]) => (p.proteinAdherence != null ? fmt.pct(p.proteinAdherence) : "—")],
                ] as const
              ).map(([label, fn]) => (
                <tr key={label} className="border-b border-border last:border-0">
                  <td className="py-2.5 pl-4 text-fg-2 sm:pl-5">{label}</td>
                  {periods.map((p) => (
                    <td key={p.n} className="py-2.5 pr-4 text-right font-medium sm:pr-5">
                      {fn(p)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-border px-4 py-3 text-xs text-fg-3 sm:px-5">{t.nutrition.history.loggedOnlyHint}</p>
      </Card>

      <Card>
        <CardHeader title={ta.macroSplit} />
        <div className="space-y-3">
          {periods.map((p) => (
            <div key={p.n}>
              <div className="mb-1 text-xs text-fg-3">{p.label}</div>
              {p.split ? (
                <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={`${t.nutrition.protein} ${fmt.pct(p.split.protein)}, ${t.nutrition.carbs} ${fmt.pct(p.split.carbs)}, ${t.nutrition.fat} ${fmt.pct(p.split.fat)}`}>
                  <span style={{ width: `${p.split.protein * 100}%`, background: "var(--c-protein)" }} />
                  <span style={{ width: `${p.split.carbs * 100}%`, background: "var(--c-carbs)" }} />
                  <span style={{ width: `${p.split.fat * 100}%`, background: "var(--c-fat)" }} />
                </div>
              ) : (
                <div className="h-3 rounded-full bg-surface-2" />
              )}
              {p.split && (
                <div className="mt-1 flex gap-4 text-xs text-fg-2 tabular">
                  <span>{t.nutrition.protein} {fmt.pct(p.split.protein)}</span>
                  <span>{t.nutrition.carbs} {fmt.pct(p.split.carbs)}</span>
                  <span>{t.nutrition.fat} {fmt.pct(p.split.fat)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      <RangeLinks base="/analytics/nutrition" value={range} label={ta.range} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SimpleChartCard
          title={ta.caloriesChart}
          kind="kcal"
          rows={rows}
          series={[
            { kind: "bar", key: "calories", label: t.nutrition.calories, color: "--series-1" },
            { kind: "line", key: "target", label: t.nutrition.target, color: "--fg-2", dashed: true },
          ]}
        />
        <SimpleChartCard
          title={ta.proteinChart}
          kind="g"
          rows={rows}
          series={[
            { kind: "bar", key: "protein", label: t.nutrition.protein, color: "--series-2" },
            { kind: "line", key: "proteinTarget", label: t.nutrition.target, color: "--fg-2", dashed: true },
          ]}
        />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <Stat label={ta.loggedDays} value={`${inRange.length}`} sub={<span className="text-fg-3">/ {range - 1}</span>} />
        </Card>
      </div>
    </div>
  );
}
