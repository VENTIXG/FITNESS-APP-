"use client";

import * as React from "react";
import { useT } from "@/components/providers/i18n-provider";
import { useFmt, usePrefs, useToday } from "@/components/providers/prefs-provider";
import { Button } from "@/components/ui/button";
import { formatForInput, NumberInput, parseDecimal, Select } from "@/components/ui/controls";
import { Field, Input, Textarea } from "@/components/ui/input";
import { useRun } from "@/lib/client/run-action";
import { addDays } from "@/lib/dates";
import { BODY_FAT_METHODS, CARDIO_ACTIVITIES, MEASUREMENT_SITES, type BodyFatMethod, type CardioActivity, type MeasurementSite } from "@/lib/domain";
import {
  fromDisplayDistance,
  fromDisplayLength,
  fromDisplaySpeed,
  fromDisplayWeight,
  paceSeconds,
  toDisplayDistance,
  toDisplayLength,
  toDisplaySpeed,
} from "@/lib/units";
import { getMeasurementsForDate, saveBodyComposition, saveMeasurements } from "@/server/actions/body";
import { createCardio, updateCardio } from "@/server/actions/cardio";

const num = (s: string) => parseDecimal(s);

// ── Cardio ────────────────────────────────────────────────────────────────

export type CardioInitial = {
  id: string;
  date: string;
  activity: CardioActivity;
  durationSeconds: number;
  distanceM: number | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  calories: number | null;
  inclinePct: number | null;
  speedKmh: number | null;
  notes: string | null;
};

export function CardioForm({ onDone, initial }: { onDone?: () => void; initial?: CardioInitial }) {
  const t = useT();
  const fmt = useFmt();
  const prefs = usePrefs();
  const today = useToday();
  const { run, pending } = useRun();
  const sep = fmt.locale === "el" ? "," : ".";
  const [activity, setActivity] = React.useState<CardioActivity>(initial?.activity ?? "walking");
  const [date, setDate] = React.useState(initial?.date ?? today);
  const d = initial?.durationSeconds ?? 0;
  const [h, setH] = React.useState(d ? String(Math.floor(d / 3600)) : "");
  const [m, setM] = React.useState(d ? String(Math.floor((d % 3600) / 60)) : "");
  const [s, setS] = React.useState(d % 60 ? String(d % 60) : "");
  const [distance, setDistance] = React.useState(initial?.distanceM != null ? formatForInput(toDisplayDistance(initial.distanceM, prefs.unitSystem), 2, sep) : "");
  const [hr, setHr] = React.useState(initial?.avgHeartRate ? String(initial.avgHeartRate) : "");
  const [maxHr, setMaxHr] = React.useState(initial?.maxHeartRate ? String(initial.maxHeartRate) : "");
  const [cal, setCal] = React.useState(initial?.calories ? String(initial.calories) : "");
  const [incline, setIncline] = React.useState(initial?.inclinePct != null ? formatForInput(initial.inclinePct, 1, sep) : "");
  const [speed, setSpeed] = React.useState(initial?.speedKmh != null ? formatForInput(toDisplaySpeed(initial.speedKmh, prefs.unitSystem), 1, sep) : "");
  const [notes, setNotes] = React.useState(initial?.notes ?? "");

  const duration = (num(h) ?? 0) * 3600 + (num(m) ?? 0) * 60 + (num(s) ?? 0);
  const distM = num(distance) != null ? fromDisplayDistance(num(distance)!, prefs.unitSystem) : null;
  const pace = duration > 0 ? paceSeconds(duration, distM, prefs.unitSystem) : null;
  const machine = ["treadmill", "stationary_bike", "elliptical", "stairmaster"].includes(activity);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (duration <= 0) return;
        const payload = {
          date,
          activity,
          durationSeconds: Math.round(duration),
          distanceM: distM,
          avgHeartRate: num(hr) != null ? Math.round(num(hr)!) : null,
          maxHeartRate: num(maxHr) != null ? Math.round(num(maxHr)!) : null,
          calories: num(cal) != null ? Math.round(num(cal)!) : null,
          inclinePct: num(incline),
          speedKmh: num(speed) != null ? fromDisplaySpeed(num(speed)!, prefs.unitSystem) : null,
          notes,
        };
        const res = initial
          ? await run(() => updateCardio({ id: initial.id, ...payload }), { success: t.cardio.saved })
          : await run(() => createCardio(payload), { success: t.cardio.saved });
        if (res.ok) onDone?.();
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label={t.cardio.activity} htmlFor="c-activity">
          <Select id="c-activity" value={activity} onChange={(e) => setActivity(e.target.value as CardioActivity)}>
            {CARDIO_ACTIVITIES.map((a) => (
              <option key={a} value={a}>
                {t.enums.cardio[a]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t.common.date} htmlFor="c-date">
          <Input id="c-date" type="date" value={date} max={addDays(today, 1)} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </Field>
      </div>
      <Field label={t.cardio.duration}>
        <div className="grid grid-cols-3 gap-2">
          <NumberInput value={h} onValueChange={setH} integer suffix={t.common.hoursShort} aria-label={t.cardio.hours} />
          <NumberInput value={m} onValueChange={setM} integer suffix={t.common.minutesShort} aria-label={t.cardio.minutes} autoFocus={!initial} />
          <NumberInput value={s} onValueChange={setS} integer suffix="s" aria-label={t.cardio.seconds} />
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t.cardio.distance} optional={t.common.optional}>
          <NumberInput value={distance} onValueChange={setDistance} suffix={fmt.distanceUnit} aria-label={t.cardio.distance} />
        </Field>
        <Field label={t.cardio.pace}>
          <div className="flex h-11 items-center rounded-xl bg-surface-2 px-3.5 text-sm text-fg-2 tabular">{fmt.pace(pace)}</div>
        </Field>
        <Field label={t.cardio.heartRate} optional={t.common.optional}>
          <NumberInput value={hr} onValueChange={setHr} integer suffix={t.cardio.bpm} aria-label={t.cardio.heartRate} />
        </Field>
        <Field label={t.cardio.calories} optional={t.common.optional}>
          <NumberInput value={cal} onValueChange={setCal} integer suffix="kcal" aria-label={t.cardio.calories} />
        </Field>
        {machine && (
          <>
            <Field label={t.cardio.incline} optional={t.common.optional}>
              <NumberInput value={incline} onValueChange={setIncline} suffix="%" aria-label={t.cardio.incline} />
            </Field>
            <Field label={t.cardio.speed} optional={t.common.optional}>
              <NumberInput value={speed} onValueChange={setSpeed} suffix={prefs.unitSystem === "imperial" ? "mph" : "km/h"} aria-label={t.cardio.speed} />
            </Field>
          </>
        )}
        <Field label={t.cardio.maxHeartRate} optional={t.common.optional}>
          <NumberInput value={maxHr} onValueChange={setMaxHr} integer suffix={t.cardio.bpm} aria-label={t.cardio.maxHeartRate} />
        </Field>
      </div>
      <Field label={t.common.notes} htmlFor="c-notes" optional={t.common.optional}>
        <Textarea id="c-notes" rows={2} className="min-h-0" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
      </Field>
      <Button type="submit" variant="primary" size="lg" block loading={pending} disabled={duration <= 0}>
        {t.common.save}
      </Button>
    </form>
  );
}

// ── Measurements ──────────────────────────────────────────────────────────

const siteKeyToCol: Record<MeasurementSite, string> = {
  waist: "waistCm",
  chest: "chestCm",
  neck: "neckCm",
  shoulders: "shouldersCm",
  leftArm: "leftArmCm",
  rightArm: "rightArmCm",
  hips: "hipsCm",
  leftThigh: "leftThighCm",
  rightThigh: "rightThighCm",
  calf: "calfCm",
};

export function MeasurementsForm({ onDone, defaultDate }: { onDone?: () => void; defaultDate?: string }) {
  const t = useT();
  const fmt = useFmt();
  const prefs = usePrefs();
  const today = useToday();
  const { run, pending } = useRun();
  const sep = fmt.locale === "el" ? "," : ".";
  const [date, setDate] = React.useState(defaultDate ?? today);
  const [values, setValues] = React.useState<Record<MeasurementSite, string>>(() => Object.fromEntries(MEASUREMENT_SITES.map((s) => [s, ""])) as Record<MeasurementSite, string>);
  const [note, setNote] = React.useState("");
  const [loadedFor, setLoadedFor] = React.useState<string | null>(null);

  // Prefill existing values for the chosen date so editing is explicit (never a silent overwrite).
  React.useEffect(() => {
    let cancelled = false;
    void getMeasurementsForDate({ date }).then((res) => {
      if (cancelled || !res.ok) return;
      const row = res.data as Record<string, unknown> | null;
      setValues(
        Object.fromEntries(
          MEASUREMENT_SITES.map((s) => {
            const v = row?.[siteKeyToCol[s]] as number | null | undefined;
            return [s, v != null ? formatForInput(toDisplayLength(v, prefs.unitSystem), 1, sep) : ""];
          }),
        ) as Record<MeasurementSite, string>,
      );
      setNote((row?.note as string) ?? "");
      setLoadedFor(row ? date : null);
    });
    return () => {
      cancelled = true;
    };
  }, [date, prefs.unitSystem, sep]);

  const parsed = Object.fromEntries(
    MEASUREMENT_SITES.map((s) => {
      const v = num(values[s]);
      return [s, v != null ? fromDisplayLength(v, prefs.unitSystem) : null];
    }),
  ) as Record<MeasurementSite, number | null>;
  const any = Object.values(parsed).some((v) => v != null);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await run(() => saveMeasurements({ date, note, ...parsed }), { success: t.body.saved });
        if (res.ok) onDone?.();
      }}
    >
      <Field label={t.common.date} htmlFor="m-date" hint={loadedFor ? t.common.edit : undefined}>
        <Input id="m-date" type="date" value={date} max={addDays(today, 1)} onChange={(e) => e.target.value && setDate(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        {MEASUREMENT_SITES.map((site) => (
          <Field key={site} label={t.enums.site[site]}>
            <NumberInput value={values[site]} onValueChange={(v) => setValues((cur) => ({ ...cur, [site]: v }))} suffix={fmt.lengthUnit} aria-label={t.enums.site[site]} />
          </Field>
        ))}
      </div>
      <Field label={t.common.note} htmlFor="m-note" optional={t.common.optional}>
        <Input id="m-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      </Field>
      <Button type="submit" variant="primary" size="lg" block loading={pending} disabled={!any}>
        {t.common.save}
      </Button>
    </form>
  );
}

// ── Body composition ──────────────────────────────────────────────────────

export function BodyCompositionForm({ onDone, latestWeightKg }: { onDone?: () => void; latestWeightKg?: number | null }) {
  const t = useT();
  const fmt = useFmt();
  const prefs = usePrefs();
  const today = useToday();
  const { run, pending } = useRun();
  const [date, setDate] = React.useState(today);
  const [bf, setBf] = React.useState("");
  const [lean, setLean] = React.useState("");
  const [fat, setFat] = React.useState("");
  const [method, setMethod] = React.useState<BodyFatMethod | "">("bia_scale");
  const [note, setNote] = React.useState("");
  const bfN = num(bf);
  const toKg = (s: string) => (num(s) != null ? fromDisplayWeight(num(s)!, prefs.unitSystem) : null);
  const preview = bfN != null && latestWeightKg ? { fat: (latestWeightKg * bfN) / 100, lean: latestWeightKg * (1 - bfN / 100) } : null;
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await run(
          () => saveBodyComposition({ date, bodyFatPct: bfN, leanMassKg: toKg(lean), fatMassKg: toKg(fat), method: method || null, note }),
          { success: t.body.saved },
        );
        if (res.ok) onDone?.();
      }}
    >
      <Field label={t.body.bodyFatPct} htmlFor="bf">
        <NumberInput id="bf" value={bf} onValueChange={setBf} suffix="%" inputClassName="h-14 text-2xl font-semibold" autoFocus />
      </Field>
      {preview && (
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface-2 p-3 text-sm">
          <div>
            <div className="text-xs text-fg-3">{t.body.fatMass}</div>
            <div className="font-semibold">{fmt.weight(preview.fat)}</div>
          </div>
          <div>
            <div className="text-xs text-fg-3">{t.body.leanMass}</div>
            <div className="font-semibold">{fmt.weight(preview.lean)}</div>
          </div>
          <p className="col-span-2 text-xs text-fg-3">{t.body.calculatedFromWeight}</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label={t.body.leanMass} optional={t.common.optional}>
          <NumberInput value={lean} onValueChange={setLean} suffix={fmt.weightUnit} aria-label={t.body.leanMass} />
        </Field>
        <Field label={t.body.fatMass} optional={t.common.optional}>
          <NumberInput value={fat} onValueChange={setFat} suffix={fmt.weightUnit} aria-label={t.body.fatMass} />
        </Field>
        <Field label={t.body.method} htmlFor="bf-method">
          <Select id="bf-method" value={method} onChange={(e) => setMethod(e.target.value as BodyFatMethod)}>
            {BODY_FAT_METHODS.map((m) => (
              <option key={m} value={m}>
                {t.enums.bodyFatMethod[m]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t.common.date} htmlFor="bf-date">
          <Input id="bf-date" type="date" value={date} max={addDays(today, 1)} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </Field>
      </div>
      <Field label={t.common.note} htmlFor="bf-note" optional={t.common.optional}>
        <Input id="bf-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      </Field>
      <Button type="submit" variant="primary" size="lg" block loading={pending} disabled={bfN == null && !num(lean) && !num(fat)}>
        {t.common.save}
      </Button>
    </form>
  );
}
