import "server-only";
import { format } from "@/lib/i18n";
import type { UserContext } from "@/server/context";
import type { WeekReport } from "./reports";

/** Plain-language interpretation of a week, built only from logged data. */
export function interpretWeek(ctx: UserContext, r: WeekReport) {
  const { t, fmt, locale } = ctx;
  const i = t.reports.interp;
  const f = (s: string, p: Record<string, string | number>) => format(s, p, locale);
  const out: string[] = [];
  if (r.weightChange == null) out.push(i.weightNoCompare);
  else if (Math.abs(r.weightChange) < 0.1) out.push(i.weightFlat);
  else out.push(f(r.weightChange < 0 ? i.weightDown : i.weightUp, { change: fmt.weight(Math.abs(r.weightChange)) }));
  if (r.foodDays) {
    out.push(
      r.calorieTarget && r.targetDays
        ? f(i.calories, { avg: fmt.kcal(r.avgCalories ?? 0), target: fmt.kcal(r.calorieTarget), pct: fmt.pct(r.calorieHits / r.targetDays) })
        : f(i.caloriesNoTarget, { avg: fmt.kcal(r.avgCalories ?? 0) }),
    );
    if (r.targetDays) out.push(f(i.protein, { hit: r.proteinHits, days: r.targetDays }));
  }
  out.push(r.plannedWorkouts ? f(i.workouts, { done: r.workouts, planned: r.plannedWorkouts }) : f(i.workoutsNoPlan, { done: r.workouts }));
  if (r.avgSteps != null) out.push(f(i.steps, { avg: fmt.int(r.avgSteps) }));
  if (!r.inProgress) out.push(f(i.logging, { days: r.foodDays }));
  if (!r.inProgress && r.foodDays < 4) out.push(i.lowData);
  return out;
}
