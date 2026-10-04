import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Dumbbell,
  Flame,
  Footprints,
  GlassWater,
  HeartPulse,
  ListChecks,
  Lightbulb,
  Plus,
  Sparkles,
  Target,
  Timer,
  TrendingDown,
  TrendingUp,
  Weight,
} from "lucide-react";
import { MiniBars, Sparkline } from "@/components/charts/sparkline";
import { WaterQuickAdd } from "@/components/forms/lifestyle-forms";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, Metric } from "@/components/ui/card";
import { Badge, Delta, Meter, ProgressRing, type DeltaSentiment } from "@/components/ui/data-display";
import type { Insight } from "@/lib/calc/insights";
import { scoreBand } from "@/lib/calc/score";
import { weekday } from "@/lib/dates";
import { format } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { UserContext } from "@/server/context";
import type { DashboardData } from "@/server/queries/dashboard";
import { HabitCheck, QuickAddButton, StartWorkoutButton } from "./islands";

type P = { d: DashboardData; ctx: UserContext };

/** Down is good when losing, up is good when gaining. */
export function weightSentiment(change: number, d: DashboardData): DeltaSentiment {
  const dir = d.goalInfo?.progress.direction;
  if (!dir || dir === "maintain" || Math.abs(change) < 0.05) return "neutral";
  return (dir === "lose" ? change < 0 : change > 0) ? "good" : "bad";
}

export function ScoreCard({ d, ctx }: P) {
  const { t, fmt } = ctx;
  if (!d.scoreEnabled) return null;
  const score = d.score.score;
  const parts = d.score.breakdown.filter((b) => b.weight > 0 && b.value != null);
  return (
    <Card>
      <CardHeader title={t.dashboard.scoreSoFar} icon={<Flame />} subtitle={d.weekScore != null ? `${t.reports.score}: ${d.weekScore}` : undefined} />
      <div className="flex items-center gap-5">
        <ProgressRing value={(score ?? 0) / 100} size={88} stroke={8} label={`${t.enums.dashboardCard.score}: ${score ?? "—"}`}>
          <div className="text-center">
            <div className="text-[26px] leading-none font-semibold tracking-tight">{score ?? "—"}</div>
            {score != null && <div className="mt-1 text-[10px] font-medium tracking-wide text-fg-3 uppercase">/100</div>}
          </div>
        </ProgressRing>
        <ul className="min-w-0 flex-1 space-y-1.5">
          {parts.slice(0, 5).map((b) => (
            <li key={b.component} className="flex items-center gap-2 text-xs">
              <span className="w-16 shrink-0 truncate text-fg-3">{t.enums.scoreComponent[b.component]}</span>
              <Meter value={b.value ?? 0} max={1} height={5} color="var(--accent)" showOverflow={false} label={t.enums.scoreComponent[b.component]} />
              <span className="w-8 shrink-0 text-right text-fg-2 tabular">{fmt.pct(b.value ?? 0)}</span>
            </li>
          ))}
        </ul>
      </div>
      {score != null && <p className="sr-only">{scoreBand(score)}</p>}
    </Card>
  );
}

export function WeightCard({ d, ctx }: P) {
  const { t, fmt } = ctx;
  const s = d.stats;
  const todayEntry = s.latest?.date === ctx.today ? s.latest : null;
  const trendLabel = s.trend ? t.weight.trendShort[s.trend] : "—";
  const TrendIcon = s.trend === "up" ? TrendingUp : TrendingDown;
  return (
    <Card>
      <CardHeader title={t.weight.title} icon={<Weight />} href="/progress" />
      <div className="flex items-end justify-between gap-3">
        <div>
          {todayEntry ? (
            <Metric value={fmt.weight(todayEntry.weightKg, { unit: false })} unit={fmt.weightUnit} />
          ) : s.latest ? (
            <div>
              <Metric value={fmt.weight(s.latest.weightKg, { unit: false })} unit={fmt.weightUnit} className="opacity-60" />
              <p className="mt-1 text-xs text-fg-3">
                {t.dashboard.notLoggedToday} · {fmt.date(s.latest.date, "dayMonth")}
              </p>
            </div>
          ) : (
            <p className="text-sm text-fg-3">{t.weight.emptyBody}</p>
          )}
          {todayEntry && s.changeFromPrevious != null && (
            <Delta className="mt-1.5" value={s.changeFromPrevious} formatted={fmt.weight(s.changeFromPrevious, { signed: true })} sentiment="neutral" suffix={t.dashboard.vsYesterday} />
          )}
        </div>
        {!todayEntry && (
          <QuickAddButton kind="weight" variant="primary" size="sm">
            <Plus aria-hidden />
            {t.dashboard.logWeight}
          </QuickAddButton>
        )}
      </div>
      {d.weightSeries30.length >= 2 && (
        <Sparkline className="mt-3" values={d.weightSeries30.map((w) => w.weightKg)} ariaLabel={t.weight.chartRaw} />
      )}
      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-xs">
        <div>
          <div className="text-fg-3">{t.weight.avg7}</div>
          <div className="mt-0.5 font-semibold text-fg tabular">{s.avg7 != null ? fmt.weight(s.avg7) : "—"}</div>
        </div>
        <div>
          <div className="text-fg-3">{t.weight.weeklyChange}</div>
          <div className="mt-0.5 font-semibold tabular">
            {s.weeklyChange != null ? (
              <span className={cn(weightSentiment(s.weeklyChange, d) === "good" ? "text-good-text" : weightSentiment(s.weeklyChange, d) === "bad" ? "text-critical-text" : "text-fg")}>
                {fmt.weight(s.weeklyChange, { signed: true })}
              </span>
            ) : (
              "—"
            )}
          </div>
        </div>
        <div>
          <div className="text-fg-3">{t.common.trend}</div>
          <div className="mt-0.5 flex items-center gap-1 font-semibold text-fg">
            {s.trend && s.trend !== "stable" && <TrendIcon className="size-3.5 text-fg-3" aria-hidden />}
            <span className="truncate">{trendLabel}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function GoalCard({ d, ctx }: P) {
  const { t, fmt } = ctx;
  const g = d.goalInfo;
  if (!g) {
    return (
      <Card>
        <CardHeader title={t.goals.title} icon={<Target />} />
        <p className="text-sm font-medium">{t.dashboard.noGoal}</p>
        <p className="mt-1 text-sm text-fg-3">{t.dashboard.noGoalBody}</p>
        <Button asChild variant="secondary" size="sm" className="mt-4">
          <Link href="/goals">{t.dashboard.setGoal}</Link>
        </Button>
      </Card>
    );
  }
  const statusLabel: Record<string, string> = {
    ahead: t.goals.statusAhead,
    on_track: t.goals.statusOnTrack,
    behind: t.goals.statusBehind,
    reached: t.goals.statusReached,
    no_target_date: t.goals.statusNoDate,
    not_started: t.goals.statusNotStarted,
  };
  const tone = g.status === "ahead" || g.status === "on_track" || g.status === "reached" ? "good" : g.status === "behind" ? "warn" : "neutral";
  return (
    <Card>
      <CardHeader title={t.goals.title} icon={<Target />} href="/goals" action={<Badge tone={tone}>{tone === "good" ? <CheckCircle2 aria-hidden /> : tone === "warn" ? <CircleAlert aria-hidden /> : null}{statusLabel[g.status]}</Badge>} />
      <div className="flex items-baseline justify-between gap-2">
        <Metric value={fmt.weight(g.progress.remainingKg, { unit: false })} unit={`${fmt.weightUnit} · ${t.goals.remaining.toLowerCase()}`} />
        <span className="text-sm font-semibold text-fg-2 tabular">{fmt.pct(g.progress.percent / 100)}</span>
      </div>
      <Meter className="mt-3" value={g.progress.percent} max={100} color="var(--accent)" label={t.goals.progress} />
      <div className="mt-2 flex justify-between text-xs text-fg-3 tabular">
        <span>{fmt.weight(g.goal.startWeightKg)}</span>
        <span className="font-medium text-fg-2">{fmt.weight(g.current)}</span>
        <span>{fmt.weight(g.goal.targetWeightKg)}</span>
      </div>
      <div className="mt-3 border-t border-border pt-3 text-xs">
        <span className="text-fg-3">{t.goals.estimatedDate}: </span>
        <span className="font-semibold text-fg">{g.eta ? fmt.date(g.eta.date, "medium") : g.progress.reached ? t.goals.statusReached : "—"}</span>
      </div>
    </Card>
  );
}

export function CaloriesCard({ d, ctx }: P) {
  const { t, fmt } = ctx;
  const n = d.today.nutrition;
  const target = n.target?.calories ?? null;
  const consumed = n.totals.calories;
  const remaining = target != null ? target - consumed : null;
  return (
    <Card>
      <CardHeader title={t.nutrition.calories} icon={<Flame />} href="/nutrition" />
      {target == null ? (
        <>
          <Metric value={fmt.int(consumed)} unit="kcal" />
          <p className="mt-2 text-sm text-fg-3">{t.dashboard.noTargets}</p>
          <Button asChild variant="secondary" size="sm" className="mt-3">
            <Link href="/settings/nutrition">{t.dashboard.setTargets}</Link>
          </Button>
        </>
      ) : (
        <>
          <div className="flex items-end justify-between gap-2">
            <div>
              <div className="text-xs text-fg-3">{remaining! >= 0 ? t.nutrition.remaining : t.nutrition.over}</div>
              <Metric value={fmt.int(Math.abs(remaining!))} unit="kcal" />
            </div>
            <Button asChild variant="secondary" size="sm">
              <Link href="/nutrition?add=1">
                <Plus aria-hidden />
                {t.nutrition.addFood}
              </Link>
            </Button>
          </div>
          <Meter className="mt-3" value={consumed} max={target} color="var(--c-calories)" height={10} label={t.nutrition.calories} />
          <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-fg-3">{t.nutrition.consumed} </span>
              <span className="font-semibold tabular">{fmt.kcal(consumed)}</span>
            </div>
            <div className="text-right">
              <span className="text-fg-3">{t.nutrition.target} </span>
              <span className="font-semibold tabular">{fmt.kcal(target)}</span>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

export function MacrosCard({ d, ctx }: P) {
  const { t, fmt } = ctx;
  const n = d.today.nutrition;
  const rows = [
    { key: "protein", label: t.nutrition.protein, value: n.totals.proteinG, target: n.target?.proteinG, color: "var(--c-protein)" },
    { key: "carbs", label: t.nutrition.carbs, value: n.totals.carbsG, target: n.target?.carbsG, color: "var(--c-carbs)" },
    { key: "fat", label: t.nutrition.fat, value: n.totals.fatG, target: n.target?.fatG, color: "var(--c-fat)" },
    { key: "fiber", label: t.nutrition.fiber, value: n.totals.fiberG, target: n.target?.fiberG, color: "var(--c-fiber)" },
  ];
  return (
    <Card>
      <CardHeader title={t.enums.dashboardCard.macros} icon={<Sparkles />} href="/nutrition" />
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.key}>
            <div className="mb-1.5 flex items-baseline justify-between text-sm">
              <span className="flex items-center gap-2 text-fg-2">
                <span className="size-2 rounded-full" style={{ background: r.color }} aria-hidden />
                {r.label}
              </span>
              <span className="tabular">
                <span className="font-semibold text-fg">{fmt.int(r.value)}</span>
                <span className="text-fg-3"> / {r.target != null ? fmt.int(r.target) : "—"} g</span>
              </span>
            </div>
            <Meter value={r.value} max={r.target ?? 0} color={r.color} height={6} label={r.label} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function WorkoutCard({ d, ctx }: P) {
  const { t, fmt } = ctx;
  const f = (tpl: string, p: Record<string, string | number>) => format(tpl, p, ctx.locale);
  const done = d.todaysWorkouts[0];
  return (
    <Card>
      <CardHeader title={t.dashboard.todaysWorkout} icon={<Dumbbell />} href="/training" />
      {d.activeWorkout ? (
        <div>
          <Badge tone="accent" className="mb-2">
            {t.dashboard.workoutInProgress}
          </Badge>
          <p className="text-lg font-semibold">{d.activeWorkout.name}</p>
          <Button asChild variant="accent" size="lg" block className="mt-4">
            <Link href={`/training/workout/${d.activeWorkout.id}`}>
              {t.dashboard.resumeWorkout}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      ) : done ? (
        <div>
          <Badge tone="good" className="mb-2">
            <CheckCircle2 aria-hidden />
            {t.dashboard.completedWorkout}
          </Badge>
          <Link href={`/training/workout/${done.workoutId}`} className="block text-lg font-semibold hover:underline">
            {done.name}
          </Link>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <div>
              <div className="text-fg-3">{t.training.duration}</div>
              <div className="mt-0.5 font-semibold">{done.durationSeconds ? fmt.duration(done.durationSeconds) : "—"}</div>
            </div>
            <div>
              <div className="text-fg-3">{t.training.sets}</div>
              <div className="mt-0.5 font-semibold tabular">{done.sets}</div>
            </div>
            <div>
              <div className="text-fg-3">{t.training.volume}</div>
              <div className="mt-0.5 font-semibold tabular">{fmt.load(done.volume)}</div>
            </div>
          </div>
        </div>
      ) : d.planned.day ? (
        <div>
          <p className="text-lg font-semibold">{d.planned.day.name}</p>
          <p className="mt-0.5 text-sm text-fg-3">
            {f(t.training.workout.exerciseCount, { count: d.planned.day.exercises.length })} · {d.planned.program?.name}
          </p>
          <ul className="mt-2 space-y-0.5 text-[13px] text-fg-2">
            {d.planned.day.exercises.slice(0, 4).map((e) => (
              <li key={e.pe.id} className="truncate">
                {ctx.locale === "el" && e.nameEl ? e.nameEl : e.name} <span className="text-fg-3">· {e.pe.targetSets}×{e.pe.repMin ?? "?"}–{e.pe.repMax ?? "?"}</span>
              </li>
            ))}
          </ul>
          <StartWorkoutButton programDayId={d.planned.day.id} variant="accent" size="lg" block className="mt-4">
            {t.dashboard.startWorkout}
          </StartWorkoutButton>
        </div>
      ) : (
        <div>
          <p className="text-lg font-semibold">{d.planned.restDay ? t.dashboard.restDay : t.dashboard.noProgram}</p>
          {d.planned.nextDay && <p className="mt-0.5 text-sm text-fg-3">{f(t.dashboard.nextWorkout, { name: d.planned.nextDay.name })}</p>}
          <StartWorkoutButton programDayId={null} variant="secondary" block className="mt-4">
            {t.dashboard.startEmpty}
          </StartWorkoutButton>
        </div>
      )}
    </Card>
  );
}

export function StepsCard({ d, ctx }: P) {
  const { t, fmt } = ctx;
  const steps = d.today.steps ?? 0;
  const goal = d.today.stepGoal;
  return (
    <Card>
      <CardHeader
        title={t.steps.title}
        icon={<Footprints />}
        href="/cardio"
        action={
          <QuickAddButton kind="steps" variant="ghost" size="icon-sm" aria-label={t.dashboard.stepsAdd}>
            <Plus />
          </QuickAddButton>
        }
      />
      <div className="flex items-baseline gap-1.5">
        <Metric value={fmt.int(steps)} />
        <span className="text-sm text-fg-3">/ {fmt.int(goal)}</span>
      </div>
      <Meter className="mt-3" value={steps} max={goal} color="var(--series-5)" showOverflow={false} label={t.steps.title} />
      <p className="mt-2 text-xs text-fg-3">{steps >= goal ? `✓ ${t.steps.goal}` : `${fmt.int(Math.max(0, goal - steps))} ${t.common.remaining.toLowerCase()}`}</p>
    </Card>
  );
}

export function CardioCard({ d, ctx }: P) {
  const { t, fmt } = ctx;
  const sessions = d.todaysCardio;
  const seconds = sessions.reduce((a, s) => a + s.durationSeconds, 0);
  const distance = sessions.reduce((a, s) => a + (s.distanceM ?? 0), 0);
  const kcal = sessions.reduce((a, s) => a + (s.calories ?? 0), 0);
  const goal = ctx.prefs.goals.cardioMinutesPerWeek;
  return (
    <Card>
      <CardHeader
        title={t.nav.cardio}
        icon={<HeartPulse />}
        href="/cardio"
        action={
          <QuickAddButton kind="cardio" variant="ghost" size="icon-sm" aria-label={t.dashboard.logCardio}>
            <Plus />
          </QuickAddButton>
        }
      />
      {sessions.length ? (
        <div className="grid grid-cols-3 gap-2">
          <div>
            <div className="text-xs text-fg-3">{t.cardio.duration}</div>
            <div className="mt-0.5 text-lg font-semibold">{fmt.duration(seconds)}</div>
          </div>
          <div>
            <div className="text-xs text-fg-3">{t.cardio.distance}</div>
            <div className="mt-0.5 text-lg font-semibold">{distance ? fmt.distance(distance, 1) : "—"}</div>
          </div>
          <div>
            <div className="text-xs text-fg-3">{t.cardio.calories}</div>
            <div className="mt-0.5 text-lg font-semibold">{kcal ? fmt.int(kcal) : "—"}</div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-fg-3">{t.dashboard.noCardioToday}</p>
      )}
      <div className="mt-3 border-t border-border pt-3">
        <div className="mb-1.5 flex justify-between text-xs">
          <span className="text-fg-3">{t.dashboard.cardioWeek}</span>
          <span className="font-medium tabular">
            {fmt.int(d.weekCardioMinutes)} / {fmt.int(goal)} {t.common.minutesShort}
          </span>
        </div>
        <Meter value={d.weekCardioMinutes} max={goal} color="var(--series-4)" height={6} showOverflow={false} label={t.dashboard.cardioWeek} />
      </div>
    </Card>
  );
}

export function WaterCard({ d, ctx }: P) {
  const { t } = ctx;
  return (
    <Card>
      <CardHeader title={t.water.title} icon={<GlassWater />} href="/habits/water" />
      <WaterQuickAdd totalMl={d.today.waterMl} />
    </Card>
  );
}

export function HabitsCard({ d, ctx }: P) {
  const { t } = ctx;
  const f = (tpl: string, p: Record<string, string | number>) => format(tpl, p, ctx.locale);
  const applicable = d.habits.filter((h) => h.doneToday != null || h.type === "manual");
  const done = applicable.filter((h) => h.doneToday).length;
  return (
    <Card>
      <CardHeader title={t.habits.title} icon={<ListChecks />} href="/habits" action={<span className="text-xs font-medium text-fg-3 tabular">{f(t.dashboard.habitsDone, { done, total: applicable.length })}</span>} />
      {d.habits.length === 0 ? (
        <p className="text-sm text-fg-3">{t.habits.emptyBody}</p>
      ) : (
        <ul className="-my-1 divide-y divide-border">
          {d.habits.map((h) => {
            const label = h.type === "auto" && h.autoMetric ? h.name || t.enums.autoHabit[h.autoMetric as keyof typeof t.enums.autoHabit] : h.name;
            return (
              <li key={h.id} className="flex items-center gap-3 py-2">
                <HabitCheck habitId={h.id} date={ctx.today} done={h.doneToday} manual={h.type === "manual"} label={label} />
                <span className={cn("min-w-0 flex-1 truncate text-sm", h.doneToday ? "text-fg-3" : "text-fg")}>{label}</span>
                {h.type === "auto" && <span className="text-[10px] font-medium tracking-wide text-fg-3 uppercase">{t.habits.autoBadge}</span>}
                {h.streak > 1 && (
                  <span className="inline-flex items-center gap-0.5 text-xs text-fg-3 tabular" title={t.habits.currentStreak}>
                    <Flame className="size-3" aria-hidden />
                    {h.streak}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export function WeeklyCard({ d, ctx }: P) {
  const { t, fmt } = ctx;
  const days = d.last7;
  const labels = days.map((x) => fmt.weekdayNarrow(weekday(x.date)));
  const target = days.at(-1)?.nutrition.target?.calories ?? null;
  return (
    <Card className="sm:col-span-2">
      <CardHeader title={t.dashboard.weeklyTrendTitle} icon={<Timer />} href="/analytics" />
      <div className="grid gap-5 sm:grid-cols-3">
        <div>
          <div className="mb-2 flex items-baseline justify-between text-xs">
            <span className="font-medium text-fg-2">{t.weight.title}</span>
            <span className="text-fg-3 tabular">{d.stats.avg7 != null ? fmt.weight(d.stats.avg7) : "—"}</span>
          </div>
          <Sparkline values={days.map((x) => x.weightKg)} height={44} ariaLabel={t.weight.title} />
          <div className="mt-1 flex">
            {labels.map((l, i) => (
              <span key={i} className="flex-1 text-center text-[10px] text-fg-3">
                {l}
              </span>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-baseline justify-between text-xs">
            <span className="font-medium text-fg-2">{t.nutrition.calories}</span>
            <span className="text-fg-3 tabular">{target ? `${t.nutrition.target} ${fmt.int(target)}` : ""}</span>
          </div>
          <MiniBars values={days.map((x) => (x.nutrition.entries ? x.nutrition.totals.calories : null))} target={target} labels={labels} ariaLabel={t.nutrition.calories} />
        </div>
        <div>
          <div className="mb-2 flex items-baseline justify-between text-xs">
            <span className="font-medium text-fg-2">{t.steps.title}</span>
            <span className="text-fg-3 tabular">
              {t.steps.goal} {fmt.int(d.today.stepGoal)}
            </span>
          </div>
          <MiniBars values={days.map((x) => x.steps)} target={d.today.stepGoal} labels={labels} ariaLabel={t.steps.title} />
        </div>
      </div>
    </Card>
  );
}

export function InsightRow({ insight, ctx }: { insight: Insight; ctx: UserContext }) {
  const { t } = ctx;
  const text = format(t.coach.i[insight.id], insight.params, ctx.locale);
  const Icon = insight.tone === "positive" ? CheckCircle2 : insight.tone === "attention" ? CircleAlert : Lightbulb;
  return (
    <li className="flex gap-3">
      <span
        className={cn(
          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg",
          insight.tone === "positive" && "bg-good/12 text-good-text",
          insight.tone === "attention" && "bg-warn/15 text-warn-text",
          insight.tone === "neutral" && "bg-surface-2 text-fg-2",
        )}
      >
        <Icon className="size-4" aria-hidden />
        <span className="sr-only">{t.coach.tone[insight.tone]}</span>
      </span>
      <p className="text-sm leading-relaxed text-fg-2">{text}</p>
    </li>
  );
}

export function InsightsCard({ d, ctx }: P) {
  const { t } = ctx;
  return (
    <Card className="sm:col-span-2 xl:col-span-1">
      <CardHeader title={t.enums.dashboardCard.insights} icon={<Sparkles />} href="/coach" />
      {d.insights.length ? (
        <ul className="space-y-3.5">
          {d.insights.map((i) => (
            <InsightRow key={i.id} insight={i} ctx={ctx} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-fg-3">{t.coach.noInsights}</p>
      )}
    </Card>
  );
}
