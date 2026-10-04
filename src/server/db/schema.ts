/**
 * FORGE relational schema (PostgreSQL, Drizzle ORM, snake_case columns).
 *
 * Conventions
 * - All personal data rows carry `user_id` (FK → users, ON DELETE CASCADE) and every
 *   read/write in the data-access layer is scoped to the session user.
 * - Day-based logs use a local calendar `date` (YYYY-MM-DD in the user's timezone);
 *   instants use `timestamptz`.
 * - Canonical units: kg, cm, ml, metres, seconds, kcal. Conversion happens at the edges.
 * - Food entries snapshot nutrients at logging time so editing a food never rewrites history.
 * - `is_demo` marks rows created by the demo-data generator so they can be removed
 *   without touching real data.
 * - Row-level security is enabled (deny-by-default) on every table. The app connects as
 *   the table owner and is unaffected; this blocks access through Supabase's public
 *   REST/GraphQL APIs if the schema is deployed there.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  ACTIVITY_LEVELS,
  AUTO_HABIT_METRICS,
  BASE_UNITS,
  BODY_FAT_METHODS,
  CARDIO_ACTIVITIES,
  DATA_SOURCES,
  EQUIPMENT,
  EXERCISE_CATEGORIES,
  FOOD_SOURCES,
  GOAL_STATUSES,
  HABIT_SCHEDULES,
  HABIT_TYPES,
  HEALTH_METRICS,
  LOCALES,
  MUSCLE_GROUPS,
  PHOTO_POSES,
  PR_TYPES,
  PRIMARY_GOALS,
  SCHEDULE_TYPES,
  SET_TYPES,
  SEXES,
  SUPPLEMENT_SCHEDULES,
  SUPPLEMENT_TIMINGS,
  THEMES,
  TRACKING_TYPES,
  UNIT_SYSTEMS,
  WORKOUT_STATUSES,
} from "@/lib/domain";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
const localDate = () => date({ mode: "string" });
const userId = () =>
  uuid()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" });
const isDemo = () => boolean().notNull().default(false);
const source = () => text({ enum: DATA_SOURCES }).notNull().default("manual");

export type FoodServing = {
  /** Stable id within the food (e.g. "slice"). */
  id: string;
  /** Display label, e.g. "1 slice" or "1 scoop (30 g)". */
  label: string;
  /** Greek label (built-in foods). */
  labelEl?: string;
  /** Amount in the food's base unit (g or ml) for ONE of this serving. */
  amount: number;
};

// ---------------------------------------------------------------------------
// identity & auth
// ---------------------------------------------------------------------------

export const users = pgTable(
  "users",
  {
    id: uuid().primaryKey().defaultRandom(),
    email: text().notNull(),
    passwordHash: text().notNull(),
    /** Accounts created by `pnpm db:seed` for previewing; never count as the owner. */
    isDemoAccount: boolean().notNull().default(false),
    lastLoginAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("users_email_unique").on(sql`lower(${t.email})`)],
).enableRLS();

export const sessions = pgTable(
  "sessions",
  {
    /** SHA-256 of the session token; the raw token only lives in the cookie. */
    id: text().primaryKey(),
    userId: userId(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    lastSeenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    userAgent: text(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId), index("sessions_expires_idx").on(t.expiresAt)],
).enableRLS();

export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** e.g. "email:me@example.com" or "ip:203.0.113.4" */
    identifier: text().notNull(),
    succeeded: boolean().notNull(),
    attemptedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("login_attempts_identifier_idx").on(t.identifier, t.attemptedAt)],
).enableRLS();

/** Personal access tokens for the ingest API (Apple Health Shortcuts, Health Connect bridges, scripts). */
export const apiTokens = pgTable(
  "api_tokens",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: userId(),
    name: text().notNull(),
    tokenHash: text().notNull(),
    /** First characters of the token, shown in the UI to identify it. */
    prefix: text().notNull(),
    scopes: text().array().notNull().default(sql`'{ingest}'::text[]`),
    lastUsedAt: timestamp({ withTimezone: true }),
    revokedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("api_tokens_hash_unique").on(t.tokenHash), index("api_tokens_user_idx").on(t.userId)],
).enableRLS();

// ---------------------------------------------------------------------------
// profile & preferences
// ---------------------------------------------------------------------------

export const profiles = pgTable(
  "profiles",
  {
    userId: uuid()
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    displayName: text(),
    sex: text({ enum: SEXES }),
    birthDate: localDate(),
    heightCm: doublePrecision(),
    activityLevel: text({ enum: ACTIVITY_LEVELS }).notNull().default("moderate"),
    primaryGoal: text({ enum: PRIMARY_GOALS }).notNull().default("lose_fat"),
    trainingDaysPerWeek: smallint(),
    timezone: text().notNull().default("UTC"),
    locale: text({ enum: LOCALES }).notNull().default("en"),
    unitSystem: text({ enum: UNIT_SYSTEMS }).notNull().default("metric"),
    theme: text({ enum: THEMES }).notNull().default("dark"),
    /** 0 = Sunday, 1 = Monday */
    weekStartsOn: smallint().notNull().default(1),
    onboardingCompletedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("profiles_height_range", sql`${t.heightCm} IS NULL OR (${t.heightCm} BETWEEN 50 AND 280)`),
    check("profiles_week_start", sql`${t.weekStartsOn} IN (0, 1)`),
  ],
).enableRLS();

/** App preferences. JSON blobs are validated with Zod schemas in src/lib/preferences.ts. */
export const userPreferences = pgTable("user_preferences", {
  userId: uuid()
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  goals: jsonb().notNull().default({}),
  training: jsonb().notNull().default({}),
  nutrition: jsonb().notNull().default({}),
  dashboard: jsonb().notNull().default({}),
  scoring: jsonb().notNull().default({}),
  notifications: jsonb().notNull().default({}),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}).enableRLS();

/**
 * Nutrition targets with history: the target in force on a day is the latest row
 * with effective_from <= that day, so past adherence stays correct after changes.
 */
export const nutritionTargets = pgTable(
  "nutrition_targets",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: userId(),
    effectiveFrom: localDate().notNull(),
    calories: integer().notNull(),
    proteinG: doublePrecision().notNull(),
    carbsG: doublePrecision().notNull(),
    fatG: doublePrecision().notNull(),
    fiberG: doublePrecision().notNull(),
    sugarG: doublePrecision(),
    sodiumMg: doublePrecision(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("nutrition_targets_user_from_unique").on(t.userId, t.effectiveFrom),
    check("nutrition_targets_calories_range", sql`${t.calories} BETWEEN 500 AND 10000`),
  ],
).enableRLS();

export const goals = pgTable(
  "goals",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: userId(),
    startDate: localDate().notNull(),
    startWeightKg: doublePrecision().notNull(),
    targetWeightKg: doublePrecision().notNull(),
    targetBodyFatPct: doublePrecision(),
    targetDate: localDate(),
    status: text({ enum: GOAL_STATUSES }).notNull().default("active"),
    completedAt: timestamp({ withTimezone: true }),
    notes: text(),
    isDemo: isDemo(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("goals_user_idx").on(t.userId, t.status),
    uniqueIndex("goals_one_active_per_user").on(t.userId).where(sql`${t.status} = 'active'`),
    check("goals_weights_range", sql`${t.startWeightKg} BETWEEN 20 AND 400 AND ${t.targetWeightKg} BETWEEN 20 AND 400`),
  ],
).enableRLS();

// ---------------------------------------------------------------------------
// body
// ---------------------------------------------------------------------------

export const weightEntries = pgTable(
  "weight_entries",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: userId(),
    date: localDate().notNull(),
    weightKg: doublePrecision().notNull(),
    note: text(),
    source: source(),
    measuredAt: timestamp({ withTimezone: true }),
    isDemo: isDemo(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("weight_entries_user_date_unique").on(t.userId, t.date),
    check("weight_entries_range", sql`${t.weightKg} BETWEEN 20 AND 400`),
  ],
).enableRLS();

export const bodyCompositionEntries = pgTable(
  "body_composition_entries",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: userId(),
    date: localDate().notNull(),
    bodyFatPct: doublePrecision(),
    leanMassKg: doublePrecision(),
    fatMassKg: doublePrecision(),
    method: text({ enum: BODY_FAT_METHODS }),
    note: text(),
    source: source(),
    isDemo: isDemo(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("body_comp_user_date_unique").on(t.userId, t.date),
    check("body_comp_bf_range", sql`${t.bodyFatPct} IS NULL OR (${t.bodyFatPct} BETWEEN 2 AND 75)`),
  ],
).enableRLS();

export const bodyMeasurements = pgTable(
  "body_measurements",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: userId(),
    date: localDate().notNull(),
    waistCm: doublePrecision(),
    chestCm: doublePrecision(),
    neckCm: doublePrecision(),
    shouldersCm: doublePrecision(),
    leftArmCm: doublePrecision(),
    rightArmCm: doublePrecision(),
    hipsCm: doublePrecision(),
    leftThighCm: doublePrecision(),
    rightThighCm: doublePrecision(),
    calfCm: doublePrecision(),
    note: text(),
    isDemo: isDemo(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("body_measurements_user_date_unique").on(t.userId, t.date)],
).enableRLS();

/** Photo metadata. Image bytes live in `progress_photo_data` so listings never load blobs. */
export const progressPhotos = pgTable(
  "progress_photos",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: userId(),
    date: localDate().notNull(),
    pose: text({ enum: PHOTO_POSES }).notNull().default("front"),
    note: text(),
    width: integer().notNull(),
    height: integer().notNull(),
    mimeType: text().notNull(),
    sizeBytes: integer().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("progress_photos_user_date_idx").on(t.userId, t.date)],
).enableRLS();

export const progressPhotoData = pgTable("progress_photo_data", {
  photoId: uuid()
    .primaryKey()
    .references(() => progressPhotos.id, { onDelete: "cascade" }),
  image: bytea().notNull(),
  thumbnail: bytea().notNull(),
}).enableRLS();

// ---------------------------------------------------------------------------
// nutrition
// ---------------------------------------------------------------------------

/**
 * Foods. `user_id IS NULL` rows are the built-in catalog (synced from code by
 * `pnpm db:migrate`). Nutrients are per 100 base units (g or ml).
 */
export const foods = pgTable(
  "foods",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid().references(() => users.id, { onDelete: "cascade" }),
    builtinKey: text(),
    name: text().notNull(),
    nameEl: text(),
    brand: text(),
    barcode: text(),
    baseUnit: text({ enum: BASE_UNITS }).notNull().default("g"),
    calories: doublePrecision().notNull(),
    proteinG: doublePrecision().notNull().default(0),
    carbsG: doublePrecision().notNull().default(0),
    fatG: doublePrecision().notNull().default(0),
    fiberG: doublePrecision().notNull().default(0),
    sugarG: doublePrecision(),
    sodiumMg: doublePrecision(),
    servings: jsonb().$type<FoodServing[]>().notNull().default([]),
    defaultServingId: text(),
    source: text({ enum: FOOD_SOURCES }).notNull().default("custom"),
    externalId: text(),
    archivedAt: timestamp({ withTimezone: true }),
    isDemo: isDemo(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("foods_user_idx").on(t.userId),
    index("foods_barcode_idx").on(t.barcode),
    uniqueIndex("foods_builtin_key_unique").on(t.builtinKey),
    check("foods_calories_range", sql`${t.calories} >= 0 AND ${t.calories} <= 1000`),
  ],
).enableRLS();

export const favoriteFoods = pgTable(
  "favorite_foods",
  {
    userId: userId(),
    foodId: uuid()
      .notNull()
      .references(() => foods.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.foodId] })],
).enableRLS();

export const recipes = pgTable(
  "recipes",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: userId(),
    name: text().notNull(),
    servings: doublePrecision().notNull().default(1),
    /** Final cooked weight in grams, enables logging recipes by weight. */
    totalWeightG: doublePrecision(),
    instructions: text(),
    isFavorite: boolean().notNull().default(false),
    archivedAt: timestamp({ withTimezone: true }),
    isDemo: isDemo(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("recipes_user_idx").on(t.userId), check("recipes_servings_positive", sql`${t.servings} > 0`)],
).enableRLS();

export const recipeIngredients = pgTable(
  "recipe_ingredients",
  {
    id: uuid().primaryKey().defaultRandom(),
    recipeId: uuid()
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    foodId: uuid()
      .notNull()
      .references(() => foods.id, { onDelete: "restrict" }),
    quantity: doublePrecision().notNull(),
    unit: text().notNull(),
    baseAmount: doublePrecision().notNull(),
    sortOrder: integer().notNull().default(0),
  },
  (t) => [index("recipe_ingredients_recipe_idx").on(t.recipeId), index("recipe_ingredients_food_idx").on(t.foodId)],
).enableRLS();

/** A saved combination of foods/recipes that can be logged in one tap. */
export const savedMeals = pgTable(
  "saved_meals",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: userId(),
    name: text().notNull(),
    mealSlot: text(),
    isFavorite: boolean().notNull().default(false),
    useCount: integer().notNull().default(0),
    lastUsedAt: timestamp({ withTimezone: true }),
    isDemo: isDemo(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("saved_meals_user_idx").on(t.userId)],
).enableRLS();

export const savedMealItems = pgTable(
  "saved_meal_items",
  {
    id: uuid().primaryKey().defaultRandom(),
    savedMealId: uuid()
      .notNull()
      .references(() => savedMeals.id, { onDelete: "cascade" }),
    foodId: uuid().references(() => foods.id, { onDelete: "restrict" }),
    recipeId: uuid().references(() => recipes.id, { onDelete: "restrict" }),
    quantity: doublePrecision().notNull(),
    unit: text().notNull(),
    baseAmount: doublePrecision(),
    sortOrder: integer().notNull().default(0),
  },
  (t) => [
    index("saved_meal_items_meal_idx").on(t.savedMealId),
    check("saved_meal_items_one_ref", sql`(${t.foodId} IS NULL) <> (${t.recipeId} IS NULL)`),
  ],
).enableRLS();

export const foodEntries = pgTable(
  "food_entries",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: userId(),
    date: localDate().notNull(),
    mealSlot: text().notNull(),
    foodId: uuid().references(() => foods.id, { onDelete: "set null" }),
    recipeId: uuid().references(() => recipes.id, { onDelete: "set null" }),
    name: text().notNull(),
    brand: text(),
    quantity: doublePrecision().notNull(),
    unit: text().notNull(),
    baseAmount: doublePrecision(),
    calories: doublePrecision().notNull(),
    proteinG: doublePrecision().notNull().default(0),
    carbsG: doublePrecision().notNull().default(0),
    fatG: doublePrecision().notNull().default(0),
    fiberG: doublePrecision().notNull().default(0),
    sugarG: doublePrecision(),
    sodiumMg: doublePrecision(),
    sortOrder: integer().notNull().default(0),
    loggedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    isDemo: isDemo(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("food_entries_user_date_idx").on(t.userId, t.date),
    index("food_entries_user_food_idx").on(t.userId, t.foodId),
    index("food_entries_user_logged_idx").on(t.userId, t.loggedAt),
    check("food_entries_quantity_positive", sql`${t.quantity} > 0`),
    check("food_entries_calories_range", sql`${t.calories} >= 0 AND ${t.calories} <= 20000`),
  ],
).enableRLS();

// ---------------------------------------------------------------------------
// training
// ---------------------------------------------------------------------------

/** Exercises. `user_id IS NULL` rows are the built-in catalog. */
export const exercises = pgTable(
  "exercises",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid().references(() => users.id, { onDelete: "cascade" }),
    builtinKey: text(),
    name: text().notNull(),
    /** Greek display name for built-in exercises (custom exercises use `name`). */
    nameEl: text(),
    muscleGroup: text({ enum: MUSCLE_GROUPS }).notNull(),
    secondaryMuscles: text({ enum: MUSCLE_GROUPS }).array().notNull().default(sql`'{}'::text[]`),
    equipment: text({ enum: EQUIPMENT }).notNull(),
    category: text({ enum: EXERCISE_CATEGORIES }).notNull().default("compound"),
    trackingType: text({ enum: TRACKING_TYPES }).notNull().default("weight_reps"),
    instructions: text(),
    archivedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("exercises_user_idx").on(t.userId), uniqueIndex("exercises_builtin_key_unique").on(t.builtinKey)],
).enableRLS();

/** Per-user overrides for an exercise (built-in or custom): notes, rep range, increment, rest. */
export const exerciseSettings = pgTable(
  "exercise_settings",
  {
    userId: userId(),
    exerciseId: uuid()
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    notes: text(),
    repMin: smallint(),
    repMax: smallint(),
    incrementKg: doublePrecision(),
    restSeconds: integer(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.exerciseId] })],
).enableRLS();

export const programs = pgTable(
  "programs",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: userId(),
    name: text().notNull(),
    description: text(),
    scheduleType: text({ enum: SCHEDULE_TYPES }).notNull().default("rotation"),
    /** Planned sessions per week for rotation schedules. */
    daysPerWeek: smallint(),
    isActive: boolean().notNull().default(false),
    archivedAt: timestamp({ withTimezone: true }),
    isDemo: isDemo(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("programs_user_idx").on(t.userId),
    uniqueIndex("programs_one_active_per_user").on(t.userId).where(sql`${t.isActive}`),
  ],
).enableRLS();

export const programDays = pgTable(
  "program_days",
  {
    id: uuid().primaryKey().defaultRandom(),
    programId: uuid()
      .notNull()
      .references(() => programs.id, { onDelete: "cascade" }),
    name: text().notNull(),
    sortOrder: integer().notNull().default(0),
    /** Weekly schedules: ISO-ish weekday numbers 0 (Sun) – 6 (Sat). */
    weekdays: smallint().array().notNull().default(sql`'{}'::smallint[]`),
    notes: text(),
  },
  (t) => [index("program_days_program_idx").on(t.programId)],
).enableRLS();

export const programExercises = pgTable(
  "program_exercises",
  {
    id: uuid().primaryKey().defaultRandom(),
    programDayId: uuid()
      .notNull()
      .references(() => programDays.id, { onDelete: "cascade" }),
    exerciseId: uuid()
      .notNull()
      .references(() => exercises.id, { onDelete: "restrict" }),
    sortOrder: integer().notNull().default(0),
    targetSets: smallint().notNull().default(3),
    repMin: smallint(),
    repMax: smallint(),
    targetRir: doublePrecision(),
    restSeconds: integer(),
    notes: text(),
  },
  (t) => [index("program_exercises_day_idx").on(t.programDayId)],
).enableRLS();

export const workouts = pgTable(
  "workouts",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: userId(),
    date: localDate().notNull(),
    name: text().notNull(),
    programId: uuid().references(() => programs.id, { onDelete: "set null" }),
    programDayId: uuid().references(() => programDays.id, { onDelete: "set null" }),
    status: text({ enum: WORKOUT_STATUSES }).notNull().default("in_progress"),
    startedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp({ withTimezone: true }),
    durationSeconds: integer(),
    notes: text(),
    /** Session RPE 1–10 (optional). */
    sessionRpe: doublePrecision(),
    bodyweightKg: doublePrecision(),
    isDemo: isDemo(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("workouts_user_date_idx").on(t.userId, t.date), index("workouts_user_status_idx").on(t.userId, t.status)],
).enableRLS();

/** Rows in a workout. Ids are generated client-side so the logger can sync idempotently. */
export const workoutExercises = pgTable(
  "workout_exercises",
  {
    id: uuid().primaryKey(),
    workoutId: uuid()
      .notNull()
      .references(() => workouts.id, { onDelete: "cascade" }),
    exerciseId: uuid()
      .notNull()
      .references(() => exercises.id, { onDelete: "restrict" }),
    sortOrder: integer().notNull().default(0),
    notes: text(),
    repMin: smallint(),
    repMax: smallint(),
    restSeconds: integer(),
  },
  (t) => [index("workout_exercises_workout_idx").on(t.workoutId), index("workout_exercises_exercise_idx").on(t.exerciseId)],
).enableRLS();

export const exerciseSets = pgTable(
  "exercise_sets",
  {
    id: uuid().primaryKey(),
    workoutExerciseId: uuid()
      .notNull()
      .references(() => workoutExercises.id, { onDelete: "cascade" }),
    setIndex: smallint().notNull(),
    setType: text({ enum: SET_TYPES }).notNull().default("normal"),
    weightKg: doublePrecision(),
    reps: smallint(),
    rir: doublePrecision(),
    durationSeconds: integer(),
    distanceM: doublePrecision(),
    completed: boolean().notNull().default(false),
    completedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index("exercise_sets_workout_exercise_idx").on(t.workoutExerciseId),
    check("exercise_sets_weight_range", sql`${t.weightKg} IS NULL OR (${t.weightKg} >= 0 AND ${t.weightKg} <= 1500)`),
    check("exercise_sets_reps_range", sql`${t.reps} IS NULL OR (${t.reps} >= 0 AND ${t.reps} <= 1000)`),
  ],
).enableRLS();

/**
 * PR events: one row each time a record was beaten (baseline sessions don't create rows).
 * Rebuilt per exercise whenever its history changes, so edits/deletes never leave stale PRs.
 */
export const personalRecords = pgTable(
  "personal_records",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: userId(),
    exerciseId: uuid()
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    workoutId: uuid()
      .notNull()
      .references(() => workouts.id, { onDelete: "cascade" }),
    setId: uuid().references(() => exerciseSets.id, { onDelete: "set null" }),
    type: text({ enum: PR_TYPES }).notNull(),
    value: doublePrecision().notNull(),
    previousValue: doublePrecision(),
    weightKg: doublePrecision(),
    reps: smallint(),
    date: localDate().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("personal_records_user_exercise_idx").on(t.userId, t.exerciseId),
    index("personal_records_user_date_idx").on(t.userId, t.date),
    index("personal_records_workout_idx").on(t.workoutId),
  ],
).enableRLS();

// ---------------------------------------------------------------------------
// activity & lifestyle
// ---------------------------------------------------------------------------

export const cardioSessions = pgTable(
  "cardio_sessions",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: userId(),
    date: localDate().notNull(),
    activity: text({ enum: CARDIO_ACTIVITIES }).notNull(),
    startedAt: timestamp({ withTimezone: true }),
    durationSeconds: integer().notNull(),
    distanceM: doublePrecision(),
    avgHeartRate: smallint(),
    maxHeartRate: smallint(),
    calories: integer(),
    inclinePct: doublePrecision(),
    speedKmh: doublePrecision(),
    notes: text(),
    source: source(),
    externalId: text(),
    isDemo: isDemo(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("cardio_sessions_user_date_idx").on(t.userId, t.date),
    uniqueIndex("cardio_sessions_external_unique")
      .on(t.userId, t.source, t.externalId)
      .where(sql`${t.externalId} IS NOT NULL`),
    check("cardio_duration_range", sql`${t.durationSeconds} > 0 AND ${t.durationSeconds} <= 86400`),
  ],
).enableRLS();

/** One row per day per source, so manual and imported counts stay separate. */
export const stepEntries = pgTable(
  "step_entries",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: userId(),
    date: localDate().notNull(),
    steps: integer().notNull(),
    source: source(),
    isDemo: isDemo(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("step_entries_user_date_source_unique").on(t.userId, t.date, t.source),
    check("step_entries_range", sql`${t.steps} >= 0 AND ${t.steps} <= 200000`),
  ],
).enableRLS();

export const waterEntries = pgTable(
  "water_entries",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: userId(),
    date: localDate().notNull(),
    amountMl: integer().notNull(),
    loggedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    isDemo: isDemo(),
    createdAt: createdAt(),
  },
  (t) => [
    index("water_entries_user_date_idx").on(t.userId, t.date),
    check("water_entries_range", sql`${t.amountMl} > 0 AND ${t.amountMl} <= 5000`),
  ],
).enableRLS();

/** `date` is the wake-up date (the night of the 3rd→4th is stored on the 4th). */
export const sleepEntries = pgTable(
  "sleep_entries",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: userId(),
    date: localDate().notNull(),
    bedTime: time(),
    wakeTime: time(),
    durationMinutes: integer().notNull(),
    quality: smallint(),
    note: text(),
    source: source(),
    isDemo: isDemo(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("sleep_entries_user_date_source_unique").on(t.userId, t.date, t.source),
    check("sleep_duration_range", sql`${t.durationMinutes} > 0 AND ${t.durationMinutes} <= 1440`),
    check("sleep_quality_range", sql`${t.quality} IS NULL OR (${t.quality} BETWEEN 1 AND 5)`),
  ],
).enableRLS();

export const supplements = pgTable(
  "supplements",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: userId(),
    name: text().notNull(),
    dose: doublePrecision(),
    doseUnit: text(),
    schedule: text({ enum: SUPPLEMENT_SCHEDULES }).notNull().default("daily"),
    daysOfWeek: smallint().array().notNull().default(sql`'{}'::smallint[]`),
    timing: text({ enum: SUPPLEMENT_TIMINGS }),
    notes: text(),
    isActive: boolean().notNull().default(true),
    sortOrder: integer().notNull().default(0),
    isDemo: isDemo(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("supplements_user_idx").on(t.userId)],
).enableRLS();

export const supplementLogs = pgTable(
  "supplement_logs",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: userId(),
    supplementId: uuid()
      .notNull()
      .references(() => supplements.id, { onDelete: "cascade" }),
    date: localDate().notNull(),
    takenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("supplement_logs_unique").on(t.supplementId, t.date),
    index("supplement_logs_user_date_idx").on(t.userId, t.date),
  ],
).enableRLS();

export const habits = pgTable(
  "habits",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: userId(),
    name: text().notNull(),
    type: text({ enum: HABIT_TYPES }).notNull().default("manual"),
    autoMetric: text({ enum: AUTO_HABIT_METRICS }),
    schedule: text({ enum: HABIT_SCHEDULES }).notNull().default("daily"),
    daysOfWeek: smallint().array().notNull().default(sql`'{}'::smallint[]`),
    icon: text(),
    isActive: boolean().notNull().default(true),
    sortOrder: integer().notNull().default(0),
    isDemo: isDemo(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("habits_user_idx").on(t.userId),
    check("habits_auto_metric", sql`(${t.type} = 'auto') = (${t.autoMetric} IS NOT NULL)`),
  ],
).enableRLS();

/** Manual habit completion: a row means "done on that date". Auto habits are computed. */
export const habitLogs = pgTable(
  "habit_logs",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: userId(),
    habitId: uuid()
      .notNull()
      .references(() => habits.id, { onDelete: "cascade" }),
    date: localDate().notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("habit_logs_unique").on(t.habitId, t.date), index("habit_logs_user_date_idx").on(t.userId, t.date)],
).enableRLS();

export const dailyNotes = pgTable(
  "daily_notes",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: userId(),
    date: localDate().notNull(),
    content: text().notNull().default(""),
    tags: text().array().notNull().default(sql`'{}'::text[]`),
    energy: smallint(),
    isDemo: isDemo(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("daily_notes_user_date_unique").on(t.userId, t.date),
    check("daily_notes_energy_range", sql`${t.energy} IS NULL OR (${t.energy} BETWEEN 1 AND 5)`),
  ],
).enableRLS();

/** Weekly reports are computed live; this stores the user's reflection for a week. */
export const weeklyReports = pgTable(
  "weekly_reports",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: userId(),
    weekStart: localDate().notNull(),
    reflection: text(),
    rating: smallint(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("weekly_reports_user_week_unique").on(t.userId, t.weekStart),
    check("weekly_reports_rating_range", sql`${t.rating} IS NULL OR (${t.rating} BETWEEN 1 AND 5)`),
  ],
).enableRLS();

/** Daily metrics imported from wearables (resting HR, HRV, active energy, ...). */
export const healthMetrics = pgTable(
  "health_metrics",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: userId(),
    date: localDate().notNull(),
    metric: text({ enum: HEALTH_METRICS }).notNull(),
    value: doublePrecision().notNull(),
    source: source(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("health_metrics_unique").on(t.userId, t.date, t.metric, t.source)],
).enableRLS();

// ---------------------------------------------------------------------------
// notifications
// ---------------------------------------------------------------------------

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: userId(),
    endpoint: text().notNull(),
    p256dh: text().notNull(),
    auth: text().notNull(),
    userAgent: text(),
    lastSuccessAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("push_subscriptions_endpoint_unique").on(t.endpoint), index("push_subscriptions_user_idx").on(t.userId)],
).enableRLS();

/** Prevents sending the same reminder twice on one local day. */
export const notificationDeliveries = pgTable(
  "notification_deliveries",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: userId(),
    kind: text().notNull(),
    date: localDate().notNull(),
    sentAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("notification_deliveries_unique").on(t.userId, t.kind, t.date)],
).enableRLS();

// ---------------------------------------------------------------------------
// inferred row types
// ---------------------------------------------------------------------------

export type User = typeof users.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type UserPreferencesRow = typeof userPreferences.$inferSelect;
export type NutritionTarget = typeof nutritionTargets.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type WeightEntry = typeof weightEntries.$inferSelect;
export type BodyCompositionEntry = typeof bodyCompositionEntries.$inferSelect;
export type BodyMeasurement = typeof bodyMeasurements.$inferSelect;
export type ProgressPhoto = typeof progressPhotos.$inferSelect;
export type Food = typeof foods.$inferSelect;
export type Recipe = typeof recipes.$inferSelect;
export type RecipeIngredient = typeof recipeIngredients.$inferSelect;
export type SavedMeal = typeof savedMeals.$inferSelect;
export type SavedMealItem = typeof savedMealItems.$inferSelect;
export type FoodEntry = typeof foodEntries.$inferSelect;
export type Exercise = typeof exercises.$inferSelect;
export type ExerciseSetting = typeof exerciseSettings.$inferSelect;
export type Program = typeof programs.$inferSelect;
export type ProgramDay = typeof programDays.$inferSelect;
export type ProgramExercise = typeof programExercises.$inferSelect;
export type Workout = typeof workouts.$inferSelect;
export type WorkoutExercise = typeof workoutExercises.$inferSelect;
export type ExerciseSet = typeof exerciseSets.$inferSelect;
export type PersonalRecord = typeof personalRecords.$inferSelect;
export type CardioSession = typeof cardioSessions.$inferSelect;
export type StepEntry = typeof stepEntries.$inferSelect;
export type WaterEntry = typeof waterEntries.$inferSelect;
export type SleepEntry = typeof sleepEntries.$inferSelect;
export type Supplement = typeof supplements.$inferSelect;
export type SupplementLog = typeof supplementLogs.$inferSelect;
export type Habit = typeof habits.$inferSelect;
export type HabitLog = typeof habitLogs.$inferSelect;
export type DailyNote = typeof dailyNotes.$inferSelect;
export type WeeklyReport = typeof weeklyReports.$inferSelect;
export type HealthMetricRow = typeof healthMetrics.$inferSelect;
export type ApiToken = typeof apiTokens.$inferSelect;
