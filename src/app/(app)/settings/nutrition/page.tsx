import { DeleteButton } from "@/components/ui/delete-button";
import { MealSlotsForm, NutritionTargetForm, SettingsCard } from "@/components/settings/forms";
import { SettingsFrame } from "@/components/settings/settings-page";
import { suggestCalorieTarget, suggestMacroTargets, targetForDate } from "@/lib/calc/nutrition";
import { deleteNutritionTarget } from "@/server/actions/settings";
import { getUserContext } from "@/server/context";
import { getAnalysis } from "@/server/queries/analysis";
import { getTargets } from "@/server/queries/common";

export default async function NutritionSettingsPage() {
  const ctx = await getUserContext();
  const { t, fmt } = ctx;
  const [targets, analysis] = await Promise.all([getTargets(ctx.userId), getAnalysis(ctx)]);
  const current = targetForDate(targets, ctx.today);
  const e = analysis.energy;
  const tdee = e.adaptive && e.adaptive.confidence !== "low" ? e.adaptive.tdee : e.formula?.tdee;
  const bw = e.stats.current;
  const suggestion = tdee && bw ? suggestMacroTargets(suggestCalorieTarget(tdee, ctx.profile.primaryGoal), bw, ctx.profile.primaryGoal) : null;
  return (
    <SettingsFrame section="nutrition">
      <SettingsCard title={t.nutrition.targets.title}>
        <NutritionTargetForm initial={current} suggestion={suggestion} />
      </SettingsCard>
      {targets.length > 0 && (
        <SettingsCard title={t.common.history}>
          <ul className="divide-y divide-border">
            {[...targets].reverse().map((x) => (
              <li key={x.id} className="flex items-center gap-3 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{fmt.date(x.effectiveFrom, "medium")}</div>
                  <div className="text-xs text-fg-3 tabular">
                    {t.nutrition.protein} {fmt.int(x.proteinG)} g · {t.nutrition.carbs} {fmt.int(x.carbsG)} g · {t.nutrition.fat} {fmt.int(x.fatG)} g · {t.nutrition.fiber} {fmt.int(x.fiberG)} g
                  </div>
                </div>
                <span className="font-semibold tabular">{fmt.kcal(x.calories)}</span>
                {targets.length > 1 && <DeleteButton id={x.id} action={deleteNutritionTarget} description={fmt.date(x.effectiveFrom, "medium")} />}
              </li>
            ))}
          </ul>
        </SettingsCard>
      )}
      <SettingsCard title={t.settings.mealNames}>
        <MealSlotsForm initial={ctx.prefs.nutrition} />
      </SettingsCard>
    </SettingsFrame>
  );
}
