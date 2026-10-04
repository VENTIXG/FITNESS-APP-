import "server-only";
import { randomUUID } from "node:crypto";
import { eq, getTableColumns, sql, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { sha256 } from "@/server/auth/crypto";
import { db, type DbOrTx } from "@/server/db";
import * as s from "@/server/db/schema";

export const BACKUP_APP = "forge";
export const BACKUP_FORMAT = 1;

type Entry = {
  name: string;
  table: PgTable;
  /** Rows belonging to the user (direct userId or via parent). */
  where: (userId: string) => SQL;
  /** True when the table has its own userId column. */
  owned: boolean;
  photo?: boolean;
};

const byUser = (col: { name: string }) => (userId: string) => sql`${col} = ${userId}`;

/** Insert order (parents before children). Deletion runs in reverse. */
export const TABLES: Entry[] = [
  { name: "nutritionTargets", table: s.nutritionTargets, where: byUser(s.nutritionTargets.userId), owned: true },
  { name: "goals", table: s.goals, where: byUser(s.goals.userId), owned: true },
  { name: "weightEntries", table: s.weightEntries, where: byUser(s.weightEntries.userId), owned: true },
  { name: "bodyCompositionEntries", table: s.bodyCompositionEntries, where: byUser(s.bodyCompositionEntries.userId), owned: true },
  { name: "bodyMeasurements", table: s.bodyMeasurements, where: byUser(s.bodyMeasurements.userId), owned: true },
  { name: "progressPhotos", table: s.progressPhotos, where: byUser(s.progressPhotos.userId), owned: true, photo: true },
  { name: "progressPhotoData", table: s.progressPhotoData, where: (u) => sql`${s.progressPhotoData.photoId} in (select id from progress_photos where user_id = ${u})`, owned: false, photo: true },
  { name: "foods", table: s.foods, where: byUser(s.foods.userId), owned: true },
  { name: "favoriteFoods", table: s.favoriteFoods, where: byUser(s.favoriteFoods.userId), owned: true },
  { name: "recipes", table: s.recipes, where: byUser(s.recipes.userId), owned: true },
  { name: "recipeIngredients", table: s.recipeIngredients, where: (u) => sql`${s.recipeIngredients.recipeId} in (select id from recipes where user_id = ${u})`, owned: false },
  { name: "savedMeals", table: s.savedMeals, where: byUser(s.savedMeals.userId), owned: true },
  { name: "savedMealItems", table: s.savedMealItems, where: (u) => sql`${s.savedMealItems.savedMealId} in (select id from saved_meals where user_id = ${u})`, owned: false },
  { name: "foodEntries", table: s.foodEntries, where: byUser(s.foodEntries.userId), owned: true },
  { name: "exercises", table: s.exercises, where: byUser(s.exercises.userId), owned: true },
  { name: "exerciseSettings", table: s.exerciseSettings, where: byUser(s.exerciseSettings.userId), owned: true },
  { name: "programs", table: s.programs, where: byUser(s.programs.userId), owned: true },
  { name: "programDays", table: s.programDays, where: (u) => sql`${s.programDays.programId} in (select id from programs where user_id = ${u})`, owned: false },
  {
    name: "programExercises",
    table: s.programExercises,
    where: (u) => sql`${s.programExercises.programDayId} in (select pd.id from program_days pd join programs p on p.id = pd.program_id where p.user_id = ${u})`,
    owned: false,
  },
  { name: "workouts", table: s.workouts, where: byUser(s.workouts.userId), owned: true },
  { name: "workoutExercises", table: s.workoutExercises, where: (u) => sql`${s.workoutExercises.workoutId} in (select id from workouts where user_id = ${u})`, owned: false },
  {
    name: "exerciseSets",
    table: s.exerciseSets,
    where: (u) => sql`${s.exerciseSets.workoutExerciseId} in (select we.id from workout_exercises we join workouts w on w.id = we.workout_id where w.user_id = ${u})`,
    owned: false,
  },
  { name: "personalRecords", table: s.personalRecords, where: byUser(s.personalRecords.userId), owned: true },
  { name: "cardioSessions", table: s.cardioSessions, where: byUser(s.cardioSessions.userId), owned: true },
  { name: "stepEntries", table: s.stepEntries, where: byUser(s.stepEntries.userId), owned: true },
  { name: "waterEntries", table: s.waterEntries, where: byUser(s.waterEntries.userId), owned: true },
  { name: "sleepEntries", table: s.sleepEntries, where: byUser(s.sleepEntries.userId), owned: true },
  { name: "supplements", table: s.supplements, where: byUser(s.supplements.userId), owned: true },
  { name: "supplementLogs", table: s.supplementLogs, where: byUser(s.supplementLogs.userId), owned: true },
  { name: "habits", table: s.habits, where: byUser(s.habits.userId), owned: true },
  { name: "habitLogs", table: s.habitLogs, where: byUser(s.habitLogs.userId), owned: true },
  { name: "dailyNotes", table: s.dailyNotes, where: byUser(s.dailyNotes.userId), owned: true },
  { name: "weeklyReports", table: s.weeklyReports, where: byUser(s.weeklyReports.userId), owned: true },
  { name: "healthMetrics", table: s.healthMetrics, where: byUser(s.healthMetrics.userId), owned: true },
];

const PROFILE_FIELDS = ["displayName", "sex", "birthDate", "heightCm", "activityLevel", "primaryGoal", "trainingDaysPerWeek", "unitSystem", "locale", "theme", "timezone", "weekStartsOn"] as const;

export type Backup = {
  app: typeof BACKUP_APP;
  format: number;
  exportedAt: string;
  /** Hash of the owner's id: same owner → ids are kept, other owner → ids are remapped. */
  owner: string;
  includesPhotos: boolean;
  profile: Record<string, unknown> | null;
  preferences: Record<string, unknown> | null;
  tables: Record<string, Record<string, unknown>[]>;
};

function serialize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return { $bytes: value.toString("base64") };
  return value;
}

export async function exportUserData(userId: string, opts: { photos: boolean }): Promise<Backup> {
  const tables: Backup["tables"] = {};
  for (const e of TABLES) {
    if (e.photo && !opts.photos) continue;
    const rows = await db.select().from(e.table).where(e.where(userId));
    tables[e.name] = rows.map((r) => Object.fromEntries(Object.entries(r as Record<string, unknown>).map(([k, v]) => [k, serialize(v)])));
  }
  const profile = (await db.select().from(s.profiles).where(eq(s.profiles.userId, userId)).limit(1))[0];
  const prefs = (await db.select().from(s.userPreferences).where(eq(s.userPreferences.userId, userId)).limit(1))[0];
  return {
    app: BACKUP_APP,
    format: BACKUP_FORMAT,
    exportedAt: new Date().toISOString(),
    owner: sha256(`backup-owner:${userId}`),
    includesPhotos: opts.photos,
    profile: profile ? Object.fromEntries(PROFILE_FIELDS.map((k) => [k, serialize(profile[k])])) : null,
    preferences: prefs ? { goals: prefs.goals, training: prefs.training, nutrition: prefs.nutrition, dashboard: prefs.dashboard, scoring: prefs.scoring, notifications: prefs.notifications } : null,
    tables,
  };
}

export function isBackup(value: unknown): value is Backup {
  const v = value as Backup;
  return !!v && v.app === BACKUP_APP && typeof v.format === "number" && v.format <= BACKUP_FORMAT && typeof v.tables === "object" && v.tables !== null;
}

export function backupSummary(b: Backup) {
  return Object.fromEntries(TABLES.map((e) => [e.name, Array.isArray(b.tables[e.name]) ? b.tables[e.name].length : 0]));
}

/** Deletes all of a user's tracked data (login, profile and sessions remain). */
export async function deleteUserData(tx: DbOrTx, userId: string, { preferences }: { preferences: boolean }) {
  for (const e of [...TABLES].reverse()) {
    if (!e.owned) continue; // children cascade from their parents
    await tx.delete(e.table).where(e.where(userId));
  }
  await tx.delete(s.notificationDeliveries).where(eq(s.notificationDeliveries.userId, userId));
  if (preferences) await tx.delete(s.userPreferences).where(eq(s.userPreferences.userId, userId));
}

const isIdKey = (k: string) => (k === "id" || k.endsWith("Id")) && k !== "userId" && k !== "externalId";

/** Converts JSON values back to column types (timestamps → Date, bytes → Buffer). */
function revive(table: PgTable, row: Record<string, unknown>) {
  const cols = getTableColumns(table) as Record<string, { dataType: string; columnType: string }>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    const col = cols[k];
    if (!col) continue; // unknown column from a newer/older format
    if (v && typeof v === "object" && "$bytes" in (v as object)) out[k] = Buffer.from(String((v as { $bytes: string }).$bytes), "base64");
    else if (typeof v === "string" && col.dataType === "date" && col.columnType === "PgTimestamp") out[k] = new Date(v);
    else out[k] = v;
  }
  return out;
}

export async function restoreUserData(userId: string, backup: Backup, mode: "merge" | "replace") {
  const sameOwner = backup.owner === sha256(`backup-owner:${userId}`);
  const idMap = new Map<string, string>();
  if (!sameOwner) {
    // Fresh ids for everything in the backup so rows can never collide with another account's.
    for (const e of TABLES) for (const r of backup.tables[e.name] ?? []) if (typeof r.id === "string") idMap.set(r.id, randomUUID());
  }
  const remap = (row: Record<string, unknown>) => {
    if (sameOwner) return row;
    const out: Record<string, unknown> = { ...row };
    for (const [k, v] of Object.entries(out)) if (isIdKey(k) && typeof v === "string" && idMap.has(v)) out[k] = idMap.get(v);
    return out;
  };

  return db.transaction(async (tx) => {
    let inserted = 0;
    let skipped = 0;
    if (mode === "replace") {
      await deleteUserData(tx, userId, { preferences: false });
      if (backup.profile) {
        const values = Object.fromEntries(PROFILE_FIELDS.filter((k) => k in backup.profile!).map((k) => [k, backup.profile![k]]));
        await tx.update(s.profiles).set(values).where(eq(s.profiles.userId, userId));
      }
      if (backup.preferences) {
        await tx
          .insert(s.userPreferences)
          .values({ userId, ...backup.preferences })
          .onConflictDoUpdate({ target: s.userPreferences.userId, set: { ...backup.preferences, updatedAt: sql`now()` } });
      }
    } else {
      // Merge must not create a second active program/goal (partial unique indexes).
      const activeProgram = await tx.select({ id: s.programs.id }).from(s.programs).where(sql`${s.programs.userId} = ${userId} and ${s.programs.isActive}`);
      const activeGoal = await tx.select({ id: s.goals.id }).from(s.goals).where(sql`${s.goals.userId} = ${userId} and ${s.goals.status} = 'active'`);
      for (const r of backup.tables.programs ?? []) if (activeProgram.length) r.isActive = false;
      for (const r of backup.tables.goals ?? []) if (activeGoal.length && r.status === "active") r.status = "archived";
    }
    for (const e of TABLES) {
      const rows = backup.tables[e.name];
      if (!Array.isArray(rows) || !rows.length) continue;
      const prepared = rows.map((r) => {
        const row = revive(e.table, remap(r));
        if (e.owned) row.userId = userId;
        return row;
      });
      // Children whose parent wasn't restored (e.g. skipped duplicate) would violate FKs; insert in chunks, skipping conflicts.
      for (let i = 0; i < prepared.length; i += 500) {
        const chunk = prepared.slice(i, i + 500);
        const res = await tx.insert(e.table).values(chunk as never).onConflictDoNothing().returning();
        inserted += res.length;
        skipped += chunk.length - res.length;
      }
    }
    return { inserted, skipped, remapped: !sameOwner };
  });
}

/** Row counts per table for a user (shown on the Data page). */
export async function countUserRows(userId: string) {
  const out: Record<string, number> = {};
  for (const e of TABLES) {
    const [{ n }] = await db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(e.table).where(e.where(userId));
    out[e.name] = n;
  }
  return out;
}

