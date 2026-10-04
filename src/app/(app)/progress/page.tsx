import type { Metadata } from "next";
import { Plus, Scale } from "lucide-react";
import { QuickAddButton } from "@/components/dashboard/islands";
import { WeightChartCard } from "@/components/progress/weight-chart-card";
import { WeightEntries } from "@/components/progress/weight-entries";
import { Card, CardHeader } from "@/components/ui/card";
import { Delta, EmptyState, Stat } from "@/components/ui/data-display";
import { bmi, bmiCategory } from "@/lib/calc/body";
import { computeWeightStats } from "@/lib/calc/weight";
import { format } from "@/lib/i18n";
import { getT, getUserContext } from "@/server/context";
import { getAnalysis, getWeights } from "@/server/queries/analysis";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).weight.title };
}

export default async function WeightPage() {
  const ctx = await getUserContext();
  const { t, fmt } = ctx;
  const [{ goal, forecast }, allWeights] = await Promise.all([getAnalysis(ctx), getWeights(ctx.userId)]);
  const s = computeWeightStats(allWeights, ctx.today, goal?.startWeightKg ?? null);
  const dir = goal ? Math.sign(goal.targetWeightKg - goal.startWeightKg) : 0;
  const sentiment = (v: number | null) => (v == null || !dir || Math.abs(v) < 0.05 ? "neutral" : Math.sign(v) === dir ? "good" : "bad") as "good" | "bad" | "neutral";
  const b = s.current && ctx.profile.heightCm ? bmi(s.current, ctx.profile.heightCm) : null;

  if (!allWeights.length) {
    return (
      <Card>
        <EmptyState
          icon={<Scale />}
          title={t.weight.emptyTitle}
          body={t.weight.emptyBody}
          action={
            <QuickAddButton kind="weight" variant="primary">
              <Plus aria-hidden />
              {t.weight.log}
            </QuickAddButton>
          }
        />
      </Card>
    );
  }

  const stat = (label: string, kg: number | null, signed = false) => (
    <Stat
      label={label}
      value={kg != null ? fmt.weight(kg, { signed, unit: false }) : "—"}
      unit={kg != null ? fmt.weightUnit : undefined}
      sub={signed && kg != null ? <Delta value={kg} formatted="" sentiment={sentiment(kg)} /> : undefined}
    />
  );

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <WeightChartCard entries={allWeights} goalKg={goal?.targetWeightKg} forecast={forecast?.points.slice(0, 9)} />
        <Card>
          <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
            {stat(t.weight.daily, s.latest?.weightKg ?? null)}
            {stat(t.weight.avg7, s.avg7)}
            {stat(t.weight.avg14, s.avg14)}
            {stat(t.weight.avg30, s.avg30)}
            {stat(t.weight.weeklyChange, s.weeklyChange, true)}
            {stat(t.weight.monthlyChange, s.monthlyChange, true)}
            {stat(s.totalChange != null && s.totalChange < 0 ? t.weight.totalLost : t.weight.totalChange, s.totalChange, true)}
            <Stat
              label={t.weight.rate}
              value={s.ratePerWeek != null ? format(t.weight.ratePerWeek, { value: fmt.weight(s.ratePerWeek, { signed: true, decimals: 2 }) }, ctx.locale) : "—"}
              sub={<span className="text-fg-3">{s.trend ? t.weight.trendShort[s.trend] : t.weight.trendUnknown}</span>}
            />
          </div>
          {b != null && (
            <p className="mt-5 border-t border-border pt-4 text-[13px] text-fg-3">
              {t.weight.bmi}: <span className="font-semibold text-fg">{fmt.number(b, 1)}</span> · {t.weight.bmiCategory[bmiCategory(b)]} · <span className="text-fg-3">{t.weight.bmiCaveat}</span>
            </p>
          )}
        </Card>
      </div>
      <Card className="lg:row-span-2">
        <CardHeader
          title={t.weight.entries}
          action={
            <QuickAddButton kind="weight" variant="secondary" size="sm">
              <Plus aria-hidden />
              {t.common.add}
            </QuickAddButton>
          }
        />
        <WeightEntries entries={allWeights} />
      </Card>
    </div>
  );
}
