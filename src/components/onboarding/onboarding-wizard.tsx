"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { Activity, Dumbbell, Flame, HelpCircle, Scale, TriangleAlert, Zap } from "lucide-react";
import { useF, useLocale, useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { NumberInput, parseDecimal, Segmented } from "@/components/ui/controls";
import { Field, Input } from "@/components/ui/input";
import { ageOn, formulaTdee } from "@/lib/calc/body";
import { assessRate, requiredWeeklyRate } from "@/lib/calc/goal";
import { suggestCalorieTarget, suggestMacroTargets } from "@/lib/calc/nutrition";
import { APP_NAME } from "@/lib/config";
import { ACTIVITY_LEVELS, PRIMARY_GOALS, type ActivityLevel, type Locale, type PrimaryGoal, type Sex, type UnitSystem } from "@/lib/domain";
import { createFormatter } from "@/lib/format";
import { fromDisplayVolume, fromDisplayWeight, inToCm } from "@/lib/units";
import { cn } from "@/lib/utils";
import { completeOnboarding, setOnboardingLocale } from "@/server/actions/onboarding";

type Initial = { name: string | null; locale: Locale; unitSystem: UnitSystem; timezone: string; today: string };

const GOAL_ICONS: Record<PrimaryGoal, React.ReactNode> = {
  lose_fat: <Flame />,
  maintain: <Scale />,
  build_muscle: <Dumbbell />,
  performance: <Zap />,
  other: <HelpCircle />,
};

function OptionCard({ selected, onClick, icon, title, hint }: { selected: boolean; onClick: () => void; icon?: React.ReactNode; title: string; hint?: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3.5 rounded-2xl border p-4 text-left transition-all",
        selected ? "border-accent bg-accent-soft ring-1 ring-accent/40" : "border-border bg-surface hover:border-border-strong",
      )}
    >
      {icon && <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl [&_svg]:size-5", selected ? "bg-accent text-accent-fg" : "bg-surface-2 text-fg-2")}>{icon}</span>}
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold text-fg">{title}</span>
        {hint && <span className="mt-0.5 block text-[13px] text-fg-3">{hint}</span>}
      </span>
    </button>
  );
}

export function OnboardingWizard({ initial }: { initial: Initial }) {
  const t = useT();
  const f = useF();
  const locale = useLocale();
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [units, setUnits] = React.useState<UnitSystem>(initial.unitSystem);
  const fmt = React.useMemo(() => createFormatter(locale, units), [locale, units]);
  const [goal, setGoal] = React.useState<PrimaryGoal>("lose_fat");
  const [sex, setSex] = React.useState<Sex | "skip">("skip");
  const [birthDate, setBirthDate] = React.useState("");
  const [heightCm, setHeightCm] = React.useState("");
  const [heightFt, setHeightFt] = React.useState("");
  const [heightIn, setHeightIn] = React.useState("");
  const [weight, setWeight] = React.useState("");
  const [bodyFat, setBodyFat] = React.useState("");
  const [activity, setActivity] = React.useState<ActivityLevel>("moderate");
  const [trainingDays, setTrainingDays] = React.useState("4");
  const [targetWeight, setTargetWeight] = React.useState("");
  const [targetDate, setTargetDate] = React.useState("");
  const [nutritionInput, setNutrition] = React.useState({ calories: "", proteinG: "", carbsG: "", fatG: "", fiberG: "" });
  const [nutritionTouched, setNutritionTouched] = React.useState(false);
  const [steps, setSteps] = React.useState("10000");
  const [water, setWater] = React.useState(initial.unitSystem === "imperial" ? "85" : "2500");
  const [waterTouched, setWaterTouched] = React.useState(false);
  const [loadDemo, setLoadDemo] = React.useState(false);

  const weightKg = parseDecimal(weight) != null ? fromDisplayWeight(parseDecimal(weight)!, units) : null;
  const targetKg = parseDecimal(targetWeight) != null ? fromDisplayWeight(parseDecimal(targetWeight)!, units) : null;
  const height =
    units === "metric"
      ? parseDecimal(heightCm)
      : parseDecimal(heightFt) != null
        ? inToCm((parseDecimal(heightFt) ?? 0) * 12 + (parseDecimal(heightIn) ?? 0))
        : null;
  const bf = parseDecimal(bodyFat);
  const age = birthDate ? ageOn(birthDate, initial.today) : null;
  const tdee = formulaTdee({ weightKg, heightCm: height, age, sex: sex === "skip" ? null : sex, activityLevel: activity, bodyFatPct: bf });

  // Suggested targets are shown until the user edits any of them.
  const suggestedMacros = tdee && weightKg ? suggestMacroTargets(suggestCalorieTarget(tdee.tdee, goal), weightKg, goal) : null;
  const suggested = suggestedMacros
    ? { calories: String(suggestedMacros.calories), proteinG: String(suggestedMacros.proteinG), carbsG: String(suggestedMacros.carbsG), fatG: String(suggestedMacros.fatG), fiberG: String(suggestedMacros.fiberG) }
    : null;
  const nutrition = nutritionTouched || !suggested ? nutritionInput : suggested;

  const required = weightKg && targetKg && targetDate ? requiredWeeklyRate(weightKg, targetKg, initial.today, targetDate) : null;
  const safety = required != null && weightKg ? assessRate(required, weightKg) : null;

  const total = 7;
  const next = () => setStep((s) => Math.min(total - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  async function finish() {
    setSubmitting(true);
    setError(null);
    const num = (s: string) => parseDecimal(s);
    const res = await completeOnboarding({
      primaryGoal: goal,
      sex: sex === "skip" ? null : sex,
      birthDate: birthDate || null,
      heightCm: height,
      weightKg,
      bodyFatPct: bf,
      activityLevel: activity,
      trainingDaysPerWeek: num(trainingDays) != null ? Math.round(num(trainingDays)!) : null,
      targetWeightKg: targetKg,
      targetDate: targetDate || null,
      calories: num(nutrition.calories) != null ? Math.round(num(nutrition.calories)!) : null,
      proteinG: num(nutrition.proteinG) ?? 0,
      carbsG: num(nutrition.carbsG) ?? 0,
      fatG: num(nutrition.fatG) ?? 0,
      fiberG: num(nutrition.fiberG) ?? 0,
      stepGoal: Math.round(num(steps) ?? 10000),
      waterGoalMl: Math.round(fromDisplayVolume(num(water) ?? 2500, units)),
      unitSystem: units,
      locale,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || initial.timezone,
      loadDemo,
    }).catch(() => null);
    // On success the action redirects; we only get here on failure.
    setSubmitting(false);
    setError(res && "error" in res ? t.errors.validation : t.errors.generic);
  }

  const stepTitle = [t.onboarding.preferencesTitle, t.onboarding.goalTitle, t.onboarding.bodyTitle, t.onboarding.activityTitle, t.onboarding.targetTitle, t.onboarding.nutritionTitle, t.onboarding.activityTargetsTitle][step];

  return (
    <div className="rounded-3xl border border-border bg-surface p-5 shadow-pop sm:p-7">
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-xs font-medium text-fg-3">
          <span>{f(t.onboarding.stepOf, { step: step + 1, total })}</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${((step + 1) / total) * 100}%` }} />
        </div>
      </div>

      {step === 0 ? (
        <div className="space-y-5">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{f(t.onboarding.welcomeTitle, { app: APP_NAME })}</h1>
            <p className="mt-2 text-sm leading-relaxed text-fg-3">{t.onboarding.welcomeBody}</p>
          </div>
          <Field label={t.settings.language}>
            <Segmented<Locale>
              block
              value={locale}
              onChange={async (v) => {
                await setOnboardingLocale(v);
                router.refresh();
              }}
              options={[
                { value: "en", label: "English" },
                { value: "el", label: "Ελληνικά" },
              ]}
            />
          </Field>
          <Field label={t.settings.units}>
            <Segmented<UnitSystem>
              block
              value={units}
              onChange={(u) => {
                setUnits(u);
                if (!waterTouched) setWater(u === "imperial" ? "85" : "2500");
              }}
              options={[
                { value: "metric", label: t.enums.unitSystem.metric },
                { value: "imperial", label: t.enums.unitSystem.imperial },
              ]}
            />
          </Field>
        </div>
      ) : (
        <h2 className="mb-5 text-xl font-semibold tracking-tight">{stepTitle}</h2>
      )}

      {step === 1 && (
        <div className="space-y-2.5" role="radiogroup">
          {PRIMARY_GOALS.map((g) => (
            <OptionCard key={g} selected={goal === g} onClick={() => setGoal(g)} icon={GOAL_ICONS[g]} title={t.enums.primaryGoal[g]} />
          ))}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <p className="text-[13px] text-fg-3">{t.onboarding.bodyHint}</p>
          <Field label={t.settings.sex} optional={t.common.optional}>
            <Segmented<Sex | "skip">
              block
              value={sex}
              onChange={setSex}
              options={[
                { value: "male", label: t.enums.sex.male },
                { value: "female", label: t.enums.sex.female },
                { value: "skip", label: t.common.skip },
              ]}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.onboarding.birthDate} htmlFor="ob-birth" optional={t.common.optional}>
              <Input id="ob-birth" type="date" value={birthDate} max={initial.today} onChange={(e) => setBirthDate(e.target.value)} />
            </Field>
            {units === "metric" ? (
              <Field label={t.onboarding.height} optional={t.common.optional}>
                <NumberInput value={heightCm} onValueChange={setHeightCm} suffix="cm" aria-label={t.onboarding.height} />
              </Field>
            ) : (
              <Field label={t.onboarding.height} optional={t.common.optional}>
                <div className="grid grid-cols-2 gap-2">
                  <NumberInput value={heightFt} onValueChange={setHeightFt} integer suffix="ft" aria-label="ft" />
                  <NumberInput value={heightIn} onValueChange={setHeightIn} integer suffix="in" aria-label="in" />
                </div>
              </Field>
            )}
            <Field label={t.onboarding.weight}>
              <NumberInput value={weight} onValueChange={setWeight} suffix={fmt.weightUnit} aria-label={t.onboarding.weight} />
            </Field>
            <Field label={t.onboarding.bodyFatKnown} optional={t.common.optional}>
              <NumberInput value={bodyFat} onValueChange={setBodyFat} suffix="%" aria-label={t.onboarding.bodyFatKnown} />
            </Field>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="space-y-2" role="radiogroup">
            {ACTIVITY_LEVELS.map((a) => (
              <OptionCard key={a} selected={activity === a} onClick={() => setActivity(a)} icon={<Activity />} title={t.enums.activity[a]} hint={t.enums.activityHint[a]} />
            ))}
          </div>
          <Field label={t.onboarding.trainingDays}>
            <Segmented
              block
              value={trainingDays}
              onChange={setTrainingDays}
              options={["0", "1", "2", "3", "4", "5", "6"].map((v) => ({ value: v, label: v }))}
            />
          </Field>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <p className="text-[13px] text-fg-3">{t.onboarding.targetHint}</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.goals.targetWeight} optional={t.common.optional}>
              <NumberInput value={targetWeight} onValueChange={setTargetWeight} suffix={fmt.weightUnit} aria-label={t.goals.targetWeight} />
            </Field>
            <Field label={t.goals.targetDate} htmlFor="ob-tdate" optional={t.common.optional}>
              <Input id="ob-tdate" type="date" value={targetDate} min={initial.today} onChange={(e) => setTargetDate(e.target.value)} />
            </Field>
          </div>
          {required != null && (
            <div className="rounded-2xl bg-surface-2 p-4 text-sm">
              <span className="text-fg-3">{t.goals.requiredRate}: </span>
              <span className="font-semibold">{f(t.weight.ratePerWeek, { value: fmt.weight(required, { signed: true, decimals: 2 }) })}</span>
            </div>
          )}
          {safety && safety.level !== "ok" && (
            <div className="flex gap-3 rounded-2xl border border-warn/30 bg-warn/10 p-4 text-sm leading-relaxed text-fg-2">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn-text" aria-hidden />
              <p>
                {f(safety.level === "very_aggressive" ? t.goals.veryAggressiveWarning : t.goals.aggressiveWarning, {
                  rate: fmt.weight(Math.abs(required!), { decimals: 2 }),
                  pct: fmt.pct(safety.pctPerWeek / 100, 1),
                })}
              </p>
            </div>
          )}
        </div>
      )}

      {step === 5 && (
        <div className="space-y-4">
          <p className="text-[13px] text-fg-3">{t.onboarding.nutritionHint}</p>
          {tdee && <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm">{f(t.onboarding.estimatedTdee, { tdee: fmt.kcal(tdee.tdee) })}</p>}
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ["calories", t.nutrition.calories, "kcal"],
                ["proteinG", t.nutrition.protein, "g"],
                ["carbsG", t.nutrition.carbs, "g"],
                ["fatG", t.nutrition.fat, "g"],
                ["fiberG", t.nutrition.fiber, "g"],
              ] as const
            ).map(([key, label, unit]) => (
              <Field key={key} label={label}>
                <NumberInput
                  value={nutrition[key]}
                  onValueChange={(v) => {
                    setNutritionTouched(true);
                    setNutrition({ ...nutrition, [key]: v });
                  }}
                  integer
                  suffix={unit}
                  aria-label={label}
                />
              </Field>
            ))}
          </div>
        </div>
      )}

      {step === 6 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.settings.stepGoal}>
              <NumberInput value={steps} onValueChange={setSteps} integer aria-label={t.settings.stepGoal} />
            </Field>
            <Field label={t.settings.waterGoal}>
              <NumberInput
                value={water}
                onValueChange={(v) => {
                  setWaterTouched(true);
                  setWater(v);
                }}
                integer
                suffix={fmt.volumeUnit}
                aria-label={t.settings.waterGoal}
              />
            </Field>
          </div>
          <div className="rounded-2xl border border-border p-4">
            <h3 className="text-[15px] font-semibold">{t.onboarding.demoTitle}</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-fg-3">{t.onboarding.demoBody}</p>
            <Segmented
              className="mt-3"
              block
              value={loadDemo ? "yes" : "no"}
              onChange={(v) => setLoadDemo(v === "yes")}
              options={[
                { value: "no", label: t.onboarding.demoNo },
                { value: "yes", label: t.onboarding.demoYes },
              ]}
            />
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm text-critical-text">
          {error}
        </p>
      )}

      <div className="mt-7 flex items-center justify-between gap-3">
        {step > 0 ? (
          <Button variant="ghost" onClick={back} disabled={submitting}>
            {t.common.back}
          </Button>
        ) : (
          <span />
        )}
        {step < total - 1 ? (
          <Button variant="primary" size="lg" onClick={next}>
            {t.common.next}
          </Button>
        ) : (
          <Button variant="accent" size="lg" onClick={finish} loading={submitting}>
            {submitting ? t.onboarding.finishing : t.onboarding.finish}
          </Button>
        )}
      </div>
    </div>
  );
}

