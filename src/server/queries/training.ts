import "server-only";
import { and, asc, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { cache } from "react";
import { weekday, type ISODate } from "@/lib/dates";
import type { TrainingPrefs } from "@/lib/preferences";
import { db } from "@/server/db";
import {
  exercises,
  exerciseSets,
  programDays,
  programExercises,
  programs,
  workoutExercises,
  workouts,
} from "@/server/db/schema";

export const getActiveWorkout = cache(async (userId: string) => {
  const rows = await db
    .select({ id: workouts.id, name: workouts.name, startedAt: workouts.startedAt, date: workouts.date })
    .from(workouts)
    .where(and(eq(workouts.userId, userId), eq(workouts.status, "in_progress")))
    .orderBy(desc(workouts.startedAt))
    .limit(1);
  return rows[0] ?? null;
});

export type ProgramWithDays = Awaited<ReturnType<typeof getActiveProgram>>;

export const getActiveProgram = cache(async (userId: string) => {
  const program = (
    await db
      .select()
      .from(programs)
      .where(and(eq(programs.userId, userId), eq(programs.isActive, true), isNull(programs.archivedAt)))
      .limit(1)
  )[0];
  if (!program) return null;
  const days = await db.select().from(programDays).where(eq(programDays.programId, program.id)).orderBy(asc(programDays.sortOrder));
  const dayIds = days.map((d) => d.id);
  const exs = dayIds.length
    ? await db
        .select({ pe: programExercises, name: exercises.name, nameEl: exercises.nameEl })
        .from(programExercises)
        .innerJoin(exercises, eq(exercises.id, programExercises.exerciseId))
        .where(inArray(programExercises.programDayId, dayIds))
        .orderBy(asc(programExercises.sortOrder))
    : [];
  return {
    ...program,
    days: days.map((d) => ({ ...d, exercises: exs.filter((e) => e.pe.programDayId === d.id) })),
  };
});

/** Planned sessions per week and (for weekly schedules) the planned weekdays. */
export async function getTrainingPlan(userId: string, prefs: TrainingPrefs) {
  const program = await getActiveProgram(userId);
  if (program?.scheduleType === "weekly") {
    const weekdays = [...new Set(program.days.flatMap((d) => d.weekdays))];
    if (weekdays.length) return { program, plannedWeekdays: weekdays, plannedPerWeek: weekdays.length };
  }
  const perWeek = program?.daysPerWeek ?? (program ? program.days.length : null) ?? prefs.plannedWorkoutsPerWeek;
  return { program, plannedWeekdays: null as number[] | null, plannedPerWeek: perWeek || prefs.plannedWorkoutsPerWeek };
}

export function isPlannedOn(plannedWeekdays: number[] | null, date: ISODate) {
  return plannedWeekdays ? plannedWeekdays.includes(weekday(date)) : false;
}

/**
 * Today's plan: for weekly schedules the day mapped to today's weekday (or rest day);
 * for rotations, the day after the last completed day of the active program.
 */
export async function getPlannedDay(userId: string, today: ISODate) {
  const program = await getActiveProgram(userId);
  if (!program || !program.days.length) return { program, day: null, restDay: false, nextDay: null };
  if (program.scheduleType === "weekly") {
    const wd = weekday(today);
    const day = program.days.find((d) => d.weekdays.includes(wd)) ?? null;
    let nextDay = null;
    if (!day) {
      for (let i = 1; i <= 7 && !nextDay; i++) {
        const w = (wd + i) % 7;
        nextDay = program.days.find((d) => d.weekdays.includes(w)) ?? null;
      }
    }
    return { program, day, restDay: !day, nextDay };
  }
  const last = (
    await db
      .select({ programDayId: workouts.programDayId })
      .from(workouts)
      .where(and(eq(workouts.userId, userId), eq(workouts.programId, program.id), eq(workouts.status, "completed")))
      .orderBy(desc(workouts.date), desc(workouts.startedAt))
      .limit(1)
  )[0];
  const idx = last ? program.days.findIndex((d) => d.id === last.programDayId) : -1;
  const day = program.days[(idx + 1) % program.days.length];
  return { program, day, restDay: false, nextDay: null };
}

export async function getWorkoutsInRange(userId: string, start: ISODate, end: ISODate) {
  return db
    .select()
    .from(workouts)
    .where(and(eq(workouts.userId, userId), gte(workouts.date, start), lte(workouts.date, end)))
    .orderBy(desc(workouts.date), desc(workouts.startedAt));
}

/** Per-workout aggregates (sets, volume, exercise count) for completed workouts. */
export async function getWorkoutAggregates(userId: string, start: ISODate, end: ISODate, includeWarmups = false) {
  const warmupFilter = includeWarmups ? sql`true` : sql`${exerciseSets.setType} <> 'warmup'`;
  return db
    .select({
      workoutId: workouts.id,
      date: workouts.date,
      name: workouts.name,
      durationSeconds: workouts.durationSeconds,
      startedAt: workouts.startedAt,
      sets: sql<number>`count(${exerciseSets.id}) filter (where ${exerciseSets.completed} and ${warmupFilter})`.mapWith(Number),
      volume: sql<number>`coalesce(sum(${exerciseSets.weightKg} * ${exerciseSets.reps}) filter (where ${exerciseSets.completed} and ${warmupFilter}), 0)`.mapWith(Number),
      exercises: sql<number>`count(distinct ${workoutExercises.id})`.mapWith(Number),
    })
    .from(workouts)
    .leftJoin(workoutExercises, eq(workoutExercises.workoutId, workouts.id))
    .leftJoin(exerciseSets, eq(exerciseSets.workoutExerciseId, workoutExercises.id))
    .where(and(eq(workouts.userId, userId), eq(workouts.status, "completed"), gte(workouts.date, start), lte(workouts.date, end)))
    .groupBy(workouts.id)
    .orderBy(desc(workouts.date), desc(workouts.startedAt));
}

/** Exercise list visible to a user (built-ins + own, not archived). */
export async function getExerciseLibrary(userId: string) {
  return db
    .select()
    .from(exercises)
    .where(and(or(isNull(exercises.userId), eq(exercises.userId, userId)), isNull(exercises.archivedAt)))
    .orderBy(asc(exercises.name));
}
