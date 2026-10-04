"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { ArrowDown, ArrowUp, Eye, EyeOff, LogOut, Plus, Trash2 } from "lucide-react";
import { useLocale, useT } from "@/components/providers/i18n-provider";
import { useFmt, useToday } from "@/components/providers/prefs-provider";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { NumberInput, Segmented, Select, SwitchRow, formatForInput, parseDecimal } from "@/components/ui/controls";
import { Field, Input } from "@/components/ui/input";
import { caloriesFromMacros } from "@/lib/calc/nutrition";
import { useRun } from "@/lib/client/run-action";
import {
  ACTIVITY_LEVELS,
  DASHBOARD_CARDS,
  LOCALES,
  PRIMARY_GOALS,
  REMINDER_KINDS,
  SCORE_COMPONENTS,
  SEXES,
  THEMES,
  UNIT_SYSTEMS,
  type ActivityLevel,
  type DashboardCard,
  type Locale,
  type PrimaryGoal,
  type ReminderKind,
  type ScoreComponent,
  type Sex,
  type ThemePreference as Theme,
  type UnitSystem,
} from "@/lib/domain";
import { format } from "@/lib/i18n";
import type { GoalsPrefs, MealSlot, NotificationPrefs, TrainingPrefs } from "@/lib/preferences";
import { cmToFeetInches, fromDisplayVolume, fromDisplayWeight, inToCm, toDisplayVolume, toDisplayWeight } from "@/lib/units";
import { changePassword, signOutEverywhere } from "@/server/actions/auth";
import {
  saveDashboardLayout,
  saveGoalsPrefs,
  saveNotificationPrefs,
  saveNutritionPrefs,
  saveNutritionTarget,
  savePreferences,
  saveProfile,
  saveScoringPrefs,
  saveTrainingPrefs,
} from "@/server/actions/settings";

function SaveBar({ pending, disabled }: { pending: boolean; disabled?: boolean }) {
  const t = useT();
  return (
    <div className="pt-2">
      <Button type="submit" variant="primary" loading={pending} disabled={disabled}>
        {t.common.save}
      </Button>
    </div>
  );
}

const num = (v: number | null | undefined, d = 0) => (v == null ? "" : formatForInput(v, d));

// ── Profile ─────────────────────────────────────────────────────────────────

export type ProfileValues = {
  displayName: string | null;
  sex: Sex | null;
  birthDate: string | null;
  heightCm: number | null;
  activityLevel: ActivityLevel;
  primaryGoal: PrimaryGoal;
  trainingDaysPerWeek: number | null;
};

export function ProfileForm({ initial }: { initial: ProfileValues }) {
  const t = useT();
  const ts = t.settings;
  const fmt = useFmt();
  const today = useToday();
  const { run, pending } = useRun();
  const imperial = fmt.units === "imperial";
  const ftIn = initial.heightCm ? cmToFeetInches(initial.heightCm) : null;
  const [name, setName] = React.useState(initial.displayName ?? "");
  const [sex, setSex] = React.useState<Sex | "">(initial.sex ?? "");
  const [birth, setBirth] = React.useState(initial.birthDate ?? "");
  const [cm, setCm] = React.useState(num(initial.heightCm, 1));
  const [ft, setFt] = React.useState(ftIn ? String(ftIn.feet) : "");
  const [inch, setInch] = React.useState(ftIn ? formatForInput(ftIn.inches, 1) : "");
  const [activity, setActivity] = React.useState<ActivityLevel>(initial.activityLevel);
  const [goal, setGoal] = React.useState<PrimaryGoal>(initial.primaryGoal);
  const [days, setDays] = React.useState(num(initial.trainingDaysPerWeek));
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const heightCm = imperial ? (parseDecimal(ft) != null ? inToCm((parseDecimal(ft) ?? 0) * 12 + (parseDecimal(inch) ?? 0)) : null) : parseDecimal(cm);
        const d = parseDecimal(days);
        await run(
          () =>
            saveProfile({
              displayName: name.trim() || null,
              sex: sex || null,
              birthDate: birth || null,
              heightCm: heightCm ? Math.round(heightCm * 10) / 10 : null,
              activityLevel: activity,
              primaryGoal: goal,
              trainingDaysPerWeek: d != null ? Math.round(d) : null,
            }),
          { success: ts.saved },
        );
      }}
    >
      <Field label={ts.displayName} htmlFor="p-name">
        <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="nickname" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={ts.birthDate} htmlFor="p-birth" optional={t.common.optional}>
          <Input id="p-birth" type="date" value={birth} max={today} onChange={(e) => setBirth(e.target.value)} />
        </Field>
        <Field label={ts.height} htmlFor="p-height" optional={t.common.optional}>
          {imperial ? (
            <div className="grid grid-cols-2 gap-2">
              <NumberInput id="p-height" integer value={ft} onValueChange={setFt} suffix={ts.feet} />
              <NumberInput aria-label={ts.inches} value={inch} onValueChange={setInch} suffix={ts.inches} />
            </div>
          ) : (
            <NumberInput id="p-height" value={cm} onValueChange={setCm} suffix="cm" />
          )}
        </Field>
      </div>
      <Field label={ts.sex} hint={ts.sexHint}>
        <Segmented
          block
          value={sex || "skip"}
          onChange={(v) => setSex(v === "skip" ? "" : (v as Sex))}
          ariaLabel={ts.sex}
          options={[...SEXES.map((s) => ({ value: s, label: t.enums.sex[s] })), { value: "skip", label: t.common.skip }]}
        />
      </Field>
      <Field label={ts.activityLevel} htmlFor="p-activity">
        <Select id="p-activity" value={activity} onChange={(e) => setActivity(e.target.value as ActivityLevel)}>
          {ACTIVITY_LEVELS.map((a) => (
            <option key={a} value={a}>
              {t.enums.activity[a]} — {t.enums.activityHint[a]}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={ts.primaryGoal} htmlFor="p-goal">
          <Select id="p-goal" value={goal} onChange={(e) => setGoal(e.target.value as PrimaryGoal)}>
            {PRIMARY_GOALS.map((g) => (
              <option key={g} value={g}>
                {t.enums.primaryGoal[g]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={ts.trainingDays} htmlFor="p-days">
          <NumberInput id="p-days" integer value={days} onValueChange={setDays} />
        </Field>
      </div>
      <SaveBar pending={pending} />
    </form>
  );
}

// ── Preferences ─────────────────────────────────────────────────────────────

export function PreferencesForm({ initial }: { initial: { unitSystem: UnitSystem; locale: Locale; theme: Theme; timezone: string; weekStartsOn: number } }) {
  const t = useT();
  const ts = t.settings;
  const locale = useLocale();
  const router = useRouter();
  const { setTheme } = useTheme();
  const { run, pending } = useRun();
  const [units, setUnits] = React.useState(initial.unitSystem);
  const [lang, setLang] = React.useState(initial.locale);
  const [theme, setThemeValue] = React.useState(initial.theme);
  const [tz, setTz] = React.useState(initial.timezone);
  const [week, setWeek] = React.useState(String(initial.weekStartsOn));
  const deviceTz = React.useSyncExternalStore(
    () => () => {},
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => "",
  );
  const [zones] = React.useState<string[]>(() => {
    try {
      return (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
    } catch {
      return [];
    }
  });
  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await run(() => savePreferences({ unitSystem: units, locale: lang, theme, timezone: tz, weekStartsOn: week === "0" ? 0 : 1 }), { success: ts.saved });
        if (res.ok) {
          setTheme(theme);
          router.refresh();
        }
      }}
    >
      <Field label={ts.units}>
        <Segmented block value={units} onChange={setUnits} ariaLabel={ts.units} options={UNIT_SYSTEMS.map((u) => ({ value: u, label: t.enums.unitSystem[u] }))} />
      </Field>
      <Field label={ts.language}>
        <Segmented block value={lang} onChange={setLang} ariaLabel={ts.language} options={LOCALES.map((l) => ({ value: l, label: t.enums.locale[l] }))} />
      </Field>
      <Field label={ts.theme}>
        <Segmented block value={theme} onChange={setThemeValue} ariaLabel={ts.theme} options={THEMES.map((x) => ({ value: x, label: t.enums.theme[x] }))} />
      </Field>
      <Field label={ts.timezone} htmlFor="pref-tz" hint={ts.timezoneHint}>
        {zones.length ? (
          <Select id="pref-tz" value={tz} onChange={(e) => setTz(e.target.value)}>
            {!zones.includes(tz) && <option value={tz}>{tz}</option>}
            {zones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </Select>
        ) : (
          <Input id="pref-tz" value={tz} onChange={(e) => setTz(e.target.value)} />
        )}
      </Field>
      {deviceTz && deviceTz !== tz && (
        <Button type="button" variant="link" size="sm" className="-mt-3 px-0" onClick={() => setTz(deviceTz)}>
          {format(ts.useDeviceTimezone, { tz: deviceTz }, locale)}
        </Button>
      )}
      <Field label={ts.weekStartsOn}>
        <Segmented
          block
          value={week}
          onChange={setWeek}
          ariaLabel={ts.weekStartsOn}
          options={[
            { value: "1", label: ts.monday },
            { value: "0", label: ts.sunday },
          ]}
        />
      </Field>
      <SaveBar pending={pending} />
    </form>
  );
}

// ── Activity goals ──────────────────────────────────────────────────────────

export function ActivityGoalsForm({ initial }: { initial: GoalsPrefs }) {
  const t = useT();
  const ts = t.settings;
  const fmt = useFmt();
  const { run, pending } = useRun();
  const [steps, setSteps] = React.useState(String(initial.stepGoal));
  const [water, setWater] = React.useState(formatForInput(toDisplayVolume(initial.waterGoalMl, fmt.units), fmt.units === "imperial" ? 0 : 0));
  const [sleepH, setSleepH] = React.useState(String(Math.floor(initial.sleepGoalMinutes / 60)));
  const [sleepM, setSleepM] = React.useState(String(initial.sleepGoalMinutes % 60));
  const [cardio, setCardio] = React.useState(String(initial.cardioMinutesPerWeek));
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        await run(
          () =>
            saveGoalsPrefs({
              stepGoal: Math.round(parseDecimal(steps) ?? 0),
              waterGoalMl: Math.round(fromDisplayVolume(parseDecimal(water) ?? 0, fmt.units)),
              sleepGoalMinutes: Math.round((parseDecimal(sleepH) ?? 0) * 60 + (parseDecimal(sleepM) ?? 0)),
              cardioMinutesPerWeek: Math.round(parseDecimal(cardio) ?? 0),
            }),
          { success: ts.saved },
        );
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={ts.stepGoal} htmlFor="g-steps">
          <NumberInput id="g-steps" integer value={steps} onValueChange={setSteps} step={500} stepper />
        </Field>
        <Field label={ts.waterGoal} htmlFor="g-water">
          <NumberInput id="g-water" integer value={water} onValueChange={setWater} suffix={fmt.volumeUnit} />
        </Field>
        <Field label={ts.sleepGoal} htmlFor="g-sleep">
          <div className="grid grid-cols-2 gap-2">
            <NumberInput id="g-sleep" integer value={sleepH} onValueChange={setSleepH} suffix={t.common.hoursShort} />
            <NumberInput aria-label={t.common.minutesShort} integer value={sleepM} onValueChange={setSleepM} suffix={t.common.minutesShort} />
          </div>
        </Field>
        <Field label={ts.cardioGoal} htmlFor="g-cardio">
          <NumberInput id="g-cardio" integer value={cardio} onValueChange={setCardio} suffix={t.common.minutesShort} />
        </Field>
      </div>
      <SaveBar pending={pending} />
    </form>
  );
}

// ── Training ────────────────────────────────────────────────────────────────

export function TrainingPrefsForm({ initial }: { initial: TrainingPrefs }) {
  const t = useT();
  const ts = t.settings;
  const fmt = useFmt();
  const { run, pending } = useRun();
  const w = (kg: number) => formatForInput(toDisplayWeight(kg, fmt.units), 2);
  const [v, setV] = React.useState({
    rest: String(initial.defaultRestSeconds),
    repMin: String(initial.defaultRepMin),
    repMax: String(initial.defaultRepMax),
    upper: w(initial.incrementUpperKg),
    lower: w(initial.incrementLowerKg),
    iso: w(initial.incrementIsolationKg),
    rounding: w(initial.roundingKg),
    planned: String(initial.plannedWorkoutsPerWeek),
  });
  const [flags, setFlags] = React.useState({ autoStartRest: initial.autoStartRest, restSound: initial.restSound, restVibrate: initial.restVibrate, includeWarmupsInVolume: initial.includeWarmupsInVolume });
  const [effort, setEffort] = React.useState(initial.effortMetric);
  const set = (k: keyof typeof v) => (x: string) => setV((s) => ({ ...s, [k]: x }));
  const kg = (x: string, fallback: number) => {
    const n = parseDecimal(x);
    return n != null && n > 0 ? Math.round(fromDisplayWeight(n, fmt.units) * 1000) / 1000 : fallback;
  };
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        await run(
          () =>
            saveTrainingPrefs({
              defaultRestSeconds: Math.round(parseDecimal(v.rest) ?? initial.defaultRestSeconds),
              ...flags,
              effortMetric: effort,
              defaultRepMin: Math.round(parseDecimal(v.repMin) ?? initial.defaultRepMin),
              defaultRepMax: Math.round(parseDecimal(v.repMax) ?? initial.defaultRepMax),
              incrementUpperKg: kg(v.upper, initial.incrementUpperKg),
              incrementLowerKg: kg(v.lower, initial.incrementLowerKg),
              incrementIsolationKg: kg(v.iso, initial.incrementIsolationKg),
              roundingKg: kg(v.rounding, initial.roundingKg),
              plannedWorkoutsPerWeek: Math.round(parseDecimal(v.planned) ?? initial.plannedWorkoutsPerWeek),
            }),
          { success: ts.saved },
        );
      }}
    >
      <Field label={ts.restTimer} htmlFor="t-rest">
        <NumberInput id="t-rest" integer value={v.rest} onValueChange={set("rest")} suffix="s" step={15} stepper />
      </Field>
      <div className="divide-y divide-border">
        <SwitchRow label={ts.autoStartRest} checked={flags.autoStartRest} onCheckedChange={(x) => setFlags((f) => ({ ...f, autoStartRest: x }))} />
        <SwitchRow label={ts.restSound} checked={flags.restSound} onCheckedChange={(x) => setFlags((f) => ({ ...f, restSound: x }))} />
        <SwitchRow label={ts.restVibrate} checked={flags.restVibrate} onCheckedChange={(x) => setFlags((f) => ({ ...f, restVibrate: x }))} />
        <SwitchRow label={ts.includeWarmups} checked={flags.includeWarmupsInVolume} onCheckedChange={(x) => setFlags((f) => ({ ...f, includeWarmupsInVolume: x }))} />
      </div>
      <Field label={ts.effortMetric}>
        <Segmented
          block
          value={effort}
          onChange={setEffort}
          ariaLabel={ts.effortMetric}
          options={[
            { value: "rir", label: "RIR" },
            { value: "rpe", label: "RPE" },
          ]}
        />
      </Field>
      <Field label={ts.repRangeDefault}>
        <div className="grid grid-cols-2 gap-2">
          <NumberInput aria-label="min" integer value={v.repMin} onValueChange={set("repMin")} />
          <NumberInput aria-label="max" integer value={v.repMax} onValueChange={set("repMax")} />
        </div>
      </Field>
      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-semibold">{ts.increments}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={ts.incrementUpper} htmlFor="t-up">
            <NumberInput id="t-up" value={v.upper} onValueChange={set("upper")} suffix={fmt.weightUnit} />
          </Field>
          <Field label={ts.incrementLower} htmlFor="t-low">
            <NumberInput id="t-low" value={v.lower} onValueChange={set("lower")} suffix={fmt.weightUnit} />
          </Field>
          <Field label={ts.incrementIsolation} htmlFor="t-iso">
            <NumberInput id="t-iso" value={v.iso} onValueChange={set("iso")} suffix={fmt.weightUnit} />
          </Field>
          <Field label={ts.rounding} htmlFor="t-round">
            <NumberInput id="t-round" value={v.rounding} onValueChange={set("rounding")} suffix={fmt.weightUnit} />
          </Field>
        </div>
      </fieldset>
      <Field label={ts.plannedPerWeek} htmlFor="t-planned">
        <NumberInput id="t-planned" integer value={v.planned} onValueChange={set("planned")} className="max-w-40" />
      </Field>
      <SaveBar pending={pending} />
    </form>
  );
}

// ── Nutrition ───────────────────────────────────────────────────────────────

export function NutritionTargetForm({
  initial,
  suggestion,
}: {
  initial: { calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number; sugarG: number | null; sodiumMg: number | null } | null;
  suggestion?: { calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number } | null;
}) {
  const t = useT();
  const tn = t.nutrition;
  const locale = useLocale();
  const fmt = useFmt();
  const today = useToday();
  const { run, pending } = useRun();
  const [from, setFrom] = React.useState(today);
  const [v, setV] = React.useState({
    calories: num(initial?.calories),
    proteinG: num(initial?.proteinG),
    carbsG: num(initial?.carbsG),
    fatG: num(initial?.fatG),
    fiberG: num(initial?.fiberG),
    sugarG: num(initial?.sugarG),
    sodiumMg: num(initial?.sodiumMg),
  });
  const set = (k: keyof typeof v) => (x: string) => setV((s) => ({ ...s, [k]: x }));
  const macroKcal = caloriesFromMacros({ proteinG: parseDecimal(v.proteinG) ?? 0, carbsG: parseDecimal(v.carbsG) ?? 0, fatG: parseDecimal(v.fatG) ?? 0 });
  const kcal = parseDecimal(v.calories);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (kcal == null) return;
        await run(
          () =>
            saveNutritionTarget({
              effectiveFrom: from,
              calories: Math.round(kcal),
              proteinG: parseDecimal(v.proteinG) ?? 0,
              carbsG: parseDecimal(v.carbsG) ?? 0,
              fatG: parseDecimal(v.fatG) ?? 0,
              fiberG: parseDecimal(v.fiberG) ?? 0,
              sugarG: parseDecimal(v.sugarG),
              sodiumMg: parseDecimal(v.sodiumMg),
            }),
          { success: tn.targets.saved },
        );
      }}
    >
      {suggestion && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() =>
            setV((s) => ({ ...s, calories: String(suggestion.calories), proteinG: String(suggestion.proteinG), carbsG: String(suggestion.carbsG), fatG: String(suggestion.fatG), fiberG: String(suggestion.fiberG) }))
          }
        >
          {t.goals.suggestTarget}: {fmt.kcal(suggestion.calories)}
        </Button>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label={tn.calories} htmlFor="nt-kcal">
          <NumberInput id="nt-kcal" integer value={v.calories} onValueChange={set("calories")} suffix="kcal" required />
        </Field>
        <Field label={tn.protein} htmlFor="nt-p">
          <NumberInput id="nt-p" value={v.proteinG} onValueChange={set("proteinG")} suffix="g" />
        </Field>
        <Field label={tn.carbs} htmlFor="nt-c">
          <NumberInput id="nt-c" value={v.carbsG} onValueChange={set("carbsG")} suffix="g" />
        </Field>
        <Field label={tn.fat} htmlFor="nt-f">
          <NumberInput id="nt-f" value={v.fatG} onValueChange={set("fatG")} suffix="g" />
        </Field>
        <Field label={tn.fiber} htmlFor="nt-fi">
          <NumberInput id="nt-fi" value={v.fiberG} onValueChange={set("fiberG")} suffix="g" />
        </Field>
        <Field label={tn.sugar} htmlFor="nt-s" optional={t.common.optional}>
          <NumberInput id="nt-s" value={v.sugarG} onValueChange={set("sugarG")} suffix="g" />
        </Field>
        <Field label={tn.sodium} htmlFor="nt-na" optional={t.common.optional}>
          <NumberInput id="nt-na" integer value={v.sodiumMg} onValueChange={set("sodiumMg")} suffix="mg" />
        </Field>
        <Field label={tn.targets.effectiveFrom} htmlFor="nt-from">
          <Input id="nt-from" type="date" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} />
        </Field>
      </div>
      <p className="text-[13px] text-fg-3">
        {format(tn.targets.macroEnergy, { kcal: fmt.int(macroKcal) }, locale)}
        {kcal != null && macroKcal > 0 && Math.abs(macroKcal - kcal) > Math.max(50, kcal * 0.08) && ` · ${tn.calories}: ${fmt.int(kcal)}`}
      </p>
      <p className="text-[13px] text-fg-3">{tn.targets.historyHint}</p>
      <SaveBar pending={pending} disabled={kcal == null} />
    </form>
  );
}

export function MealSlotsForm({ initial }: { initial: { mealSlots: MealSlot[]; showSugar: boolean; showSodium: boolean } }) {
  const t = useT();
  const ts = t.settings;
  const { run, pending } = useRun();
  const [slots, setSlots] = React.useState(initial.mealSlots.map((s) => ({ ...s, name: s.name ?? "" })));
  const [sugar, setSugar] = React.useState(initial.showSugar);
  const [sodium, setSodium] = React.useState(initial.showSodium);
  const fallback = (id: string) => (t.enums.meal as Record<string, string>)[id] ?? "";
  const move = (i: number, d: -1 | 1) =>
    setSlots((s) => {
      const n = [...s];
      const j = i + d;
      if (j < 0 || j >= n.length) return s;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        await run(() => saveNutritionPrefs({ mealSlots: slots.map((s) => ({ id: s.id, name: s.name.trim() || null })), showSugar: sugar, showSodium: sodium }), { success: ts.saved });
      }}
    >
      <p className="text-[13px] text-fg-3">{ts.mealNamesHint}</p>
      <ul className="space-y-2">
        {slots.map((s, i) => (
          <li key={s.id} className="flex items-center gap-2">
            <Input
              aria-label={ts.mealNames}
              value={s.name}
              placeholder={fallback(s.id)}
              maxLength={40}
              onChange={(e) => setSlots((list) => list.map((x) => (x.id === s.id ? { ...x, name: e.target.value } : x)))}
              required={!fallback(s.id)}
            />
            <Button type="button" variant="ghost" size="icon-sm" aria-label={t.common.moveUp} disabled={i === 0} onClick={() => move(i, -1)}>
              <ArrowUp />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={t.common.moveDown} disabled={i === slots.length - 1} onClick={() => move(i, 1)}>
              <ArrowDown />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={t.common.remove} disabled={slots.length <= 1} onClick={() => setSlots((list) => list.filter((x) => x.id !== s.id))}>
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
      {slots.length < 8 && (
        <Button type="button" variant="secondary" size="sm" onClick={() => setSlots((s) => [...s, { id: `meal_${Math.random().toString(36).slice(2, 8)}`, name: "" }])}>
          <Plus aria-hidden />
          {ts.addMeal}
        </Button>
      )}
      <div className="divide-y divide-border">
        <SwitchRow label={ts.showSugar} checked={sugar} onCheckedChange={setSugar} />
        <SwitchRow label={ts.showSodium} checked={sodium} onCheckedChange={setSodium} />
      </div>
      <SaveBar pending={pending} />
    </form>
  );
}

// ── Dashboard & score ───────────────────────────────────────────────────────

export function DashboardPrefsForm({
  order: initialOrder,
  hidden: initialHidden,
  scoring,
}: {
  order: DashboardCard[];
  hidden: DashboardCard[];
  scoring: { enabled: boolean; weights: Record<ScoreComponent, number> };
}) {
  const t = useT();
  const ts = t.settings;
  const { run, pending } = useRun();
  const [order, setOrder] = React.useState<DashboardCard[]>([...initialOrder, ...DASHBOARD_CARDS.filter((c) => !initialOrder.includes(c))]);
  const [hidden, setHidden] = React.useState<DashboardCard[]>(initialHidden);
  const [enabled, setEnabled] = React.useState(scoring.enabled);
  const [weights, setWeights] = React.useState(scoring.weights);
  const move = (i: number, d: -1 | 1) =>
    setOrder((s) => {
      const n = [...s];
      const j = i + d;
      if (j < 0 || j >= n.length) return s;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  return (
    <form
      className="space-y-6"
      onSubmit={async (e) => {
        e.preventDefault();
        const a = await run(() => saveDashboardLayout({ order, hidden }), { silent: true });
        if (a.ok) await run(() => saveScoringPrefs({ enabled, weights }), { success: ts.saved });
      }}
    >
      <section>
        <h3 className="mb-2 text-sm font-semibold">{ts.cardOrder}</h3>
        <ul className="divide-y divide-border rounded-xl border border-border">
          {order.map((c, i) => {
            const off = hidden.includes(c);
            return (
              <li key={c} className="flex items-center gap-2 px-3 py-2">
                <span className={off ? "flex-1 text-sm text-fg-3 line-through" : "flex-1 text-sm"}>{t.enums.dashboardCard[c]}</span>
                <Button type="button" variant="ghost" size="icon-sm" aria-pressed={!off} aria-label={off ? t.common.show : t.common.hide} onClick={() => setHidden((h) => (off ? h.filter((x) => x !== c) : [...h, c]))}>
                  {off ? <EyeOff /> : <Eye />}
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" aria-label={t.common.moveUp} disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp />
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" aria-label={t.common.moveDown} disabled={i === order.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown />
                </Button>
              </li>
            );
          })}
        </ul>
      </section>
      <section>
        <SwitchRow label={ts.scoreEnabled} checked={enabled} onCheckedChange={setEnabled} />
        <h3 className="mt-2 text-sm font-semibold">{ts.scoreWeights}</h3>
        <p className="mb-3 text-[13px] text-fg-3">{ts.scoreWeightsHint}</p>
        <ul className="space-y-2">
          {SCORE_COMPONENTS.map((c) => (
            <li key={c} className="flex items-center justify-between gap-3">
              <span className="text-sm">{t.enums.scoreComponent[c]}</span>
              <Segmented
                size="sm"
                value={String(weights[c] ?? 0)}
                onChange={(v) => setWeights((w) => ({ ...w, [c]: Number(v) }))}
                ariaLabel={t.enums.scoreComponent[c]}
                options={["0", "1", "2", "3", "4", "5"].map((x) => ({ value: x, label: x }))}
              />
            </li>
          ))}
        </ul>
      </section>
      <SaveBar pending={pending} />
    </form>
  );
}

// ── Notifications (preferences) ─────────────────────────────────────────────

export function NotificationPrefsForm({ initial }: { initial: NotificationPrefs }) {
  const t = useT();
  const tn = t.notifications;
  const { run, pending } = useRun();
  const [enabled, setEnabled] = React.useState(initial.enabled);
  const [rem, setRem] = React.useState(initial.reminders);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        await run(() => saveNotificationPrefs({ enabled, reminders: rem }), { success: t.settings.saved });
      }}
    >
      <SwitchRow label={tn.enable} description={tn.intro} checked={enabled} onCheckedChange={setEnabled} />
      <ul className={enabled ? "divide-y divide-border" : "pointer-events-none divide-y divide-border opacity-50"}>
        {REMINDER_KINDS.map((k: ReminderKind) => (
          <li key={k} className="flex items-center gap-3 py-2">
            <div className="flex-1">
              <SwitchRow label={t.enums.reminder[k]} checked={rem[k].enabled} onCheckedChange={(x) => setRem((r) => ({ ...r, [k]: { ...r[k], enabled: x } }))} />
            </div>
            <Input
              type="time"
              aria-label={`${t.enums.reminder[k]} · ${tn.reminderTime}`}
              value={rem[k].time}
              onChange={(e) => e.target.value && setRem((r) => ({ ...r, [k]: { ...r[k], time: e.target.value } }))}
              className="w-28"
            />
          </li>
        ))}
      </ul>
      <p className="text-[13px] text-fg-3">{tn.cronHint}</p>
      <SaveBar pending={pending} />
    </form>
  );
}

// ── Account ─────────────────────────────────────────────────────────────────

export function PasswordForm() {
  const t = useT();
  const { run, pending } = useRun();
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await run(() => changePassword({ current, next }), { success: t.auth.passwordChanged });
        if (res.ok) {
          setCurrent("");
          setNext("");
        }
      }}
    >
      <Field label={t.auth.currentPassword} htmlFor="pw-current">
        <Input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
      </Field>
      <Field label={t.auth.newPassword} htmlFor="pw-next" hint={t.auth.passwordTooShort}>
        <Input id="pw-next" type="password" autoComplete="new-password" minLength={10} value={next} onChange={(e) => setNext(e.target.value)} required />
      </Field>
      <SaveBar pending={pending} disabled={next.length < 10 || !current} />
    </form>
  );
}

export function SignOutOthersButton() {
  const t = useT();
  const { run, pending } = useRun();
  return (
    <Button variant="secondary" loading={pending} onClick={() => run(() => signOutEverywhere({}), { success: t.auth.signedOutEverywhere })}>
      <LogOut aria-hidden />
      {t.auth.signOutEverywhere}
    </Button>
  );
}

export function SettingsCard({ title, children, description }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} subtitle={description} />
      {children}
    </Card>
  );
}
