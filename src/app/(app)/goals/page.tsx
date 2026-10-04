import type { Metadata } from "next";
import { and, desc, eq, ne } from "drizzle-orm";
import { CheckCircle2, CircleAlert, Flame, Target, TriangleAlert } from "lucide-react";
import { ApplySuggestionButton, GoalMenu, NewGoalButton } from "@/components/goals/goal-actions";
import { WeightChartCard } from "@/components/progress/weight-chart-card";
import { Card, CardHeader, Metric } from "@/components/ui/card";
import { Badge, EmptyState, Meter, Stat } from "@/components/ui/data-display";
import { PageHeader } from "@/components/ui/page";
import { assessRate, dailyEnergyBalanceForRate, goalProgress, requiredWeeklyRate, scheduleStatus } from "@/lib/calc/goal";
import { suggestCalorieTarget, targetForDate } from "@/lib/calc/nutrition";
import { addDays, diffDays } from "@/lib/dates";
import { format } from "@/lib/i18n";
import { getT, getUserContext } from "@/server/context";
import { db } from "@/server/db";
import { goals } from "@/server/db/schema";
import { getAnalysis } from "@/server/queries/analysis";
import { getTargets } from "@/server/queries/common";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).goals.title };
}

export default async function GoalsPage() {
  const ctx = await getUserContext();
  const { t, fmt } = ctx;
  const f = (tpl: string, p: Record<string, string | number>) => format(tpl, p, ctx.locale);
  const [analysis, targets, past] = await Promise.all([
    getAnalysis(ctx),
    getTargets(ctx.userId),
    db.select().from(goals).where(and(eq(goals.userId, ctx.userId), ne(goals.status, "active"))).orderBy(desc(goals.createdAt)),
  ]);
  const { goal, energy, forecast, weights } = analysis;
  const stats = energy.stats;
  const current = stats.current;

  const statusLabel: Record<string, string> = {
    ahead: t.goals.statusAhead,
    on_track: t.goals.statusOnTrack,
    behind: t.goals.statusBehind,
    reached: t.goals.statusReached,
    no_target_date: t.goals.statusNoDate,
    not_started: t.goals.statusNotStarted,
  };

  // ── Energy ───────────────────────────────────────────────────────────────
  const adaptive = energy.adaptive;
  const useAdaptive = adaptive && adaptive.confidence !== "low";
  const basisTdee = useAdaptive ? adaptive.tdee : energy.formula?.tdee;
  const suggestion = basisTdee ? suggestCalorieTarget(basisTdee, ctx.profile.primaryGoal) : null;
  const currentTarget = targetForDate(targets, ctx.today);

  const energyCard = (
    <Card>
      <CardHeader title={t.goals.energy} icon={<Flame />} />
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl bg-surface-2 p-4">
          <div className="text-xs text-fg-3">{t.goals.formulaTdee}</div>
          <Metric className="mt-1" size="md" value={energy.formula ? fmt.int(energy.formula.tdee) : "—"} unit="kcal" />
          {energy.formula && <div className="mt-1 text-xs text-fg-3">{energy.formula.method === "katch" ? "Katch–McArdle" : "Mifflin–St Jeor"} × {fmt.number(energy.formula.multiplier, 3)}</div>}
        </div>
        <div className="rounded-2xl bg-surface-2 p-4">
          <div className="text-xs text-fg-3">{t.goals.adaptiveTdee}</div>
          <Metric className="mt-1" size="md" value={adaptive ? fmt.int(adaptive.tdee) : "—"} unit="kcal" />
          {adaptive ? (
            <div className="mt-1 text-xs text-fg-3">
              {t.goals.confidence}: <span className="font-medium text-fg-2">{t.goals.confidenceLevel[adaptive.confidence]}</span> · {fmt.int(adaptive.low)}–{fmt.int(adaptive.high)}
            </div>
          ) : (
            <div className="mt-1 text-xs text-fg-3">{t.goals.tdeeNeedsData}</div>
          )}
        </div>
      </div>
      <p className="mt-4 text-[13px] leading-relaxed text-fg-3">
        {f(t.goals.tdeeExplain, { days: adaptive?.windowDays ?? 28 })}
        {adaptive && ` ${f(t.goals.tdeeBasis, { intakeDays: adaptive.intakeDays, weighIns: adaptive.weighIns })}`}
      </p>
      {suggestion && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <div>
            <div className="text-xs text-fg-3">{t.goals.suggestTarget}</div>
            <div className="text-lg font-semibold">
              {fmt.kcal(suggestion)}
              {currentTarget && <span className="ml-2 text-sm font-normal text-fg-3">({t.nutrition.target}: {fmt.kcal(currentTarget.calories)})</span>}
            </div>
            <div className="text-xs text-fg-3">{f(t.goals.suggestTargetHint, { source: useAdaptive ? t.goals.sourceData : t.goals.sourceFormula })}</div>
          </div>
          {(!currentTarget || Math.abs(currentTarget.calories - suggestion) >= 20) && <ApplySuggestionButton calories={suggestion} />}
        </div>
      )}
    </Card>
  );

  if (!goal) {
    return (
      <>
        <PageHeader title={t.goals.title} actions={<NewGoalButton currentKg={current} variant="primary" size="sm" />} />
        <div className="space-y-4">
          <Card>
            <EmptyState icon={<Target />} title={t.goals.noneTitle} body={t.goals.noneBody} action={<NewGoalButton currentKg={current} variant="primary" />} />
          </Card>
          {energyCard}
        </div>
      </>
    );
  }

  const cur = current ?? goal.startWeightKg;
  const progress = goalProgress(goal, cur);
  const status = scheduleStatus(goal, ctx.today, current);
  const required = requiredWeeklyRate(cur, goal.targetWeightKg, ctx.today, goal.targetDate);
  const safety = required != null ? assessRate(required, cur) : null;
  const eta = forecast?.goalEta ?? null;
  const tone = status === "ahead" || status === "on_track" || status === "reached" ? "good" : status === "behind" ? "warn" : "neutral";
  const horizonDays = goal.targetDate ? Math.min(182, Math.max(35, diffDays(goal.targetDate, ctx.today) + 7)) : 98;

  return (
    <>
      <PageHeader title={t.goals.title} actions={<NewGoalButton currentKg={current} variant="secondary" size="sm" />} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title={t.goals.active}
            icon={<Target />}
            action={
              <>
                <Badge tone={tone}>
                  {tone === "good" ? <CheckCircle2 aria-hidden /> : tone === "warn" ? <CircleAlert aria-hidden /> : null}
                  {statusLabel[status]}
                </Badge>
                <GoalMenu goal={goal} currentKg={current} />
              </>
            }
          />
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-xs text-fg-3">{t.goals.remaining}</div>
              <Metric size="xl" value={fmt.weight(progress.remainingKg, { unit: false })} unit={fmt.weightUnit} />
            </div>
            <div className="text-right">
              <div className="text-xs text-fg-3">{t.goals.progress}</div>
              <div className="text-2xl font-semibold">{fmt.pct(progress.percent / 100)}</div>
            </div>
          </div>
          <Meter className="mt-4" value={progress.percent} max={100} height={10} label={t.goals.progress} />
          <div className="mt-2 flex justify-between text-xs text-fg-3 tabular">
            <span>
              {t.goals.startWeight} {fmt.weight(goal.startWeightKg)}
            </span>
            <span className="font-medium text-fg">
              {t.common.current} {fmt.weight(cur)}
            </span>
            <span>
              {t.common.target} {fmt.weight(goal.targetWeightKg)}
            </span>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5 border-t border-border pt-5 sm:grid-cols-4">
            <Stat label={t.goals.targetDate} value={goal.targetDate ? fmt.date(goal.targetDate, "medium") : "—"} />
            <Stat label={t.goals.requiredRate} value={required != null ? f(t.weight.ratePerWeek, { value: fmt.weight(required, { signed: true, decimals: 2 }) }) : "—"} />
            <Stat label={required != null && required > 0 ? t.goals.requiredSurplus : t.goals.requiredDeficit} value={required != null ? `≈ ${fmt.kcal(Math.abs(dailyEnergyBalanceForRate(required)))}` : "—"} />
            <Stat label={t.goals.targetBodyFat} value={goal.targetBodyFatPct != null ? `${fmt.number(goal.targetBodyFatPct, 1)}%` : "—"} />
          </div>
          {safety && safety.level !== "ok" && required != null && (
            <div className="mt-5 flex gap-3 rounded-2xl border border-warn/30 bg-warn/10 p-4 text-sm leading-relaxed text-fg-2">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn-text" aria-hidden />
              <p>{f(safety.level === "very_aggressive" ? t.goals.veryAggressiveWarning : t.goals.aggressiveWarning, { rate: fmt.weight(Math.abs(required), { decimals: 2 }), pct: fmt.pct(safety.pctPerWeek / 100, 1) })}</p>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title={t.goals.estimatedDate} />
          {eta ? (
            <>
              <Metric size="md" value={fmt.date(eta.date, "medium")} />
              <p className="mt-2 text-sm text-fg-3">{eta.late && eta.early ? f(t.goals.estimatedRange, { early: fmt.date(eta.early, "dayMonth"), late: fmt.date(eta.late, "medium") }) : eta.early ? f(t.goals.estimatedRangeOpen, { early: fmt.date(eta.early, "medium") }) : null}</p>
            </>
          ) : (
            <p className="text-sm text-fg-3">{progress.reached ? t.goals.statusReached : stats.ratePerWeek == null ? t.goals.needMoreData : t.goals.notTrending}</p>
          )}
          {forecast && (
            <div className="mt-5 space-y-3 border-t border-border pt-4 text-sm">
              <div className="text-xs font-medium text-fg-3">{t.goals.atCurrentPace}</div>
              {[
                [t.goals.in1Month, forecast.at(30)],
                [t.goals.in3Months, forecast.at(91)],
                ...(goal.targetDate && diffDays(goal.targetDate, ctx.today) > 0 ? [[t.goals.atGoalDate, forecast.at(diffDays(goal.targetDate, ctx.today))] as const] : []),
              ].map(([label, p]) => (
                <div key={label as string} className="flex items-baseline justify-between gap-2">
                  <span className="text-fg-2">{label as string}</span>
                  <span className="text-right tabular">
                    <span className="font-semibold">{fmt.weight((p as { expected: number }).expected)}</span>
                    <span className="ml-1.5 text-xs text-fg-3">
                      {fmt.weight((p as { low: number }).low, { unit: false })}–{fmt.weight((p as { high: number }).high)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="lg:col-span-2">
          <WeightChartCard
            entries={weights.filter((w) => w.date >= addDays(ctx.today, -90))}
            goalKg={goal.targetWeightKg}
            defaultRange="all"
            forecast={forecast?.points.filter((p) => diffDays(p.date, ctx.today) <= horizonDays)}
          />
          <p className="mt-2 px-1 text-xs leading-relaxed text-fg-3">{f(t.goals.forecastHint, { energy: forecast?.basis === "combined" ? t.goals.forecastEnergy : "" })}</p>
        </div>
        {energyCard}

        {past.length > 0 && (
          <Card className="lg:col-span-3">
            <CardHeader title={t.goals.past} />
            <ul className="divide-y divide-border">
              {past.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span>
                    {fmt.weight(g.startWeightKg)} → {fmt.weight(g.targetWeightKg)}
                    <span className="ml-2 text-fg-3">{fmt.date(g.startDate, "medium")}</span>
                  </span>
                  <Badge tone={g.status === "completed" ? "good" : "neutral"}>
                    {g.status === "completed" ? t.goals.statusReached : t.goals.archive}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}
