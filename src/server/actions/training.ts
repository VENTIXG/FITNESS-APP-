"use server";

import { and, asc, desc, eq, inArray, isNull, max, notInArray, or, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { EQUIPMENT, EXERCISE_CATEGORIES, MUSCLE_GROUPS, SCHEDULE_TYPES, SET_TYPES, TRACKING_TYPES } from "@/lib/domain";
import { isoDate, optionalText, requiredName, uuid } from "@/lib/validation";
import { builtinExerciseId } from "@/server/catalog/stable-id";
import { getUserContext } from "@/server/context";
import { db, type DbOrTx } from "@/server/db";
import {
  exercises,
  exerciseSets,
  exerciseSettings,
  personalRecords,
  programDays,
  programExercises,
  programs,
  weightEntries,
  workoutExercises,
  workouts,
} from "@/server/db/schema";
import { recomputeRecords } from "@/server/services/records";
import { ActionError, createAction } from "./_lib";

// ── Workout snapshot schema (shared by sync / finish / edit) ───────────────

const setSchema = z.object({
  id: uuid,
  setIndex: z.number().int().min(0).max(200),
  setType: z.enum(SET_TYPES),
  weightKg: z.number().min(0).max(1500).nullable(),
  reps: z.number().int().min(0).max(1000).nullable(),
  rir: z.number().min(0).max(10).nullable(),
  durationSeconds: z.number().int().min(0).max(86400).nullable(),
  distanceM: z.number().min(0).max(100000).nullable(),
  completed: z.boolean(),
  completedAt: z.string().datetime().nullable(),
});

const workoutExerciseSchema = z.object({
  id: uuid,
  exerciseId: uuid,
  sortOrder: z.number().int().min(0).max(200),
  notes: optionalText(1000),
  repMin: z.number().int().min(1).max(100).nullable(),
  repMax: z.number().int().min(1).max(100).nullable(),
  restSeconds: z.number().int().min(0).max(900).nullable(),
  sets: z.array(setSchema).max(60),
});

const snapshotSchema = z.object({
  workoutId: uuid,
  name: requiredName(120),
  notes: optionalText(4000),
  exercises: z.array(workoutExerciseSchema).max(50),
});

type Snapshot = z.infer<typeof snapshotSchema>;

/**
 * Applies a full workout snapshot idempotently. Client-generated ids are checked
 * so a payload can never touch rows belonging to another workout or user.
 */
async function applySnapshot(tx: DbOrTx, userId: string, snap: Snapshot) {
  const workout = (
    await tx
      .select({ id: workouts.id, status: workouts.status })
      .from(workouts)
      .where(and(eq(workouts.id, snap.workoutId), eq(workouts.userId, userId)))
      .limit(1)
  )[0];
  if (!workout) throw new ActionError("not_found");

  const exerciseIds = [...new Set(snap.exercises.map((e) => e.exerciseId))];
  if (exerciseIds.length) {
    const visible = await tx
      .select({ id: exercises.id })
      .from(exercises)
      .where(and(inArray(exercises.id, exerciseIds), or(isNull(exercises.userId), eq(exercises.userId, userId))));
    if (visible.length !== exerciseIds.length) throw new ActionError("validation");
  }

  const weIds = snap.exercises.map((e) => e.id);
  const setIds = snap.exercises.flatMap((e) => e.sets.map((s) => s.id));
  if (weIds.length) {
    const foreign = await tx
      .select({ id: workoutExercises.id })
      .from(workoutExercises)
      .where(and(inArray(workoutExercises.id, weIds), sql`${workoutExercises.workoutId} <> ${snap.workoutId}`));
    if (foreign.length) throw new ActionError("conflict");
  }
  if (setIds.length) {
    const foreignSets = await tx
      .select({ id: exerciseSets.id })
      .from(exerciseSets)
      .innerJoin(workoutExercises, eq(workoutExercises.id, exerciseSets.workoutExerciseId))
      .where(and(inArray(exerciseSets.id, setIds), sql`${workoutExercises.workoutId} <> ${snap.workoutId}`));
    if (foreignSets.length) throw new ActionError("conflict");
  }

  await tx
    .update(workouts)
    .set({ name: snap.name, notes: snap.notes })
    .where(eq(workouts.id, snap.workoutId));

  // Remove rows that are no longer in the snapshot.
  await tx
    .delete(workoutExercises)
    .where(weIds.length ? and(eq(workoutExercises.workoutId, snap.workoutId), notInArray(workoutExercises.id, weIds)) : eq(workoutExercises.workoutId, snap.workoutId));
  if (weIds.length) {
    await tx
      .delete(exerciseSets)
      .where(
        setIds.length
          ? and(inArray(exerciseSets.workoutExerciseId, weIds), notInArray(exerciseSets.id, setIds))
          : inArray(exerciseSets.workoutExerciseId, weIds),
      );
  }

  for (const e of snap.exercises) {
    await tx
      .insert(workoutExercises)
      .values({
        id: e.id,
        workoutId: snap.workoutId,
        exerciseId: e.exerciseId,
        sortOrder: e.sortOrder,
        notes: e.notes,
        repMin: e.repMin,
        repMax: e.repMax,
        restSeconds: e.restSeconds,
      })
      .onConflictDoUpdate({
        target: workoutExercises.id,
        set: { exerciseId: e.exerciseId, sortOrder: e.sortOrder, notes: e.notes, repMin: e.repMin, repMax: e.repMax, restSeconds: e.restSeconds },
      });
    if (e.sets.length) {
      await tx
        .insert(exerciseSets)
        .values(
          e.sets.map((s) => ({
            id: s.id,
            workoutExerciseId: e.id,
            setIndex: s.setIndex,
            setType: s.setType,
            weightKg: s.weightKg,
            reps: s.reps,
            rir: s.rir,
            durationSeconds: s.durationSeconds,
            distanceM: s.distanceM,
            completed: s.completed,
            completedAt: s.completedAt ? new Date(s.completedAt) : null,
          })),
        )
        .onConflictDoUpdate({
          target: exerciseSets.id,
          set: {
            setIndex: sql`excluded.set_index`,
            setType: sql`excluded.set_type`,
            weightKg: sql`excluded.weight_kg`,
            reps: sql`excluded.reps`,
            rir: sql`excluded.rir`,
            durationSeconds: sql`excluded.duration_seconds`,
            distanceM: sql`excluded.distance_m`,
            completed: sql`excluded.completed`,
            completedAt: sql`excluded.completed_at`,
          },
        });
    }
  }
  return { status: workout.status, exerciseIds };
}

/** Drops unchecked sets and exercises left empty (used when finishing/saving a workout). */
async function pruneIncomplete(tx: DbOrTx, workoutId: string) {
  const weRows = await tx.select({ id: workoutExercises.id }).from(workoutExercises).where(eq(workoutExercises.workoutId, workoutId));
  const ids = weRows.map((r) => r.id);
  if (!ids.length) return;
  await tx.delete(exerciseSets).where(and(inArray(exerciseSets.workoutExerciseId, ids), eq(exerciseSets.completed, false)));
  await tx.execute(sql`
    delete from ${workoutExercises} we
    where we.workout_id = ${workoutId}
      and not exists (select 1 from ${exerciseSets} s where s.workout_exercise_id = we.id)`);
}

// ── Start / sync / finish ─────────────────────────────────────────────────

export async function startWorkout(input: { programDayId: string | null }) {
  const parsed = z.object({ programDayId: uuid.nullable() }).safeParse(input);
  if (!parsed.success) throw new Error("invalid input");
  const ctx = await getUserContext();

  const existing = (
    await db
      .select({ id: workouts.id })
      .from(workouts)
      .where(and(eq(workouts.userId, ctx.userId), eq(workouts.status, "in_progress")))
      .limit(1)
  )[0];
  if (existing) redirect(`/training/workout/${existing.id}`);

  let dayInfo: { id: string; name: string; programId: string } | null = null;
  if (parsed.data.programDayId) {
    dayInfo =
      (
        await db
          .select({ id: programDays.id, name: programDays.name, programId: programDays.programId })
          .from(programDays)
          .innerJoin(programs, eq(programs.id, programDays.programId))
          .where(and(eq(programDays.id, parsed.data.programDayId), eq(programs.userId, ctx.userId)))
          .limit(1)
      )[0] ?? null;
  }
  const lastWeight = (
    await db
      .select({ w: weightEntries.weightKg })
      .from(weightEntries)
      .where(eq(weightEntries.userId, ctx.userId))
      .orderBy(desc(weightEntries.date))
      .limit(1)
  )[0];

  const workoutId = await db.transaction(async (tx) => {
    const [w] = await tx
      .insert(workouts)
      .values({
        userId: ctx.userId,
        date: ctx.today,
        name: dayInfo?.name ?? ctx.t.training.workout.untitled,
        programId: dayInfo?.programId ?? null,
        programDayId: dayInfo?.id ?? null,
        status: "in_progress",
        startedAt: new Date(),
        bodyweightKg: lastWeight?.w ?? null,
      })
      .returning({ id: workouts.id });
    if (dayInfo) {
      const pes = await tx.select().from(programExercises).where(eq(programExercises.programDayId, dayInfo.id)).orderBy(asc(programExercises.sortOrder));
      for (const [i, pe] of pes.entries()) {
        const weId = crypto.randomUUID();
        await tx.insert(workoutExercises).values({
          id: weId,
          workoutId: w.id,
          exerciseId: pe.exerciseId,
          sortOrder: i,
          notes: pe.notes,
          repMin: pe.repMin,
          repMax: pe.repMax,
          restSeconds: pe.restSeconds,
        });
        const n = Math.max(1, pe.targetSets);
        await tx.insert(exerciseSets).values(
          Array.from({ length: n }, (_, k) => ({
            id: crypto.randomUUID(),
            workoutExerciseId: weId,
            setIndex: k,
            setType: "normal" as const,
            completed: false,
          })),
        );
      }
    }
    return w.id;
  });
  redirect(`/training/workout/${workoutId}`);
}

/** Autosave from the logger (does not change status). */
export const syncWorkout = createAction(
  snapshotSchema,
  async (input, ctx) => {
    await db.transaction((tx) => applySnapshot(tx, ctx.userId, input));
    return { savedAt: new Date().toISOString() };
  },
  { revalidate: false },
);

export const finishWorkout = createAction(
  snapshotSchema.extend({ sessionRpe: z.number().min(1).max(10).nullable() }),
  async (input, ctx) => {
    const result = await db.transaction(async (tx) => {
      const { exerciseIds } = await applySnapshot(tx, ctx.userId, input);
      await pruneIncomplete(tx, input.workoutId);
      const w = (await tx.select({ startedAt: workouts.startedAt, status: workouts.status }).from(workouts).where(eq(workouts.id, input.workoutId)))[0];
      const finishedAt = new Date();
      const duration = Math.min(12 * 3600, Math.max(0, Math.round((finishedAt.getTime() - w.startedAt.getTime()) / 1000)));
      await tx
        .update(workouts)
        .set({
          status: "completed",
          finishedAt: w.status === "completed" ? undefined : finishedAt,
          durationSeconds: w.status === "completed" ? undefined : duration,
          sessionRpe: input.sessionRpe,
          isDemo: false,
        })
        .where(eq(workouts.id, input.workoutId));
      await recomputeRecords(tx, ctx.userId, exerciseIds);
      const prs = await tx
        .select({ type: personalRecords.type, value: personalRecords.value, previousValue: personalRecords.previousValue, weightKg: personalRecords.weightKg, reps: personalRecords.reps, exerciseId: personalRecords.exerciseId, name: exercises.name, nameEl: exercises.nameEl })
        .from(personalRecords)
        .innerJoin(exercises, eq(exercises.id, personalRecords.exerciseId))
        .where(eq(personalRecords.workoutId, input.workoutId));
      return { prs };
    });
    return result;
  },
);

/** Edit metadata of a completed workout (date, name, duration, effort). */
export const updateWorkoutMeta = createAction(
  z.object({
    workoutId: uuid,
    date: isoDate,
    name: requiredName(120),
    durationSeconds: z.number().int().min(0).max(43200).nullable(),
    notes: optionalText(4000),
    sessionRpe: z.number().min(1).max(10).nullable(),
  }),
  async (input, ctx) => {
    const res = await db
      .update(workouts)
      .set({ date: input.date, name: input.name, durationSeconds: input.durationSeconds, notes: input.notes, sessionRpe: input.sessionRpe })
      .where(and(eq(workouts.id, input.workoutId), eq(workouts.userId, ctx.userId)))
      .returning({ id: workouts.id });
    if (!res.length) throw new ActionError("not_found");
    // Date changes alter PR chronology.
    const exs = await db.select({ id: workoutExercises.exerciseId }).from(workoutExercises).where(eq(workoutExercises.workoutId, input.workoutId));
    await db.transaction((tx) => recomputeRecords(tx, ctx.userId, exs.map((e) => e.id)));
    return null;
  },
);

export const deleteWorkout = createAction(z.object({ workoutId: uuid }), async (input, ctx) => {
  await db.transaction(async (tx) => {
    const exs = await tx
      .select({ id: workoutExercises.exerciseId })
      .from(workoutExercises)
      .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
      .where(and(eq(workoutExercises.workoutId, input.workoutId), eq(workouts.userId, ctx.userId)));
    const res = await tx.delete(workouts).where(and(eq(workouts.id, input.workoutId), eq(workouts.userId, ctx.userId))).returning({ id: workouts.id });
    if (!res.length) throw new ActionError("not_found");
    await recomputeRecords(tx, ctx.userId, exs.map((e) => e.id));
  });
  return null;
});

// ── Exercises ─────────────────────────────────────────────────────────────

const exerciseSchema = z.object({
  name: requiredName(120),
  muscleGroup: z.enum(MUSCLE_GROUPS),
  secondaryMuscles: z.array(z.enum(MUSCLE_GROUPS)).max(6),
  equipment: z.enum(EQUIPMENT),
  category: z.enum(EXERCISE_CATEGORIES),
  trackingType: z.enum(TRACKING_TYPES),
  instructions: optionalText(4000),
});

export const createExercise = createAction(exerciseSchema, async (input, ctx) => {
  const [row] = await db.insert(exercises).values({ userId: ctx.userId, ...input }).returning({ id: exercises.id });
  return { id: row.id };
});

export const updateExercise = createAction(exerciseSchema.extend({ id: uuid }), async ({ id, ...input }, ctx) => {
  const res = await db
    .update(exercises)
    .set(input)
    .where(and(eq(exercises.id, id), eq(exercises.userId, ctx.userId)))
    .returning({ id: exercises.id });
  if (!res.length) throw new ActionError("not_found");
  return null;
});

/** Deletes a custom exercise, or archives it when it has history. */
export const deleteExercise = createAction(z.object({ id: uuid }), async (input, ctx) => {
  const used = await db.select({ id: workoutExercises.id }).from(workoutExercises).where(eq(workoutExercises.exerciseId, input.id)).limit(1);
  const usedInProgram = await db.select({ id: programExercises.id }).from(programExercises).where(eq(programExercises.exerciseId, input.id)).limit(1);
  if (used.length || usedInProgram.length) {
    await db.update(exercises).set({ archivedAt: new Date() }).where(and(eq(exercises.id, input.id), eq(exercises.userId, ctx.userId)));
    return { archived: true };
  }
  await db.delete(exercises).where(and(eq(exercises.id, input.id), eq(exercises.userId, ctx.userId)));
  return { archived: false };
});

export const saveExerciseSettings = createAction(
  z
    .object({
      exerciseId: uuid,
      notes: optionalText(2000),
      repMin: z.number().int().min(1).max(100).nullable(),
      repMax: z.number().int().min(1).max(100).nullable(),
      incrementKg: z.number().min(0.1).max(50).nullable(),
      restSeconds: z.number().int().min(0).max(900).nullable(),
    })
    .refine((v) => v.repMin == null || v.repMax == null || v.repMin <= v.repMax, { path: ["repMax"], message: "range" }),
  async (input, ctx) => {
    const visible = await db
      .select({ id: exercises.id })
      .from(exercises)
      .where(and(eq(exercises.id, input.exerciseId), or(isNull(exercises.userId), eq(exercises.userId, ctx.userId))));
    if (!visible.length) throw new ActionError("not_found");
    const values = { notes: input.notes, repMin: input.repMin, repMax: input.repMax, incrementKg: input.incrementKg, restSeconds: input.restSeconds };
    await db
      .insert(exerciseSettings)
      .values({ userId: ctx.userId, exerciseId: input.exerciseId, ...values })
      .onConflictDoUpdate({ target: [exerciseSettings.userId, exerciseSettings.exerciseId], set: values });
    return null;
  },
);

// ── Programs ──────────────────────────────────────────────────────────────

const programSchema = z.object({
  id: uuid,
  name: requiredName(120),
  description: optionalText(2000),
  scheduleType: z.enum(SCHEDULE_TYPES),
  daysPerWeek: z.number().int().min(1).max(14).nullable(),
  days: z
    .array(
      z.object({
        id: uuid,
        name: requiredName(80),
        weekdays: z.array(z.number().int().min(0).max(6)).max(7),
        notes: optionalText(1000),
        exercises: z
          .array(
            z.object({
              id: uuid,
              exerciseId: uuid,
              targetSets: z.number().int().min(1).max(20),
              repMin: z.number().int().min(1).max(100).nullable(),
              repMax: z.number().int().min(1).max(100).nullable(),
              targetRir: z.number().min(0).max(10).nullable(),
              restSeconds: z.number().int().min(0).max(900).nullable(),
              notes: optionalText(1000),
            }),
          )
          .max(30),
      }),
    )
    .max(14),
});

/** Creates or replaces a program from a full snapshot (ids are client-generated). */
export const saveProgram = createAction(programSchema, async (input, ctx) => {
  await db.transaction(async (tx) => {
    const existing = (await tx.select({ id: programs.id, userId: programs.userId }).from(programs).where(eq(programs.id, input.id)).limit(1))[0];
    if (existing && existing.userId !== ctx.userId) throw new ActionError("not_found");

    const exerciseIds = [...new Set(input.days.flatMap((d) => d.exercises.map((e) => e.exerciseId)))];
    if (exerciseIds.length) {
      const visible = await tx
        .select({ id: exercises.id })
        .from(exercises)
        .where(and(inArray(exercises.id, exerciseIds), or(isNull(exercises.userId), eq(exercises.userId, ctx.userId))));
      if (visible.length !== exerciseIds.length) throw new ActionError("validation");
    }
    const dayIds = input.days.map((d) => d.id);
    if (dayIds.length) {
      const foreign = await tx.select({ id: programDays.id }).from(programDays).where(and(inArray(programDays.id, dayIds), sql`${programDays.programId} <> ${input.id}`));
      if (foreign.length) throw new ActionError("conflict");
    }
    const peIds = input.days.flatMap((d) => d.exercises.map((e) => e.id));
    if (peIds.length) {
      const foreign = await tx
        .select({ id: programExercises.id })
        .from(programExercises)
        .innerJoin(programDays, eq(programDays.id, programExercises.programDayId))
        .where(and(inArray(programExercises.id, peIds), sql`${programDays.programId} <> ${input.id}`));
      if (foreign.length) throw new ActionError("conflict");
    }

    const values = { name: input.name, description: input.description, scheduleType: input.scheduleType, daysPerWeek: input.daysPerWeek };
    if (existing) await tx.update(programs).set({ ...values, isDemo: false }).where(eq(programs.id, input.id));
    else await tx.insert(programs).values({ id: input.id, userId: ctx.userId, ...values });

    await tx.delete(programDays).where(dayIds.length ? and(eq(programDays.programId, input.id), notInArray(programDays.id, dayIds)) : eq(programDays.programId, input.id));
    for (const [i, d] of input.days.entries()) {
      await tx
        .insert(programDays)
        .values({ id: d.id, programId: input.id, name: d.name, sortOrder: i, weekdays: d.weekdays, notes: d.notes })
        .onConflictDoUpdate({ target: programDays.id, set: { name: d.name, sortOrder: i, weekdays: d.weekdays, notes: d.notes } });
      const ids = d.exercises.map((e) => e.id);
      await tx
        .delete(programExercises)
        .where(ids.length ? and(eq(programExercises.programDayId, d.id), notInArray(programExercises.id, ids)) : eq(programExercises.programDayId, d.id));
      for (const [j, e] of d.exercises.entries()) {
        const v = { exerciseId: e.exerciseId, sortOrder: j, targetSets: e.targetSets, repMin: e.repMin, repMax: e.repMax, targetRir: e.targetRir, restSeconds: e.restSeconds, notes: e.notes };
        await tx.insert(programExercises).values({ id: e.id, programDayId: d.id, ...v }).onConflictDoUpdate({ target: programExercises.id, set: v });
      }
    }
  });
  return { id: input.id };
});

export const setActiveProgram = createAction(z.object({ id: uuid.nullable() }), async (input, ctx) => {
  await db.transaction(async (tx) => {
    await tx.update(programs).set({ isActive: false }).where(eq(programs.userId, ctx.userId));
    if (input.id) {
      const res = await tx.update(programs).set({ isActive: true }).where(and(eq(programs.id, input.id), eq(programs.userId, ctx.userId))).returning({ id: programs.id });
      if (!res.length) throw new ActionError("not_found");
    }
  });
  return null;
});

export const deleteProgram = createAction(z.object({ id: uuid }), async (input, ctx) => {
  await db.delete(programs).where(and(eq(programs.id, input.id), eq(programs.userId, ctx.userId)));
  return null;
});

type TemplateDay = { name: string; exercises: [key: string, sets: number, repMin: number, repMax: number][] };
const TEMPLATES: Record<"ppl" | "upperLower" | "fullBody", { name: string; days: TemplateDay[]; weekly?: number[][] }> = {
  ppl: {
    name: "Push / Pull / Legs",
    days: [
      { name: "Push", exercises: [["barbell-bench-press", 3, 6, 10], ["incline-dumbbell-bench-press", 3, 8, 12], ["seated-dumbbell-press", 3, 8, 12], ["lateral-raise", 3, 12, 15], ["rope-pushdown", 3, 10, 15]] },
      { name: "Pull", exercises: [["pull-up", 3, 6, 10], ["barbell-row", 3, 6, 10], ["seated-cable-row", 3, 10, 12], ["face-pull", 3, 12, 15], ["dumbbell-curl", 3, 10, 12]] },
      { name: "Legs", exercises: [["back-squat", 3, 5, 8], ["romanian-deadlift", 3, 8, 10], ["leg-press", 3, 10, 12], ["lying-leg-curl", 3, 10, 12], ["standing-calf-raise", 4, 10, 15]] },
    ],
  },
  upperLower: {
    name: "Upper / Lower",
    weekly: [[1], [2], [4], [5]],
    days: [
      { name: "Upper A", exercises: [["barbell-bench-press", 3, 5, 8], ["barbell-row", 3, 6, 10], ["overhead-press", 3, 6, 10], ["lat-pulldown", 3, 8, 12], ["ez-bar-curl", 2, 10, 12], ["triceps-pushdown", 2, 10, 12]] },
      { name: "Lower A", exercises: [["back-squat", 3, 5, 8], ["romanian-deadlift", 3, 6, 10], ["leg-press", 3, 10, 12], ["lying-leg-curl", 3, 10, 12], ["standing-calf-raise", 3, 10, 15]] },
      { name: "Upper B", exercises: [["incline-dumbbell-bench-press", 3, 8, 12], ["pull-up", 3, 6, 10], ["seated-dumbbell-press", 3, 8, 12], ["seated-cable-row", 3, 10, 12], ["lateral-raise", 3, 12, 15], ["hammer-curl", 2, 10, 12]] },
      { name: "Lower B", exercises: [["deadlift", 3, 3, 6], ["bulgarian-split-squat", 3, 8, 12], ["leg-extension", 3, 10, 15], ["seated-leg-curl", 3, 10, 15], ["hanging-leg-raise", 3, 8, 15]] },
    ],
  },
  fullBody: {
    name: "Full Body",
    weekly: [[1], [3], [5]],
    days: [
      { name: "Full Body A", exercises: [["back-squat", 3, 5, 8], ["barbell-bench-press", 3, 6, 10], ["barbell-row", 3, 6, 10], ["lateral-raise", 2, 12, 15], ["plank", 3, 1, 1]] },
      { name: "Full Body B", exercises: [["deadlift", 3, 3, 6], ["overhead-press", 3, 6, 10], ["lat-pulldown", 3, 8, 12], ["leg-press", 3, 10, 12], ["dumbbell-curl", 2, 10, 12]] },
      { name: "Full Body C", exercises: [["front-squat", 3, 6, 8], ["incline-dumbbell-bench-press", 3, 8, 12], ["seated-cable-row", 3, 10, 12], ["romanian-deadlift", 3, 8, 10], ["triceps-pushdown", 2, 10, 15]] },
    ],
  },
};

/** Creates a program from a template (or blank) and returns its id. */
export const createProgramFromTemplate = createAction(z.object({ template: z.enum(["ppl", "upperLower", "fullBody", "blank"]), name: z.string().max(120).optional() }), async (input, ctx) => {
  const id = crypto.randomUUID();
  await db.transaction(async (tx) => {
    const tpl = input.template === "blank" ? null : TEMPLATES[input.template];
    await tx.insert(programs).values({
      id,
      userId: ctx.userId,
      name: input.name?.trim() || tpl?.name || ctx.t.training.program.template.blank,
      scheduleType: tpl?.weekly ? "weekly" : "rotation",
      daysPerWeek: tpl ? (tpl.weekly ? tpl.weekly.length : 6) : null,
    });
    if (!tpl) return;
    for (const [i, day] of tpl.days.entries()) {
      const dayId = crypto.randomUUID();
      await tx.insert(programDays).values({ id: dayId, programId: id, name: day.name, sortOrder: i, weekdays: tpl.weekly?.[i] ?? [] });
      await tx.insert(programExercises).values(
        day.exercises.map(([key, sets, repMin, repMax], j) => ({
          programDayId: dayId,
          exerciseId: builtinExerciseId(key),
          sortOrder: j,
          targetSets: sets,
          repMin,
          repMax,
          restSeconds: repMax <= 8 ? 180 : 120,
        })),
      );
    }
  });
  const [{ n }] = await db.select({ n: max(programs.createdAt) }).from(programs).where(and(eq(programs.userId, ctx.userId), eq(programs.isActive, true)));
  if (!n) await db.update(programs).set({ isActive: true }).where(eq(programs.id, id));
  return { id };
});
