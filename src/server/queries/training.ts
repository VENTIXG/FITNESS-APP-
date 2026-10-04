import "server-only";
import { and, asc, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { cache } from "react";
import { buildExerciseRecords } from "@/lib/calc/training";
import { weekday, type ISODate } from "@/lib/dates";
import type { TrainingPrefs } from "@/lib/preferences";
import { db } from "@/server/db";
import {
  exercises,
  exerciseSets,
  exerciseSettings as exerciseSettingsTable,
  personalRecords,
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

export type ExerciseInfo = Pick<
  typeof exercises.$inferSelect,
  "id" | "name" | "nameEl" | "muscleGroup" | "secondaryMuscles" | "equipment" | "category" | "trackingType" | "userId"
>;

const exerciseInfoCols = {
  id: exercises.id,
  name: exercises.name,
  nameEl: exercises.nameEl,
  muscleGroup: exercises.muscleGroup,
  secondaryMuscles: exercises.secondaryMuscles,
  equipment: exercises.equipment,
  category: exercises.category,
  trackingType: exercises.trackingType,
  userId: exercises.userId,
};

export type HistorySetRow = { weightKg: number | null; reps: number | null; rir: number | null; setType: string; durationSeconds: number | null; distanceM: number | null };
export type ExerciseSession = { workoutId: string; date: string; sets: HistorySetRow[] };

export type ExerciseContext = {
  exercise: ExerciseInfo;
  /** Most recent completed sessions first (max 2), excluding the current workout. */
  sessions: ExerciseSession[];
  /** All-time records before the current workout (null when there is no history). */
  records: { e1rm: number | null; weight: number | null; reps: number | null; repLadder: { weightKg: number; reps: number }[] } | null;
  settings: { notes: string | null; repMin: number | null; repMax: number | null; incrementKg: number | null; restSeconds: number | null } | null;
};

/**
 * History context the workout logger needs for each exercise: previous performance,
 * the session before (for progression), all-time records and per-exercise settings.
 */
export async function getExerciseContexts(userId: string, exerciseIds: string[], excludeWorkoutId: string | null): Promise<Record<string, ExerciseContext>> {
  const ids = [...new Set(exerciseIds)];
  if (!ids.length) return {};
  const [infos, rows, settings] = await Promise.all([
    db.select(exerciseInfoCols).from(exercises).where(and(inArray(exercises.id, ids), or(isNull(exercises.userId), eq(exercises.userId, userId)))),
    db
      .select({
        exerciseId: workoutExercises.exerciseId,
        workoutId: workouts.id,
        date: workouts.date,
        startedAt: workouts.startedAt,
        setIndex: exerciseSets.setIndex,
        weightKg: exerciseSets.weightKg,
        reps: exerciseSets.reps,
        rir: exerciseSets.rir,
        setType: exerciseSets.setType,
        durationSeconds: exerciseSets.durationSeconds,
        distanceM: exerciseSets.distanceM,
      })
      .from(exerciseSets)
      .innerJoin(workoutExercises, eq(workoutExercises.id, exerciseSets.workoutExerciseId))
      .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
      .where(
        and(
          eq(workouts.userId, userId),
          eq(workouts.status, "completed"),
          eq(exerciseSets.completed, true),
          inArray(workoutExercises.exerciseId, ids),
          excludeWorkoutId ? sql`${workouts.id} <> ${excludeWorkoutId}` : undefined,
        ),
      )
      .orderBy(desc(workouts.date), desc(workouts.startedAt), asc(workoutExercises.sortOrder), asc(exerciseSets.setIndex)),
    db.select().from(exerciseSettingsTable).where(and(eq(exerciseSettingsTable.userId, userId), inArray(exerciseSettingsTable.exerciseId, ids))),
  ]);
  const out: Record<string, ExerciseContext> = {};
  for (const info of infos) {
    const mine = rows.filter((r) => r.exerciseId === info.id);
    const sessions: ExerciseSession[] = [];
    for (const r of mine) {
      let s = sessions.find((x) => x.workoutId === r.workoutId);
      if (!s) {
        if (sessions.length >= 2) continue;
        s = { workoutId: r.workoutId, date: r.date, sets: [] };
        sessions.push(s);
      }
      s.sets.push({ weightKg: r.weightKg, reps: r.reps, rir: r.rir, setType: r.setType, durationSeconds: r.durationSeconds, distanceM: r.distanceM });
    }
    const working = mine.filter((r) => r.setType !== "warmup");
    const st = settings.find((x) => x.exerciseId === info.id);
    out[info.id] = {
      exercise: info,
      sessions,
      records: working.length ? buildExerciseRecords(working) : null,
      settings: st ? { notes: st.notes, repMin: st.repMin, repMax: st.repMax, incrementKg: st.incrementKg, restSeconds: st.restSeconds } : null,
    };
  }
  return out;
}

/** A workout with its exercises and sets, in display order. */
export async function getWorkoutDetail(userId: string, workoutId: string) {
  const w = (await db.select().from(workouts).where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId))).limit(1))[0];
  if (!w) return null;
  const wes = await db
    .select({ we: workoutExercises, ex: exerciseInfoCols })
    .from(workoutExercises)
    .innerJoin(exercises, eq(exercises.id, workoutExercises.exerciseId))
    .where(eq(workoutExercises.workoutId, workoutId))
    .orderBy(asc(workoutExercises.sortOrder));
  const sets = wes.length
    ? await db
        .select()
        .from(exerciseSets)
        .where(inArray(exerciseSets.workoutExerciseId, wes.map((x) => x.we.id)))
        .orderBy(asc(exerciseSets.setIndex))
    : [];
  const prs = await db
    .select({ type: personalRecords.type, value: personalRecords.value, previousValue: personalRecords.previousValue, weightKg: personalRecords.weightKg, reps: personalRecords.reps, exerciseId: personalRecords.exerciseId, setId: personalRecords.setId })
    .from(personalRecords)
    .where(eq(personalRecords.workoutId, workoutId));
  return {
    workout: w,
    exercises: wes.map(({ we, ex }) => ({ ...we, exercise: ex, sets: sets.filter((s) => s.workoutExerciseId === we.id) })),
    prs,
  };
}

export type WorkoutDetail = NonNullable<Awaited<ReturnType<typeof getWorkoutDetail>>>;

/** How often each exercise was used recently (for the exercise picker's "recent" list). */
export async function getRecentExerciseIds(userId: string, limit = 30) {
  const rows = await db
    .select({ id: workoutExercises.exerciseId, last: sql<string>`max(${workouts.date})` })
    .from(workoutExercises)
    .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
    .where(eq(workouts.userId, userId))
    .groupBy(workoutExercises.exerciseId)
    .orderBy(sql`max(${workouts.date}) desc`)
    .limit(limit);
  return rows.map((r) => r.id);
}

/** Completed working sets and volume per exercise in a date range (for muscle volume). */
export async function getExerciseSetCounts(userId: string, start: ISODate, end: ISODate, includeWarmups = false) {
  const warm = includeWarmups ? sql`true` : sql`${exerciseSets.setType} <> 'warmup'`;
  return db
    .select({
      exerciseId: exercises.id,
      muscleGroup: exercises.muscleGroup,
      secondaryMuscles: exercises.secondaryMuscles,
      sets: sql<number>`count(*)`.mapWith(Number),
      volume: sql<number>`coalesce(sum(${exerciseSets.weightKg} * ${exerciseSets.reps}), 0)`.mapWith(Number),
    })
    .from(exerciseSets)
    .innerJoin(workoutExercises, eq(workoutExercises.id, exerciseSets.workoutExerciseId))
    .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
    .innerJoin(exercises, eq(exercises.id, workoutExercises.exerciseId))
    .where(and(eq(workouts.userId, userId), eq(workouts.status, "completed"), eq(exerciseSets.completed, true), warm, gte(workouts.date, start), lte(workouts.date, end)))
    .groupBy(exercises.id);
}

/** Sessions and last date per exercise (for the library list). */
export async function getExerciseUsage(userId: string) {
  const rows = await db
    .select({
      exerciseId: workoutExercises.exerciseId,
      sessions: sql<number>`count(distinct ${workouts.id})`.mapWith(Number),
      last: sql<string>`max(${workouts.date})`,
    })
    .from(workoutExercises)
    .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
    .where(and(eq(workouts.userId, userId), eq(workouts.status, "completed")))
    .groupBy(workoutExercises.exerciseId);
  return Object.fromEntries(rows.map((r) => [r.exerciseId, { sessions: r.sessions, last: r.last }]));
}

/** Full history of one exercise: completed sets grouped by session (oldest first). */
export async function getExerciseHistory(userId: string, exerciseId: string) {
  const ex = (
    await db
      .select()
      .from(exercises)
      .where(and(eq(exercises.id, exerciseId), or(isNull(exercises.userId), eq(exercises.userId, userId))))
      .limit(1)
  )[0];
  if (!ex) return null;
  const [rows, settings, prs] = await Promise.all([
    db
      .select({
        workoutId: workouts.id,
        workoutName: workouts.name,
        date: workouts.date,
        startedAt: workouts.startedAt,
        setId: exerciseSets.id,
        setType: exerciseSets.setType,
        weightKg: exerciseSets.weightKg,
        reps: exerciseSets.reps,
        rir: exerciseSets.rir,
        durationSeconds: exerciseSets.durationSeconds,
        distanceM: exerciseSets.distanceM,
      })
      .from(exerciseSets)
      .innerJoin(workoutExercises, eq(workoutExercises.id, exerciseSets.workoutExerciseId))
      .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
      .where(and(eq(workouts.userId, userId), eq(workouts.status, "completed"), eq(exerciseSets.completed, true), eq(workoutExercises.exerciseId, exerciseId)))
      .orderBy(asc(workouts.date), asc(workouts.startedAt), asc(exerciseSets.setIndex)),
    db.select().from(exerciseSettingsTable).where(and(eq(exerciseSettingsTable.userId, userId), eq(exerciseSettingsTable.exerciseId, exerciseId))).limit(1),
    db
      .select({ type: personalRecords.type, value: personalRecords.value, previousValue: personalRecords.previousValue, weightKg: personalRecords.weightKg, reps: personalRecords.reps, date: personalRecords.date, workoutId: personalRecords.workoutId })
      .from(personalRecords)
      .where(and(eq(personalRecords.userId, userId), eq(personalRecords.exerciseId, exerciseId)))
      .orderBy(desc(personalRecords.date), desc(personalRecords.createdAt)),
  ]);
  const sessions: { workoutId: string; name: string; date: string; sets: typeof rows }[] = [];
  for (const r of rows) {
    const last = sessions[sessions.length - 1];
    if (last?.workoutId === r.workoutId) last.sets.push(r);
    else sessions.push({ workoutId: r.workoutId, name: r.workoutName, date: r.date, sets: [r] });
  }
  return { exercise: ex, sessions, settings: settings[0] ?? null, prs };
}

/** Current records (latest PR of each type per exercise) and the most recent PR events. */
export async function getRecordsOverview(userId: string) {
  const cols = {
    exerciseId: personalRecords.exerciseId,
    type: personalRecords.type,
    value: personalRecords.value,
    previousValue: personalRecords.previousValue,
    weightKg: personalRecords.weightKg,
    reps: personalRecords.reps,
    date: personalRecords.date,
    workoutId: personalRecords.workoutId,
    name: exercises.name,
    nameEl: exercises.nameEl,
  };
  const [current, recent] = await Promise.all([
    db
      .selectDistinctOn([personalRecords.exerciseId, personalRecords.type], cols)
      .from(personalRecords)
      .innerJoin(exercises, eq(exercises.id, personalRecords.exerciseId))
      .where(and(eq(personalRecords.userId, userId), inArray(personalRecords.type, ["e1rm", "weight", "reps"])))
      .orderBy(personalRecords.exerciseId, personalRecords.type, desc(personalRecords.date), desc(personalRecords.value)),
    db
      .select(cols)
      .from(personalRecords)
      .innerJoin(exercises, eq(exercises.id, personalRecords.exerciseId))
      .where(and(eq(personalRecords.userId, userId), inArray(personalRecords.type, ["e1rm", "weight", "reps", "session_volume"])))
      .orderBy(desc(personalRecords.date), desc(personalRecords.createdAt))
      .limit(40),
  ]);
  return { current, recent };
}

export async function getPrograms(userId: string) {
  const rows = await db
    .select({
      id: programs.id,
      name: programs.name,
      description: programs.description,
      scheduleType: programs.scheduleType,
      daysPerWeek: programs.daysPerWeek,
      isActive: programs.isActive,
      days: sql<number>`(select count(*) from program_days pd where pd.program_id = "programs"."id")`.mapWith(Number),
      lastUsed: sql<string | null>`(select max(w.date) from workouts w where w.program_id = "programs"."id" and w.status = 'completed')`,
    })
    .from(programs)
    .where(and(eq(programs.userId, userId), isNull(programs.archivedAt)))
    .orderBy(desc(programs.isActive), asc(programs.name));
  return rows;
}

export async function getProgramDetail(userId: string, id: string) {
  const program = (await db.select().from(programs).where(and(eq(programs.id, id), eq(programs.userId, userId))).limit(1))[0];
  if (!program) return null;
  const days = await db.select().from(programDays).where(eq(programDays.programId, id)).orderBy(asc(programDays.sortOrder));
  const exs = days.length
    ? await db.select().from(programExercises).where(inArray(programExercises.programDayId, days.map((d) => d.id))).orderBy(asc(programExercises.sortOrder))
    : [];
  return { program, days: days.map((d) => ({ ...d, exercises: exs.filter((e) => e.programDayId === d.id) })) };
}
