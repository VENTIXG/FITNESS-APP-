import "server-only";
import { and, asc, eq } from "drizzle-orm";
import writeXlsxFile from "write-excel-file/node";
import type { UserContext } from "@/server/context";
import { db } from "@/server/db";
import {
  bodyCompositionEntries,
  bodyMeasurements,
  cardioSessions,
  exercises,
  exerciseSets,
  foodEntries,
  stepEntries,
  weightEntries,
  workoutExercises,
  workouts,
} from "@/server/db/schema";

export const EXPORT_CATEGORIES = ["weight", "nutrition", "workouts", "measurements", "cardio", "all"] as const;
export type ExportCategory = (typeof EXPORT_CATEGORIES)[number];
export const EXPORT_FORMATS = ["csv", "xlsx", "json"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

type Cell = string | number | null;
export type Dataset = { name: string; columns: string[]; rows: Cell[][] };

/** Tabular datasets for a category. Values are in canonical metric units (named in the headers). */
export async function buildDatasets(ctx: UserContext, category: ExportCategory): Promise<Dataset[]> {
  const uid = ctx.userId;
  const { t } = ctx;
  const out: Dataset[] = [];
  const want = (c: ExportCategory) => category === "all" || category === c;

  if (want("weight")) {
    const rows = await db.select().from(weightEntries).where(eq(weightEntries.userId, uid)).orderBy(asc(weightEntries.date));
    out.push({ name: t.weight.title, columns: [t.common.date, "weight_kg", t.common.note, t.common.source], rows: rows.map((r) => [r.date, r.weightKg, r.note, r.source]) });
  }
  if (want("nutrition")) {
    const rows = await db.select().from(foodEntries).where(eq(foodEntries.userId, uid)).orderBy(asc(foodEntries.date), asc(foodEntries.sortOrder));
    out.push({
      name: t.nutrition.title,
      columns: [t.common.date, "meal", t.common.name, "brand", t.common.quantity, t.common.unit, "kcal", "protein_g", "carbs_g", "fat_g", "fiber_g", "sugar_g", "sodium_mg"],
      rows: rows.map((r) => [r.date, r.mealSlot, r.name, r.brand, r.quantity, r.unit, round(r.calories), round(r.proteinG, 1), round(r.carbsG, 1), round(r.fatG, 1), round(r.fiberG, 1), r.sugarG == null ? null : round(r.sugarG, 1), r.sodiumMg == null ? null : round(r.sodiumMg)]),
    });
  }
  if (want("workouts")) {
    const rows = await db
      .select({
        date: workouts.date,
        workout: workouts.name,
        exercise: exercises.name,
        setIndex: exerciseSets.setIndex,
        setType: exerciseSets.setType,
        weightKg: exerciseSets.weightKg,
        reps: exerciseSets.reps,
        rir: exerciseSets.rir,
        durationSeconds: exerciseSets.durationSeconds,
        distanceM: exerciseSets.distanceM,
        sortOrder: workoutExercises.sortOrder,
      })
      .from(exerciseSets)
      .innerJoin(workoutExercises, eq(workoutExercises.id, exerciseSets.workoutExerciseId))
      .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
      .innerJoin(exercises, eq(exercises.id, workoutExercises.exerciseId))
      .where(and(eq(workouts.userId, uid), eq(workouts.status, "completed"), eq(exerciseSets.completed, true)))
      .orderBy(asc(workouts.date), asc(workouts.startedAt), asc(workoutExercises.sortOrder), asc(exerciseSets.setIndex));
    out.push({
      name: t.training.title,
      columns: [t.common.date, "workout", "exercise", "set", "set_type", "weight_kg", "reps", "rir", "duration_s", "distance_m"],
      rows: rows.map((r) => [r.date, r.workout, r.exercise, r.setIndex + 1, r.setType, r.weightKg, r.reps, r.rir, r.durationSeconds, r.distanceM]),
    });
  }
  if (want("measurements")) {
    const m = await db.select().from(bodyMeasurements).where(eq(bodyMeasurements.userId, uid)).orderBy(asc(bodyMeasurements.date));
    const sites = ["waistCm", "chestCm", "neckCm", "shouldersCm", "leftArmCm", "rightArmCm", "hipsCm", "leftThighCm", "rightThighCm", "calfCm"] as const;
    out.push({
      name: t.body.tabs.measurements,
      columns: [t.common.date, ...sites.map((s) => s.replace(/Cm$/, "_cm")), t.common.note],
      rows: m.map((r) => [r.date, ...sites.map((s) => (r as unknown as Record<string, number | null>)[s] ?? null), r.note]),
    });
    const bc = await db.select().from(bodyCompositionEntries).where(eq(bodyCompositionEntries.userId, uid)).orderBy(asc(bodyCompositionEntries.date));
    out.push({ name: t.body.composition, columns: [t.common.date, "body_fat_pct", "method", t.common.note], rows: bc.map((r) => [r.date, r.bodyFatPct, r.method, r.note]) });
  }
  if (want("cardio")) {
    const c = await db.select().from(cardioSessions).where(eq(cardioSessions.userId, uid)).orderBy(asc(cardioSessions.date));
    out.push({
      name: t.cardio.title,
      columns: [t.common.date, "activity", "duration_s", "distance_m", "avg_hr", "max_hr", "kcal", "incline_pct", "speed_kmh", t.common.source, t.common.notes],
      rows: c.map((r) => [r.date, r.activity, r.durationSeconds, r.distanceM, r.avgHeartRate, r.maxHeartRate, r.calories, r.inclinePct, r.speedKmh, r.source, r.notes]),
    });
    const st = await db.select().from(stepEntries).where(eq(stepEntries.userId, uid)).orderBy(asc(stepEntries.date));
    out.push({ name: t.steps.title, columns: [t.common.date, "steps", t.common.source], rows: st.map((r) => [r.date, r.steps, r.source]) });
  }
  return out;
}

function round(v: number, d = 0) {
  const f = 10 ** d;
  return Math.round(v * f) / f;
}

/** RFC 4180 CSV with a UTF-8 BOM so Excel opens Greek text correctly. */
export function toCsv(ds: Dataset) {
  const esc = (v: Cell) => {
    if (v == null) return "";
    const s = String(v);
    // Neutralise spreadsheet formula injection.
    const safe = /^[=+\-@\t\r]/.test(s) && typeof v === "string" ? `'${s}` : s;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return "﻿" + [ds.columns, ...ds.rows].map((r) => r.map(esc).join(",")).join("\r\n") + "\r\n";
}

export async function toXlsx(datasets: Dataset[]) {
  const used = new Set<string>();
  const sheets = datasets.map((d) => {
    let name = d.name.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Sheet";
    while (used.has(name)) name = `${name.slice(0, 28)} ${used.size}`;
    used.add(name);
    return {
      sheet: name,
      data: [d.columns.map((c) => ({ value: c, fontWeight: "bold" as const })), ...d.rows.map((r) => r.map((v) => (v == null ? null : v)))],
    };
  });
  return writeXlsxFile(sheets).toBuffer();
}

export function toJson(datasets: Dataset[]) {
  return JSON.stringify(
    Object.fromEntries(datasets.map((d) => [d.name, d.rows.map((r) => Object.fromEntries(d.columns.map((c, i) => [c, r[i]])))])),
    null,
    2,
  );
}
